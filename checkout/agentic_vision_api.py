"""Operator-only vision research. No payment writes or receipt storage."""
import os
import hashlib
import hmac
import re
import time
from collections import deque
import subprocess
from pathlib import Path
from threading import BoundedSemaphore, Lock

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import FileResponse, JSONResponse
from starlette.concurrency import run_in_threadpool

from checkout.agentic_api import checkout_order, checkout_info, require_open_checkout, now
from checkout.agentic_storage import receipt_observations
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from checkout.agentic_login import require_session
from checkout.agentic_vision import MAX_BYTES, analyze_image

router = APIRouter()
slots = BoundedSemaphore(2)

def authorize(request, order_id):
    if os.getenv("AGENTIC_VISION_LAB") != "1":
        raise HTTPException(404, "Vision lab disabled")
    identity = require_session(request)
    with request.app.state.engine.connect() as conn:
        order = checkout_order(conn, order_id)
        require_open_checkout(order)
        if order["merchant_id"] != identity.merchant_id:
            raise HTTPException(404, "Order not found")
    info = checkout_info(request, order_id)
    require_open_checkout(info)
    return info["amount_minor"]

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


# Server-to-server receipt-only research transport. Disabled by default.
# Never provide the dedicated credential to a customer browser.
_frame_lock = Lock()
_frame_times = deque()

def authorize_transport(request, order_id):
    if os.getenv("AGENTIC_RECEIPT_INGEST") != "1":
        raise HTTPException(404, "Receipt transport disabled")
    token = os.getenv("AGENTIC_RECEIPT_TOKEN", "")
    if not re.fullmatch(r"[A-Za-z0-9_-]{43,128}", token):
        raise HTTPException(503, "Receipt transport not configured")
    supplied = request.headers.get("authorization", "")
    if not supplied.isascii() or not hmac.compare_digest(supplied, "Bearer " + token):
        raise HTTPException(401, "Receipt transport authentication required")
    with _frame_lock:
        timestamp = time.monotonic()
        while _frame_times and _frame_times[0][0] <= timestamp - 120:
            _frame_times.popleft()
        if sum(t > timestamp - 60 for t, _ in _frame_times) >= 30:
            raise HTTPException(429, "Receipt transport busy")
        if sum(oid == order_id for _, oid in _frame_times) >= 14:
            raise HTTPException(429, "Order observation limit reached")
        _frame_times.append((timestamp, order_id))

def observation_conflict(decision):
    return JSONResponse({"recognized": False, "decision": decision,
                         "financially_verified": False, "checkout_changed": False},
                        status_code=409)


def observation_result(order_id, **extra):
    return dict(recognized=True, receipt_observation={
        "order_id": order_id, "decision": "VISUAL_SUCCESS",
        "advance_research": True, "financially_verified": False,
        "checkout_changed": False}, **extra)

@router.post("/api/checkout/{order_id}/receipt-observation")
async def receipt_observation(request: Request, order_id: str, dry_run: bool = False):
    authorize_transport(request, order_id)
    synthetic = request.headers.get("x-agentic-synthetic") == "1"
    if synthetic != dry_run:
        raise HTTPException(403, "Synthetic frames are dry-run only")
    expected = await run_in_threadpool(checkout_info, request, order_id)
    require_open_checkout(expected)
    if request.headers.get("content-type", "").split(";")[0] not in {"image/png", "image/jpeg", "image/webp"}:
        raise HTTPException(415, "Unsupported receipt format")
    if not slots.acquire(blocking=False):
        raise HTTPException(429, "Vision lab busy")
    try:
        data = bytearray()
        async for chunk in request.stream():
            if len(data) + len(chunk) > MAX_BYTES:
                raise HTTPException(413, "Image too large")
            data.extend(chunk)
        try:
            result = await run_in_threadpool(analyze_image, bytes(data), expected["amount_minor"], expected["upi_id"])
        except ValueError:
            raise HTTPException(422, "Invalid receipt")
        except (subprocess.SubprocessError, OSError):
            raise HTTPException(503, "Vision engine unavailable")
    finally:
        slots.release()
    if result["decision"] != "VISUAL_SUCCESS":
        return {"recognized": False, "decision": result["decision"],
                "financially_verified": False, "checkout_changed": False}
    reference = result.get("reference_digest", "")
    if not re.fullmatch(r"[0-9a-f]{64}", reference):
        raise HTTPException(422, "Missing reference fingerprint")
    if dry_run:
        return observation_result(order_id, dry_run=True)
    frame = hashlib.sha256(data).hexdigest()
    # Atomic uniqueness across orders even when images are re-encoded.
    try:
        with request.app.state.engine.begin() as conn:
            order = checkout_order(conn, order_id, lock=True)
            require_open_checkout(order)
            previous = conn.execute(select(receipt_observations).where(
                receipt_observations.c.order_id == order_id)).mappings().first()
            if previous is not None:
                if previous["reference_digest"] == reference and previous["decision"] == "VISUAL_SUCCESS":
                    return observation_result(order_id, replayed=True)
                return observation_conflict("ORDER_OBSERVATION_CONFLICT")
            conn.execute(receipt_observations.insert().values(
                order_id=order_id, frame_digest=frame, reference_digest=reference,
                decision="VISUAL_SUCCESS", created=now(), expires=order["expires"]))
    except IntegrityError:
        # The insert transaction has rolled back. Identify known conflicts
        # without claiming recognition or exposing another order.
        with request.app.state.engine.connect() as conn:
            if conn.scalar(select(receipt_observations.c.order_id).where(
                receipt_observations.c.reference_digest == reference,
                receipt_observations.c.order_id != order_id)):
                return observation_conflict("REFERENCE_REPLAYED")
            if conn.scalar(select(receipt_observations.c.order_id).where(
                receipt_observations.c.frame_digest == frame,
                receipt_observations.c.order_id != order_id)):
                return observation_conflict("FRAME_REPLAYED")
        return observation_conflict("OBSERVATION_CONFLICT")
    return observation_result(order_id)
