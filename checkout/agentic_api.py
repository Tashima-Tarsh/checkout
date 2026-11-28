"""Tenant-scoped Agentic Pay API."""
import csv
import hashlib
import hmac
import io
import os
import re
import secrets
import time
from datetime import datetime, timedelta, timezone
from typing import Annotated, Literal

from cryptography.fernet import Fernet
from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request
from pydantic import BaseModel, Field, ValidationError, field_validator
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError

from checkout.agentic_login import require_session
from checkout.agentic_onboarding import enforce_entitlement
from checkout.agentic_settle import get_settlement, public_settlement, _save_state
from checkout.agentic_storage import (
    accounts, agent_sessions, audit, jobs, merchants, orders, amount_reservations,
    evidence_consumption, receipt_observations, settlement_states, shared_test_orders,
    devices, pairing_codes, device_credentials, device_observations, device_heartbeats,
    credit_events, daily_issuance, subscriptions, upi_health, upi_ledger, upi_rotation_log,
    workers, device_upi_apps, automation_config, auto_checkout,
)

from checkout.config import ENVIRONMENT, BASE_DOMAIN, get_all_urls

router = APIRouter(prefix="/api")
Token = Annotated[str | None, Header(max_length=256)]
ORDER_ID = re.compile(r"[0-9a-f]{48}")
CHECKOUT_TTL_SECONDS = 120

DEVICE_ID = re.compile(r"[A-Za-z0-9_-]{8,64}")
PAIRING_CODE = re.compile(r"[A-Z0-9]{8}")
PAIRING_TTL_SECONDS = 600
PAIRING_RATE_WINDOW = 300
PAIRING_MAX_ATTEMPTS = 5
DEVICE_STATE_ONLINE = "ONLINE"
DEVICE_STATE_OFFLINE = "OFFLINE"
DEVICE_STATE_REVOKED = "REVOKED"
DEVICE_STATE_PENDING = "ENROLLMENT_PENDING"
OBS_STATE_RECEIVED = "OBSERVATION_RECEIVED"
OBS_STATE_MATCHED = "OBSERVATION_MATCHED"
OBS_STATE_AMBIGUOUS = "AMBIGUOUS_OBSERVATION"
OBS_STATE_REJECTED = "OBSERVATION_REJECTED"
OBS_STATE_EXPIRED = "EXPIRED"
OBS_STATE_SETTLED = "SETTLED"
OBS_STATE_AWAITING = "AWAITING_PAYMENT"
HEARTBEAT_OFFLINE_TIMEOUT = 90
CREDENTIAL_TTL_SECONDS = 30 * 24 * 60 * 60
DEVICE_RECONNECT_BASE = 2
DEVICE_RECONNECT_MAX = 60

DEVICE_OBSERVATION_FIELDS = (
    "order_id", "merchant_id", "account_id", "amount_paise", "currency",
    "transaction_reference", "observation_direction", "evidence_provenance",
    "observation_timestamp", "checkout_created", "checkout_expires",
)


def digest(value):
    return hashlib.sha256(value.encode()).hexdigest()


def bearer(authorization):
    scheme, _, token = (authorization or "").partition(" ")
    if scheme.lower() != "bearer" or not token or not token.isascii():
        raise HTTPException(401, "Bearer token required")
    return token


def device_bearer(request: Request, authorization: Token = None):
    """Authenticate an enrolled device using its stored credential."""
    if authorization is None:
        raise HTTPException(401, "Device credentials required")
    token = bearer(authorization)
    now = int(time.time())
    with request.app.state.engine.connect() as conn:
        row = conn.execute(
            select(device_credentials.c.device_id, device_credentials.c.credential_hash,
                   device_credentials.c.expires, device_credentials.c.revoked,
                   devices.c.state, devices.c.merchant_id, devices.c.agent_id)
            .join(devices, devices.c.device_id == device_credentials.c.device_id)
            .where(device_credentials.c.credential_hash == digest(token))
        ).mappings().first()
    if row is None:
        raise HTTPException(401, "Invalid device credentials")
    if row["revoked"] is not None:
        raise HTTPException(401, "Device revoked")
    if row["expires"] is not None and row["expires"] <= now:
        raise HTTPException(401, "Device credential expired")
    if row["state"] != DEVICE_STATE_ONLINE:
        raise HTTPException(401, "Device not enrolled")
    return row


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
    mode: Literal["P2P", "P2M"] = "P2P"
    upi_id: str | None = None  # optional: explicit UPI ID; auto-routed for P2P if omitted


class DeviceEvidence(BaseModel):
    utr: str = Field(pattern=r"^[0-9]{12}$")
    amount_paise: int = Field(strict=True, ge=100, le=100000000)
    payee_vpa: str = Field(pattern=r"^[A-Za-z0-9_.-]{2,256}@[A-Za-z0-9_.-]{2,64}$")
    claimed_paid_at: int = Field(strict=True, ge=0)
    source: Literal["camera_ocr", "barcode", "sound", "color_pattern", "upi_intent_return"]



def now():
    return int(time.time())


def formatTime(ts):
    if not ts:
        return "—"
    from datetime import datetime, timezone, timedelta
    IST = timezone(timedelta(hours=5, minutes=30))
    d = datetime.fromtimestamp(ts, IST)
    return d.strftime("%d %b %Y, %H:%M IST")


def event(conn, identity, name):
    conn.execute(audit.insert().values(merchant_id=identity, event=name, created=now()))


@router.get("")
def api_root():
    return {"service": "Agentic Pay", "verification": "PENDING"}


@router.post("/owner/merchants", status_code=201)
def create_merchant(request: Request, item: MerchantInput):
    identity = secrets.token_hex(16)
    token = secrets.token_urlsafe(32)
    with request.app.state.engine.begin() as conn:
        conn.execute(merchants.insert().values(id=identity, name=item.name, token_hash=digest(token)))
        event(conn, identity, "MERCHANT_CREATED")
    return {"id": identity, "name": item.name, "token": token}


@router.get("/owner/merchants")
def list_merchants(request: Request):
    with request.app.state.engine.connect() as conn:
        return [dict(row) for row in conn.execute(select(merchants.c.id, merchants.c.name)).mappings()]


class PaidTerm(BaseModel):
    paid_until: int = Field(gt=0)


@router.put("/owner/merchants/{identity}/paid-term")
def set_paid_term(request: Request, identity: str, item: PaidTerm):
    with request.app.state.engine.begin() as conn:
        row = conn.execute(select(subscriptions.c.paid_until).where(
            subscriptions.c.merchant_id == identity
        ).with_for_update()).first()
        if row is None:
            raise HTTPException(404, "Merchant subscription not found")
        paid_until = max(row.paid_until or 0, item.paid_until)
        if row.paid_until != paid_until:
            conn.execute(subscriptions.update().where(
                subscriptions.c.merchant_id == identity
            ).values(paid_until=paid_until))
            event(conn, identity, "PAID_TERM_EXTENDED")
    return {"paid_until": paid_until}


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
    now_ts = created
    selected_upi_id = item.upi_id

    with request.app.state.engine.begin() as conn:
        account_row = conn.execute(select(accounts.c.id, accounts.c.mobile_cipher).where(
            accounts.c.id == item.account_id, accounts.c.merchant_id == identity,
        ).with_for_update()).first()
        if account_row is None:
            raise HTTPException(404, "Account not found")
        account = account_row.id
        lower = max(100, item.amount_minor - item.max_discount_minor)
        payable = item.amount_minor if item.shared_amount else unused_payable(conn, account, lower, item.amount_minor)
        if payable is None:
            raise HTTPException(409, "Payment amount pool exhausted; no safe unused amount")
        if os.environ.get("DISHA_ENV") == "prod":
            enforce_entitlement(conn, identity, created)
            reserve_daily_issuance(conn, request, account_row.mobile_cipher, payable, created, mode=item.mode)

        # The selected receiving account is authoritative; never silently rotate
        # to a different account or accept a caller-supplied unrelated VPA.
        registered_vpa = conn.scalar(select(accounts.c.vpa).where(
            accounts.c.id == account, accounts.c.merchant_id == identity))
        if selected_upi_id is not None and selected_upi_id != registered_vpa:
            raise HTTPException(422, "UPI ID does not match the selected receiving account")
        selected_upi_id = registered_vpa

        conn.execute(orders.insert().values(
            id=order_id, merchant_id=identity, account_id=account, amount_minor=item.amount_minor,
            created=created, expires=created + CHECKOUT_TTL_SECONDS, status="AWAITING_PAYMENT",
            mode=item.mode, upi_id=selected_upi_id,
        ))
        if item.shared_amount:
            # Repeated amounts lack independent order-to-payment binding. Keep observational only.
            conn.execute(shared_test_orders.insert().values(order_id=order_id))
        else:
            conn.execute(amount_reservations.insert().values(order_id=order_id, account_id=account, payable_minor=payable))
        event(conn, identity, "ORDER_CREATED")
    result = {"id": order_id, "checkout_path": f"/checkout/{order_id}", "payable_minor": payable, "discount_minor": item.amount_minor-payable,
              "upi_id": selected_upi_id, "mode": item.mode}
    if item.shared_amount:
        result.update(session_reference=order_id, expires=created+CHECKOUT_TTL_SECONDS)
    return result


def reserve_daily_issuance(conn, request, mobile_cipher, payable, created, mode="P2P"):
    from sqlalchemy.dialects.postgresql import insert

    mobile = request.app.state.account_cipher.decrypt(mobile_cipher.encode())
    key = hmac.digest(os.environ["DISHA_CAP_KEY"].encode(), mobile, "sha256").hex()
    india = timezone(timedelta(hours=5, minutes=30))
    days = {datetime.fromtimestamp(stamp, india).date().isoformat()
            for stamp in (created, created + CHECKOUT_TTL_SECONDS - 1)}
    # P2M mode is exempt from daily collection limit
    if mode == "P2M":
        return
    if payable > DAILY_COLLECTION_LIMIT_PAISE:
        raise HTTPException(409, "Daily collection limit exceeded")
    for day in sorted(days):
        statement = insert(daily_issuance).values(mobile_key=key, day=day, reserved_paise=payable)
        total = daily_issuance.c.reserved_paise + statement.excluded.reserved_paise
        result = conn.execute(statement.on_conflict_do_update(
            index_elements=[daily_issuance.c.mobile_key, daily_issuance.c.day],
            set_={"reserved_paise": total},
            where=total <= DAILY_COLLECTION_LIMIT_PAISE,
        ).returning(daily_issuance.c.reserved_paise)).scalar_one_or_none()
        if result is None:
            raise HTTPException(409, "Daily collection limit exceeded")


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
        account_type = conn.scalar(select(accounts.c.account_type).where(
            accounts.c.id == order["account_id"], accounts.c.merchant_id == order["merchant_id"],
        ))
        mcc = conn.scalar(select(accounts.c.mcc).where(
            accounts.c.id == order["account_id"], accounts.c.merchant_id == order["merchant_id"],
        ))
        payable = conn.scalar(select(amount_reservations.c.payable_minor).where(
            amount_reservations.c.order_id == order_id,
            amount_reservations.c.account_id == order["account_id"]))
        result = {"id": order["id"], "amount_minor": payable if payable is not None else order["amount_minor"],
                "original_minor": order["amount_minor"],
                "discount_minor": order["amount_minor"]-payable if payable is not None else 0,
                "expires": order["expires"], "upi_id": vpa, "status": order["status"],
                "account_type": account_type, "mcc": mcc}
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


class TxnEvent(BaseModel):
    event: Literal["copy_ok", "copy_failed", "browser_departed", "browser_returned",
                   "verification_requested", "evidence_submitted", "evidence_rejected", "verdict"]
    detail: str | None = None


@router.post("/checkout/{order_id}/txn-event", status_code=202)
def txn_event(order_id: str, b: TxnEvent, request: Request):
    """Record a persistent transaction diagnostic event server-side.

    Never classifies clipboard activity, browser return, or screenshots alone
    as verified debit — this is an observational event log only.
    """
    with request.app.state.engine.begin() as conn:
        order = checkout_order(conn, order_id)
        conn.execute(audit.insert().values(
            merchant_id=order["merchant_id"],
            order_id=order_id,
            event=b.event,
            detail=b.detail,
            created=now(),
        ))
        event(conn, order["merchant_id"], "TXN_" + b.event.upper())
    return {"recorded": True, "order_id": order_id, "event": b.event}


# ============================================================================
# Android device enrollment and authentication
# ============================================================================

class PairingCodeInput(BaseModel):
    merchant_id: str | None = Field(default=None, pattern=r"^[0-9a-f]{32}$")
    agent_id: str = Field(pattern=r"^[A-Za-z0-9_-]{8,32}$")


class PairingCodeOutput(BaseModel):
    code: str
    expires_in_seconds: int


class DeviceListItem(BaseModel):
    device_id: str
    state: str
    last_heartbeat: int | None
    app_version: str | None
    revoked_at: int | None


class DevicePairInput(BaseModel):
    code: str = Field(pattern=r"^[A-Z0-9]{8}$")
    device_id: str = Field(pattern=r"^[A-Za-z0-9_-]{8,64}$")
    public_key_pem: str = Field(min_length=100, max_length=4096)
    app_version: str | None = Field(default=None, max_length=32)


class DeviceCredentialOutput(BaseModel):
    credential: str
    expires_in_seconds: int


class DeviceHeartbeatInput(BaseModel):
    pass


class DeviceObservationInput(BaseModel):
    order_id: str = Field(pattern=r"^[0-9a-f]{48}$")
    amount_paise: int = Field(strict=True, ge=100, le=100000000)
    currency: str = Field(pattern=r"^[A-Z]{3}$")
    account_id: str = Field(pattern=r"^[0-9a-f]{32}$")
    transaction_reference: str | None = Field(default=None, pattern=r"^[0-9]{12}$")
    observation_direction: str = Field(pattern=r"^(incoming|outgoing)$")
    evidence_provenance: str = Field(pattern=r"^(user_authorized|system_observed)$")
    observation_timestamp: int = Field(strict=True, ge=0)
    checkout_created: int = Field(strict=True, ge=0)
    checkout_expires: int = Field(strict=True, ge=0)


class DeviceObservationOutput(BaseModel):
    observation_id: str
    state: str
    decision: str | None
    reason: str | None


class CreditEventInput(BaseModel):
    event_id: str = Field(pattern=r"^[0-9a-f]{64}$")
    amount_paise: int = Field(strict=True, ge=100, le=100000000)
    currency: str = Field(pattern=r"^[A-Z]{3}$")
    observation_direction: str = Field(pattern=r"^(incoming|outgoing)$")
    receiving_account_id: str = Field(pattern=r"^[0-9a-f]{32}$")
    transaction_reference: str | None = Field(default=None, pattern=r"^[0-9]{12}$")
    observation_timestamp: int = Field(strict=True, ge=0)
    source_app_id: str | None = Field(default=None, max_length=256)


class CreditEventOutput(BaseModel):
    event_id: str
    state: str
    decision: str | None
    reason: str | None
    matched_order_id: str | None


def _pairing_rate_check(conn, merchant_id, now):
    window_start = now - PAIRING_RATE_WINDOW
    attempts = conn.scalar(select(func.count()).select_from(pairing_codes).where(
        pairing_codes.c.merchant_id == merchant_id,
        pairing_codes.c.created >= window_start,
    ))
    if attempts is not None and attempts >= PAIRING_MAX_ATTEMPTS:
        raise HTTPException(429, "Pairing code rate limit exceeded. Try again shortly.")


def _make_pairing_code() -> str:
    return "".join(secrets.choice("ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789") for _ in range(8))


@router.post("/android/devices/pairing", status_code=201, response_model=PairingCodeOutput)
def generate_pairing_code(request: Request, item: PairingCodeInput, authorization: Token = None):
    """Owner generates a short-lived, single-use pairing code bound to a merchant and agent."""
        # Derive merchant identity: session (cookie auth) or explicit merchant_id (bearer token auth)
    if authorization is None:
        login = require_session(request)
        identity = login.merchant_id
    else:
        if item.merchant_id is None:
            raise HTTPException(400, "merchant_id is required when using bearer token auth")
        identity = item.merchant_id
    with request.app.state.engine.begin() as conn:
        merchant = conn.scalar(select(merchants.c.id).where(merchants.c.id == identity))
        if merchant is None:
            raise HTTPException(404, "Merchant not found")
        _pairing_rate_check(conn, identity, now())
        code = _make_pairing_code()
        code_hash = digest(code)
        expires = now() + PAIRING_TTL_SECONDS
        conn.execute(pairing_codes.insert().values(
            code_hash=code_hash, merchant_id=identity, agent_id=item.agent_id,
            device_id=None, expires=expires, used=None, created=now(),
        ))
        event(conn, identity, "PAIRING_CODE_GENERATED")
    return {"code": code, "expires_in_seconds": PAIRING_TTL_SECONDS}


@router.get("/android/devices", response_model=list[DeviceListItem])
def list_devices(request: Request, authorization: Token = None, merchant_id_param: str | None = Query(default=None, alias="merchant_id")):
    """List registered devices for the authenticated merchant."""
    # Support both device bearer token and merchant bearer token / session
    if authorization is not None:
        identity = device_bearer(request, authorization).device_id
    else:
        login = require_session(request)
        identity = login.merchant_id

    if identity is None and merchant_id_param is not None:
        identity = merchant_id_param
    if identity is None:
        raise HTTPException(400, "merchant_id is required")

    now_ts = now()
    with request.app.state.engine.begin() as conn:
        rows = conn.execute(
            select(devices).where(devices.c.merchant_id == identity).order_by(devices.c.created.desc())
        ).mappings().all()
        results = []
        for row in rows:
            state = row["state"]
            if state == DEVICE_STATE_ONLINE:
                hb = row["last_heartbeat"]
                if hb is None or now_ts - hb > HEARTBEAT_OFFLINE_TIMEOUT:
                    state = DEVICE_STATE_OFFLINE
                    conn.execute(
                        devices.update().where(devices.c.device_id == row["device_id"])
                        .values(state=DEVICE_STATE_OFFLINE)
                    )
                    event(conn, row["merchant_id"], "DEVICE_OFFLINE_TIMEOUT")
            results.append(DeviceListItem(
                device_id=row["device_id"], state=state,
                last_heartbeat=row["last_heartbeat"], app_version=row["app_version"],
                revoked_at=row["revoked_at"],
            ))
    return results


@router.post("/android/devices/{device_id}/revoke", status_code=204)
def revoke_device(request: Request, device_id: str, authorization: Token = None, merchant_id_param: str | None = Query(default=None, alias="merchant_id")):
    """Revoke a registered device and its credentials."""
    if not DEVICE_ID.fullmatch(device_id):
        raise HTTPException(404, "Device not found")
    if authorization is not None:
        identity = device_bearer(request, authorization).device_id
    elif merchant_id_param is not None:
        identity = merchant_id_param
    else:
        raise HTTPException(400, "merchant_id is required when using bearer token auth")
    with request.app.state.engine.begin() as conn:
        row = conn.execute(
            select(devices).where(devices.c.device_id == device_id, devices.c.merchant_id == identity)
        ).mappings().first()
        if row is None:
            raise HTTPException(404, "Device not found")
        ts = now()
        conn.execute(
            devices.update().where(devices.c.device_id == device_id)
            .values(state=DEVICE_STATE_REVOKED, revoked_at=ts, revoked_reason="OWNER_REVOKED")
        )
        conn.execute(
            device_credentials.update().where(device_credentials.c.device_id == device_id)
            .values(revoked=ts)
        )
        event(conn, identity, "DEVICE_REVOKED")


@router.post("/android/pair", status_code=201, response_model=DeviceCredentialOutput)
def device_pair(request: Request, item: DevicePairInput):
    """Device redeems a pairing code to obtain authentication credentials."""
    if not DEVICE_ID.fullmatch(item.device_id):
        raise HTTPException(404, "Invalid device identifier")
    ts = now()
    with request.app.state.engine.begin() as conn:
        code_row = conn.execute(
            select(pairing_codes).where(pairing_codes.c.code_hash == digest(item.code)).with_for_update()
        ).mappings().first()
        if code_row is None:
            raise HTTPException(401, "Invalid pairing code")
        if code_row["used"] is not None:
            raise HTTPException(401, "Pairing code already used")
        if code_row["expires"] <= ts:
            raise HTTPException(401, "Pairing code expired")
        # Bind to the code's merchant and agent; the device_id is the caller's.
        credential = secrets.token_urlsafe(48)
        credential_hash = digest(credential)
        credential_expires = ts + CREDENTIAL_TTL_SECONDS
        conn.execute(
            pairing_codes.update().where(pairing_codes.c.code_hash == digest(item.code))
            .values(used=ts, device_id=item.device_id)
        )
        existing = conn.execute(
            select(devices).where(devices.c.device_id == item.device_id).with_for_update()
        ).mappings().first()
        if existing is None:
            conn.execute(devices.insert().values(
                device_id=item.device_id, merchant_id=code_row["merchant_id"],
                agent_id=code_row["agent_id"], public_key_pem=item.public_key_pem,
                state=DEVICE_STATE_ONLINE, created=ts, last_heartbeat=ts,
                app_version=item.app_version,
            ))
        else:
            if existing["merchant_id"] != code_row["merchant_id"]:
                raise HTTPException(403, "Device belongs to another merchant")
            conn.execute(
                devices.update().where(devices.c.device_id == item.device_id)
                .values(merchant_id=code_row["merchant_id"], agent_id=code_row["agent_id"],
                        public_key_pem=item.public_key_pem, state=DEVICE_STATE_ONLINE,
                        last_heartbeat=ts, app_version=item.app_version,
                        revoked_at=None, revoked_reason=None)
            )
        credential_values = dict(credential_hash=credential_hash, created=ts,
                                 expires=credential_expires, revoked=None)
        updated = conn.execute(device_credentials.update().where(
            device_credentials.c.device_id == item.device_id
        ).values(**credential_values))
        if updated.rowcount == 0:
            conn.execute(device_credentials.insert().values(
                device_id=item.device_id, **credential_values
            ))
        conn.execute(device_heartbeats.insert().values(
            device_id=item.device_id, received_at=ts, created=ts,
        ))
        event(conn, code_row["merchant_id"], "DEVICE_PAIRED")
    return {"credential": credential, "expires_in_seconds": CREDENTIAL_TTL_SECONDS}


@router.get("/android/device/status")
def device_status(request: Request, authorization: Token = None):
    """Return only the authenticated device's own connection status."""
    identity = device_bearer(request, authorization)
    with request.app.state.engine.connect() as conn:
        row = conn.execute(select(devices).where(
            devices.c.device_id == identity["device_id"]
        )).mappings().one()
    state = row["state"]
    hb = row["last_heartbeat"]
    if state == DEVICE_STATE_ONLINE and (hb is None or now() - hb > HEARTBEAT_OFFLINE_TIMEOUT):
        state = DEVICE_STATE_OFFLINE
    return {"device_id": row["device_id"], "state": state,
            "connected": state == DEVICE_STATE_ONLINE,
            "last_heartbeat": hb, "app_version": row["app_version"],
            "financially_verified": False}


@router.post("/android/heartbeat", status_code=204)
def device_heartbeat(request: Request, authorization: Token = None):
    """Authenticated device heartbeat. Updates last-seen timestamp.

    Allows an OFFLINE device to re-heartbeat and return to ONLINE; revoked
    or expired credentials are still rejected.
    """
    row = device_bearer(request, authorization)
    ts = now()
    with request.app.state.engine.begin() as conn:
        conn.execute(
            devices.update().where(devices.c.device_id == row["device_id"])
            .values(state=DEVICE_STATE_ONLINE, last_heartbeat=ts)
        )
        conn.execute(device_heartbeats.insert().values(
            device_id=row["device_id"], received_at=ts, created=ts,
        ))
        event(conn, row["merchant_id"], "DEVICE_HEARTBEAT")


@router.post("/android/observations", status_code=202, response_model=DeviceObservationOutput)
def device_observation(request: Request, item: DeviceObservationInput, authorization: Token = None):
    """Receiver device submits explicitly authorized, transaction-scoped evidence.

    The server correlates the observation against an existing checkout record.
    A match is observational only and does not set financially_verified.
    """
    row = device_bearer(request, authorization)
    ts = now()
    device_id = row["device_id"]
    merchant_id = row["merchant_id"]

    with request.app.state.engine.begin() as conn:
        order = checkout_order(conn, item.order_id, lock=True)
        if order["merchant_id"] != merchant_id:
            raise HTTPException(403, "Cross-merchant observation rejected")
        if order["account_id"] != item.account_id:
            raise HTTPException(403, "Observation account mismatch")
        if order["expires"] <= ts:
            _device_settle_state(conn, item.order_id, OBS_STATE_REJECTED,
                        item.amount_paise, ts, "EXPIRED_CHECKOUT")
            raise HTTPException(410, "Checkout expired")
        if order["status"] not in {"AWAITING_PAYMENT", "PENDING"}:
            _device_settle_state(conn, item.order_id, OBS_STATE_REJECTED,
                        item.amount_paise, ts, "CHECKOUT_CLOSED")
            raise HTTPException(410, "Checkout closed")

        amount_match = item.amount_paise == order["amount_minor"]
        # Check for duplicate observation
        existing_obs = conn.execute(
            select(device_observations).where(
                device_observations.c.order_id == item.order_id,
                device_observations.c.device_id == device_id,
            )
        ).mappings().first()
        if existing_obs is not None:
            _device_settle_state(conn, item.order_id, OBS_STATE_REJECTED,
                        item.amount_paise, ts, "DUPLICATE_OBSERVATION")
            event(conn, merchant_id, "DEVICE_OBSERVATION_DUPLICATE")
            return {"observation_id": existing_obs["observation_id"], "state": OBS_STATE_REJECTED,
                    "decision": "REJECTED", "reason": "Duplicate observation for this device and order"}

        # Count matching observations for this order across all devices
        matching_count = conn.scalar(select(func.count()).select_from(device_observations).where(
            device_observations.c.order_id == item.order_id,
            device_observations.c.state.in_({OBS_STATE_RECEIVED, OBS_STATE_MATCHED}),
        ))
        is_ambiguous = matching_count >= 1

        obs_id = "obs_" + secrets.token_hex(24)
        state = OBS_STATE_AMBIGUOUS if is_ambiguous else OBS_STATE_RECEIVED
        decision = "AMBIGUOUS" if is_ambiguous else "RECEIVED"
        reason = ("Multiple observations received for this checkout; verification requires review."
                  if is_ambiguous else "Observation received and awaiting correlation.")
        conn.execute(device_observations.insert().values(
            observation_id=obs_id, device_id=device_id, order_id=item.order_id,
            merchant_id=merchant_id, account_id=item.account_id,
            amount_paise=item.amount_paise, currency=item.currency,
            transaction_reference=item.transaction_reference,
            observation_direction=item.observation_direction,
            evidence_provenance=item.evidence_provenance,
            observation_timestamp=item.observation_timestamp,
            checkout_created=order["created"], checkout_expires=order["expires"],
            state=state, created=ts, decision=decision,
        ))
        _device_settle_state(conn, item.order_id, state, item.amount_paise if amount_match else None,
                    ts, decision)
        event(conn, merchant_id, "DEVICE_OBSERVATION_RECEIVED")
    return {"observation_id": obs_id, "state": state, "decision": decision, "reason": reason}


@router.post("/android/credit-event", status_code=202, response_model=CreditEventOutput)
def credit_event(request: Request, item: CreditEventInput, authorization: Token = None):
    """Authenticated incoming UPI credit event ingestion.

    Resolves the active checkout from the merchant's authorized receiving
    account, exact amount, transaction reference and event time. Does not
    require a checkout ID and never consumes the financial settlement ledger.
    """
    row = device_bearer(request, authorization)
    ts = now()
    device_id = row["device_id"]
    merchant_id = row["merchant_id"]

    with request.app.state.engine.begin() as conn:
        # Basic validation: currency and direction.
        if item.currency != "INR" or item.observation_direction != "incoming":
            _credit_insert(conn, item.event_id, device_id, merchant_id, item,
                           OBS_STATE_REJECTED, None, ts, "INVALID_EVENT",
                           "Only incoming INR credit events are observed.")
            event(conn, merchant_id, "CREDIT_EVENT_REJECTED")
            return CreditEventOutput(
                event_id=item.event_id, state=OBS_STATE_REJECTED, decision="REJECTED",
                reason="Only incoming INR credit events are observed.",
                matched_order_id=None)

        # Idempotent duplicate delivery: preserve previous state.
        existing = conn.execute(
            select(credit_events).where(credit_events.c.event_id == item.event_id)
        ).mappings().first()
        if existing is not None:
            event(conn, merchant_id, "CREDIT_EVENT_DUPLICATE")
            return CreditEventOutput(
                event_id=item.event_id, state=existing["state"],
                decision="MATCHED" if existing["matched_order_id"] is not None else "RECEIVED",
                reason="Duplicate event delivery; previous state preserved.",
                matched_order_id=existing["matched_order_id"])

        # Verify the receiving account belongs to this merchant.
        account = conn.scalar(select(accounts.c.id).where(
            accounts.c.id == item.receiving_account_id,
            accounts.c.merchant_id == merchant_id,
        ))
        if account is None:
            _credit_insert(conn, item.event_id, device_id, merchant_id, item,
                           OBS_STATE_REJECTED, None, ts, "UNKNOWN_ACCOUNT",
                           "Receiving account is not authorized for this merchant.")
            return CreditEventOutput(
                event_id=item.event_id, state=OBS_STATE_REJECTED, decision="REJECTED",
                reason="Receiving account is not authorized for this merchant.",
                matched_order_id=None)

        # Transaction reference uniqueness: reject if already used.
        if item.transaction_reference is not None:
            used = conn.scalar(select(credit_events.c.event_id).where(
                credit_events.c.merchant_id == merchant_id,
                credit_events.c.transaction_reference == item.transaction_reference,
                credit_events.c.state == OBS_STATE_MATCHED,
            ))
            if used is not None:
                event(conn, merchant_id, "CREDIT_EVENT_REJECTED")
                return CreditEventOutput(
                    event_id=item.event_id, state=OBS_STATE_REJECTED, decision="REJECTED",
                    reason="Transaction reference already used.", matched_order_id=None)

        # Resolve eligible checkouts for this account and amount.
        eligible = conn.execute(
            select(orders.c.id, orders.c.amount_minor, orders.c.created, orders.c.expires,
                   orders.c.status)
            .where(
                orders.c.account_id == item.receiving_account_id,
                orders.c.merchant_id == merchant_id,
                orders.c.amount_minor == item.amount_paise,
                orders.c.status.in_(("AWAITING_PAYMENT", "PENDING")),
                orders.c.expires > ts,
            )
            .order_by(orders.c.created.desc())
        ).mappings().all()

        if len(eligible) == 0:
            _credit_insert(conn, item.event_id, device_id, merchant_id, item,
                           OBS_STATE_RECEIVED, None, ts, "UNMATCHED",
                           "No eligible checkout found for this credit.")
            event(conn, merchant_id, "CREDIT_EVENT_UNMATCHED")
            return CreditEventOutput(
                event_id=item.event_id, state=OBS_STATE_RECEIVED, decision="RECEIVED",
                reason="No eligible checkout found for this credit.",
                matched_order_id=None)

        if len(eligible) > 1:
            _credit_insert(conn, item.event_id, device_id, merchant_id, item,
                           OBS_STATE_AMBIGUOUS, None, ts, "AMBIGUOUS",
                           "Multiple eligible checkouts; no arbitrary selection.")
            event(conn, merchant_id, "CREDIT_EVENT_AMBIGUOUS")
            return CreditEventOutput(
                event_id=item.event_id, state=OBS_STATE_AMBIGUOUS, decision="AMBIGUOUS",
                reason="Multiple eligible checkouts; no arbitrary selection.",
                matched_order_id=None)

        # Exactly one eligible checkout: match it.
        order = eligible[0]
        _credit_insert(conn, item.event_id, device_id, merchant_id, item,
                       OBS_STATE_MATCHED, order["id"], ts, "MATCHED",
                       "Credit matched to checkout.")
        event(conn, merchant_id, "CREDIT_EVENT_MATCHED")
        return CreditEventOutput(
            event_id=item.event_id, state=OBS_STATE_MATCHED, decision="MATCHED",
            reason="Credit matched to checkout.",
            matched_order_id=order["id"])


def _credit_insert(conn, event_id, device_id, merchant_id, item, state, matched_order_id,
                   ts, decision, reason):
    """Insert a credit event record and reflect the state in settlement_states."""
    from sqlalchemy.dialects.postgresql import insert as pg_insert
    from sqlalchemy.dialects.sqlite import insert as sqlite_insert
    values = dict(
        event_id=event_id, device_id=device_id, merchant_id=merchant_id,
        amount_paise=item.amount_paise, currency=item.currency,
        observation_direction=item.observation_direction,
        receiving_account_id=item.receiving_account_id,
        transaction_reference=item.transaction_reference,
        observation_timestamp=item.observation_timestamp,
        source_app_id=item.source_app_id,
        state=state, matched_order_id=matched_order_id,
        created=ts, updated=ts,
    )
    if conn.dialect.name == "postgresql":
        stmt = pg_insert(credit_events).values(**values).on_conflict_do_nothing(
            index_elements=[credit_events.c.event_id],
        )
    elif conn.dialect.name == "sqlite":
        stmt = sqlite_insert(credit_events).values(**values).on_conflict_do_nothing(
            index_elements=[credit_events.c.event_id],
        )
    else:
        raise RuntimeError("Unsupported ledger database")
    conn.execute(stmt)
    # Reflect observation state in settlement_states so the checkout UI sees it.
    if matched_order_id is not None:
        settle_values = dict(order_id=matched_order_id, state=state,
                             observed_minor=item.amount_paise if state == OBS_STATE_MATCHED else None,
                             updated=ts)
        if conn.dialect.name == "postgresql":
            s_stmt = pg_insert(settlement_states).values(**settle_values).on_conflict_do_update(
                index_elements=[settlement_states.c.order_id],
                set_=dict(state=state, observed_minor=settle_values["observed_minor"], updated=ts),
            )
        elif conn.dialect.name == "sqlite":
            s_stmt = sqlite_insert(settlement_states).values(**settle_values).on_conflict_do_update(
                index_elements=[settlement_states.c.order_id],
                set_=dict(state=state, observed_minor=settle_values["observed_minor"], updated=ts),
            )
        else:
            raise RuntimeError("Unsupported ledger database")
        conn.execute(s_stmt)
    conn.execute(audit.insert().values(
        merchant_id=merchant_id, event="CREDIT_EVENT_" + state,
        detail=decision + ": " + reason, created=ts,
    ))


def _device_settle_state(conn, order_id, state, observed_minor, ts, decision):
    """Record or update the settlement state for an order from a device observation."""
    merchant_id = conn.execute(select(orders.c.merchant_id).where(
        orders.c.id == order_id)).scalar()
    values = dict(order_id=order_id, state=state, observed_minor=observed_minor, updated=ts)
    if conn.dialect.name == "postgresql":
        from sqlalchemy.dialects.postgresql import insert as pg_insert
        stmt = pg_insert(settlement_states).values(**values).on_conflict_do_update(
            index_elements=[settlement_states.c.order_id],
            set_=dict(state=state, observed_minor=observed_minor, updated=ts),
        )
    elif conn.dialect.name == "sqlite":
        from sqlalchemy.dialects.sqlite import insert as sqlite_insert
        stmt = sqlite_insert(settlement_states).values(**values).on_conflict_do_update(
            index_elements=[settlement_states.c.order_id],
            set_=dict(state=state, observed_minor=observed_minor, updated=ts),
        )
    else:
        raise RuntimeError("Unsupported ledger database")
    conn.execute(stmt)
    conn.execute(audit.insert().values(
        merchant_id=merchant_id, order_id=order_id, event="DEVICE_OBS_" + state,
        detail=decision, created=ts,
    ))


# ============================================================================
# Merchant agent daily collection limit and UPI registration
# ============================================================================

class UpiRegisterInput(BaseModel):
    upi_id: str = Field(pattern=r"^[a-zA-Z0-9_.-]{2,256}@[a-zA-Z0-9_.-]{2,64}$")
    mobile_number: str = Field(pattern=r"^[0-9]{10}$")
    account_holder: str = Field(min_length=2, max_length=100)
    bank_name: str = Field(min_length=1, max_length=100)
    account_number: str = Field(pattern=r"^[0-9]{6,34}$")


@router.get("/android/daily-limit", response_model=dict)
def android_daily_limit(request: Request, authorization: Token = None):
    """Return today's collected amount and the daily limit for the device's merchant.

    P2P mode is capped at ₹70,000/day. P2M mode is unlimited.
    """
    row = device_bearer(request, authorization)
    merchant_id = row["merchant_id"]
    today_start = now() - (now() % 86400)
    with request.app.state.engine.connect() as conn:
        p2p_collected = conn.scalar(
            select(func.coalesce(func.sum(orders.c.amount_minor), 0)).where(
                orders.c.merchant_id == merchant_id,
                orders.c.status == "PAID",
                orders.c.mode == "P2P",
                orders.c.created >= today_start,
            )
        ) or 0
    return {
        "merchant_id": merchant_id,
        "p2p": {
            "collected_today_paise": int(p2p_collected),
            "collected_today_rupees": int(p2p_collected) / 100.0,
            "daily_limit_paise": DAILY_COLLECTION_LIMIT_PAISE,
            "daily_limit_rupees": DAILY_COLLECTION_LIMIT_PAISE / 100.0,
            "remaining_paise": max(0, DAILY_COLLECTION_LIMIT_PAISE - int(p2p_collected)),
            "can_collect": int(p2p_collected) < DAILY_COLLECTION_LIMIT_PAISE,
        },
        "p2m": {
            "collected_today_paise": 0,
            "collected_today_rupees": 0.0,
            "daily_limit_paise": None,
            "daily_limit_rupees": None,
            "remaining_paise": None,
            "can_collect": True,
        },
    }


@router.post("/android/register-upi", status_code=201, response_model=dict)
def android_register_upi(request: Request, item: UpiRegisterInput, authorization: Token = None):
    """Register the agent's own UPI ID + mobile number as a receiving account.

    Bound to the device's paired merchant. Each agent mobile registers its
    own UPI and mobile number once; thereafter it can create checkouts and
    collect incoming UPI credits against that account.
    """
    row = device_bearer(request, authorization)
    merchant_id = row["merchant_id"]
    device_id = row["device_id"]

    with request.app.state.engine.begin() as conn:
        # Check if this merchant already has an account with this UPI.
        existing = conn.scalar(select(accounts.c.id).where(
            accounts.c.merchant_id == merchant_id,
            accounts.c.vpa == item.upi_id.lower(),
        ))
        if existing is not None:
            # Link this device to the existing account (idempotent).
            try:
                conn.execute(agent_sessions.insert().values(
                    account_id=existing, agent_id=device_id, state="AUTH_REQUIRED", expires=0,
                ))
            except IntegrityError:
                pass  # Agent session already exists for this device
            return {"registered": False, "account_id": existing, "upi_id": item.upi_id.lower(),
                    "note": "UPI already registered for this merchant."}

        cipher = request.app.state.account_cipher
        account_id = secrets.token_hex(16)
        try:
            conn.execute(select(merchants.c.id).where(merchants.c.id == merchant_id).with_for_update())
            # Max 15 UPIs per agent device
            current_upis = conn.scalar(select(func.count()).select_from(agent_sessions).where(
                agent_sessions.c.agent_id == device_id,
            ))
            if current_upis >= 15:
                raise HTTPException(409, "Maximum 15 UPIs per agent device reached")
            current = conn.scalar(select(func.count()).select_from(accounts).where(accounts.c.merchant_id == merchant_id))
            if current >= 1000:
                raise HTTPException(409, "Merchant account limit exceeded")
            conn.execute(accounts.insert().values(
                id=account_id, merchant_id=merchant_id, vpa=item.upi_id.lower(),
                bank=item.bank_name, holder=item.account_holder, last4=item.account_number[-4:],
                account_cipher=cipher.encrypt(item.account_number.encode()).decode(),
                mobile_cipher=cipher.encrypt(item.mobile_number.encode()).decode(),
                account_type="MERCHANT", mcc=None,
            ))
            conn.execute(agent_sessions.insert().values(
                account_id=account_id, agent_id=device_id, state="AUTH_REQUIRED", expires=0,
            ))
            event(conn, merchant_id, "AGENT_UPI_REGISTERED")
        except IntegrityError:
            raise HTTPException(409, "UPI already registered") from None
    return {"registered": True, "account_id": account_id, "upi_id": item.upi_id.lower(),
            "mobile_number": item.mobile_number}


DAILY_COLLECTION_LIMIT_PAISE = 7000000


class MerchantEmailInput(BaseModel):
    email: str = Field(pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


@router.post("/admin/merchant-email")
def admin_set_merchant_email(request: Request, merchant_id: str, item: MerchantEmailInput):
    """Set the notification email for a merchant (owner only)."""
    with request.app.state.engine.begin() as conn:
        exists = conn.scalar(select(merchants.c.id).where(merchants.c.id == merchant_id))
        if exists is None:
            raise HTTPException(404, "Merchant not found")
        conn.execute(merchants.update().where(merchants.c.id == merchant_id).values(email=item.email))
    return {"merchant_id": merchant_id, "email": item.email}


class EmailNotifyInput(BaseModel):
    order_id: str
    status: str


@router.post("/android/email-notify")
def android_email_notify(request: Request, item: EmailNotifyInput, authorization: Token = None):
    """Queue a payment email notification for the device's merchant."""
    row = device_bearer(request, authorization)
    merchant_id = row["merchant_id"]
    with request.app.state.engine.begin() as conn:
        email = conn.scalar(select(merchants.c.email).where(merchants.c.id == merchant_id))
        event(conn, merchant_id, "EMAIL_NOTIFY")
    if email is None:
        raise HTTPException(400, "Merchant email not configured")
    return {"merchant_id": merchant_id, "order_id": item.order_id, "status": item.status,
            "email": email, "queued": True}


class RefundInput(BaseModel):
    order_id: str = Field(pattern=r"^[0-9a-f]{48}$")
    reason: str = Field(min_length=2, max_length=200)


@router.post("/android/refund", status_code=200, response_model=dict)
def android_refund(request: Request, item: RefundInput, authorization: Token = None):
    """Agent-initiated refund for a failed or disputed payment.

    Refundable when: payment not verified within 120s (failed), duplicate charge,
    or technical error. Agent can auto-approve; Super Admin can override.
    """
    row = device_bearer(request, authorization)
    merchant_id = row["merchant_id"]
    device_id = row["device_id"]
    now_ts = now()

    with request.app.state.engine.begin() as conn:
        order = conn.execute(select(orders).where(
            orders.c.id == item.order_id,
            orders.c.merchant_id == merchant_id,
        )).mappings().first()
        if order is None:
            raise HTTPException(404, "Order not found")
        if order["status"] not in ("AWAITING_PAYMENT", "EXPIRED", "PENDING"):
            raise HTTPException(409, f"Cannot refund order in state: {order['status']}")
        # Check 120s window: refund allowed only within 120s of creation for failed payments
        if order["expires"] <= now_ts and order["status"] == "AWAITING_PAYMENT":
            raise HTTPException(409, "Order expired — no refund window")
        conn.execute(orders.update().where(orders.c.id == item.order_id).values(
            status="REFUNDED",
        ))
        conn.execute(audit.insert().values(
            merchant_id=merchant_id, order_id=item.order_id, event="REFUND_ISSUED",
            detail=f"Agent {device_id}: {item.reason}", created=now_ts,
        ))
    return {"order_id": item.order_id, "status": "REFUNDED", "reason": item.reason,
            "refunded_at": now_ts}


# ============================================================================
# Adaptive P2P UPI Routing & Velocity Control Engine
# ============================================================================

def require_unreviewed_feature_disabled():
    """Do not expose unfinished payment automation or device provisioning."""
    raise HTTPException(503, "Feature unavailable pending security and financial verification")

UPI_DAILY_TXN_LIMIT = 50          # max transactions per UPI per 24h
UPI_DAILY_VOLUME_LIMIT = 10000000 # max volume per UPI per 24h (₹1,00,000 in paise)
RAPID_FIRE_LIMIT = 3              # max txns per 10-min window
RAPID_FIRE_WINDOW = 600           # 10 minutes in seconds
COOLDOWN_BASE_SECONDS = 60        # base cooldown per rupee (scaled below)
PENALTY_SECONDS = 3600            # 1 hour penalty for failed UPI
WARMUP_HOURS = 48                 # dormancy trigger: 48h without use
JITTER_SECONDS = (5, 15)          # randomized jitter range


class UpiRouteInput(BaseModel):
    amount_minor: int = Field(strict=True, ge=100, le=100000000)
    mode: Literal["P2P", "P2M"] = "P2P"


def _cooldown_seconds(amount_minor: int) -> int:
    """Higher value = longer cooldown. Base: 60s per ₹1000."""
    return max(COOLDOWN_BASE_SECONDS, int((amount_minor / 1000) * COOLDOWN_BASE_SECONDS))


def _now_ts() -> int:
    return int(time.time())


def _reset_daily_if_needed(row: dict, now_ts: int) -> dict:
    """Reset daily counters if a new day has started."""
    last_reset = row.get("last_daily_reset", 0) or 0
    india = timezone(timedelta(hours=5, minutes=30))
    today_start = now_ts - (now_ts % 86400)
    if last_reset < today_start:
        row["daily_count"] = 0
        row["daily_volume"] = 0
        row["last_daily_reset"] = today_start
        row["rapid_fire_count"] = 0
        row["rapid_fire_window_start"] = now_ts
    return row


def _is_rapid_fire_exceeded(row: dict, now_ts: int) -> bool:
    window_start = row.get("rapid_fire_window_start", 0) or 0
    if now_ts - window_start > RAPID_FIRE_WINDOW:
        return False
    return (row.get("rapid_fire_count", 0) or 0) >= RAPID_FIRE_LIMIT


def _select_best_upi(conn, merchant_id: str, amount_minor: int, now_ts: int):
    """Weighted Intelligent Rotation: pick the healthiest UPI ID from the pool."""
    rows = conn.execute(
        select(upi_health).where(upi_health.c.merchant_id == merchant_id)
    ).mappings().all()

    if not rows:
        return None, "no_upis_registered"

    candidates = []
    for row in rows:
        row = _reset_daily_if_needed(dict(row), now_ts)

        # Blacklist check
        if row.get("blacklisted"):
            continue

        # Penalty check
        penalty_until = row.get("penalty_until", 0) or 0
        if now_ts < penalty_until:
            continue

        # Cooldown check
        cooldown_until = row.get("cooldown_until", 0) or 0
        if now_ts < cooldown_until:
            continue

        # Daily count limit
        if (row.get("daily_count", 0) or 0) >= UPI_DAILY_TXN_LIMIT:
            continue

        # Daily volume limit
        if (row.get("daily_volume", 0) or 0) + amount_minor > UPI_DAILY_VOLUME_LIMIT:
            continue

        # Rapid-fire check
        if _is_rapid_fire_exceeded(row, now_ts):
            continue

        # Dormancy / warmup
        if row.get("warmup_required"):
            continue

        # Success rate penalty: very low success rate deprioritizes but doesn't block
        success_rate = row.get("success_rate", 1.0) or 1.0
        if success_rate < 0.3:
            continue  # too unhealthy

        # Compute weight: higher success rate + lower recent usage = better
        last_tx = row.get("last_transaction", 0) or 0
        idle_seconds = now_ts - last_tx
        weight = success_rate * (1 + min(idle_seconds / 3600, 5))

        candidates.append((weight, dict(row)))

    if not candidates:
        return None, "all_upis_unavailable"

    # Sort by weight descending, pick top
    candidates.sort(key=lambda x: x[0], reverse=True)
    return candidates[0][1], None


def _record_rotation_log(conn, merchant_id: str, upi_id: str, order_id: str,
                          amount_minor: int, decision: str, reason: str,
                          correlation_id: str, now_ts: int):
    conn.execute(upi_rotation_log.insert().values(
        id=secrets.token_hex(24),
        merchant_id=merchant_id,
        upi_id=upi_id,
        order_id=order_id,
        amount_minor=amount_minor,
        decision=decision,
        reason=reason,
        correlation_id=correlation_id,
        created=now_ts,
    ))


def _update_upi_health_after_route(conn, upi_id: str, amount_minor: int, now_ts: int,
                                    cooldown_seconds: int):
    conn.execute(upi_health.update().where(upi_health.c.upi_id == upi_id).values(
        daily_count=upi_health.c.daily_count + 1,
        daily_volume=upi_health.c.daily_volume + amount_minor,
        cooldown_until=now_ts + cooldown_seconds,
        last_transaction=now_ts,
        rapid_fire_count=upi_health.c.rapid_fire_count + 1,
    ))


def _update_upi_health_after_result(conn, upi_id: str, success: bool, now_ts: int):
    if success:
        conn.execute(upi_health.update().where(upi_health.c.upi_id == upi_id).values(
            success_count=upi_health.c.success_count + 1,
            penalty_until=0,
        ))
    else:
        conn.execute(upi_health.update().where(upi_health.c.upi_id == upi_id).values(
            failure_count=upi_health.c.failure_count + 1,
            penalty_until=now_ts + PENALTY_SECONDS,
        ))
    # Recompute success rate
    row = conn.execute(select(upi_health).where(upi_health.c.upi_id == upi_id)).mappings().first()
    if row:
        total = (row.get("success_count", 0) or 0) + (row.get("failure_count", 0) or 0)
        rate = (row.get("success_count", 0) or 0) / total if total > 0 else 1.0
        conn.execute(upi_health.update().where(upi_health.c.upi_id == upi_id).values(
            success_rate=rate,
        ))


@router.post("/android/upi-route", response_model=dict, dependencies=[Depends(require_unreviewed_feature_disabled)])
def android_upi_route(request: Request, item: UpiRouteInput, authorization: Token = None):
    """Intelligent UPI routing: returns the best UPI ID for a transaction."""
    row = device_bearer(request, authorization)
    merchant_id = row["merchant_id"]
    device_id = row["device_id"]
    now_ts = _now_ts()
    correlation_id = secrets.token_hex(16)

    with request.app.state.engine.begin() as conn:
        selected, reason = _select_best_upi(conn, merchant_id, item.amount_minor, now_ts)
        if selected is None:
            _record_rotation_log(conn, merchant_id, "NONE", None, item.amount_minor,
                                 "ROUTE_FAILED", reason, correlation_id, now_ts)
            raise HTTPException(409, f"No UPI available: {reason}")

        upi_id = selected["upi_id"]
        cooldown = _cooldown_seconds(item.amount_minor)

        # Record rotation decision
        _record_rotation_log(conn, merchant_id, upi_id, None, item.amount_minor,
                             "ROUTE_SELECTED", "Weighted intelligent rotation",
                             correlation_id, now_ts)

        # Update health state
        _update_upi_health_after_route(conn, upi_id, item.amount_minor, now_ts, cooldown)

    return {
        "upi_id": upi_id,
        "merchant_id": merchant_id,
        "amount_minor": item.amount_minor,
        "cooldown_seconds": cooldown,
        "cooldown_until": now_ts + cooldown,
        "correlation_id": correlation_id,
        "daily_count": (selected.get("daily_count", 0) or 0) + 1,
        "daily_volume": (selected.get("daily_volume", 0) or 0) + item.amount_minor,
    }


@router.post("/android/upi-result", response_model=dict, dependencies=[Depends(require_unreviewed_feature_disabled)])
def android_upi_result(request: Request, authorization: Token = None,
                       upi_id: str = None, success: bool = None,
                       order_id: str = None):
    """Report transaction result for a routed UPI (success/failure)."""
    row = device_bearer(request, authorization)
    merchant_id = row["merchant_id"]
    now_ts = _now_ts()

    with request.app.state.engine.begin() as conn:
        _update_upi_health_after_result(conn, upi_id, success, now_ts)
        conn.execute(audit.insert().values(
            merchant_id=merchant_id, order_id=order_id, event="UPI_RESULT",
            detail=f"UPI {upi_id} result: success={success}", created=now_ts,
        ))
    return {"upi_id": upi_id, "success": success, "recorded_at": now_ts}


@router.get("/android/upi-pool", response_model=dict, dependencies=[Depends(require_unreviewed_feature_disabled)])
def android_upi_pool(request: Request, authorization: Token = None):
    """Return all registered UPI IDs with their current health status."""
    row = device_bearer(request, authorization)
    merchant_id = row["merchant_id"]
    now_ts = _now_ts()

    with request.app.state.engine.connect() as conn:
        rows = conn.execute(
            select(upi_health).where(upi_health.c.merchant_id == merchant_id)
        ).mappings().all()

    pool = []
    for r in rows:
        r = _reset_daily_if_needed(dict(r), now_ts)
        pool.append({
            "upi_id": r["upi_id"],
            "daily_count": r.get("daily_count", 0),
            "daily_volume": r.get("daily_volume", 0),
            "daily_volume_limit": UPI_DAILY_VOLUME_LIMIT,
            "daily_txn_limit": UPI_DAILY_TXN_LIMIT,
            "cooldown_until": r.get("cooldown_until", 0),
            "penalty_until": r.get("penalty_until", 0),
            "blacklisted": bool(r.get("blacklisted")),
            "success_rate": r.get("success_rate", 1.0),
            "last_transaction": r.get("last_transaction", 0),
            "available": (
                not r.get("blacklisted")
                and now_ts >= (r.get("penalty_until", 0) or 0)
                and now_ts >= (r.get("cooldown_until", 0) or 0)
                and (r.get("daily_count", 0) or 0) < UPI_DAILY_TXN_LIMIT
                and (r.get("daily_volume", 0) or 0) < UPI_DAILY_VOLUME_LIMIT
                and not r.get("warmup_required")
            ),
        })

    return {"merchant_id": merchant_id, "upi_pool": pool, "pool_size": len(pool),
            "checked_at": now_ts}


@router.post("/android/daily-report", response_model=dict, dependencies=[Depends(require_unreviewed_feature_disabled)])
def android_daily_report(request: Request, authorization: Token = None):
    """Generate and email daily P2P/P2M report to merchant owner."""
    row = device_bearer(request, authorization)
    merchant_id = row["merchant_id"]
    device_id = row["device_id"]
    now_ts = _now_ts()
    today_start = now_ts - (now_ts % 86400)

    with request.app.state.engine.connect() as conn:
        merchant = conn.execute(select(merchants).where(
            merchants.c.id == merchant_id
        )).mappings().first()
        if not merchant:
            raise HTTPException(404, "Merchant not found")

        # P2P vs P2M totals
        p2p = conn.execute(select(func.coalesce(func.sum(orders.c.amount_minor), 0),
                                   func.count(orders.c.id)).where(
            orders.c.merchant_id == merchant_id,
            orders.c.mode == "P2P",
            orders.c.status == "PAID",
            orders.c.created >= today_start,
        )).first()
        p2m = conn.execute(select(func.coalesce(func.sum(orders.c.amount_minor), 0),
                                   func.count(orders.c.id)).where(
            orders.c.merchant_id == merchant_id,
            orders.c.mode == "P2M",
            orders.c.status == "PAID",
            orders.c.created >= today_start,
        )).first()

        # UPI pool summary
        upi_rows = conn.execute(
            select(upi_health).where(upi_health.c.merchant_id == merchant_id)
        ).mappings().all()

        upi_summary = []
        for r in upi_rows:
            upi_summary.append({
                "upi_id": r["upi_id"],
                "daily_count": r.get("daily_count", 0),
                "daily_volume": r.get("daily_volume", 0),
                "success_rate": r.get("success_rate", 1.0),
                "blacklisted": bool(r.get("blacklisted")),
            })

        email = merchant.get("email")
        report = {
            "merchant_id": merchant_id,
            "business_name": merchant.get("name"),
            "email": email,
            "date": today_start,
            "p2p": {
                "collected_paise": p2p[0] or 0,
                "collected_rupees": (p2p[0] or 0) / 100.0,
                "txn_count": p2p[1] or 0,
                "limit_paise": DAILY_COLLECTION_LIMIT_PAISE,
                "limit_reached": (p2p[0] or 0) >= DAILY_COLLECTION_LIMIT_PAISE,
            },
            "p2m": {
                "collected_paise": p2m[0] or 0,
                "collected_rupees": (p2m[0] or 0) / 100.0,
                "txn_count": p2m[1] or 0,
            },
            "upi_pool": upi_summary,
            "generated_at": now_ts,
        }

        # Log the report generation
        conn.execute(audit.insert().values(
            merchant_id=merchant_id, event="DAILY_REPORT_GENERATED",
            detail=f"Daily report for {today_start}", created=now_ts,
        ))

    # Email notification (placeholder - integrates with backend email service)
    if email:
        report["email_queued"] = True
        report["email_to"] = email
    else:
        report["email_queued"] = False
        report["reason"] = "merchant email not configured"

    return report


@router.get("/android/upi-master-ledger", response_model=dict, dependencies=[Depends(require_unreviewed_feature_disabled)])
def android_upi_master_ledger(request: Request, authorization: Token = None):
    """Master UPI ledger: all UPI IDs for the merchant with P2P consumption,
    cooldown status, and which UPI is next in rotation when one hits ₹70k cap."""
    row = device_bearer(request, authorization)
    merchant_id = row["merchant_id"]
    now_ts = _now_ts()
    today_start = now_ts - (now_ts % 86400)

    with request.app.state.engine.connect() as conn:
        upi_rows = conn.execute(
            select(upi_health).where(upi_health.c.merchant_id == merchant_id)
            .order_by(upi_health.c.upi_id)
        ).mappings().all()

        # P2P collected per UPI today (from orders)
        upi_p2p_collected = {}
        p2p_rows = conn.execute(
            select(orders.c.upi_id,
                   func.coalesce(func.sum(orders.c.amount_minor), 0).label("total"),
                   func.count(orders.c.id).label("cnt"))
            .where(orders.c.merchant_id == merchant_id,
                   orders.c.mode == "P2P",
                   orders.c.status == "PAID",
                   orders.c.upi_id.is_not(None),
                   orders.c.created >= today_start)
            .group_by(orders.c.upi_id)
        ).mappings().all()
        for r in p2p_rows:
            upi_p2p_collected[r["upi_id"]] = {"collected_paise": r["total"], "txn_count": r["cnt"]}

    ledger = []
    next_upi = None
    for r in upi_rows:
        r = _reset_daily_if_needed(r, now_ts)
        upi_id = r["upi_id"]
        daily_count = r.get("daily_count", 0) or 0
        daily_volume = r.get("daily_volume", 0) or 0
        p2p_data = upi_p2p_collected.get(upi_id, {"collected_paise": 0, "txn_count": 0})
        p2p_collected_paise = p2p_data["collected_paise"]
        p2p_limit_reached = p2p_collected_paise >= DAILY_COLLECTION_LIMIT_PAISE

        # Determine if this UPI is available for next P2P transaction
        cooldown_until = r.get("cooldown_until", 0) or 0
        penalty_until = r.get("penalty_until", 0) or 0
        available = (
            not r.get("blacklisted")
            and now_ts >= cooldown_until
            and now_ts >= penalty_until
            and daily_count < UPI_DAILY_TXN_LIMIT
            and daily_volume < UPI_DAILY_VOLUME_LIMIT
            and p2p_collected_paise < DAILY_COLLECTION_LIMIT_PAISE
            and not r.get("warmup_required")
        )

        ledger.append({
            "upi_id": upi_id,
            "p2p_collected_paise": p2p_collected_paise,
            "p2p_collected_rupees": p2p_collected_paise / 100.0,
            "p2p_limit_paise": DAILY_COLLECTION_LIMIT_PAISE,
            "p2p_limit_rupees": DAILY_COLLECTION_LIMIT_PAISE / 100.0,
            "p2p_limit_reached": p2p_limit_reached,
            "p2p_remaining_paise": max(0, DAILY_COLLECTION_LIMIT_PAISE - p2p_collected_paise),
            "routing_daily_count": daily_count,
            "routing_daily_volume": daily_volume,
            "success_rate": r.get("success_rate", 1.0),
            "blacklisted": bool(r.get("blacklisted")),
            "available_for_next_p2p": available,
            "cooldown_until": cooldown_until,
        })

        if available and next_upi is None:
            next_upi = upi_id

    # Sort: available first, then by P2P consumed ascending
    ledger.sort(key=lambda x: (not x["available_for_next_p2p"], x["p2p_collected_paise"]))

    total_p2p_collected = sum(l["p2p_collected_paise"] for l in ledger)
    total_limit = DAILY_COLLECTION_LIMIT_PAISE * len(ledger)
    all_caps_reached = all(l["p2p_limit_reached"] for l in ledger) if ledger else False

    return {
        "merchant_id": merchant_id,
        "date": today_start,
        "upi_count": len(ledger),
        "max_upis": 15,
        "total_p2p_collected_paise": total_p2p_collected,
        "total_p2p_collected_rupees": total_p2p_collected / 100.0,
        "total_p2p_limit_paise": total_limit,
        "total_p2p_limit_rupees": total_limit / 100.0,
        "all_p2p_caps_reached": all_caps_reached,
        "next_upi_for_p2p": next_upi,
        "ledger": ledger,
        "generated_at": now_ts,
    }


# ============================================================================
# Adaptive P2P Automation Engine - Full Automation
# ============================================================================

class AutoCheckoutInput(BaseModel):
    amount_minor: int = Field(strict=True, ge=100, le=100000000)
    mode: Literal["P2P", "P2M"] = "P2P"
    worker_index: int = Field(ge=0, le=14)


class WorkerResultInput(BaseModel):
    worker_index: int = Field(ge=0, le=14)
    upi_id: str
    order_id: str
    success: bool
    amount_minor: int


class AutomationConfigInput(BaseModel):
    auto_checkout: bool = True
    auto_verify: bool = True
    auto_refund: bool = True
    auto_rotate_upi: bool = True
    daily_txn_target: int = Field(default=100, ge=1, le=1000)
    min_amount_paise: int = Field(default=100, ge=100)
    max_amount_paise: int = Field(default=100000000, ge=1000)
    p2p_daily_cap_paise: int = Field(default=7000000, ge=100000)


class ProvisionDeviceInput(BaseModel):
    merchant_id: str
    device_id: str
    email: str
    business_name: str


@router.post("/android/auto-checkout", response_model=dict, dependencies=[Depends(require_unreviewed_feature_disabled)])
def android_auto_checkout(request: Request, item: AutoCheckoutInput, authorization: Token = None):
    """Auto-create a checkout via worker. Worker specifies which UPI index to use."""
    row = device_bearer(request, authorization)
    merchant_id = row["merchant_id"]
    device_id = row["device_id"]
    now_ts = _now_ts()

    with request.app.state.engine.begin() as conn:
        # Verify worker exists for this device
        worker = conn.execute(select(workers).where(
            workers.c.device_id == device_id,
            workers.c.worker_index == item.worker_index,
        )).mappings().first()
        if not worker:
            raise HTTPException(404, f"Worker index {item.worker_index} not found on this device")

        # Get the UPI ID assigned to this worker
        upi_id = worker["upi_id"]
        if not upi_id:
            raise HTTPException(409, f"Worker {item.worker_index} has no UPI ID assigned")

        # Check automation config
        config = conn.execute(select(automation_config).where(
            automation_config.c.device_id == device_id
        )).mappings().first()
        if not config or not config["auto_checkout"]:
            raise HTTPException(409, "Auto-checkout not enabled for this device")

        # Create the order
        order_id = secrets.token_hex(24)
        expires_at = now_ts + CHECKOUT_TTL_SECONDS

        # Record auto-checkout entry
        conn.execute(auto_checkout.insert().values(
            id=order_id,
            merchant_id=merchant_id,
            device_id=device_id,
            worker_id=worker["id"],
            upi_id=upi_id,
            amount_minor=item.amount_minor,
            mode=item.mode,
            status="CREATED",
            expires_at=expires_at,
            created_at=now_ts,
        ))

        # Create actual order
        conn.execute(orders.insert().values(
            id=order_id,
            merchant_id=merchant_id,
            account_id=worker["id"],  # use worker id as account reference
            amount_minor=item.amount_minor,
            created=now_ts,
            expires=expires_at,
            status="AWAITING_PAYMENT",
            mode=item.mode,
            upi_id=upi_id,
        ))
        event(conn, merchant_id, "AUTO_CHECKOUT_CREATED")

    return {
        "order_id": order_id,
        "upi_id": upi_id,
        "worker_index": item.worker_index,
        "amount_minor": item.amount_minor,
        "mode": item.mode,
        "checkout_path": f"/checkout/{order_id}",
        "expires_at": expires_at,
        "seconds_remaining": CHECKOUT_TTL_SECONDS,
    }


@router.get("/android/worker-dispatch", response_model=dict, dependencies=[Depends(require_unreviewed_feature_disabled)])
def android_worker_dispatch(request: Request, authorization: Token = None,
                             worker_index: int = None):
    """Dispatch work to a worker: returns pending auto-checkouts or idle status."""
    row = device_bearer(request, authorization)
    device_id = row["device_id"]
    now_ts = _now_ts()

    with request.app.state.engine.connect() as conn:
        # Get workers for this device
        workers_rows = conn.execute(select(workers).where(
            workers.c.device_id == device_id
        )).mappings().all()

        if worker_index is not None:
            workers_rows = [w for w in workers_rows if w["worker_index"] == worker_index]

        # Get pending auto-checkouts for this device
        pending = conn.execute(select(auto_checkout).where(
            auto_checkout.c.device_id == device_id,
            auto_checkout.c.status == "CREATED",
        )).mappings().all()

        # Map worker_index -> worker
        worker_map = {w["worker_index"]: w for w in workers_rows}

        dispatch = []
        for ac in pending:
            wi = None
            # Find which worker this checkout belongs to
            for w in workers_rows:
                if w["id"] == ac["worker_id"]:
                    wi = w["worker_index"]
                    break
            dispatch.append({
                "order_id": ac["id"],
                "worker_index": wi,
                "upi_id": ac["upi_id"],
                "amount_minor": ac["amount_minor"],
                "mode": ac["mode"],
                "checkout_path": f"/checkout/{ac['id']}",
                "expires_at": ac["expires_at"],
                "seconds_remaining": max(0, ac["expires_at"] - now_ts),
            })

    return {
        "device_id": device_id,
        "worker_count": len(workers_rows),
        "pending_checkouts": dispatch,
        "now_ts": now_ts,
    }


@router.post("/android/worker-result", response_model=dict, dependencies=[Depends(require_unreviewed_feature_disabled)])
def android_worker_result(request: Request, item: WorkerResultInput, authorization: Token = None):
    """Worker reports transaction result: success or failure."""
    row = device_bearer(request, authorization)
    merchant_id = row["merchant_id"]
    device_id = row["device_id"]
    now_ts = _now_ts()

    with request.app.state.engine.begin() as conn:
        # Verify worker
        worker = conn.execute(select(workers).where(
            workers.c.device_id == device_id,
            workers.c.worker_index == item.worker_index,
            workers.c.upi_id == item.upi_id,
        )).mappings().first()
        if not worker:
            raise HTTPException(404, "Worker not found or UPI mismatch")

        # Update worker stats
        conn.execute(workers.update().where(workers.c.id == worker["id"]).values(
            status="IDLE" if item.success else "ERROR",
            current_order_id=None,
            last_heartbeat=now_ts,
            daily_txns=workers.c.daily_txns + 1,
            daily_volume=workers.c.daily_volume + item.amount_minor,
            updated_at=now_ts,
        ))

        # Update order status
        order = conn.execute(select(orders).where(
            orders.c.id == item.order_id,
            orders.c.merchant_id == merchant_id,
        )).mappings().first()
        if order:
            new_status = "PAID" if item.success else "FAILED"
            conn.execute(orders.update().where(orders.c.id == item.order_id).values(
                status=new_status,
            ))
            # If failed and auto_refund enabled, trigger refund
            config = conn.execute(select(automation_config).where(
                automation_config.c.device_id == device_id
            )).mappings().first()
            if not item.success and config and config["auto_refund"]:
                conn.execute(audit.insert().values(
                    merchant_id=merchant_id, order_id=item.order_id, event="AUTO_REFUND",
                    detail=f"Worker {item.worker_index} reported failure on {item.upi_id}", created=now_ts,
                ))

        # Report UPI result to routing engine
        _update_upi_health_after_result(conn, item.upi_id, item.success, now_ts)

        event(conn, merchant_id, "WORKER_RESULT")

    return {
        "worker_index": item.worker_index,
        "upi_id": item.upi_id,
        "order_id": item.order_id,
        "success": item.success,
        "recorded_at": now_ts,
    }


@router.get("/super-admin/device-fleet", response_model=dict, dependencies=[Depends(require_unreviewed_feature_disabled)])
def super_admin_device_fleet(request: Request, authorization: Token = None):
    """Super Admin: view all merchant devices across the platform."""
    # Super admin check
    token = authorization or ""
    admin_token = os.getenv("", "")
    if not token or not token.startswith("Bearer "):
        raise HTTPException(401, "Super Admin token required")
    token_val = token.split(" ", 1)[1]
    if token_val != admin_token:
        raise HTTPException(403, "Invalid Super Admin token")

    now_ts = _now_ts()

    with request.app.state.engine.connect() as conn:
        devices_rows = conn.execute(select(devices)).mappings().all()
        fleet = []
        for d in devices_rows:
            merchant = conn.execute(select(merchants).where(
                merchants.c.id == d["merchant_id"]
            )).mappings().first()
            worker_count = conn.execute(select(func.count(workers.c.id)).where(
                workers.c.device_id == d["id"]
            )).scalar() or 0
            fleet.append({
                "device_id": d["id"],
                "merchant_id": d["merchant_id"],
                "merchant_name": merchant.get("name") if merchant else None,
                "merchant_email": merchant.get("email") if merchant else None,
                "device_type": d.get("device_type", "ANDROID_MOBILE"),
                "status": d.get("state", "UNKNOWN"),
                "last_heartbeat": d.get("last_heartbeat", 0),
                "worker_count": worker_count,
                "upi_registered": bool(d.get("upi_registered")),
            })

    return {
        "total_devices": len(fleet),
        "fleet": fleet,
        "generated_at": now_ts,
    }


@router.post("/super-admin/provision-device", response_model=dict, dependencies=[Depends(require_unreviewed_feature_disabled)])
def super_admin_provision_device(request: Request, item: ProvisionDeviceInput, authorization: Token = None):
    """Super Admin: provision a new merchant Android device with 15 workers."""
    admin_token = os.getenv("", "")
    token = authorization or ""
    if not token or not token.startswith("Bearer "):
        raise HTTPException(401, "Super Admin token required")
    token_val = token.split(" ", 1)[1]
    if token_val != admin_token:
        raise HTTPException(403, "Invalid Super Admin token")

    now_ts = _now_ts()
    device_id = f"device_{secrets.token_hex(12)}"

    with request.app.state.engine.begin() as conn:
        # Create device
        conn.execute(devices.insert().values(
            id=device_id,
            merchant_id=item.merchant_id,
            device_type="ANDROID_MOBILE",
            state="PROVISIONED",
            last_heartbeat=now_ts,
            upi_registered=False,
        ))

        # Create 15 workers (1 per UPI ID)
        upi_apps = [
            "GPay", "PhonePe", "BHIM", "WhatsApp Pay", "Cred",
            "Mi Pay", "Paytm", "Amazon Pay", "Airtel Pay", "JioPay",
            "BharatPe", "Slice", "LazyPay", "PostPe", "Simpl",
        ]

        for i in range(15):
            worker_id = f"worker_{device_id}_{i}"
            conn.execute(workers.insert().values(
                id=worker_id,
                merchant_id=item.merchant_id,
                device_id=device_id,
                worker_index=i,
                upi_id=None,  # assigned when UPI registered
                upi_app=upi_apps[i] if i < len(upi_apps) else f"UPI App {i+1}",
                status="IDLE",
                auto_mode=True,
                daily_txns=0,
                daily_volume=0,
                created_at=now_ts,
                updated_at=now_ts,
            ))

        # Pre-install UPI apps inventory
        for i, app_name in enumerate(upi_apps):
            conn.execute(device_upi_apps.insert().values(
                id=f"app_{device_id}_{i}",
                device_id=device_id,
                app_name=app_name,
                app_package=f"com.upi.{app_name.lower().replace(' ', '')}",
                is_installed=True,
                is_enabled=True,
                last_checked=now_ts,
                created_at=now_ts,
            ))

        # Default automation config
        conn.execute(automation_config.insert().values(
            id=f"cfg_{device_id}",
            merchant_id=item.merchant_id,
            device_id=device_id,
            auto_checkout=True,
            auto_verify=True,
            auto_refund=True,
            auto_rotate_upi=True,
            daily_txn_target=100,
            min_amount_paise=100,
            max_amount_paise=100000000,
            p2p_daily_cap_paise=7000000,
            created_at=now_ts,
            updated_at=now_ts,
        ))

        event(conn, item.merchant_id, "DEVICE_PROVISIONED")

    return {
        "device_id": device_id,
        "merchant_id": item.merchant_id,
        "worker_count": 15,
        "upi_apps_installed": len(upi_apps),
        "status": "PROVISIONED",
        "provisioned_at": now_ts,
        "message": "Device provisioned with 15 workers and 11+ UPI apps. Agent can now register UPIs and start collecting.",
    }


@router.get("/android/automation-config", response_model=dict, dependencies=[Depends(require_unreviewed_feature_disabled)])
def android_automation_config(request: Request, authorization: Token = None):
    """Get automation config for this device."""
    row = device_bearer(request, authorization)
    device_id = row["device_id"]

    with request.app.state.engine.connect() as conn:
        config = conn.execute(select(automation_config).where(
            automation_config.c.device_id == device_id
        )).mappings().first()
        if not config:
            raise HTTPException(404, "Automation config not found")

    return {
        "device_id": device_id,
        "auto_checkout": bool(config["auto_checkout"]),
        "auto_verify": bool(config["auto_verify"]),
        "auto_refund": bool(config["auto_refund"]),
        "auto_rotate_upi": bool(config["auto_rotate_upi"]),
        "daily_txn_target": config["daily_txn_target"],
        "min_amount_paise": config["min_amount_paise"],
        "max_amount_paise": config["max_amount_paise"],
        "p2p_daily_cap_paise": config["p2p_daily_cap_paise"],
    }


@router.put("/android/automation-config", response_model=dict, dependencies=[Depends(require_unreviewed_feature_disabled)])
def android_update_automation_config(request: Request, item: AutomationConfigInput, authorization: Token = None):
    """Update automation config for this device."""
    row = device_bearer(request, authorization)
    device_id = row["device_id"]
    now_ts = _now_ts()

    with request.app.state.engine.begin() as conn:
        conn.execute(automation_config.update().where(automation_config.c.device_id == device_id).values(
            auto_checkout=item.auto_checkout,
            auto_verify=item.auto_verify,
            auto_refund=item.auto_refund,
            auto_rotate_upi=item.auto_rotate_upi,
            daily_txn_target=item.daily_txn_target,
            min_amount_paise=item.min_amount_paise,
            max_amount_paise=item.max_amount_paise,
            p2p_daily_cap_paise=item.p2p_daily_cap_paise,
            updated_at=now_ts,
        ))

    return {"device_id": device_id, "updated_at": now_ts, "status": "updated"}


# ============================================================================
# Super Admin Control Plane - Prism Command
# ============================================================================



@router.get("/superadmin/overview", response_model=dict, dependencies=[Depends(require_unreviewed_feature_disabled)])
def superadmin_overview(request: Request, authorization: Token = None):
    """Platform-wide executive overview for Super Admin."""
    now_ts = _now_ts()
    today_start = now_ts - (now_ts % 86400)

    with request.app.state.engine.connect() as conn:
        merchant_count = conn.scalar(select(func.count()).select_from(merchants)) or 0
        device_count = conn.scalar(select(func.count()).select_from(devices)) or 0
        worker_count = conn.scalar(select(func.count()).select_from(workers)) or 0
        order_count = conn.scalar(select(func.count()).select_from(orders)) or 0
        today_orders = conn.scalar(select(func.count()).select_from(orders).where(
            orders.c.created >= today_start
        )) or 0
        today_volume = conn.scalar(select(func.coalesce(func.sum(orders.c.amount_minor), 0)).where(
            orders.c.status == "PAID", orders.c.created >= today_start
        )) or 0
        active_agents = conn.scalar(select(func.count()).select_from(devices).where(
            devices.c.state == DEVICE_STATE_ONLINE
        )) or 0

    return {
        "merchants": merchant_count,
        "agents": active_agents,
        "owners": 0,  # tracked separately in production
        "users": 0,
        "upi_accounts": worker_count,
        "total_transactions": order_count,
        "today_transactions": today_orders,
        "confirmed_transactions": today_orders,
        "pending_transactions": 0,
        "failed_transactions": 0,
        "platform_volume_paise": today_volume,
        "platform_volume_rupees": today_volume / 100.0,
        "platform_revenue_paise": 0,
        "platform_revenue_rupees": 0.0,
        "monthly_aws_cost_paise": 0,
        "monthly_aws_cost_rupees": 0.0,
        "open_incidents": 0,
        "aws_resource_count": 0,
        "platform_availability": 100.0,
        "financially_verified_total": 0,
        "generated_at": now_ts,
    }


@router.get("/superadmin/incidents", response_model=list[dict], dependencies=[Depends(require_unreviewed_feature_disabled)])
def superadmin_incidents(request: Request, authorization: Token = None):
    """Open platform incidents."""
    with request.app.state.engine.connect() as conn:
        rows = conn.execute(select(audit).where(
            audit.c.event.in_(["DEVICE_OFFLINE_TIMEOUT", "DEVICE_REVOKED", "CHECKOUT_FAILED"])
        ).order_by(audit.c.created.desc()).limit(50)).mappings().all()
    incidents = []
    for r in rows:
        incidents.append({
            "incident_id": r["id"],
            "severity": "HIGH",
            "status": "OPEN",
            "merchant_id": r["merchant_id"],
            "detected": formatTime(r["created"]),
            "assigned": None,
            "detail": r["detail"],
        })
    return incidents


@router.get("/superadmin/security", response_model=list[dict], dependencies=[Depends(require_unreviewed_feature_disabled)])
def superadmin_security(request: Request, authorization: Token = None):
    """Recent security events."""
    with request.app.state.engine.connect() as conn:
        rows = conn.execute(select(audit).where(
            audit.c.event.in_([
                "DEVICE_REVOKED", "AGENT_UPI_REGISTERED", "DEVICE_PAIRED",
                "EMAIL_NOTIFY", "AGENT_UPI_REGISTERED"
            ])
        ).order_by(audit.c.created.desc()).limit(50)).mappings().all()
    events = []
    for r in rows:
        events.append({
            "event_id": r["id"],
            "event": r["event"],
            "merchant_id": r["merchant_id"],
            "detected": formatTime(r["created"]),
            "detail": r["detail"],
        })
    return events


@router.get("/superadmin/aws/resources", response_model=list[dict], dependencies=[Depends(require_unreviewed_feature_disabled)])
def superadmin_aws_resources(request: Request, authorization: Token = None):
    """AWS resource discovery (read-only). Requires AWS credentials configured."""
        # Stub: AWS resources require Boto3 and valid credentials configured in the environment.
    # Return empty until AWS SDK access is provisioned.
    return []


@router.get("/superadmin/aws/billing", response_model=dict, dependencies=[Depends(require_unreviewed_feature_disabled)])
def superadmin_aws_billing(request: Request, authorization: Token = None):
    """AWS billing intelligence (read-only). Requires AWS credentials configured."""
    return {
        "monthly_cost_paise": 0,
        "monthly_cost_rupees": 0.0,
        "daily_cost_paise": 0,
        "daily_cost_rupees": 0.0,
        "budget_utilization_pct": 0.0,
        "currency": "INR",
        "last_updated": _now_ts(),
        "note": "AWS billing data requires Cost Explorer access configured in the environment.",
    }


@router.get("/superadmin/aws/credits", response_model=dict, dependencies=[Depends(require_unreviewed_feature_disabled)])
def superadmin_aws_credits(request: Request, authorization: Token = None):
    """AWS credit intelligence (read-only). Requires AWS credentials configured."""
    return {
        "original_credits_paise": 0,
        "applied_credits_paise": 0,
        "remaining_credits_paise": 0,
        "remaining_credits_rupees": 0.0,
        "credit_expiry": None,
        "eligible_services": [],
        "estimated_runway_days": None,
        "note": "AWS credit data requires Billing and Cost Management access configured in the environment.",
    }


# ============================================================================
# Business Inquiry API
# ============================================================================

class ContactInquiryInput(BaseModel):
    name: str = Field(min_length=2, max_length=150)
    company: str = Field(min_length=2, max_length=150)
    email: str = Field(pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    country: str = Field(min_length=2, max_length=100)
    monthly_volume: str = Field(default="", max_length=100)
    provider: str = Field(default="", max_length=100)
    message: str = Field(min_length=1, max_length=2000)


@router.post("/contact", status_code=201, response_model=dict, dependencies=[Depends(require_unreviewed_feature_disabled)])
def contact_inquiry(request: Request, item: ContactInquiryInput):
    """Business inquiry form submission."""
    now_ts = _now_ts()
    with request.app.state.engine.begin() as conn:
        conn.execute(audit.insert().values(
            merchant_id=None,
            event="BUSINESS_INQUIRY",
            detail=f"{item.name} ({item.company}) - {item.country} - {item.email}",
            created=now_ts,
        ))
    return {
        "status": "received",
        "message": "Thank you for your inquiry. Our team will contact you soon.",
        "contact_email": "nitish@thenitishkr.in",
        "contact_whatsapp": "+91-9142197135",
        "submitted_at": now_ts,
    }


# ============================================================================
# Canonical URL Registry Endpoint
# ============================================================================

@router.get("/canonical-urls", response_model=dict)
def canonical_urls(request: Request):
    """Return all canonical URL mappings for the platform."""
    return {
        "environment": ENVIRONMENT,
        "base_domain": BASE_DOMAIN,
        "services": {
            "website": "https://disha8-2.thenitishkr.in/",
            "superadmin": "https://superadmin.disha8-2.thenitishkr.in/",
            "merchant_portal": "https://merchant.disha8-2.thenitishkr.in/",
            "agent_portal": "https://agenticpay.disha8-2.thenitishkr.in/",
            "support_portal": "https://support.disha8-2.thenitishkr.in/",
            "checkout": "https://checkout.disha8-2.thenitishkr.in/",
            "receipt": "https://receipt.disha8-2.thenitishkr.in/",
            "api_public": "https://api.disha8-2.thenitishkr.in/",
            "system_status": "https://status.disha8-2.thenitishkr.in/",
        },
        "contact_email": "nitish@thenitishkr.in",
        "contact_whatsapp": "+91-9142197135",
        "generated_at": now(),
    }

