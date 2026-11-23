"""Operator-managed appearance and read-only operational metrics.

These tools configure payment initiation UI, not financial settlement.
"""
from __future__ import annotations

import re
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
