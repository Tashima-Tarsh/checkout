"""Operator-only vision research. No payment writes or receipt storage."""
import hashlib
import os
import subprocess
import time
from collections import defaultdict, deque
from pathlib import Path
from threading import BoundedSemaphore, Lock

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from starlette.concurrency import run_in_threadpool

from checkout.agentic_api import ORDER_ID, checkout_order, checkout_info, digest, now
from checkout.agentic_login import require_session
from checkout.agentic_storage import receipt_observations
from checkout.agentic_vision import MAX_BYTES, analyze_image

router = APIRouter()
slots = BoundedSemaphore(2)
frame_limits = defaultdict(deque)
frame_limit_lock = Lock()
FRAME_LIMIT = 12
FRAME_WINDOW_SECONDS = 60

def authorize(request, order_id):
    if os.getenv("AGENTIC_VISION_LAB") != "1":
        raise HTTPException(404, "Vision lab disabled")
    identity = require_session(request)
    with request.app.state.engine.connect() as conn:
        order = checkout_order(conn, order_id)
        if order["merchant_id"] != identity.merchant_id:
            raise HTTPException(404, "Order not found")
    return checkout_info(request, order_id)["amount_minor"]

@router.get("/checkout/{order_id}/vision")
def vision_page(request: Request, order_id: str):
    authorize(request, order_id)
    return FileResponse(Path(__file__).parent / "agentic_assets" / "vision.html")

@router.get("/api/checkout/{order_id}/vision")
def vision_availability(request: Request, order_id: str):
    authorize(request, order_id)
    return {"enabled": True, "research_only": True}

@router.post("/api/checkout/{order_id}/vision")
async def vision_result(request: Request, order_id: str):
    expected = await run_in_threadpool(authorize, request, order_id)
    if request.headers.get("content-type", "").split(";")[0] not in {"image/png", "image/jpeg", "image/webp"}:
        raise HTTPException(415, "Choose a PNG, JPEG or WebP image")
    if not slots.acquire(blocking=False):
        raise HTTPException(429, "Vision lab busy")
    try:
        body = bytearray()
        async for chunk in request.stream():
            if len(body) + len(chunk) > MAX_BYTES:
                raise HTTPException(413, "Image too large")
            body.extend(chunk)
        try:
            return await run_in_threadpool(analyze_image, bytes(body), expected)
        except ValueError:
            raise HTTPException(422, "Unsupported or invalid image")
        except (subprocess.SubprocessError, OSError):
            raise HTTPException(503, "Vision engine unavailable")
    finally:
        slots.release()


def owner_ingest(request: Request, order_id: str):
    """Authorize a trusted first-party transport, never an anonymous browser."""
    if os.getenv("AGENTIC_VISION_LAB") != "1":
        raise HTTPException(404, "Vision lab disabled")
    scheme, _, token = request.headers.get("authorization", "").partition(" ")
    if scheme.lower() != "bearer" or not token or not token.isascii():
        raise HTTPException(401, "Authenticated frame transport required")
    if digest(token) != getattr(request.app.state, "owner_token_hash", ""):
        raise HTTPException(401, "Authenticated frame transport required")
    if not ORDER_ID.fullmatch(order_id):
        raise HTTPException(404, "Order not found")
    with request.app.state.engine.connect() as conn:
        order = checkout_order(conn, order_id)
    if order["expires"] <= now() or order["status"] not in {"AWAITING_PAYMENT", "PENDING"}:
        raise HTTPException(410, "Checkout expired or unavailable")
    return order


def allow_frame(order_id: str):
    timestamp = time.monotonic()
    with frame_limit_lock:
        entries = frame_limits[order_id]
        while entries and entries[0] <= timestamp - FRAME_WINDOW_SECONDS:
            entries.popleft()
        if len(entries) >= FRAME_LIMIT:
            raise HTTPException(429, "Frame rate limit exceeded")
        entries.append(timestamp)


async def bounded_image(request: Request):
    if request.headers.get("content-type", "").split(";")[0] not in {"image/png", "image/jpeg", "image/webp"}:
        raise HTTPException(415, "Choose a PNG, JPEG or WebP image")
    body = bytearray()
    async for chunk in request.stream():
        if len(body) + len(chunk) > MAX_BYTES:
            raise HTTPException(413, "Image too large")
        body.extend(chunk)
    if not body:
        raise HTTPException(422, "Image required")
    return bytes(body)


def saved_observation(request: Request, order_id: str, frame_digest: str):
    with request.app.state.engine.connect() as conn:
        existing = conn.execute(select(receipt_observations).where(
            receipt_observations.c.order_id == order_id,
        )).mappings().first()
        replay = conn.scalar(select(receipt_observations.c.order_id).where(
            receipt_observations.c.frame_digest == frame_digest,
        ))
    if existing is not None:
        return existing
    if replay is not None:
        raise HTTPException(409, "Frame already bound to another checkout")
    return None


@router.post("/api/checkout/{order_id}/receipt-observation")
async def receipt_observation(request: Request, order_id: str, dry_run: bool = False):
    """Analyze one explicitly authorized frame with bounded, replay-safe transport.

    Synthetic browser frames are permitted only in dry-run mode and are never
    written to an order.  A visual result remains non-financial in all modes.
    """
    order = owner_ingest(request, order_id)
    synthetic = request.headers.get("x-agentic-synthetic") == "1"
    if synthetic != dry_run:
        raise HTTPException(403, "Synthetic frames are dry-run only")
    allow_frame(order_id)
    data = await bounded_image(request)
    frame_digest = hashlib.sha256(data).hexdigest()
    if not dry_run:
        existing = saved_observation(request, order_id, frame_digest)
        if existing is not None:
            return {"recognized": True, "replayed": True, "receipt_observation": {
                "order_id": order_id, "decision": existing["decision"],
                "advance_research": True, "financially_verified": False, "checkout_changed": False,
            }}
    if not slots.acquire(blocking=False):
        raise HTTPException(429, "Vision lab busy")
    try:
        try:
            result = await run_in_threadpool(analyze_image, data, checkout_info(request, order_id)["amount_minor"])
        except ValueError:
            raise HTTPException(422, "Unsupported or invalid image")
        except (subprocess.SubprocessError, OSError):
            raise HTTPException(503, "Vision engine unavailable")
    finally:
        slots.release()
    if result["decision"] != "VISUAL_SUCCESS":
        return {"recognized": False, "decision": result["decision"], "financially_verified": False,
                "checkout_changed": False}
    observation = {"order_id": order_id, "decision": "VISUAL_SUCCESS", "advance_research": True,
                   "financially_verified": False, "checkout_changed": False}
    if dry_run:
        return {"recognized": True, "dry_run": True, "receipt_observation": observation}
    try:
        with request.app.state.engine.begin() as conn:
            conn.execute(receipt_observations.insert().values(
                order_id=order_id, frame_digest=frame_digest, decision="VISUAL_SUCCESS",
                created=now(), expires=order["expires"],
            ))
    except IntegrityError:
        existing = saved_observation(request, order_id, frame_digest)
        if existing is not None:
            return {"recognized": True, "replayed": True, "receipt_observation": observation}
        raise HTTPException(409, "Frame already bound to another checkout") from None
    return {"recognized": True, "receipt_observation": observation}
