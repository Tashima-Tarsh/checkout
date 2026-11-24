"""Operator-only vision research. No payment writes or receipt storage."""
import os
import subprocess
from pathlib import Path
from threading import BoundedSemaphore

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import FileResponse
from starlette.concurrency import run_in_threadpool

from checkout.agentic_api import checkout_order, checkout_info
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
        if order["merchant_id"] != identity.merchant_id:
            raise HTTPException(404, "Order not found")
    return checkout_info(request, order_id)["amount_minor"]

@router.get("/checkout/{order_id}/vision")
def vision_page(request: Request, order_id: str):
    authorize(request, order_id)
    return FileResponse(Path(__file__).parent / "agentic_assets" / "vision.html")

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
