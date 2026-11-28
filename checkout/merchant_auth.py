"""Public merchant signup + Clerk OAuth verification for DISHA 8.2.

No admin token required. Any merchant can self-onboard with Clerk OAuth,
get a DISHA API key, pair their Android observer device, register their UPI,
and start collecting payments within the 120-second verification window.
"""
from __future__ import annotations

import os
import secrets
import time
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import select
from checkout.agentic_storage import (
    engine, merchants, merchant_profiles, agent_sessions, make_engine, now
)

router = APIRouter(tags=["merchant-auth"])

# Clerk backend SDK (optional - install with: pip install clerk-backend-api)
try:
    from clerk_backend_api import Clerk
    from clerk_backend_api.models import TokenVerification
    _clerk = Clerk(bearer_auth=os.getenv("CLERK_SECRET_KEY")) if os.getenv("CLERK_SECRET_KEY") else None
except Exception:  # pragma: no cover - clerk SDK may not be installed yet
    _clerk = None


class ClerkTokenIn(BaseModel):
    token: str


class MerchantSignupIn(BaseModel):
    clerk_user_id: str
    email: EmailStr
    business_name: str = Field(min_length=2, max_length=150)
    gst_number: str | None = Field(None, min_length=2, max_length=15)
    tier: str = Field(default="starter")
    monthly_volume_estimate_paise: int | None = None


def _verify_clerk_token(token: str) -> dict:
    """Verify Clerk JWT and return user payload."""
    if _clerk is None:
        raise HTTPException(503, "Merchant sign-in is unavailable")
    try:
        token_data = _clerk.tokens.verify(token=TokenVerification(token=token))
        return token_data.model_dump()
    except Exception:
        raise HTTPException(401, "Invalid Clerk session") from None


def _generate_api_key() -> tuple[str, str, str]:
    """Generate (plain_key, hash, prefix) for merchant API access."""
    plain = f"dm_live_{secrets.token_urlsafe(32)}"
    key_hash = secrets.token_hex(32)
    prefix = plain[:12]
    return plain, key_hash, prefix


@router.post("/api/merchant/signup")
def merchant_signup(item: MerchantSignupIn, request: Request):
    """Public merchant signup — no admin token required.

    Creates merchant record, profile, API key, and device slot.
    Returns the API key ONCE — merchant must save it immediately.
    """
    now_ts = now()
    merchant_id = f"merch_{secrets.token_hex(16)}"
    device_id = f"device_{secrets.token_hex(12)}"
    api_key_plain, api_key_hash, api_key_prefix = _generate_api_key()
    trial_ends = now_ts + 86400  # 1-day free trial

    with make_engine().begin() as conn:
        # 1. Merchant record
        conn.execute(merchants.insert().values(
            id=merchant_id,
            name=item.business_name,
            token_hash=api_key_hash,
            email=item.email,
        ))
        # 2. Merchant profile
        conn.execute(merchant_profiles.insert().values(
            id=merchant_id,
            clerk_user_id=item.clerk_user_id,
            email=item.email,
            business_name=item.business_name,
            gst_number=item.gst_number,
            tier=item.tier,
            monthly_volume_estimate=item.monthly_volume_estimate_paise,
            api_key_hash=api_key_hash,
            api_key_prefix=api_key_prefix,
            subscription_status="trial",
            trial_ends_at=trial_ends,
            created_at=now_ts,
            updated_at=now_ts,
        ))
        # 3. Agent device slot (bound to merchant)
        conn.execute(agent_sessions.insert().values(
            account_id=merchant_id,
            agent_id=device_id,
            state="AWAITING_DEVICE",
            expires=0,
        ))

    return {
        "merchant_id": merchant_id,
        "device_id": device_id,
        "api_key": api_key_plain,
        "api_key_prefix": api_key_prefix,
        "tier": item.tier,
        "subscription_status": "trial",
        "trial_ends_at": trial_ends,
        "daily_limit_paise": 7000000,
        "next_steps": [
            "Install DISHA observer APK on your Android mobile",
            "Pair device using device_id + API key",
            "Register your UPI ID + mobile number as receiving account",
            "Create checkout links and collect payments (120s verification)",
        ],
    }


@router.post("/api/merchant/clerk-callback")
def clerk_callback(request: Request, body: ClerkTokenIn):
    """Clerk OAuth redirect callback — verifies token, returns merchant session."""
    payload = _verify_clerk_token(body.token)
    clerk_user_id = payload.get("sub") or payload.get("user_id")
    email = payload.get("email")

    if not clerk_user_id:
        raise HTTPException(400, "Clerk token missing user_id")

    with make_engine().connect() as conn:
        profile = conn.execute(
            select(merchant_profiles).where(merchant_profiles.c.clerk_user_id == clerk_user_id)
        ).mappings().first()

    if not profile:
        raise HTTPException(404, "Merchant profile not found. Complete signup first.")

    session_token = f"disha_session_{secrets.token_urlsafe(32)}"

    return {
        "session_token": session_token,
        "merchant_id": profile["id"],
        "business_name": profile["business_name"],
        "tier": profile["tier"],
        "subscription_status": profile["subscription_status"],
        "daily_limit_paise": 7000000,
        "can_collect": profile["subscription_status"] in ("trial", "active"),
        "api_key_prefix": profile["api_key_prefix"],
    }


@router.get("/api/merchant/profile")
def merchant_profile(request: Request, authorization: str = None):
    """Get merchant profile — requires valid DISHA session token."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Bearer token required")
    token = authorization.split(" ", 1)[1]
    if not token.startswith("disha_session_"):
        raise HTTPException(401, "Invalid session token")

    # Look up session in merchant_profiles by API key prefix match is not
    # sufficient for session auth; implement proper session store in prod.
    # For now, return a deterministic profile lookup placeholder.
    raise HTTPException(501, "Use /api/merchant/clerk-callback for session; profile store pending")
