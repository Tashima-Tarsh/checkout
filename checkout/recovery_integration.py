"""Recovery Agent integration for the checkout server.

Mounts the recovery-agent FastAPI router under /api/recovery so that
employee checkouts, device registration, and authenticated observation
ingestion are served alongside the existing Agentic Pay checkout.

The recovery-agent runs with its own database engine (DATABASE_URL from
.env or recovery-agent/.env.example) and maintains its own tables:
ap_tenants, ap_employees, ap_android_devices, ap_mobile_agents,
ap_collection_cases, ap_checkouts, ap_observations, ap_ledger_entries,
ap_outbox, ap_audit_events.

No existing checkout routes are modified. The recovery-agent is
observational only — financially_verified requires the existing
evidence rules (VPA + amount + challenge-verified frame).
"""

import importlib.util
import sys
from pathlib import Path

from fastapi import APIRouter

ROOT = Path(__file__).resolve().parent.parent
RECOVERY_AGENT_DIR = ROOT / "recovery-agent"

# Add recovery-agent to sys.path so its packages are importable
if str(RECOVERY_AGENT_DIR) not in sys.path:
    sys.path.insert(0, str(RECOVERY_AGENT_DIR))

# Load the recovery-agent API router dynamically (directory name has a hyphen)
spec = importlib.util.spec_from_file_location(
    "recovery_agent_api",
    RECOVERY_AGENT_DIR / "recovery" / "api.py",
)
recovery_agent_api = importlib.util.module_from_spec(spec)
spec.loader.exec_module(recovery_agent_api)

recovery_router = APIRouter(prefix="/api/recovery")

# Mount all recovery-agent routes under /api/recovery
for route in recovery_agent_api.router.routes:
    recovery_router.routes.append(route)

__all__ = ["recovery_router"]
