import os
import asyncio
import ipaddress
import secrets

class _MockWebSocket:
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


async def _auth_websocket(websocket: _MockWebSocket) -> str | None:
    auth_header = websocket.query_params.get("authorization")
    if not auth_header or not auth_header.lower().startswith("bearer "):
        await websocket.close(code=4001, reason="Authentication required")
        return None

    token = auth_header.split(" ", 1)[1]

    admin_token = os.environ.get("PDEP_ADMIN_TOKEN", "")
    print(f"DEBUG: admin_token from env: '{admin_token}'")
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


async def test_valid():
    os.environ["PDEP_ADMIN_TOKEN"] = "test-admin-token-change-in-production-12345"
    os.environ["PDEP_ADMIN_IP_ALLOWLIST"] = "127.0.0.1/32"
    
    ws = _MockWebSocket({"authorization": "bearer test-admin-token-change-in-production-12345"})
    result = await _auth_websocket(ws)
    print(f"Result: {result}")
    print(f"Accepted: {ws.accepted}")
    assert result == "shop-0001"
    assert ws.accepted is True
    print("PASS: test_websocket_auth_valid")


async def test_websocket_auth_invalid():
    os.environ["PDEP_ADMIN_TOKEN"] = "test-admin-token-change-in-production-12345"
    os.environ["PDEP_ADMIN_IP_ALLOWLIST"] = "127.0.0.1/32"

    ws = _MockWebSocket({"authorization": "bearer invalid-token"})
    result = await _auth_websocket(ws)
    assert result is None
    assert ws.accepted is False
    assert ws.closed is True
    assert ws.close_code == 4001
    print("PASS: test_websocket_auth_invalid")


async def test_websocket_auth_no_token():
    os.environ["PDEP_ADMIN_TOKEN"] = "test-admin-token-change-in-production-12345"
    os.environ["PDEP_ADMIN_IP_ALLOWLIST"] = "127.0.0.1/32"

    ws = _MockWebSocket({})
    result = await _auth_websocket(ws)
    assert result is None
    assert ws.accepted is False
    assert ws.closed is True
    assert ws.close_code == 4001
    print("PASS: test_websocket_auth_no_token")


if __name__ == "__main__":
    print("Test 1: Valid token")
    asyncio.run(test_websocket_auth_valid())
    print("Test 2: Invalid token")
    asyncio.run(test_websocket_auth_invalid())
    print("Test 3: No token")
    asyncio.run(test_websocket_auth_no_token())
    print("\nALL TESTS PASSED!")