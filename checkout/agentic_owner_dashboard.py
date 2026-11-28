"""Read-only, authenticated owner operations data; never asserts payment settlement."""
import os
import time

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import func, select, text

from checkout.agentic_api import require_owner
from checkout.agentic_storage import (
    accounts, agent_sessions, audit, jobs, merchants, orders,
    receipt_observations, settlement_states, evidence_consumption,
)

router = APIRouter(prefix="/api/owner", dependencies=[Depends(require_owner)])
LIMIT = 100


def rows(conn, statement):
    return [dict(row) for row in conn.execute(statement.limit(LIMIT)).mappings()]


@router.get("/dashboard/{tab}")
def dashboard(request: Request, tab: str):
    engine = request.app.state.engine
    with engine.connect() as conn:
        if tab == "transactions":
            data = rows(conn, select(orders.c.id, merchants.c.name.label("merchant"),
                orders.c.amount_minor, orders.c.status, orders.c.created)
                .join(merchants, merchants.c.id == orders.c.merchant_id)
                .order_by(orders.c.created.desc()))
            return {"rows": data, "note": "Latest 100 payment requests, not confirmed receipts."}
        if tab == "trust":
            data = rows(conn, select(receipt_observations.c.order_id,
                receipt_observations.c.decision, receipt_observations.c.created,
                receipt_observations.c.expires).order_by(receipt_observations.c.created.desc()))
            return {"rows": data, "note": "Receipt observations are not independent financial proof."}
        if tab == "ledger":
            data = rows(conn, select(orders.c.id, orders.c.amount_minor,
                orders.c.status, settlement_states.c.state, settlement_states.c.observed_minor,
                settlement_states.c.updated).outerjoin(settlement_states,
                settlement_states.c.order_id == orders.c.id).order_by(orders.c.created.desc()))
            return {"rows": data, "note": "Reconciliation states only; not a double-entry accounting ledger."}
        if tab in ("analytics", "overview"):
            data = rows(conn, select(orders.c.status, func.count().label("count"),
                func.sum(orders.c.amount_minor).label("requested_minor")).group_by(orders.c.status))
            return {"rows": data, "note": "Requested amounts grouped by order state, not collected revenue."}
        if tab == "infrastructure":
            conn.execute(text("SELECT 1"))
            return {"rows": [{"component": "Agentic Pay API", "state": "RESPONDING"},
                {"component": "Database", "state": "QUERY_OK"},
                {"component": "Android runtime", "state": "NOT_CONNECTED"}],
                "note": "Live application/database probe. External service health is not measured here."}
        if tab == "integrations":
            data = rows(conn, select(jobs.c.order_id, jobs.c.attempts, jobs.c.dispatched,
                jobs.c.retry_at).order_by(jobs.c.created.desc()))
            return {"rows": data, "note": "n8n configuration: " + ("configured" if os.getenv("AGENTIC_N8N_WEBHOOK") and os.getenv("AGENTIC_N8N_TOKEN") else "not configured") + ". Job records do not prove external execution."}
        if tab == "requests":
            data = rows(conn, select(agent_sessions.c.agent_id, agent_sessions.c.state,
                agent_sessions.c.expires).where(agent_sessions.c.state == "AUTH_REQUIRED"))
            return {"rows": data, "note": "Account agents requiring authorization; no separate access-request workflow exists."}
        if tab == "incidents":
            data = rows(conn, select(jobs.c.order_id, jobs.c.attempts, jobs.c.retry_at)
                .where(jobs.c.attempts > 0, jobs.c.dispatched == 0).order_by(jobs.c.retry_at.desc()))
            return {"rows": data, "note": "Undispatched jobs with attempts. This is not a complete application error log."}
        if tab == "settings":
            return {"rows": [{"setting": "Email login", "state": "CONFIGURED" if getattr(request.app.state, "password_login", None) else "UNAVAILABLE"},
                {"setting": "Android runtime", "state": "NOT_CONNECTED"},
                {"setting": "Checkout TTL seconds", "state": 120}],
                "note": "Read-only effective settings. No secrets are returned."}
    raise HTTPException(404, "Unknown dashboard tab")
