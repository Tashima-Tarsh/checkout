"""Independent Agentic Pay application entry point."""
import asyncio
import logging
import os
import re
from contextlib import asynccontextmanager
from pathlib import Path

from cryptography.fernet import Fernet
from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError

from checkout.agentic_api import ORDER_ID, digest, now, router
from checkout.agentic_login import configure, router as login_router
from checkout.agentic_storage import amount_reservations, initialize, make_engine, merchants, orders, expire_previous_uat_links
from checkout.agentic_worker import N8nProvider, dispatch_next
from checkout.agentic_vision_api import router as vision_router
from checkout.agentic_test_checkout import router as test_checkout_router, auto_enabled, open_test_checkout

ASSETS = Path(__file__).parent / "agentic_assets"
log = logging.getLogger(__name__)


async def dispatch_pending(engine, provider, stopped):
    while not stopped.is_set():
        try:
            if await asyncio.to_thread(dispatch_next, engine, provider):
                continue
        except SQLAlchemyError:
            log.error("Agentic Pay dispatch storage unavailable")
        try:
            await asyncio.wait_for(stopped.wait(), timeout=1)
        except TimeoutError:
            pass


@asynccontextmanager
async def lifespan(app):
    token = os.environ.get("AGENTIC_OWNER_TOKEN", "")
    if re.fullmatch(r"[A-Za-z0-9_-]{43,128}", token) is None:
        raise RuntimeError("Set AGENTIC_OWNER_TOKEN to a randomly generated secret")
    app.state.owner_token_hash = digest(token)
    app.state.account_cipher = Fernet(os.environ["AGENTIC_ACCOUNT_KEY"].encode())
    engine = make_engine()
    try:
        initialize(engine)
        app.state.engine = engine
        app.state.password_login = configure(engine, token)
        cutoff = os.environ.get("AGENTIC_TEST_EXPIRE_BEFORE", "")
        if cutoff:
            merchant_id = os.environ.get("AGENTIC_LOGIN_MERCHANT_ID", "")
            if re.fullmatch(r"[0-9a-f]{32}", merchant_id) and re.fullmatch(r"[0-9]{10}", cutoff) and 0 < int(cutoff) <= now():
                count = expire_previous_uat_links(engine, merchant_id=merchant_id, cutoff=int(cutoff), timestamp=now())
                log.info("UAT historical checkout expiry applied: %s open links closed", count)
            else:
                log.error("Invalid UAT historical checkout expiry configuration; no links changed")
        webhook = os.environ.get("AGENTIC_N8N_WEBHOOK")
        dispatch_token = os.environ.get("AGENTIC_N8N_TOKEN")
        if bool(webhook) != bool(dispatch_token):
            raise RuntimeError("Configure the n8n webhook and token together")
        stopped = asyncio.Event()
        task = None
        if webhook:
            task = asyncio.create_task(
                dispatch_pending(engine, N8nProvider(webhook, dispatch_token), stopped)
            )
        try:
            yield
        finally:
            stopped.set()
            if task is not None:
                await task
    finally:
        engine.dispose()


app = FastAPI(title="Agentic Pay", lifespan=lifespan, docs_url=None, redoc_url=None, openapi_url=None)
app.include_router(router)
app.include_router(login_router)
app.include_router(vision_router)
app.include_router(test_checkout_router)
app.mount("/assets", StaticFiles(directory=ASSETS), name="assets")


@app.exception_handler(RequestValidationError)
async def validation_error(request, error):
    return JSONResponse({"detail": "Invalid request input"}, status_code=422)


@app.exception_handler(SQLAlchemyError)
async def database_error(request, error):
    return JSONResponse({"detail": "Storage unavailable"}, status_code=503)


@app.middleware("http")
async def security_headers(request, call_next):
    response = await call_next(request)
    response.headers.update({
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "no-referrer",
        "Content-Security-Policy": "default-src 'self'; style-src 'self' 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
    })
    if request.url.path == "/research/vision-uat" or (request.url.path == "/agenticcheckouttest" and os.getenv("AGENTIC_TEST_VISION_DEMO") == "1"):
        response.headers["Content-Security-Policy"] = "default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; media-src 'self' blob:; connect-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"
        response.headers["Permissions-Policy"] = "display-capture=(self), camera=(), microphone=()"
    return response


@app.get("/research/vision-uat")
def vision_permission_uat():
    return FileResponse(ASSETS / "vision-uat.html")


@app.get("/healthz")
def health(request: Request):
    with request.app.state.engine.connect() as conn:
        conn.execute(select(merchants.c.id).limit(1))
    return {"ok": True, "verification": "PENDING"}


@app.get("/")
def home():
    return RedirectResponse("/merchant")


@app.get("/admin")
@app.get("/admin/")
def legacy_admin():
    return RedirectResponse("/owner")


@app.get("/merchant")
@app.get("/owner")
@app.get("/agents")
def portal():
    return FileResponse(ASSETS / "portal.html")


@app.get("/checkout/{order_id}/diagnostics")
@app.get("/checkout/{order_id}")
def checkout(order_id: str):
    if not ORDER_ID.fullmatch(order_id):
        raise HTTPException(404, "Order not found")
    return FileResponse(ASSETS / "checkout.html")


@app.get("/research/split-screen")
def split_screen_research():
    return FileResponse(ASSETS / "split-screen-pixel.html", headers={"Permissions-Policy": "display-capture=(self), camera=(), microphone=()"})


@app.get("/agenticcheckouttest")
def public_test_checkout(request: Request):
    if os.getenv("AGENTIC_TEST_VISION_DEMO") == "1":
        return FileResponse(ASSETS / "vision-uat.html")
    if auto_enabled():
        return open_test_checkout(request, ASSETS)
    # Operator opts in by selecting an already allocated, authorized test order.
    # Public GET never creates an order, consumes an amount, or changes payment state.
    order_id = os.environ.get("AGENTIC_TEST_ORDER_ID", "")
    amount = os.environ.get("AGENTIC_TEST_AMOUNT_MINOR", "100")
    if not re.fullmatch(r"1[0-9]{2}", amount) or not ORDER_ID.fullmatch(order_id):
        raise HTTPException(404, "Test checkout not configured")
    with request.app.state.engine.connect() as conn:
        order = conn.execute(
            select(orders.c.status, orders.c.expires, amount_reservations.c.payable_minor)
            .join(amount_reservations, (amount_reservations.c.order_id == orders.c.id)
                  & (amount_reservations.c.account_id == orders.c.account_id))
            .where(orders.c.id == order_id)
        ).mappings().first()
    if order is None or order["payable_minor"] != int(amount):
        raise HTTPException(404, "Test checkout unavailable")
    if order["status"] != "AWAITING_PAYMENT" or order["expires"] <= now():
        raise HTTPException(410, "Test checkout expired or already submitted")
    return RedirectResponse(f"/checkout/{order_id}", status_code=303)
