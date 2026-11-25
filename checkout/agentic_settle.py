"""Time-bound live-evidence settlement. This policy is the only writer of PAID."""
import re
from decimal import Decimal
from typing import Mapping

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert

from checkout.agentic_replay import reserve_reference
from checkout.agentic_storage import (
    accounts,
    amount_reservations,
    audit,
    evidence_consumption,
    orders,
    settlement_states,
)

OPEN = {"AWAITING_PAYMENT", "PENDING"}
RESERVED = {"RESERVED_ONLY", "ALREADY_RESERVED"}
REFERENCE = re.compile(r"[0-9]{12}")


def verdict(order, observation, *, baseline, now):
    """SETTLED | WRONG_AMOUNT | WRONG_PAYEE | NOT_YET | INVALID_REFERENCE."""
    if not isinstance(observation, Mapping):
        return "NOT_YET"
    observed_at = observation.get("observed_at")
    if (
        observation.get("order_id") != order["id"]
        or observation.get("challenge_verified") is not True
        or type(observed_at) is not int
        or not order["created"] <= observed_at <= now < order["expires"]
        or observation.get("success") is not True
    ):
        return "NOT_YET"
    payee = observation.get("payee")
    if not isinstance(payee, str) or not payee:
        return "NOT_YET"
    if payee.casefold() != order["vpa"].casefold():
        return "WRONG_PAYEE"
    amount = observation.get("amount_minor")
    if type(amount) is not int:
        return "AMOUNT_UNCONFIRMED"
    if amount != order["payable_minor"]:
        return "WRONG_AMOUNT"
    reference = observation.get("reference")
    if not isinstance(reference, str) or not REFERENCE.fullmatch(reference):
        return "INVALID_REFERENCE"
    if reference in baseline:
        return "REPLAY_OR_ORDER_CONFLICT"
    return "SETTLED"


def _current_order(conn, order_id):
    return conn.execute(
        select(orders, amount_reservations.c.payable_minor, accounts.c.vpa)
        .join(amount_reservations, (amount_reservations.c.order_id == orders.c.id)
              & (amount_reservations.c.account_id == orders.c.account_id))
        .join(accounts, (accounts.c.id == orders.c.account_id)
              & (accounts.c.merchant_id == orders.c.merchant_id))
        .where(orders.c.id == order_id)
        .with_for_update()
    ).mappings().first()


def _save_state(conn, order_id, state, observed_minor, now):
    previous = conn.execute(
        select(settlement_states.c.state, settlement_states.c.observed_minor)
        .where(settlement_states.c.order_id == order_id)
    ).first()
    if previous and previous.state == state and previous.observed_minor == observed_minor:
        return
    values = dict(order_id=order_id, state=state, observed_minor=observed_minor, updated=now)
    if conn.dialect.name == "postgresql":
        insert = pg_insert
    elif conn.dialect.name == "sqlite":
        insert = sqlite_insert
    else:
        raise RuntimeError("Unsupported ledger database")
    conn.execute(insert(settlement_states).values(**values).on_conflict_do_update(
        index_elements=[settlement_states.c.order_id],
        set_=dict(state=state, observed_minor=observed_minor, updated=now),
    ))


def attempt_settle(conn, order, observation, *, baseline=frozenset(), now):
    """Consume one server-observed live result, or leave the order unverified.

    The caller owns the transaction and validates the short-lived challenge.
    Every PAID write follows the atomic global reference reservation.
    """
    current = _current_order(conn, order["id"])
    if current is None:
        return "ORDER_NOT_ELIGIBLE"
    consumed = conn.scalar(select(evidence_consumption.c.order_id).where(
        evidence_consumption.c.order_id == current["id"])) is not None
    if current["status"] == "PAID":
        return "SETTLED" if consumed else "ORDER_NOT_ELIGIBLE"
    if current["status"] not in OPEN or not current["created"] <= now < current["expires"]:
        return "ORDER_NOT_ELIGIBLE"

    state = verdict(current, observation, baseline=baseline, now=now)
    if state != "SETTLED":
        amount = observation.get("amount_minor") if isinstance(observation, Mapping) else None
        _save_state(conn, current["id"], state, amount if type(amount) is int else None, now)
        return state

    reserved = reserve_reference(
        conn,
        order_id=current["id"],
        merchant_id=current["merchant_id"],
        account_id=current["account_id"],
        reference=observation["reference"],
        now=now,
    )
    if reserved not in RESERVED:
        _save_state(conn, current["id"], reserved, None, now)
        return reserved

    updated = conn.execute(orders.update().where(
        orders.c.id == current["id"], orders.c.status.in_(OPEN),
    ).values(status="PAID"))
    if updated.rowcount != 1:
        raise RuntimeError("Order changed during atomic settlement")
    _save_state(conn, current["id"], "SETTLED", None, now)
    conn.execute(audit.insert().values(
        merchant_id=current["merchant_id"], event="PAYMENT_SETTLED", created=now,
    ))
    return "SETTLED"


def money(amount_minor):
    return "₹" + format(Decimal(amount_minor) / 100, ".2f")


def reason_for(order, state, *, observed_minor=None, seen=None):
    """Explain the current result without exposing raw payee or reference text."""
    expected = money(order["payable_minor"])
    seen = seen or {}
    seen_amount = seen.get("amount_minor")
    if state == "SETTLED":
        return "Verified payment."
    if state == "WRONG_PAYEE":
        return "A different receiving UPI ID was observed. Pay the exact UPI ID shown."
    if state == "WRONG_AMOUNT":
        amount = observed_minor if observed_minor is not None else seen_amount
        if amount is not None:
            return f"{money(amount)} observed — this order needs {expected}."
        return f"Wrong amount. This order needs {expected}."
    if state == "AMOUNT_UNCONFIRMED":
        return "The payment amount could not be read clearly."
    if state == "INVALID_REFERENCE":
        return "A fresh valid transaction reference was not visible."
    if state == "AMBIGUOUS":
        return "Multiple matching payments were observed. Verification needs review."
    if state == "NOT_YET":
        if seen.get("payee_ok") is False:
            return "A different receiving UPI ID was observed. Pay the exact UPI ID shown."
        if seen_amount is not None and seen_amount != order["payable_minor"]:
            return f"{money(seen_amount)} observed — this order needs {expected}."
        if seen.get("payee_ok") is True and seen_amount == order["payable_minor"]:
            return "Right amount to the right payee. Waiting for the live payment result."
        return "No matching live payment found."
    if state == "REPLAY_OR_ORDER_CONFLICT":
        return "This payment reference has already been used."
    if state == "SENSITIVE_CONTENT_REJECTED":
        return "Hide PIN, OTP, balances and account details, then retry live verification."
    if state == "CHALLENGE_EXPIRED":
        return "Live verification expired. Restart it."
    if state in {"ORDER_NOT_ELIGIBLE", "SCOPE_MISMATCH"}:
        return "This checkout is not eligible for verification."
    if state == "VERIFICATION_UNAVAILABLE":
        return "Live verification is temporarily unavailable. Please retry."
    return "Payment is not verified."


def public_settlement(order, observation=None, *, consumed=False, seen=None):
    """Serialize the same minimized state for checkout and merchant consumers."""
    if order["status"] == "PAID" and consumed:
        state = "SETTLED"
    elif order["status"] == "PAID":
        state = "ORDER_NOT_ELIGIBLE"
    else:
        state = observation["state"] if observation is not None else "NOT_YET"
    observed_minor = observation["observed_minor"] if observation is not None else None
    return {
        "satisfied": state == "SETTLED" and order["status"] == "PAID" and consumed,
        "state": state,
        "reason": reason_for(order, state, observed_minor=observed_minor, seen=seen),
    }


def get_settlement(conn, order, *, seen=None):
    observation = conn.execute(select(settlement_states).where(
        settlement_states.c.order_id == order["id"],
    )).mappings().first()
    consumed = conn.scalar(select(evidence_consumption.c.order_id).where(
        evidence_consumption.c.order_id == order["id"],
    )) is not None
    return public_settlement(order, observation, consumed=consumed, seen=seen)
