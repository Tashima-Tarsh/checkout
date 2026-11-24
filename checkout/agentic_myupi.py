"""Offline evidence adapter boundary. No network, credentials or paid-state transition."""
from dataclasses import dataclass
from typing import Protocol
from checkout.agentic_verify import match

@dataclass(frozen=True)
class EvidenceRequest:
    account_id: str
    created: int
    expires: int

class EvidenceUnavailable(Exception):
    pass

class EvidenceSource(Protocol):
    def candidates(self, request: EvidenceRequest) -> list[dict]: ...

class DisabledMyUPI:
    def candidates(self, request: EvidenceRequest) -> list[dict]:
        raise EvidenceUnavailable("AUTHORIZED_SOURCE_REQUIRED")

def evaluate(order: dict, source: EvidenceSource | None = None) -> dict:
    """Diagnostic only; callers cannot use this to mark payment verified."""
    pending = {"state": "PENDING", "financially_verified": False}
    request = EvidenceRequest(order["account_id"], order["created"], order["expires"])
    try:
        rows = (source if source is not None else DisabledMyUPI()).candidates(request)
    except EvidenceUnavailable:
        return {**pending, "reason": "AUTHORIZED_SOURCE_REQUIRED"}
    if not isinstance(rows, list) or len(rows) > 1000:
        return {**pending, "reason": "INVALID_EVIDENCE"}
    if any(not isinstance(row, dict) for row in rows):
        return {**pending, "reason": "INVALID_EVIDENCE"}
    return match(order, rows)
