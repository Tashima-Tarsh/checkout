"""Operator-managed appearance and read-only operational metrics.

These tools configure payment initiation UI, not financial settlement.
"""
from __future__ import annotations

import re
import os
import time
from fastapi import APIRouter, Request
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import func, select
from checkout.storage import checkout_settings, sessions, events, vpa_routes
from checkout.vpa_admin import require_admin

router = APIRouter(tags=["saas"])
DEFAULTS = {"brand_name": "PDEP", "headline": "Make a payment",
            "accent": "#4985FF", "theme": "midnight",
            "logo_letter": "P"}
ACCENTS = {"#4985FF", "#8B5CF6", "#06B6D4", "#10B981", "#F59E0B", "#F43F5E"}
THEMES = {"midnight", "aurora", "light"}


class Appearance(BaseModel):
    brand_name: str = Field(min_length=2, max_length=40)
    headline: str = Field(min_length=3, max_length=70)
    accent: str = Field(pattern=r"^#[0-9A-Fa-f]{6}$")
    theme: str
    logo_letter: str = Field(pattern=r"^[A-Za-z0-9]$")

    @field_validator("brand_name", "headline")
    @classmethod
    def clean(cls, value: str):
        value = value.strip()
        if not value or any(ord(c) < 32 for c in value):
            raise ValueError("Invalid display text")
        return value

    @field_validator("accent")
    @classmethod
    def palette(cls, value):
        if value.upper() not in ACCENTS:
            raise ValueError("Choose an approved accessible palette")
        return value.upper()

    @field_validator("theme")
    @classmethod
    def theme_choice(cls, value):
        if value not in THEMES: raise ValueError("Unsupported theme")
        return value


def get_appearance(connection):
    row = connection.execute(select(checkout_settings).where(
        checkout_settings.c.id == 1
    )).mappings().one_or_none()
    return dict(DEFAULTS) if row is None else {
        key: row[key] for key in DEFAULTS
    }


@router.get("/api/appearance")
def public_appearance(request: Request):
    with request.app.state.engine.connect() as connection:
        return get_appearance(connection)


@router.get("/api/admin/appearance")
def admin_appearance(request: Request):
    require_admin(request)
    with request.app.state.engine.connect() as connection:
        return get_appearance(connection)


@router.put("/api/admin/appearance")
def update_appearance(request: Request, appearance: Appearance):
    require_admin(request)
    data = appearance.model_dump()
    with request.app.state.engine.begin() as connection:
        count = connection.execute(
            checkout_settings.update().where(checkout_settings.c.id == 1).values(**data)
        ).rowcount
        if count == 0:
            connection.execute(checkout_settings.insert().values(id=1, **data))
    return data


@router.get("/api/admin/overview")
def overview(request: Request):
    require_admin(request)
    now = int(time.time())
    with request.app.state.engine.connect() as connection:
        total = connection.scalar(select(func.count()).select_from(sessions))
        active = connection.scalar(select(func.count()).select_from(sessions).where(sessions.c.expires > now))
        by_state = connection.execute(
            select(sessions.c.state, func.count()).group_by(sessions.c.state)
        ).all()
        routes = connection.scalar(select(func.count()).select_from(vpa_routes).where(vpa_routes.c.enabled.is_(True)))
        recorded_events = connection.scalar(select(func.count()).select_from(events))
    return {
        "total_checkouts": total,
        "active_checkouts": active,
        "configured_recipient_routes": routes,
        "recorded_observations": recorded_events,
        "states": {state: count for state, count in by_state},
        "financially_verified": 0,
        "note": "Operational observations, not evidence of funds debited.",
    }


@router.get("/api/admin/health")
def health(request: Request):
    """Per-tab health verification for the SaaS control center.

    Each tab's backing API is probed so the admin UI can show a verified
    status badge per section: overview, appearance, inventory, android
    workspace. Never sets financially_verified.
    """
    now = int(time.time())
    tabs = {}
    with request.app.state.engine.connect() as connection:
        # Overview tab: sessions table readable
        try:
            connection.scalar(select(func.count()).select_from(sessions))
            tabs["overview"] = {"healthy": True, "note": "Sessions table readable"}
        except Exception as exc:
            tabs["overview"] = {"healthy": False, "note": str(exc)[:120]}

        # Appearance tab: settings table readable
        try:
            connection.execute(select(checkout_settings).where(checkout_settings.c.id == 1))
            tabs["appearance"] = {"healthy": True, "note": "Appearance settings readable"}
        except Exception as exc:
            tabs["appearance"] = {"healthy": False, "note": str(exc)[:120]}

        # Inventory tab: vpa_routes table readable
        try:
            connection.scalar(select(func.count()).select_from(vpa_routes))
            tabs["inventory"] = {"healthy": True, "note": "Recipient route inventory readable"}
        except Exception as exc:
            tabs["inventory"] = {"healthy": False, "note": str(exc)[:120]}

    # Android Workspace tab: check configuration flag
    android_configured = bool(os.getenv("ANDROID_DEVICE_ID") and os.getenv("ANDROID_TENANT_ID"))
    tabs["android_workspace"] = {
        "healthy": android_configured,
        "note": "Android Workspace authentication not configured" if not android_configured else "Android Workspace configured",
    }

    all_healthy = all(t["healthy"] for t in tabs.values())
    return {
        "healthy": all_healthy,
        "checked_at": now,
        "tabs": tabs,
        "note": "Per-tab API verification; financially_verified remains 0.",
    }
