# WebSocket integration tests for Agentic-Recovery
# Tests WebSocket authentication using the _auth_websocket function directly

import os
import asyncio
import ipaddress
import secrets
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ed25519

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from recovery.server import create_app
from recovery.storage import make_engine, make_session, initialize, now_ms


# ---- Mock WebSocket ----
class _MockWebSocket:
    """Mock WebSocket that simulates accept/close behavior."""
    def __init__(self, query_params):
        self.query_params = query_params
        self.accepted = False
        self.closed = False
        self.close_code = None
        self.close_reason = None

    async def accept(self):
        self.accepted = True

    async def close(self, code: int, reason: str):
        self.closed = True
        self.close_code = code
        self.close_reason = reason


# ---- Auth logic (mirrors checkout.server._auth_websocket) ----
async def _auth_websocket(websocket: _MockWebSocket) -> str | None:
    """Authenticate WebSocket connection using Bearer token from query params.
    Token must match the PDEP_ADMIN_TOKEN environment variable.
    Returns the tenant_id on success.
    """
    auth_header = websocket.query_params.get("authorization")
    if not auth_header or not auth_header.lower().startswith("bearer "):
        await websocket.close(code=4001, reason="Authentication required")
        return None

    token = auth_header.split(" ", 1)[1]

    admin_token = os.environ.get("PDEP_ADMIN_TOKEN", "")
    if len(admin_token) < 32:
        await websocket.close(code=4001, reason="Admin access is disabled until explicitly configured")
        return None

    admin_ip = os.environ.get("PDEP_ADMIN_IP_ALLOWLIST", "")
    try:
        allowed = [ipaddress.ip_network(x.strip(), strict=False) for x in admin_ip.split(",") if x.strip()]
    except ValueError:
        await websocket.close(code=4001, reason="Admin access is disabled until explicitly configured")
        return None

    peer = ipaddress.ip_address("127.0.0.1")
    if not any(peer in net for net in allowed):
        await websocket.close(code=403, reason="IP is not allowlisted")
        return None

    scheme, _, token_val = token.partition(" ")
    if scheme.lower() != "bearer" or not secrets.compare_digest(token_val, admin_token):
        await websocket.close(code=4001, reason="Invalid token")
        return None

    tenant_id = os.getenv("ANDROID_TENANT_ID", "shop-0001")
    return tenant_id


# ---- Fixtures ----

@pytest.fixture(scope="function")
def db_engine(tmp_path):
    db_file = tmp_path / "test.db"
    engine = create_engine(
        f"sqlite:///{db_file}",
        pool_pre_ping=True,
        connect_args={"check_same_thread": False},
    )
    initialize(engine)
    yield engine
    engine.dispose()


@pytest.fixture(scope="function")
def db_session(db_engine):
    Session = make_session(db_engine)
    session = Session()
    yield session
    session.close()


@pytest.fixture(scope="function")
def client(db_session, db_engine):
    # Set admin auth environment variables for WebSocket tests
    old_admin_token = os.environ.get("PDEP_ADMIN_TOKEN")
    old_admin_ip = os.environ.get("PDEP_ADMIN_IP_ALLOWLIST")
    os.environ["PDEP_ADMIN_TOKEN"] = "test-admin-token-change-in-production-12345"
    os.environ["PDEP_ADMIN_IP_ALLOWLIST"] = "127.0.0.1/32"

    app = create_app(engine=db_engine)
    client = TestClient(app)
    yield client
    client.close()

    if old_admin_token is not None:
        os.environ["PDEP_ADMIN_TOKEN"] = old_admin_token
    else:
        os.environ.pop("PDEP_ADMIN_TOKEN", None)
    if old_admin_ip is not None:
        os.environ["PDEP_ADMIN_IP_ALLOWLIST"] = old_admin_ip
    else:
        os.environ.pop("PDEP_ADMIN_IP_ALLOWLIST", None)


# ---- WebSocket Authentication Tests ----

def test_websocket_auth_valid(client, db_session):
    """Valid admin token allows WebSocket viewer connection."""
    admin_token = os.environ.get("PDEP_ADMIN_TOKEN", "test-admin-token-change-in-production-12345")

    ws = _MockWebSocket({"authorization": f"bearer {admin_token}"})
    result = asyncio.run(_auth_websocket(ws))
    assert result is not None
    assert result == "shop-0001"
    assert ws.accepted is True
    assert ws.closed is False


@pytest.mark.asyncio
async def test_websocket_host_auth_valid(client, db_session):
    """Valid admin token allows host WebSocket connection."""
    admin_token = os.environ.get("PDEP_ADMIN_TOKEN", "test-admin-token-change-in-production-12345")

    ws = _MockWebSocket({"authorization": f"bearer {admin_token}"})
    result = await _auth_websocket(ws)
    assert result is not None
    assert result == "shop-0001"
    assert ws.accepted is True
    assert ws.closed is False


@pytest.mark.asyncio
async def test_websocket_auth_invalid(client, db_session):
    """Invalid token rejected for WebSocket connection."""
    ws = _MockWebSocket({"authorization": "bearer invalid-token"})
    result = await _auth_websocket(ws)
    assert result is None
    assert ws.accepted is False
    assert ws.closed is True
    assert ws.close_code == 4001


@pytest.mark.asyncio
async def test_websocket_auth_no_token(client, db_session):
    """No token rejected for WebSocket connection."""
    ws = _MockWebSocket({})
    result = await _auth_websocket(ws)
    assert result is None
    assert ws.accepted is False
    assert ws.closed is True
    assert ws.close_code == 4001


@pytest.mark.asyncio
async def test_websocket_host_invalid_token(client, db_session):
    """Invalid token rejected for host WebSocket."""
    ws = _MockWebSocket({"authorization": "bearer bad-token"})
    result = await _auth_websocket(ws)
    assert result is None
    assert ws.accepted is False
    assert ws.closed is True
    assert ws.close_code == 4001