"""Payer-submitted mobile share, SMS text and receipt artefact intake.

Client-supplied material is not authenticated debit proof. Store only digests
and metadata, never raw private message bodies or receipt screenshots.
"""
from __future__ import annotations

import hashlib
import secrets
import time

from fastapi import APIRouter, File, Form, HTTPException, Request, UploadFile
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from checkout.storage import mobile_evidence

router = APIRouter(tags=["mobile-evidence"])
MAX_BYTES = 2 * 1024 * 1024
FORM_TYPES = {"text/plain", "image/png", "image/jpeg", "image/webp", "application/pdf"}
SOURCES = {"app_share", "sms_paste", "notification_paste", "receipt_upload"}


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

    if source not in SOURCES:
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


@router.get("/api/sessions/{sid}/evidence")
def evidence_history(sid: str, request: Request):
    from checkout.server import auth
    with request.app.state.engine.connect() as conn:
        auth(conn, sid, request.headers.get("authorization"))
        rows = conn.execute(select(mobile_evidence.c.source, mobile_evidence.c.created,
                                   mobile_evidence.c.length_bytes).where(mobile_evidence.c.sid == sid)
                            .order_by(mobile_evidence.c.created.desc()).limit(50)).mappings()
        return {"items": [dict(r) for r in rows], "financially_verified": False}
