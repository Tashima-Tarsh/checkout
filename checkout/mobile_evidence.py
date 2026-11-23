"""Payer-submitted mobile share, SMS text and receipt artefact intake.

Client-supplied material is not authenticated debit proof. Store only digests
and metadata, never raw private message bodies or receipt screenshots.
"""
from __future__ import annotations

import hashlib
import html
import re
import secrets
import time

from fastapi import APIRouter, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import HTMLResponse
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from checkout.storage import mobile_evidence, share_intake

router = APIRouter(tags=["mobile-evidence"])
MAX_BYTES = 2 * 1024 * 1024
LIFETIME = 600
FORM_TYPES = {"text/plain", "image/png", "image/jpeg", "image/webp", "application/pdf"}
SOURCES = {"app_share", "sms_paste", "notification_paste", "receipt_upload", "share_target"}


def digest(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def _record(connection, sid: str, source: str, evidence_hash: str, size: int):
    exists = connection.execute(select(mobile_evidence.c.id).where(
        mobile_evidence.c.sid == sid,
        mobile_evidence.c.evidence_hash == evidence_hash
    )).scalar_one_or_none()
    if exists is not None:
        return False
    try:
        with connection.begin_nested():
            connection.execute(mobile_evidence.insert().values(
                id="me_" + secrets.token_urlsafe(18),
                sid=sid, source=source, evidence_hash=evidence_hash,
                length_bytes=size, created=int(time.time()),
            ))
        return True
    except IntegrityError:
        return False


@router.post("/api/sessions/{sid}/evidence")
async def upload_evidence(
    sid: str, request: Request,
    source: str = Form("app_share"),
    text: str = Form(""),
    file: UploadFile | None = File(default=None),
):
    from checkout.server import auth, require_active, view

    if source not in SOURCES - {"share_target"}:
        raise HTTPException(422, "Invalid evidence source")
    if file is None and not text.strip():
        raise HTTPException(422, "Share text or choose a file")
    if file is not None and text.strip():
        raise HTTPException(422, "Submit text or a file, not both")
    if file is not None:
        if file.content_type not in FORM_TYPES:
            raise HTTPException(415, "Unsupported shared file format")
        body = await file.read(MAX_BYTES + 1)
    else:
        body = text.strip().encode("utf-8")
    if not body or len(body) > MAX_BYTES:
        raise HTTPException(413, "Evidence empty or too large")
    with request.app.state.engine.begin() as conn:
        row = auth(conn, sid, request.headers.get("authorization"))
        require_active(row)
        stored = _record(conn, sid, source, digest(body), len(body))
        return {"accepted": stored, "duplicate": not stored,
                "classification": "PAYER_SUBMITTED_UNVERIFIED",
                "financially_verified": False, "session_state": view(row)["state"]}


@router.post("/share-inbox", response_class=HTMLResponse)
async def share_target(
    request: Request,
    title: str = Form(""),
    text: str = Form(""),
    url: str = Form(""),
    files: UploadFile | None = File(default=None),
):
    """PWA share target. Generates a one-time claim code for a checkout tab.

    A share-sheet callback is never proof of a payment.
    """
    if files is not None:
        if files.content_type not in FORM_TYPES:
            raise HTTPException(415, "Unsupported file type")
        payload = await files.read(MAX_BYTES + 1)
    else:
        payload = (title[:1024] + "\n" + text + "\n" + url[:2048]).strip().encode("utf-8")
    if not payload or len(payload) > MAX_BYTES:
        raise HTTPException(413, "Shared content empty or too large")
    code = secrets.token_urlsafe(24)
    with request.app.state.engine.begin() as conn:
        conn.execute(share_intake.insert().values(
            code_hash=digest(code.encode("ascii")), evidence_hash=digest(payload),
            length_bytes=len(payload), created=int(time.time()),
            consumed=False,
        ))
        conn.execute(share_intake.delete().where(share_intake.c.created < int(time.time()) - LIFETIME))
    safe_code = html.escape(code)
    return HTMLResponse(
        '<!doctype html><html lang="en"><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width,initial-scale=1">'
        '<title>PDEP · Shared evidence</title><link rel="stylesheet" href="/static/style.css">'
        '<main class="share-result"><h1>Shared item received</h1>'
        '<p>Return to your PDEP checkout and enter this single-use code in the '
        '<strong>Attach mobile evidence</strong> section.</p>'
        f'<code id="claim">{safe_code}</code>'
        '<button class="primary" id="copyCode" type="button">Copy code</button>'
        '<p>This does not confirm a debit.</p>'
        '<a href="/">Open checkout</a>'
        '<script src="/static/share-result.js"></script></main></html>',
        headers={"Cache-Control": "no-store", "Referrer-Policy": "no-referrer"},
    )


@router.post("/api/sessions/{sid}/evidence/claim")
async def claim_share(sid: str, request: Request, code: str = Form(...)):
    from checkout.server import auth, require_active

    if not re.fullmatch(r"[A-Za-z0-9_-]{32}", code):
        raise HTTPException(422, "Invalid share code")
    with request.app.state.engine.begin() as conn:
        require_active(auth(conn, sid, request.headers.get("authorization")))
        claim_hash = digest(code.encode("ascii"))
        row = conn.execute(
            select(share_intake).where(share_intake.c.code_hash == claim_hash)
        ).mappings().one_or_none()
        if row is None or row["consumed"] or int(time.time()) - row["created"] > LIFETIME:
            raise HTTPException(410, "Share code expired or already used")
        changed = conn.execute(
            update(share_intake).where(
                share_intake.c.code_hash == claim_hash,
                share_intake.c.consumed.is_(False),
            ).values(consumed=True)
        ).rowcount
        if not changed:
            raise HTTPException(410, "Share code already used")
        accepted = _record(conn, sid, "share_target", row["evidence_hash"], row["length_bytes"])
        return {"accepted": accepted, "duplicate": not accepted,
                "classification": "PAYER_SUBMITTED_UNVERIFIED",
                "financially_verified": False}


@router.get("/api/sessions/{sid}/evidence")
def evidence_history(sid: str, request: Request):
    from checkout.server import auth
    with request.app.state.engine.connect() as conn:
        auth(conn, sid, request.headers.get("authorization"))
        rows = conn.execute(select(mobile_evidence.c.source, mobile_evidence.c.created,
                                   mobile_evidence.c.length_bytes).where(mobile_evidence.c.sid == sid)
                            .order_by(mobile_evidence.c.created.desc()).limit(50)).mappings()
        return {"items": [dict(r) for r in rows], "financially_verified": False}
