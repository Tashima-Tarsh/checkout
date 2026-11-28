"""Browser-only UPI payment initiation and synthetic evidence observations."""
import asyncio
import base64
import hashlib
import hmac
import io
import json
import logging
import os
import re
import secrets
import time
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Annotated, Literal
from urllib.parse import quote, urlencode

import qrcode
from fastapi import FastAPI, Header, HTTPException, Request, Response, WebSocket, WebSocketDisconnect
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select, text
from sqlalchemy.dialects.postgresql import insert as postgres_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.exc import SQLAlchemyError

from checkout.storage import creation_limits, debit_evidence, events, make_engine, metadata, receipts, sessions, vpa_routes
from checkout.agentic_storage import merchants
from checkout.vpa_admin import router as admin_router, enforce_optional_session_allowlist
from checkout.saas import router as saas_router
from checkout.recovery_integration import recovery_router
from pdep.protocol import Session, SimulatedIssuer, Verifier

ROOT = Path(__file__).parent
DEMO = os.getenv("PDEP_DEMO_MODE") == "1" and not (
    os.getenv("RAILWAY_ENVIRONMENT") or os.getenv("PDEP_REQUIRE_POSTGRES") == "1"
)
ISSUER = SimulatedIssuer() if DEMO else None
VALID_PROOF = "SIMULATED_ISSUER_ATTESTATION_VALID"
log = logging.getLogger("checkout")
TR_KEY = os.getenv("PDEP_TR_KEY", "dev-only-change-in-production").encode()


def make_tr(sid: str, amount: int, vpa: str) -> str:
    digest = hmac.new(TR_KEY, f"{sid}|{amount}|{vpa}".encode(), "sha256").digest()
    return base64.b32encode(digest).decode().rstrip("=")[:35]


Authorization = Annotated[str | None, Header(max_length=256)]
EVENT_STATES = {
    "UPI_LAUNCH_ATTEMPTED": "PAYMENT_LAUNCHED",
    "BROWSER_RESUMED": "BROWSER_RETURNED",
    "PAYER_CLAIMED_PAID": "PAYER_CLAIMED_SUCCESS",
    "PAYER_CANCELLED": "CONSISTENT_UNVERIFIED",
}
OBSERVATION_PROGRESS = {
    name: rank for rank, name in enumerate(("AWAITING_PAYMENT", *EVENT_STATES.values()))
}


@asynccontextmanager
async def lifespan(app):
    engine = make_engine()
    try:
        if engine.dialect.name == "sqlite":
            metadata.create_all(engine)
        app.state.engine = engine
        yield
    finally:
        engine.dispose()


app = FastAPI(title="PDEP research checkout", lifespan=lifespan)
app.mount("/static", StaticFiles(directory=ROOT / "static"), name="static")
# Isolated opt-in research lab. Existing checkout routes are unchanged.
app.mount("/pdep-lab", StaticFiles(directory=ROOT / "static" / "pdep-lab", html=True), name="pdep-lab")
app.include_router(admin_router)
app.include_router(saas_router)
app.include_router(recovery_router)


@app.middleware("http")
async def response_headers(request: Request, call_next):
    request_id = secrets.token_hex(12)
    try:
        response = await call_next(request)
    except SQLAlchemyError:
        log.error("database operation failed request_id=%s", request_id)
        response = JSONResponse({"detail": "Storage unavailable"}, status_code=503)
    response.headers.update({
        "X-Request-ID": request_id,
        "Referrer-Policy": "no-referrer",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'self'; img-src 'self' blob:; frame-ancestors 'none'; base-uri 'none'",
    })
    if request.url.path.startswith("/api/"):
        response.headers["Cache-Control"] = "no-store"
    return response


class Create(BaseModel):
    mode: Literal["P2P", "P2M"]
    vpa: str | None = Field(default=None, pattern=r"^[A-Za-z0-9_.-]{2,256}@[A-Za-z0-9_.-]{2,64}$")
    route_key: str | None = Field(default=None, pattern=r"^[a-z0-9][a-z0-9_-]{0,63}$")
    name: str = Field(default="Recipient", min_length=1, max_length=80)
    amount_paise: int = Field(strict=True, ge=100, le=100000000)
    mcc: str | None = Field(default=None, pattern=r"^[0-9]{4}$")

    @field_validator("name", mode="before")
    @classmethod
    def normalize_name(cls, value):
        return value.strip() if isinstance(value, str) else value


class Observation(BaseModel):
    event: Literal["UPI_LAUNCH_ATTEMPTED", "BROWSER_RESUMED", "PAYER_CLAIMED_PAID", "PAYER_CANCELLED"]


class Proof(BaseModel):
    receipt: dict


class DeviceEvidence(BaseModel):
    utr: str = Field(pattern=r"^[0-9]{12}$")
    amount_paise: int = Field(strict=True, ge=100, le=100000000)
    payee_vpa: str = Field(pattern=r"^[A-Za-z0-9_.-]{2,256}@[A-Za-z0-9_.-]{2,64}$")
    claimed_paid_at: int = Field(strict=True, ge=0)
    source: Literal["camera_ocr", "barcode", "sound", "color_pattern", "upi_intent_return"]


def auth(connection, sid, authorization):
    scheme, _, token = (authorization or "").partition(" ")
    if scheme.lower() != "bearer" or not re.fullmatch(r"[A-Za-z0-9_-]{43}", token):
        raise HTTPException(401, "Bearer authorization required")
    query = select(sessions).where(sessions.c.id == sid)
    row = connection.execute(query).mappings().one_or_none()
    if row is None or not secrets.compare_digest(row["token_hash"], digest(token)):
        raise HTTPException(404, "Session not found")
    return row


def digest(token):
    return hashlib.sha256(token.encode("ascii")).hexdigest()


def uri(row):
    rupees, paise = divmod(row["amount"], 100)
    tr = row.get("tr") or ""
    callback = row.get("callback") or ""
    tn = f"ORD-{row['id'][3:11]}-{row['amount']}"
    mc = row.get("mcc") or "5411"
    params = dict(
        pa=row["vpa"],
        pn=row["name"],
        am=f"{rupees}.{paise:02}",
        cu="INR",
        tn=tn,
        mc=mc,
    )
    if tr:
        params["tr"] = tr
    if callback:
        params["url"] = callback
    query = urlencode(params, quote_via=quote, safe="")
    if callback:
        fallback = quote(callback + "&fb=1", safe="")
        return f"intent://pay?{query}#Intent;scheme=upi;S.browser_fallback_url={fallback};end"
    return f"intent://pay?{query}#Intent;scheme=upi;end"


def require_active(row):
    if int(time.time()) >= row["expires"]:
        raise HTTPException(410, "Session expired")


def insert_once(connection, table, **values):
    insert = postgres_insert if connection.dialect.name == "postgresql" else sqlite_insert
    query = insert(table).values(**values).on_conflict_do_nothing().returning(list(table.primary_key)[0])
    return connection.execute(query).scalar_one_or_none() is not None


def proof_session(row):
    return Session(row["id"], row["nonce"], row["mode"], row["vpa"], row["amount"], row["mcc"])


def view(row):
    expired = int(time.time()) >= row["expires"]
    fv = row["financially_verified"] if "financially_verified" in row else False
    return dict(session_id=row["id"], mode=row["mode"], vpa=row["vpa"], name=row["name"],
                amount_paise=row["amount"], mcc=row["mcc"], expires=row["expires"],
                state="EXPIRED" if expired else row["state"],
                test_attested=row["state"] == "SIMULATED_PROOF_VALID",
                financially_verified=bool(fv),
                payment_uri=None if expired else uri(row),
                synthetic_enabled=DEMO)


@app.get("/", response_class=HTMLResponse)
def home():
    return (ROOT / "static" / "payment.html").read_text(encoding="utf-8")

@app.get("/admin", response_class=HTMLResponse)
def admin_page():
    return (ROOT / "static" / "admin.html").read_text(encoding="utf-8")


@app.post("/api/sessions", status_code=201)
def create(b: Create, request: Request):
    enforce_optional_session_allowlist(request)
    if b.mode == "P2P" and b.mcc is not None:
        raise HTTPException(422, "MCC is available only for merchant payments")
    if bool(b.vpa) == bool(b.route_key):
        raise HTTPException(422, "Supply exactly one: vpa or route_key")
    token = secrets.token_urlsafe(32)
    with request.app.state.engine.begin() as connection:
        if b.route_key:
            selected = connection.execute(
                select(vpa_routes).where(
                    vpa_routes.c.route_key == b.route_key,
                    vpa_routes.c.mode == b.mode,
                    vpa_routes.c.enabled.is_(True),
                ).order_by(vpa_routes.c.priority.asc(), vpa_routes.c.id.asc()).limit(1)
            ).mappings().one_or_none()
            if selected is None:
                raise HTTPException(422, "No enabled recipient for this route and mode")
            target_vpa, target_mcc = selected["vpa"], selected["mcc"]
        else:
            target_vpa, target_mcc = b.vpa.lower(), b.mcc
        row = dict(id="ps_" + secrets.token_urlsafe(18), token_hash=digest(token),
                   nonce=secrets.token_urlsafe(32), mode=b.mode, vpa=target_vpa, name=b.name,
                   amount=b.amount_paise, mcc=target_mcc, expires=int(time.time()) + (90 if b.mode == "P2P" else 900),
                   state="AWAITING_PAYMENT", financially_verified=False)
        origin = str(request.base_url).rstrip("/")
        row["tr"] = make_tr(row["id"], row["amount"], row["vpa"])
        row["callback"] = f"{origin}/api/cb?sid={row['id']}"
        bucket = int(time.time()) // 60
        insert = postgres_insert if connection.dialect.name == "postgresql" else sqlite_insert
        limit = insert(creation_limits).values(bucket=bucket, count=1).on_conflict_do_update(
            index_elements=[creation_limits.c.bucket],
            set_={"count": creation_limits.c.count + 1},
            where=creation_limits.c.count < 60,
        )
        if connection.execute(limit.returning(creation_limits.c.bucket)).scalar_one_or_none() is None:
            raise HTTPException(429, "Session creation limit reached", headers={"Retry-After": "60"})
        connection.execute(creation_limits.delete().where(creation_limits.c.bucket < bucket - 1))
        connection.execute(sessions.insert().values(**row))
    return {"token": token, **view(row)}


@app.get("/api/sessions/{sid}")
def get(sid: str, request: Request, authorization: Authorization = None):
    with request.app.state.engine.connect() as connection:
        return view(auth(connection, sid, authorization))


@app.get("/api/sessions/{sid}/qr.png")
def qr(sid: str, request: Request, authorization: Authorization = None):
    with request.app.state.engine.connect() as connection:
        row = auth(connection, sid, authorization)
    require_active(row)
    output = io.BytesIO()
    qrcode.make(uri(row)).save(output, format="PNG")
    return Response(output.getvalue(), media_type="image/png")


@app.post("/api/sessions/{sid}/observe")
def observe(sid: str, b: Observation, request: Request, authorization: Authorization = None):
    state = EVENT_STATES[b.event]
    with request.app.state.engine.begin() as connection:
        row = auth(connection, sid, authorization)
        require_active(row)
        if insert_once(connection, events, sid=sid, kind=b.event, created=int(time.time())):
            earlier = [name for name, rank in OBSERVATION_PROGRESS.items()
                       if rank < OBSERVATION_PROGRESS[state]]
            connection.execute(sessions.update().where(
                sessions.c.id == sid, sessions.c.state.in_(earlier),
                sessions.c.expires > int(time.time()),
            ).values(state=state))
        return view(auth(connection, sid, authorization))


@app.post("/api/sessions/{sid}/copy")
def copy(sid: str, request: Request, authorization: Authorization = None):
    """Record copy-to-clipboard event. Arms verification but never sets financially_verified."""
    with request.app.state.engine.begin() as connection:
        row = auth(connection, sid, authorization)
        require_active(row)
        insert_once(connection, events, sid=sid, kind="UPI_ID_COPIED", created=int(time.time()))
        return view(auth(connection, sid, authorization))


@app.post("/api/sessions/{sid}/device-evidence")
def device_evidence(sid: str, b: DeviceEvidence, request: Request, authorization: Authorization = None):
    """Record device-reported UPI payment evidence; server matches VPA+amount before verifying."""
    with request.app.state.engine.begin() as connection:
        row = auth(connection, sid, authorization)
        require_active(row)
        now = int(time.time())
        # Rate limit: max 5 device-evidence attempts per session per minute (fixes BUG 3)
        recent = connection.execute(
            select(events).where(
                events.c.sid == sid,
                events.c.kind.like("DEVICE_EVIDENCE%"),
                events.c.created >= now - 60,
            )
        ).mappings().all()
        if len(recent) >= 5:
            return view(auth(connection, sid, authorization))
        matches = (
            b.payee_vpa.lower() == row["vpa"].lower()
            and b.amount_paise == row["amount"]
        )
        insert_once(
            connection, debit_evidence,
            sid=sid, utr=b.utr, amount_minor=b.amount_paise,
            payee_vpa=b.payee_vpa, claimed_paid_at=b.claimed_paid_at,
            source=b.source, server_confirmed=bool(matches), created=now,   # BUG 2 fixed
        )
        if matches:                                                          # BUG 1 fixed
            connection.execute(
                sessions.update().where(sessions.c.id == sid)
                .values(financially_verified=True)
            )
        insert_once(
            connection, events, sid=sid,
            kind="DEVICE_EVIDENCE_OBSERVED" if matches else "DEVICE_EVIDENCE_REJECTED",
            created=now,
        )
        return view(auth(connection, sid, authorization))


@app.post("/api/sessions/{sid}/depart")
def depart(sid: str, request: Request, authorization: Authorization = None):
    """Record the server-clocked moment the payer leaves to pay (sendBeacon)."""
    with request.app.state.engine.begin() as connection:
        row = auth(connection, sid, authorization)
        require_active(row)
        connection.execute(
            sessions.update().where(sessions.c.id == sid)
            .values(t_depart=int(time.time()))
        )
        return {"ok": True}


@app.get("/api/sessions/{sid}/debit-evidence")
def debit_evidence_status(sid: str, request: Request, authorization: Authorization = None):
    """Frontend polls this to learn whether device evidence was verified."""
    with request.app.state.engine.connect() as connection:
        row = auth(connection, sid, authorization)
        evidence = connection.execute(
            select(debit_evidence).where(debit_evidence.c.sid == sid)
            .order_by(debit_evidence.c.created.desc()).limit(1)
        ).mappings().one_or_none()
        return {
            "session_id": row["id"],
            "financially_verified": bool(row["financially_verified"]),
            "evidence": dict(evidence) if evidence else None,
            "state": row["state"],
        }


@app.get("/api/cb")
def upi_callback(request: Request):
    """UPI app callback endpoint. Validates tr, txnId, time window, status.

    Never sets financially_verified on its own; promotes to PENDING_OCR so
    the capture/OCR pipeline can corroborate before acceptance.
    """
    q = request.query_params
    sid = q.get("sid")
    tr = q.get("tr")
    txn_id = q.get("txnId")
    status = q.get("Status")
    amount = q.get("amount")

    if not sid:
        return JSONResponse({"error": "missing_sid"}, status_code=400)

    with request.app.state.engine.begin() as connection:
        row = connection.execute(
            select(sessions).where(sessions.c.id == sid)
        ).mappings().one_or_none()
        if row is None:
            return JSONResponse({"error": "unknown_session"}, status_code=404)
        if row["state"] != "AWAITING_PAYMENT":
            return JSONResponse({"error": "session_not_pending", "state": row["state"]}, status_code=409)
        if not row["tr"] or tr != row["tr"]:
            return JSONResponse({"error": "tr_mismatch"}, status_code=409)

        now = int(time.time())
        t_depart = row["t_depart"]
        if t_depart is not None:
            dt = now - t_depart
            if dt < 3:
                return JSONResponse({"error": "too_fast"}, status_code=409)
            if dt > 120:
                return JSONResponse({"error": "expired"}, status_code=409)

        if status != "SUCCESS":
            connection.execute(
                sessions.update().where(sessions.c.id == sid)
                .values(state="PAYMENT_FAILED")
            )
            return JSONResponse({"error": "status_" + str(status)}, status_code=409)

        if amount is not None:
            try:
                amount_paise = int(float(amount) * 100)
                if amount_paise != row["amount"]:
                    return JSONResponse({"error": "amount_mismatch"}, status_code=409)
            except (ValueError, TypeError):
                pass

        connection.execute(
            sessions.update().where(sessions.c.id == sid)
            .values(state="PENDING_OCR")
        )
        return {"state": "PENDING_OCR", "session_id": sid}


@app.post("/api/sessions/{sid}/proof")
def proof(sid: str, b: Proof, request: Request, authorization: Authorization = None):
    with request.app.state.engine.begin() as connection:
        row = auth(connection, sid, authorization)
        require_active(row)
        result = "UNTRUSTED_ISSUER"
        if DEMO:
            verifier = Verifier({"SIMULATED_ONLY": ISSUER.public()})
            result = verifier.verify(proof_session(row), b.receipt)
        if result == VALID_PROOF:
            reference = b.receipt["payload"]["txref"]
            if len(reference) > 128:
                result = "INVALID_REFERENCE"
            elif not insert_once(connection, receipts, issuer="SIMULATED_ONLY", reference=reference):
                result = "REPLAY"
        state = "SIMULATED_PROOF_VALID" if result == VALID_PROOF else "EVIDENCE_REJECTED"
        query = sessions.update().where(sessions.c.id == sid, sessions.c.expires > int(time.time()))
        if result != VALID_PROOF:
            query = query.where(sessions.c.state != "SIMULATED_PROOF_VALID")
        connection.execute(query.values(state=state))
        return {"result": result, **view(auth(connection, sid, authorization))}


if DEMO:
    @app.post("/api/demo/sessions/{sid}/issue-test-proof")
    def issue_demo_proof(sid: str, request: Request, authorization: Authorization = None):
        with request.app.state.engine.connect() as connection:
            row = auth(connection, sid, authorization)
        require_active(row)
        return {"receipt": ISSUER.issue(proof_session(row), "SIM_" + secrets.token_hex(12))}


@app.get("/api/sessions/{sid}/events")
def event_history(sid: str, request: Request, authorization: Authorization = None):
    with request.app.state.engine.connect() as connection:
        auth(connection, sid, authorization)
        query = select(events.c.kind, events.c.created).where(events.c.sid == sid)
        return [dict(row) for row in connection.execute(query.order_by(events.c.created, events.c.kind)).mappings()]


@app.get("/healthz")
def health(request: Request):
    with request.app.state.engine.connect() as connection:
        connection.execute(text("SELECT id FROM checkout_sessions WHERE 1 = 0"))
    return {"ok": True, "synthetic_enabled": DEMO}


# ============================================================================
# Android Workspace - WebSocket relay between host agent and browser
# ============================================================================

# Connected WebSocket clients
_host_ws: WebSocket | None = None
_viewer_ws: WebSocket | None = None

# WebSocket authentication helper for Android Workspace
async def _auth_websocket(websocket: WebSocket) -> str | None:
    """Authenticate WebSocket connection using Bearer token from query params.
    Token must match a valid merchant API token.
    Returns the merchant_id on success.
    """
    auth_header = websocket.query_params.get("authorization")
    if not auth_header or not auth_header.lower().startswith("bearer "):
        await websocket.close(code=4001, reason="Authentication required")
        return None

    token = auth_header.split(" ", 1)[1]

    with websocket.app.state.engine.connect() as conn:
        identity = conn.scalar(
            select(merchants.c.id).where(merchants.c.token_hash == digest(token))
        )
    if identity is None:
        await websocket.close(code=4001, reason="Invalid token")
        return None

    return identity


@app.get("/api/android/workspace/status")
def android_workspace_status(request: Request):
    raise HTTPException(503, "Android Workspace authentication not configured")


@app.post("/api/android/workspace/start")
def android_workspace_start(request: Request):
    raise HTTPException(503, "Android Workspace authentication not configured")


@app.post("/api/android/workspace/stop")
def android_workspace_stop(request: Request):
    raise HTTPException(503, "Android Workspace authentication not configured")


@app.post("/api/android/workspace/restart")
def android_workspace_restart(request: Request):
    raise HTTPException(503, "Android Workspace authentication not configured")


@app.post("/api/android/workspace/input")
def android_workspace_input(request: Request, body: dict):
    raise HTTPException(503, "Android Workspace authentication not configured")


@app.get("/api/android/workspace/config")
def android_workspace_config(request: Request):
    raise HTTPException(503, "Android Workspace authentication not configured")


@app.get("/android/workspace", response_class=HTMLResponse)
def android_workspace_page():
    raise HTTPException(503, "Android Workspace authentication not configured")


@app.websocket("/android/ws/host")
async def android_ws_host(websocket: WebSocket):
    """WebSocket endpoint for the Android host agent (runs on local Windows machine).
    Requires Bearer token authentication matching PDEP_ADMIN_TOKEN.
    """
    global _host_ws

    tenant_id = await _auth_websocket(websocket)
    if tenant_id is None:
        return

    await websocket.accept()
    _host_ws = websocket
    log.info("Android host agent connected via WebSocket")
    try:
        # Send initial device status (host reports its own state)
        await websocket.send_json({
            "type": "device_status",
            "device_id": os.getenv("ANDROID_DEVICE_ID", "AgenticMobile0001"),
            "connected": True,
            "state": "connected",
            "tenant_id": tenant_id,
        })

        # Relay messages from host to viewers
        while True:
            message = await websocket.receive_text()
            try:
                data = json.loads(message)
                msg_type = data.get("type")

                if msg_type == "screen_frame":
                    # Forward screen frame to all viewers
                    if _viewer_ws:
                        await _viewer_ws.send_json(data)
                elif msg_type == "device_status":
                    # Forward status to all viewers
                    if _viewer_ws:
                        await _viewer_ws.send_json(data)
                elif msg_type == "ping":
                    await websocket.send_json({"type": "pong"})
            except json.JSONDecodeError:
                log.error(f"Invalid message from host: {message}")
    except WebSocketDisconnect:
        log.info("Android host agent disconnected")
    except Exception as e:
        log.error(f"Host WebSocket error: {e}")
    finally:
        _host_ws = None


@app.websocket("/android/ws/viewer")
async def android_ws_viewer(websocket: WebSocket):
    """WebSocket endpoint for the Android Workspace viewer (browser).
    Requires Bearer token authentication with owner/admin role.
    """
    global _viewer_ws

    tenant_id = await _auth_websocket(websocket)
    if tenant_id is None:
        return

    await websocket.accept()
    _viewer_ws = websocket
    log.info("Android Workspace viewer connected")

    try:
        # Send initial connection status
        await websocket.send_json({
            "type": "connection",
            "status": "connected",
            "host_connected": _host_ws is not None,
            "tenant_id": tenant_id,
        })

        # Relay messages from viewer to host
        while True:
            message = await websocket.receive_text()
            try:
                data = json.loads(message)
                msg_type = data.get("type")

                if msg_type == "inject_input":
                    # Forward input to host agent
                    if _host_ws:
                        await _host_ws.send_json(data)
                    else:
                        await websocket.send_json({
                            "type": "error",
                            "message": "Host agent not connected",
                        })
                elif msg_type == "get_status":
                    # Request status from host
                    if _host_ws:
                        await _host_ws.send_json({"type": "get_status"})
                    else:
                        await websocket.send_json({
                            "type": "device_status",
                            "connected": False,
                            "state": "offline",
                        })
                elif msg_type == "ping":
                    await websocket.send_json({"type": "pong"})
            except json.JSONDecodeError:
                log.error(f"Invalid message from viewer: {message}")
    except WebSocketDisconnect:
        log.info("Android Workspace viewer disconnected")
    except Exception as e:
        log.error(f"Viewer WebSocket error: {e}")
    finally:
        _viewer_ws = None


# Mount Android observer static files
if (ROOT / "static" / "android").is_dir():
    app.mount("/android/assets", StaticFiles(directory=ROOT / "static" / "android"), name="android_assets")