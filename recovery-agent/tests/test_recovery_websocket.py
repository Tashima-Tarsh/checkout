"""Exercise real checkout ASGI routes while Android auth is not configured."""
import pytest
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect


@pytest.fixture
def client():
    from checkout.server import app
    return TestClient(app)


@pytest.mark.parametrize("endpoint", ["host", "viewer"])
@pytest.mark.parametrize("authorization", ["", "Bearer invalid", "Bearer " + "a" * 43])
def test_android_websocket_fails_closed(client, endpoint, authorization):
    with pytest.raises(WebSocketDisconnect) as exc:
        with client.websocket_connect(
            "/android/ws/" + endpoint, headers={"Authorization": authorization}
        ):
            pytest.fail("Unconfigured Android authentication accepted a connection")
    assert exc.value.code == 4001


@pytest.mark.parametrize("method,path", [
    ("GET", "/android/workspace"),
    ("GET", "/api/android/workspace/status"),
    ("GET", "/api/android/workspace/config"),
    ("POST", "/api/android/workspace/start"),
    ("POST", "/api/android/workspace/stop"),
    ("POST", "/api/android/workspace/restart"),
    ("POST", "/api/android/workspace/input"),
])
def test_android_http_fails_closed(client, method, path):
    kwargs = {"json": {"action": "home"}} if method == "POST" else {}
    assert client.request(method, path, **kwargs).status_code == 503
