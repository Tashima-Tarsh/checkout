import hashlib

import pytest
from sqlalchemy import create_engine, select

from checkout.agentic_settle import attempt_settle, verdict
from checkout.agentic_storage import (
    accounts,
    amount_reservations,
    evidence_consumption,
    merchants,
    metadata,
    orders,
    settlement_states,
    shared_test_orders,
)


@pytest.fixture
def ledger(tmp_path):
    engine = create_engine("sqlite:///" + str(tmp_path / "settle.db"))
    metadata.create_all(engine)
    merchant, account = "a" * 32, "b" * 32
    ids = ["c" * 48, "d" * 48]
    with engine.begin() as conn:
        conn.execute(merchants.insert().values(id=merchant, name="fixture", token_hash="x" * 64))
        conn.execute(accounts.insert().values(
            id=account, merchant_id=merchant, vpa="merchant@example", bank="fixture",
            holder="fixture", account_cipher="fixture", mobile_cipher="fixture",
            last4="0000", account_type="PERSONAL",
        ))
        for oid, payable in zip(ids, (10037, 10038)):
            conn.execute(orders.insert().values(
                id=oid, merchant_id=merchant, account_id=account, amount_minor=payable,
                created=100, expires=200, status="AWAITING_PAYMENT",
            ))
            conn.execute(amount_reservations.insert().values(
                order_id=oid, account_id=account, payable_minor=payable,
            ))
    yield engine, ids[0], ids[1]
    engine.dispose()


def order(oid="c" * 48, **changes):
    return dict(id=oid, merchant_id="a" * 32, account_id="b" * 32,
                vpa="merchant@example", payable_minor=10037,
                created=100, expires=200, **changes)


def observation(**changes):
    return dict(order_id="c" * 48, challenge_verified=True, success=True,
                amount_minor=10037, payee="merchant@example",
                reference="123456789012", observed_at=125) | changes


def test_verdict_requires_fresh_exact_live_evidence():
    assert verdict(order(), observation(), baseline=set(), now=150) == "SETTLED"
    assert verdict(order(), observation(payee="other@example"), baseline=set(), now=150) == "WRONG_PAYEE"
    assert verdict(order(), observation(amount_minor=20000), baseline=set(), now=150) == "WRONG_AMOUNT"
    assert verdict(order(), observation(amount_minor=None), baseline=set(), now=150) == "AMOUNT_UNCONFIRMED"
    assert verdict(order(), observation(reference=None), baseline=set(), now=150) == "INVALID_REFERENCE"


@pytest.mark.parametrize("changes", [
    {"challenge_verified": False},
    {"challenge_verified": None},
    {"success": False},
    {"success": None},
    {"payee": None},
    {"observed_at": 99},
    {"observed_at": 151},
    {"observed_at": True},
    {"order_id": "other"},
])
def test_verdict_rejects_missing_unfresh_or_unbound_evidence(changes):
    assert verdict(order(), observation(**changes), baseline=set(), now=150) == "NOT_YET"


def test_expired_session_and_baseline_reference_cannot_settle():
    assert verdict(order(), observation(), baseline=set(), now=200) == "NOT_YET"
    assert verdict(order(), observation(), baseline={"123456789012"}, now=150) == "REPLAY_OR_ORDER_CONFLICT"


def test_exact_live_evidence_atomically_marks_paid_and_is_idempotent(ledger):
    engine, oid, _ = ledger
    with engine.begin() as conn:
        assert attempt_settle(conn, {"id": oid}, observation(), now=150) == "SETTLED"
    with engine.connect() as conn:
        assert conn.scalar(select(orders.c.status).where(orders.c.id == oid)) == "PAID"
        assert conn.scalar(select(evidence_consumption.c.order_id)) == oid
        assert conn.scalar(select(evidence_consumption.c.reference_digest)) == hashlib.sha256(b"123456789012").hexdigest()
        assert conn.execute(select(settlement_states)).mappings().one()["state"] == "SETTLED"
    with engine.begin() as conn:
        assert attempt_settle(conn, {"id": oid}, {}, now=150) == "SETTLED"


def test_reference_replay_can_never_settle_second_order(ledger):
    engine, first, second = ledger
    with engine.begin() as conn:
        assert attempt_settle(conn, {"id": first}, observation(), now=150) == "SETTLED"
        state = attempt_settle(conn, {"id": second}, observation(
            order_id=second, amount_minor=10038,
        ), now=150)
        assert state == "REPLAY_OR_ORDER_CONFLICT"
    with engine.connect() as conn:
        assert conn.scalar(select(orders.c.status).where(orders.c.id == second)) == "AWAITING_PAYMENT"
        assert conn.scalar(select(settlement_states.c.state).where(
            settlement_states.c.order_id == second)) == "REPLAY_OR_ORDER_CONFLICT"


def test_red_is_not_terminal_and_later_exact_live_result_settles(ledger):
    engine, oid, _ = ledger
    with engine.begin() as conn:
        assert attempt_settle(conn, {"id": oid}, observation(amount_minor=15000), now=150) == "WRONG_AMOUNT"
        assert conn.scalar(select(orders.c.status).where(orders.c.id == oid)) == "AWAITING_PAYMENT"
        assert attempt_settle(conn, {"id": oid}, observation(reference="123456789099"), now=151) == "SETTLED"


def test_expired_order_does_not_write_paid(ledger):
    engine, oid, _ = ledger
    with engine.begin() as conn:
        assert attempt_settle(conn, {"id": oid}, observation(), now=200) == "ORDER_NOT_ELIGIBLE"
    with engine.connect() as conn:
        assert conn.scalar(select(orders.c.status).where(orders.c.id == oid)) == "AWAITING_PAYMENT"
        assert conn.scalar(select(evidence_consumption.c.order_id)) is None


def test_shared_amount_uat_order_cannot_consume_live_evidence(ledger):
    engine, _, second = ledger
    with engine.begin() as conn:
        conn.execute(shared_test_orders.insert().values(order_id=second))
        state = attempt_settle(conn, {"id": second}, observation(
            order_id=second, amount_minor=10038,
        ), now=150)
        assert state == "ORDER_NOT_ELIGIBLE"
        assert conn.scalar(select(orders.c.status).where(orders.c.id == second)) == "AWAITING_PAYMENT"
