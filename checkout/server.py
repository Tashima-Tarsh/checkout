"""Browser-only UPI payment initiation and synthetic evidence observations."""
import hashlib
import io
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
from fastapi import FastAPI, Header, HTTPException, Request, Response
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select, text
from sqlalchemy.dialects.postgresql import insert as postgres_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.exc import SQLAlchemyError

from checkout.storage import creation_limits, debit_evidence, events, make_engine, metadata, receipts, sessions, vpa_routes
from checkout.vpa_admin import router as admin_router, enforce_optional_session_allowlist
from checkout.saas import router as saas_router
from pdep.protocol import Session, SimulatedIssuer, Verifier

ROOT = Path(__file__).parent
DEMO = os.getenv("PDEP_DEMO_MODE") == "1" and not (
    os.getenv("RAILWAY_ENVIRONMENT") or os.getenv("PDEP_REQUIRE_POSTGRES") == "1"
)
ISSUER = SimulatedIssuer() if DEMO else None
VALID_PROOF = "SIMULATED_ISSUER_ATTESTATION_VALID"
log = logging.getLogger("checkout")
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
    params = dict(pa=row["vpa"], pn=row["name"], am=f"{rupees}.{paise:02}", cu="INR")
    if row["mode"] == "P2M":
        params["tn"] = "PDEP " + row["id"]
        if row["mcc"]:
            params["mc"] = row["mcc"]
    return "upi://pay?" + urlencode(params, quote_via=quote, safe="")


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
    return (ROOT / "static" / "index.html").read_text(encoding="utf-8")

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
    """Device (Android camera OCR / sound / color / barcode) reports UPI payment evidence.
    
    The payer device is hostile — this endpoint records the claim but sets
    financially_verified=True ONLY when VPA and amount match the session server-side.
    Credit settlement happens later via banking rails (3 days); this is verification
    that a real UPI payment occurred, not settlement.
    """
    with request.app.state.engine.begin() as connection:
        row = auth(connection, sid, authorization)
        require_active(row)
        now = int(time.time())
        # Rate limit: max 5 device-evidence attempts per session per minute
        recent = connection.execute(
            select(events).where(
                events.c.sid == sid,
                events.c.kind.like("DEVICE_EVIDENCE%"),
                events.c.created >= now - 60,
            )
        ).mappings().all()
        if len(recent) >= 5:
            return view(auth(connection, sid, authorization))
        # Server-side match: VPA + amount must match the session. Never trust
        # client-submitted UTR alone — UTR is evidence only when bound to a
        # session whose payee and amount the server already knows.
        vpa_match = b.payee_vpa.lower() == row["vpa"].lower()
        amount_match = b.amount_paise == row["amount"]

        if vpa_match and amount_match:
            connection.execute(
                sessions.update().where(sessions.c.id == sid)
                .values(financially_verified=True)
            )
            insert_once(connection, debit_evidence,
                sid=sid, utr=b.utr, amount_minor=b.amount_paise,
                payee_vpa=b.payee_vpa, claimed_paid_at=b.claimed_paid_at,
                source=b.source, server_confirmed=True, created=int(time.time()),
            )
            connection.execute(
                events.insert().values(sid=sid, kind="DEVICE_EVIDENCE_VERIFIED", created=int(time.time()))
            )
        else:
            # Record the attempt but do not verify. Mismatched payee/amount is fraud.
            insert_once(connection, debit_evidence,
                sid=sid, utr=b.utr, amount_minor=b.amount_paise,
                payee_vpa=b.payee_vpa, claimed_paid_at=b.claimed_paid_at,
                source=b.source, server_confirmed=False, created=int(time.time()),
            )
            connection.execute(
                events.insert().values(sid=sid, kind="DEVICE_EVIDENCE_REJECTED", created=int(time.time()))
            )

        return view(auth(connection, sid, authorization))


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
