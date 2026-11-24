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
from checkout.agentic_storage import accounts, agent_sessions, audit, jobs, merchants, orders, amount_reservations, receipt_observations

router = APIRouter(prefix="/api")
Token = Annotated[str | None, Header(max_length=256)]
ORDER_ID = re.compile(r"[0-9a-f]{48}")


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
    order_id = secrets.token_hex(24)
    created = now()
    with request.app.state.engine.begin() as conn:
        account = conn.scalar(select(accounts.c.id).where(
            accounts.c.id == item.account_id, accounts.c.merchant_id == identity,
        ).with_for_update())
        if account is None:
            raise HTTPException(404, "Account not found")
        lower = max(100, item.amount_minor - item.max_discount_minor)
        payable = unused_payable(conn, account, lower, item.amount_minor)
        if payable is None:
            raise HTTPException(409, "Payment amount pool exhausted; no safe unused amount")
        conn.execute(orders.insert().values(
            id=order_id, merchant_id=identity, account_id=account, amount_minor=item.amount_minor,
            created=created, expires=created + 1800, status="AWAITING_PAYMENT",
        ))
        conn.execute(amount_reservations.insert().values(order_id=order_id, account_id=account, payable_minor=payable))
        event(conn, identity, "ORDER_CREATED")
    return {"id": order_id, "checkout_path": f"/checkout/{order_id}", "payable_minor": payable, "discount_minor": item.amount_minor-payable}


@router.get("/orders")
def list_orders(request: Request, identity: Merchant):
    query = select(
        orders.c.id, orders.c.amount_minor, orders.c.created, orders.c.expires, orders.c.status,
    ).where(orders.c.merchant_id == identity).order_by(orders.c.created.desc()).limit(100)
    with request.app.state.engine.connect() as conn:
        return [dict(row) for row in conn.execute(query).mappings()]


def checkout_order(conn, order_id, lock=False):
    if not ORDER_ID.fullmatch(order_id):
        raise HTTPException(404, "Order not found")
    query = select(orders).where(orders.c.id == order_id)
    row = conn.execute(query.with_for_update() if lock else query).mappings().first()
    if row is None:
        raise HTTPException(404, "Order not found")
    return row


def require_readable_checkout(order):
    if order["expires"] <= now():
        raise HTTPException(410, "Checkout expired")


def require_open_checkout(order):
    # Expire the public payment capability, not the accounting record.
    require_readable_checkout(order)
    if order["status"] not in {"AWAITING_PAYMENT", "PENDING"}:
        raise HTTPException(410, "Checkout closed")


@router.get("/checkout/{order_id}")
def checkout_info(request: Request, order_id: str):
    with request.app.state.engine.connect() as conn:
        order = checkout_order(conn, order_id)
        require_readable_checkout(order)
        payment_open = order["status"] in {"AWAITING_PAYMENT", "PENDING"}
        vpa = conn.scalar(select(accounts.c.vpa).where(
            accounts.c.id == order["account_id"], accounts.c.merchant_id == order["merchant_id"],
        ))
        payable = conn.scalar(select(amount_reservations.c.payable_minor).where(
            amount_reservations.c.order_id == order_id,
            amount_reservations.c.account_id == order["account_id"]))
        result = {"amount_minor": payable if payable is not None else order["amount_minor"],
                "original_minor": order["amount_minor"],
                "discount_minor": order["amount_minor"]-payable if payable is not None else 0,
                "expires": order["expires"], "upi_id": vpa if payment_open else None,
                 "status": order["status"]}
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
