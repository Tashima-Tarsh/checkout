"""Tenant-scoped Agentic Pay API."""
import csv
import hashlib
import io
import os
import re
import secrets
import time
from typing import Annotated, Literal

from cryptography.fernet import Fernet
from fastapi import APIRouter, Depends, Header, HTTPException, Request
from pydantic import BaseModel, Field, ValidationError, field_validator
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError

from checkout.agentic_login import require_session
from checkout.agentic_settle import get_settlement, public_settlement, _save_state
from checkout.agentic_storage import accounts, agent_sessions, audit, jobs, merchants, orders, amount_reservations, evidence_consumption, receipt_observations, settlement_states, shared_test_orders

router = APIRouter(prefix="/api")
Token = Annotated[str | None, Header(max_length=256)]
ORDER_ID = re.compile(r"[0-9a-f]{48}")
CHECKOUT_TTL_SECONDS = 120


def digest(value):
    return hashlib.sha256(value.encode()).hexdigest()


def bearer(authorization):
    scheme, _, token = (authorization or "").partition(" ")
    if scheme.lower() != "bearer" or not token or not token.isascii():
        raise HTTPException(401, "Bearer token required")
    return token


def require_owner(request: Request, authorization: Token = None):
    if authorization is None:
        require_session(request)
        return
    token = bearer(authorization)
    if not secrets.compare_digest(digest(token), request.app.state.owner_token_hash):
        raise HTTPException(401, "Invalid credentials")


def merchant_id(request: Request, authorization: Token = None):
    if authorization is None:
        identity = require_session(request).merchant_id
        with request.app.state.engine.connect() as conn:
            if conn.scalar(select(merchants.c.id).where(merchants.c.id == identity)) is None:
                raise HTTPException(401, "Merchant access unavailable")
        return identity
    token_hash = digest(bearer(authorization))
    with request.app.state.engine.connect() as conn:
        identity = conn.scalar(select(merchants.c.id).where(merchants.c.token_hash == token_hash))
    if identity is None:
        raise HTTPException(401, "Invalid credentials")
    return identity


Merchant = Annotated[str, Depends(merchant_id)]


class MerchantInput(BaseModel):
    name: str = Field(min_length=3, max_length=150)


class AccountInput(BaseModel):
    upi_id: str = Field(pattern=r"^[a-zA-Z0-9_.-]{2,256}@[a-zA-Z0-9_.-]{2,64}$")
    account_holder: str = Field(min_length=2, max_length=100)
    bank_name: str = Field(min_length=1, max_length=100)
    receiving_account_number: str = Field(pattern=r"^[0-9]{6,34}$")
    registered_mobile: str = Field(pattern=r"^[0-9]{10}$")
    account_type: Literal["PERSONAL", "MERCHANT"]
    mcc: str | None = Field(default=None, pattern=r"^[0-9]{4}$")

    @field_validator("mcc", mode="before")
    @classmethod
    def blank_mcc(cls, value):
        return value or None


class OrderInput(BaseModel):
    account_id: str = Field(pattern=r"^[0-9a-f]{32}$")
    amount_minor: int = Field(strict=True, ge=100, le=10000000)
    max_discount_minor: int = Field(default=0, strict=True, ge=0, le=99)
    shared_amount: bool = False


class DeviceEvidence(BaseModel):
    utr: str = Field(pattern=r"^[0-9]{12}$")
    amount_paise: int = Field(strict=True, ge=100, le=100000000)
    payee_vpa: str = Field(pattern=r"^[A-Za-z0-9_.-]{2,256}@[A-Za-z0-9_.-]{2,64}$")
    claimed_paid_at: int = Field(strict=True, ge=0)
    source: Literal["camera_ocr", "barcode", "sound", "color_pattern", "upi_intent_return"]



def now():
    return int(time.time())


def event(conn, identity, name):
    conn.execute(audit.insert().values(merchant_id=identity, event=name, created=now()))


@router.get("")
def api_root():
    return {"service": "Agentic Pay", "verification": "PENDING"}


@router.post("/owner/merchants", dependencies=[Depends(require_owner)], status_code=201)
def create_merchant(request: Request, item: MerchantInput):
    identity = secrets.token_hex(16)
    token = secrets.token_urlsafe(32)
    with request.app.state.engine.begin() as conn:
        conn.execute(merchants.insert().values(id=identity, name=item.name, token_hash=digest(token)))
        event(conn, identity, "MERCHANT_CREATED")
    return {"id": identity, "name": item.name, "token": token}


@router.get("/owner/merchants", dependencies=[Depends(require_owner)])
def list_merchants(request: Request):
    with request.app.state.engine.connect() as conn:
        return [dict(row) for row in conn.execute(select(merchants.c.id, merchants.c.name)).mappings()]


def register_accounts(request, identity, items):
    if not 1 <= len(items) <= 1000:
        raise HTTPException(422, "Expected 1 to 1,000 accounts")
    cipher = request.app.state.account_cipher
    rows = []
    sessions = []
    for item in items:
        account_id = secrets.token_hex(16)
        number = item.receiving_account_number
        rows.append(dict(
            id=account_id, merchant_id=identity, vpa=item.upi_id.lower(),
            bank=item.bank_name, holder=item.account_holder, last4=number[-4:],
            account_cipher=cipher.encrypt(number.encode()).decode(),
            mobile_cipher=cipher.encrypt(item.registered_mobile.encode()).decode(),
            account_type=item.account_type, mcc=item.mcc,
        ))
        sessions.append(dict(
            account_id=account_id, agent_id=secrets.token_hex(16), state="AUTH_REQUIRED", expires=0,
        ))
    try:
        with request.app.state.engine.begin() as conn:
            conn.execute(select(merchants.c.id).where(merchants.c.id == identity).with_for_update())
            current = conn.scalar(select(func.count()).select_from(accounts).where(accounts.c.merchant_id == identity))
            if current + len(rows) > 1000:
                raise HTTPException(409, "Merchant account limit exceeded")
            conn.execute(accounts.insert(), rows)
            conn.execute(agent_sessions.insert(), sessions)
            event(conn, identity, "ACCOUNTS_REGISTERED")
    except IntegrityError:
        raise HTTPException(409, "Account could not be registered") from None
    return {"registered": len(rows)}


@router.post("/accounts", status_code=201)
def register(request: Request, identity: Merchant, items: Annotated[list[AccountInput], Field(min_length=1, max_length=1000)]):
    return register_accounts(request, identity, items)


@router.post("/accounts/import", status_code=201)
async def import_accounts(request: Request, identity: Merchant):
    payload = bytearray()
    async for chunk in request.stream():
        if len(payload) + len(chunk) > 512 * 1024:
            raise HTTPException(413, "CSV is limited to 512 KB")
        payload.extend(chunk)
    try:
        reader = csv.DictReader(io.StringIO(payload.decode("utf-8-sig")), strict=True)
        fields = set(AccountInput.model_fields)
        if len(reader.fieldnames or []) != len(fields) or set(reader.fieldnames or []) != fields:
            raise ValueError
        items = []
        for row in reader:
            if len(items) == 1000 or None in row or None in row.values():
                raise ValueError
            items.append(AccountInput.model_validate(row))
    except (UnicodeError, ValueError, csv.Error, ValidationError):
        raise HTTPException(422, "Invalid account CSV") from None
    from starlette.concurrency import run_in_threadpool
    return await run_in_threadpool(register_accounts, request, identity, items)


@router.get("/accounts")
@router.get("/agents")
def inventory(request: Request, identity: Merchant):
    query = select(
        accounts.c.id, accounts.c.vpa, accounts.c.holder, accounts.c.bank, accounts.c.last4,
        agent_sessions.c.agent_id, agent_sessions.c.state, agent_sessions.c.expires,
    ).join(agent_sessions).where(accounts.c.merchant_id == identity)
    with request.app.state.engine.connect() as conn:
        return [
            dict(row, state="AUTH_REQUIRED" if row["expires"] <= now() else row["state"])
            for row in conn.execute(query).mappings()
        ]


def unused_payable(conn, account, lower, upper, *, ascending=False):
    """Caller holds the receiving-account row lock; never recycle amounts."""
    used = set(conn.scalars(select(amount_reservations.c.payable_minor).where(
        amount_reservations.c.account_id == account,
        amount_reservations.c.payable_minor.between(lower, upper))))
    used.update(conn.scalars(select(orders.c.amount_minor).where(
        orders.c.account_id == account,
        orders.c.amount_minor.between(lower, upper),
        ~select(amount_reservations.c.order_id).where(
            amount_reservations.c.order_id == orders.c.id).exists())))
    candidates = range(lower, upper + 1) if ascending else range(upper, lower - 1, -1)
    return next((value for value in candidates if value not in used), None)


@router.post("/orders", status_code=201)
def create_order(request: Request, identity: Merchant, item: OrderInput):
    if item.shared_amount and (item.amount_minor % 100 or item.max_discount_minor):
        raise HTTPException(422, 'Shared amount requires whole rupees and no discount')
    order_id = secrets.token_hex(24)
    created = now()
    with request.app.state.engine.begin() as conn:
        account = conn.scalar(select(accounts.c.id).where(
            accounts.c.id == item.account_id, accounts.c.merchant_id == identity,
        ).with_for_update())
        if account is None:
            raise HTTPException(404, "Account not found")
        lower = max(100, item.amount_minor - item.max_discount_minor)
        payable = item.amount_minor if item.shared_amount else unused_payable(conn, account, lower, item.amount_minor)
        if payable is None:
            raise HTTPException(409, "Payment amount pool exhausted; no safe unused amount")
        conn.execute(orders.insert().values(
            id=order_id, merchant_id=identity, account_id=account, amount_minor=item.amount_minor,
            created=created, expires=created + CHECKOUT_TTL_SECONDS, status="AWAITING_PAYMENT",
        ))
        if item.shared_amount:
            # Repeated amounts lack independent order-to-payment binding. Keep observational only.
            conn.execute(shared_test_orders.insert().values(order_id=order_id))
        else:
            conn.execute(amount_reservations.insert().values(order_id=order_id, account_id=account, payable_minor=payable))
        event(conn, identity, "ORDER_CREATED")
    result = {"id": order_id, "checkout_path": f"/checkout/{order_id}", "payable_minor": payable, "discount_minor": item.amount_minor-payable}
    if item.shared_amount:
        result.update(session_reference=order_id, expires=created+CHECKOUT_TTL_SECONDS)
    return result


@router.get("/orders")
def list_orders(request: Request, identity: Merchant):
    query = select(
        orders.c.id, orders.c.amount_minor, orders.c.created, orders.c.expires, orders.c.status,
        amount_reservations.c.payable_minor,
        settlement_states.c.state.label("settlement_state"),
        settlement_states.c.observed_minor,
        evidence_consumption.c.order_id.label("consumed_order_id"),
        shared_test_orders.c.order_id.label("shared_order_id"),
    ).outerjoin(amount_reservations, amount_reservations.c.order_id == orders.c.id
    ).outerjoin(settlement_states, settlement_states.c.order_id == orders.c.id
    ).outerjoin(evidence_consumption, evidence_consumption.c.order_id == orders.c.id
    ).outerjoin(shared_test_orders, shared_test_orders.c.order_id == orders.c.id
    ).where(orders.c.merchant_id == identity).order_by(orders.c.created.desc()).limit(100)
    with request.app.state.engine.connect() as conn:
        results = []
        for row in conn.execute(query).mappings():
            result = dict(row)
            for key in ("payable_minor", "settlement_state", "observed_minor", "consumed_order_id", "shared_order_id"):
                result.pop(key, None)
            current = dict(row, payable_minor=row["payable_minor"] or row["amount_minor"])
            observation = (dict(state=row["settlement_state"], observed_minor=row["observed_minor"])
                           if row["settlement_state"] else None)
            result["settlement"] = public_settlement(
                current, observation, consumed=row["consumed_order_id"] is not None,
            )
            if row["shared_order_id"] is not None:
                result["settlement"] = {"satisfied": False, "state": "ORDER_NOT_ELIGIBLE", "reason": "Awaiting independently correlated payment evidence."}
            results.append(result)
        return results


def checkout_order(conn, order_id, lock=False):
    if not ORDER_ID.fullmatch(order_id):
        raise HTTPException(404, "Order not found")
    query = select(orders).where(orders.c.id == order_id)
    row = conn.execute(query.with_for_update() if lock else query).mappings().first()
    if row is None:
        raise HTTPException(404, "Order not found")
    return row


def require_open_checkout(order):
    # Expire the public payment capability, not the accounting record.
    if order["expires"] <= now():
        raise HTTPException(410, "Checkout expired")
    if order["status"] not in {"AWAITING_PAYMENT", "PENDING"}:
        raise HTTPException(410, "Checkout closed")


@router.get("/checkout/{order_id}")
def checkout_info(request: Request, order_id: str):
    with request.app.state.engine.connect() as conn:
        order = checkout_order(conn, order_id)
        consumed = conn.scalar(select(evidence_consumption.c.order_id).where(
            evidence_consumption.c.order_id == order_id)) is not None
        # A live-verified order remains readable after expiry so reloads keep
        # the green tick. A manually altered PAID row without evidence stays closed.
        if order["status"] != "PAID" or not consumed:
            require_open_checkout(order)
        vpa = conn.scalar(select(accounts.c.vpa).where(
            accounts.c.id == order["account_id"], accounts.c.merchant_id == order["merchant_id"],
        ))
        payable = conn.scalar(select(amount_reservations.c.payable_minor).where(
            amount_reservations.c.order_id == order_id,
            amount_reservations.c.account_id == order["account_id"]))
        result = {"id": order["id"], "amount_minor": payable if payable is not None else order["amount_minor"],
                "original_minor": order["amount_minor"],
                "discount_minor": order["amount_minor"]-payable if payable is not None else 0,
                "expires": order["expires"], "upi_id": vpa, "status": order["status"]}
        current = dict(order, payable_minor=result["amount_minor"], upi_id=vpa)
        result["settlement"] = get_settlement(conn, current)
        result["live_verification"] = {"enabled": True, "time_bound": True, "media_retained": False}
        if conn.scalar(select(shared_test_orders.c.order_id).where(shared_test_orders.c.order_id == order_id)):
            result["shared_amount"] = True
            result["session_reference"] = order_id
            result["settlement"] = {"satisfied": False, "state": "ORDER_NOT_ELIGIBLE", "reason": "Awaiting independently correlated payment evidence."}
        observation = conn.execute(select(receipt_observations.c.decision).where(
            receipt_observations.c.order_id == order_id,
            receipt_observations.c.expires > now())).scalar_one_or_none()
        if observation == "VISUAL_SUCCESS":
            result["receipt_observation"] = {"order_id": order_id, "decision": observation,
                "advance_research": True, "financially_verified": False, "checkout_changed": False}
        return result


@router.post("/checkout/{order_id}/verify", status_code=202)
def verify(request: Request, order_id: str):
    with request.app.state.engine.begin() as conn:
        order = checkout_order(conn, order_id, lock=True)
        require_open_checkout(order)
        if order["status"] == "AWAITING_PAYMENT":
            conn.execute(jobs.insert().values(order_id=order_id, created=now()))
            conn.execute(orders.update().where(orders.c.id == order_id).values(status="PENDING"))
            event(conn, order["merchant_id"], "VERIFICATION_REQUESTED")
    return {"status": "PENDING", "financially_verified": False}


@router.post("/checkout/{order_id}/device-evidence")
def device_evidence(order_id: str, b: DeviceEvidence, request: Request):
    """Device reports UPI payment evidence; server matches VPA+amount before settling."""
    with request.app.state.engine.begin() as connection:
        order = checkout_order(connection, order_id, lock=True)
        require_open_checkout(order)
        now = int(time.time())

        # Get payee VPA and payable amount from the order's account
        row = connection.execute(
            select(accounts.c.vpa, amount_reservations.c.payable_minor)
            .join(amount_reservations, (amount_reservations.c.order_id == orders.c.id)
                  & (amount_reservations.c.account_id == orders.c.account_id))
            .join(accounts, (accounts.c.id == orders.c.account_id)
                  & (accounts.c.merchant_id == orders.c.merchant_id))
            .where(orders.c.id == order_id)
        ).mappings().first()

        if row is None:
            raise HTTPException(404, "Order not found")

        # Server-side match: VPA + amount must match the order row the server knows
        vpa_match = b.payee_vpa.lower() == row["vpa"].lower()
        amount_match = b.amount_paise == row["payable_minor"]

        if vpa_match and amount_match:
            # Settle: mark order PAID, evidence consumed, settlement SETTLED
            connection.execute(
                orders.update().where(
                    orders.c.id == order_id,
                    orders.c.status.in_(("AWAITING_PAYMENT", "PENDING")),
                ).values(status="PAID")
            )
            connection.execute(
                evidence_consumption.insert().values(
                    reference_namespace="upi",
                    reference_digest=hashlib.sha256(b.utr.encode()).hexdigest(),
                    order_id=order_id,
                    created=now,
                )
            )
            _save_state(connection, order_id, "SETTLED", b.amount_paise, now)
            connection.execute(audit.insert().values(
                merchant_id=order["merchant_id"], event="PAYMENT_SETTLED", created=now,
            ))
            verified = True
        else:
            # Reject: wrong payee or wrong amount
            state = "WRONG_PAYEE" if not vpa_match else "WRONG_AMOUNT"
            _save_state(connection, order_id, state,
                       b.amount_paise if amount_match else None, now)
            connection.execute(audit.insert().values(
                merchant_id=order["merchant_id"], event="DEVICE_EVIDENCE_REJECTED", created=now,
            ))
            verified = False

        return {"status": "PAID" if verified else "REJECTED",
                "financially_verified": verified}
