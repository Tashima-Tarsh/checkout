"""Provider-neutral command validation. No financial mutation or device credentials."""
from dataclasses import dataclass
from pathlib import Path
import json
import os
from urllib.parse import urlparse

POLICY = json.loads(Path(__file__).with_name("policy.json").read_text(encoding="utf-8"))

@dataclass(frozen=True)
class Principal:
    tenant_id: str
    role: str
    agent_id: str

def authorize(principal: Principal, tenant_id: str, action: str) -> None:
    """Principal must come from verified server identity, never request headers."""
    if not principal.tenant_id or not principal.agent_id or principal.tenant_id != tenant_id:
        raise PermissionError("tenant mismatch")
    if action not in POLICY["roles"].get(principal.role, []):
        raise PermissionError("action denied")

def provider_state(name: str) -> str:
    """Configuration is not a runtime health check."""
    provider = POLICY["providers"][name]
    if provider.get("enabled") is False:
        return "disabled"
    if provider.get("local"):
        return "template_only"
    raw = os.getenv(provider["env"], "")
    parsed = urlparse(raw)
    if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password:
        return "not_configured"
    return "configured_unverified"

def plan(principal: Principal, tenant_id: str, action: str, request_id: str) -> dict:
    authorize(principal, tenant_id, action)
    if not isinstance(request_id, str) or not request_id or len(request_id) > 128:
        raise ValueError("invalid request id")
    # Intentionally no arbitrary payload, URL, credentials or raw device commands.
    return {"tenant_id": tenant_id, "agent_id": principal.agent_id,
            "action": action, "request_id": request_id, "status": "planned",
            "provider": "mobilerun" if action.startswith(("device.", "setup.")) else "openclaw"}

def collection_gate(observed_minor: int, reserved_minor: int, requested_minor: int) -> bool:
    """Pure policy check; caller must lock and reserve atomically in database."""
    values = (observed_minor, reserved_minor, requested_minor)
    if any(type(v) is not int or v < 0 for v in values) or requested_minor == 0:
        return False
    return observed_minor + reserved_minor + requested_minor <= POLICY["daily_collection_limit_minor"]
