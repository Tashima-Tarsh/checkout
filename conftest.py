"""Pytest configuration for Agentic Pay checkout repository.

Adds recovery-agent package to sys.path so recovery tests can be discovered
and run from the repository root.
"""

import sys
from pathlib import Path

# Add recovery-agent directory to Python path so `from recovery.models import ...` works
recovery_agent_dir = Path(__file__).parent / "recovery-agent"
if str(recovery_agent_dir) not in sys.path:
    sys.path.insert(0, str(recovery_agent_dir))
