"""Short-lived live-vision verification with strict media/data minimization."""
import hashlib
import re
import secrets
import subprocess
from threading import BoundedSemaphore
from urllib.parse import unquote_plus

from fastapi import APIRouter, HTTPException, Request
from sqlalchemy import select
from starlette.concurrency import run_in_threadpool

from checkout.agentic_api import checkout_info, checkout_order, now
from checkout.agentic_login import require_same_origin
from checkout.agentic_settle import attempt_settle, get_settlement, reason_for
from checkout.agentic_storage import (
    amount_reservations,
    live_verification_challenges,
)
from checkout.agentic_vision import MAX_BYTES, analyze_live_frame

router = APIRouter()
slots = BoundedSemaphore(2)
CHALLENGE_TTL = 45
CHALLENGE = re.compile(r"[A-Za-z0-9_-]{43}")


def _authorize(request, order_id):
    require_same_origin(request)
    info = checkout_info(request, order_id)
    if info.get('shared_amount'):
        raise HTTPException(409, 'Shared amount requires independently correlated payment evidence')
    return info


def _digest(challenge):
    return hashlib.sha256(challenge.encode("ascii")).hexdigest()


@router.get("/api/checkout/{order_id}/upi-return")
async def upi_return(request: Request, order_id: str):
    """Handle UPI app return via protocol handler.
    
    UPI app redirects to: /upi-return?tr=REF&upi_ref=UTR123&status=success&am=100.37
    
    Protocol-handler returns are untrusted client input. No settlement is
    attempted here; the checkout page polls status and the user must arm
    live verification separately. A return is not debit evidence.
    """
    _authorize(request, order_id)
    
    # Validate order matches, but do not trust any return parameter for settlement.
    tr = request.query_params.get('tr')
    if tr and tr != order_id:
        raise HTTPException(400, 'Transaction reference mismatch')
    
    # Redirect back to checkout page — no observation, no settlement.
    from fastapi.responses import RedirectResponse
    return RedirectResponse(url=f"/checkout/{order_id}", status_code=302)


@router.post("/api/checkout/{order_id}/live/session")
def live_session(request: Request, order_id: str):
    _authorize(request, order_id)
    challenge = secrets.token_urlsafe(32)
    timestamp = now()
    with request.app.state.engine.begin() as conn:
        conn.execute(live_verification_challenges.delete().where(
            live_verification_challenges.c.expires <= timestamp,
        ))
        # One active challenge per checkout also bounds storage per session.
        conn.execute(live_verification_challenges.delete().where(
            live_verification_challenges.c.order_id == order_id,
        ))
        conn.execute(live_verification_challenges.insert().values(
            challenge_digest=_digest(challenge), order_id=order_id,
            created=timestamp, expires=timestamp + CHALLENGE_TTL,
        ))
    return {"challenge": challenge, "expires": timestamp + CHALLENGE_TTL,
            "media_retained": False}


def _challenge_valid(request, order_id, challenge):
    if not isinstance(challenge, str) or not challenge.isascii() or not CHALLENGE.fullmatch(challenge):
        return False
    with request.app.state.engine.connect() as conn:
        return conn.scalar(select(live_verification_challenges.c.challenge_digest).where(
            live_verification_challenges.c.challenge_digest == _digest(challenge),
            live_verification_challenges.c.order_id == order_id,
            live_verification_challenges.c.expires > now(),
        )) is not None


def _consume_challenge(conn, order_id, challenge, timestamp):
    if not isinstance(challenge, str) or not challenge.isascii() or not CHALLENGE.fullmatch(challenge):
        return False
    digest = _digest(challenge)
    row = conn.execute(select(live_verification_challenges).where(
        live_verification_challenges.c.challenge_digest == digest,
        live_verification_challenges.c.order_id == order_id,
        live_verification_challenges.c.expires > timestamp,
    ).with_for_update()).first()
    if row is None:
        return False
    conn.execute(live_verification_challenges.delete().where(
        live_verification_challenges.c.challenge_digest == digest,
    ))
    return True


def _seen(analysis, expected_vpa):
    payee = analysis.get("payee")
    return {
        "amount_minor": analysis.get("amount_minor"),
        "payee_ok": (payee.casefold() == expected_vpa.casefold()) if isinstance(payee, str) and payee else None,
    }


def _result(request, order_id, seen=None):
    with request.app.state.engine.connect() as conn:
        order = checkout_order(conn, order_id)
        payable = conn.scalar(select(amount_reservations.c.payable_minor).where(
            amount_reservations.c.order_id == order_id,
            amount_reservations.c.account_id == order["account_id"],
        ))
        current = dict(order, payable_minor=payable)
        if current["status"] != "PAID" and current["expires"] <= now():
            result = {"satisfied": False, "state": "EXPIRED", "reason": "Checkout expired."}
        else:
            result = get_settlement(conn, current, seen=seen)
    if seen is not None:
        # Never return raw payee text, transaction references, OCR, or media.
        result["seen"] = seen
    return result


def _rejected(expected, state, seen=None):
    result = {
        "satisfied": False,
        "state": state,
        "reason": reason_for(dict(payable_minor=expected["amount_minor"]), state, seen=seen),
    }
    if seen is not None:
        result["seen"] = seen
    return result


@router.post("/api/checkout/{order_id}/live/frame")
async def live_frame(request: Request, order_id: str):
    expected = await run_in_threadpool(_authorize, request, order_id)
    challenge = request.headers.get("x-agentic-challenge", "")
    if not await run_in_threadpool(_challenge_valid, request, order_id, challenge):
        return _rejected(expected, "CHALLENGE_EXPIRED")
    if request.headers.get("content-type", "").split(";")[0] not in {"image/png", "image/jpeg", "image/webp"}:
        raise HTTPException(415, "Choose a PNG, JPEG or WebP live frame")
    if not slots.acquire(blocking=False):
        raise HTTPException(429, "Live verification busy")
    try:
        body = bytearray()
        async for chunk in request.stream():
            if len(body) + len(chunk) > MAX_BYTES:
                raise HTTPException(413, "Live frame too large")
            body.extend(chunk)
        try:
            # Raw bytes and OCR text are scoped to this call and never persisted.
            analysis = await run_in_threadpool(analyze_live_frame, bytes(body))
        except ValueError:
            raise HTTPException(422, "Unsupported or invalid live frame")
        except (subprocess.SubprocessError, OSError):
            raise HTTPException(503, "Live vision engine unavailable")
    finally:
        slots.release()

    seen = _seen(analysis, expected["upi_id"])
    timestamp = now()
    with request.app.state.engine.begin() as conn:
        if not _consume_challenge(conn, order_id, challenge, timestamp):
            return _rejected(expected, "CHALLENGE_EXPIRED", seen)
        if analysis.get("sensitive_content"):
            return _rejected(expected, "SENSITIVE_CONTENT_REJECTED", seen)
        observation = dict(analysis,
            order_id=order_id,
            observed_at=timestamp,
            challenge_verified=True,
        )
        attempt_settle(conn, {"id": order_id}, observation, now=timestamp)
    return await run_in_threadpool(_result, request, order_id, seen)


@router.post("/api/checkout/{order_id}/live/chime", status_code=202)
async def live_chime(request: Request, order_id: str):
    await run_in_threadpool(_authorize, request, order_id)
    # No microphone or audio recording is accepted. A chime only asks the
    # browser to obtain a fresh challenge-bound live frame immediately.
    return {"satisfied": False, "state": "CHECK_REQUESTED", "media_retained": False}
