"""Opt-in, bounded UAT order allocator. Public visits never verify payment."""
import hmac
import os
import re
import secrets

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import FileResponse, RedirectResponse
from sqlalchemy import func, select

from checkout.agentic_api import event, now, unused_payable
from checkout.agentic_login import require_same_origin
from checkout.agentic_storage import accounts, amount_reservations, orders, shared_test_orders

router = APIRouter()
COOKIE = "__Host-agentic_test_session"
TOKEN = re.compile(r"[A-Za-z0-9_-]{43}")
LOWER, UPPER = 100, 199
MAX_NEW_PER_MINUTE = 5


def auto_enabled():
    return os.getenv("AGENTIC_TEST_AUTO") == "1"


def scope(conn, *, lock=False):
    identity = os.getenv("AGENTIC_LOGIN_MERCHANT_ID", "")
    if not re.fullmatch(r"[0-9a-f]{32}", identity):
        raise HTTPException(503, "Test checkout not configured")
    query = select(accounts.c.id).where(accounts.c.merchant_id == identity).order_by(accounts.c.id).limit(2)
    ids = list(conn.scalars(query.with_for_update() if lock else query))
    if len(ids) != 1:
        raise HTTPException(503, "Test checkout requires one registered account")
    return identity, ids[0]


def order_id(request, token, identity, account):
    # Secret-derived identifier binds a browser session to one account.
    return hmac.new(request.app.state.owner_token_hash.encode(),
        ("test-checkout:" + identity + ":" + account + ":" + token).encode(), "sha256").hexdigest()[:48]


def active(row, timestamp):
    return row is not None and row["status"] == "AWAITING_PAYMENT" and row["expires"] > timestamp


def existing(conn, identity, account, oid):
    return conn.execute(select(orders).where(orders.c.id == oid,
        orders.c.merchant_id == identity, orders.c.account_id == account)).mappings().first()


def open_test_checkout(request, assets):
    token = request.cookies.get(COOKIE, "")
    with request.app.state.engine.connect() as conn:
        identity, account = scope(conn)
        if TOKEN.fullmatch(token):
            oid = order_id(request, token, identity, account)
            row = existing(conn, identity, account, oid)
            if active(row, now()):
                return RedirectResponse("/checkout/" + oid, status_code=303)
            # Preserve the session through retries before allocation.
            if row is not None:
                token = ""
    response = FileResponse(assets / "test-checkout-entry.html")
    if not TOKEN.fullmatch(token):
        response.set_cookie(COOKIE, secrets.token_urlsafe(32), max_age=1800,
            secure=True, httponly=True, samesite="lax", path="/")
    return response


@router.post("/api/agenticcheckouttest")
def allocate_test(request: Request):
    if os.getenv("AGENTIC_TEST_VISION_DEMO") == "1":
        raise HTTPException(404, "Synthetic vision demo: payment allocation disabled")
    if not auto_enabled():
        raise HTTPException(404, "Test checkout disabled")
    require_same_origin(request)
    token = request.cookies.get(COOKIE, "")
    if not TOKEN.fullmatch(token):
        raise HTTPException(403, "Open test checkout first")
    timestamp = now()
    with request.app.state.engine.begin() as conn:
        identity, account = scope(conn, lock=True)
        oid = order_id(request, token, identity, account)
        row = existing(conn, identity, account, oid)
        if row is not None:
            if not active(row, timestamp):
                raise HTTPException(410, "Open test checkout again")
            return {"checkout_path": "/checkout/" + oid}
        recent = conn.scalar(select(func.count()).select_from(orders).where(
            orders.c.account_id == account, orders.c.created > timestamp - 60))
        if recent >= MAX_NEW_PER_MINUTE:
            raise HTTPException(429, "Please retry shortly")
        shared = os.getenv("AGENTIC_TEST_SHARED_AMOUNT") == "1"
        if shared:
            configured = os.getenv("AGENTIC_TEST_AMOUNT_MINOR", "100")
            if not re.fullmatch(r"1[0-9]{2}", configured):
                raise HTTPException(503, "Test amount configuration invalid")
            payable = int(configured)
        else:
            payable = unused_payable(conn, account, LOWER, UPPER, ascending=True)
            if payable is None:
                raise HTTPException(409, "Test amount pool exhausted")
        conn.execute(orders.insert().values(id=oid, merchant_id=identity, account_id=account,
            amount_minor=payable, created=timestamp, expires=timestamp+1800, status="AWAITING_PAYMENT"))
        if shared:
            # Deliberately ambiguous amount; this order cannot consume financial evidence.
            # The regular allocator also excludes unreserved historical order amounts.
            conn.execute(shared_test_orders.insert().values(order_id=oid))
        else:
            conn.execute(amount_reservations.insert().values(order_id=oid, account_id=account, payable_minor=payable))
        event(conn, identity, "TEST_SHARED_ORDER_CREATED" if shared else "TEST_ORDER_CREATED")
    return {"checkout_path": "/checkout/" + oid}
