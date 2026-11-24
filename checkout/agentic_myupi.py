"""Offline MyUPI candidate adapter. Fixture rows never constitute bank evidence."""
from collections import Counter
from dataclasses import dataclass
from typing import Mapping

from checkout.agentic_verify import match


@dataclass(frozen=True)
class AgentScope:
    merchant_id: str
    account_id: str
    agent_id: str


@dataclass(frozen=True)
class FixtureSession:
    scope: AgentScope
    source_account_id: str
    expires: int


def pending(reason):
    return {"state": "PENDING", "financially_verified": False,
            "evidence_source": "SYNTHETIC_FIXTURE", "reason": reason}


def evaluate_fixture(order: Mapping, scope: AgentScope, session: FixtureSession | None,
                     rows, *, now: int, consumed_references=frozenset()):
    """Evaluate normalized fixture rows for one server-resolved agent scope.

    References supplied as consumed must come from a trusted replay index.
    This offline check neither reserves references nor changes order state.
    """
    if (order.get("merchant_id"), order.get("account_id")) != (scope.merchant_id, scope.account_id):
        return pending("SCOPE_MISMATCH")
    if session is None or session.scope != scope:
        return pending("AUTH_REQUIRED")
    if session.expires <= now:
        return pending("SESSION_EXPIRED")

    scoped_rows = [
        row for row in rows
        if row.get("source_account_id") == session.source_account_id
        and row.get("account_id") == scope.account_id
    ]
    eligible = [
        row for row in scoped_rows
        if type(row.get("timestamp")) is int and row["timestamp"] <= now
        and match(order, [row])["reason"] == "UNATTESTED_CANDIDATE"
    ]
    counts = Counter(row["reference"] for row in scoped_rows
                     if isinstance(row.get("reference"), str))
    if any(row["reference"] in consumed_references or counts[row["reference"]] > 1
           for row in eligible):
        return pending("DUPLICATE_REFERENCE")
    return pending(match(order, eligible)["reason"])


def retrieve_live(*_args, **_kwargs):
    """No provider interface or authorization has been established."""
    return {"state": "PENDING", "financially_verified": False,
            "evidence_source": None, "reason": "LIVE_RETRIEVAL_DISABLED"}
