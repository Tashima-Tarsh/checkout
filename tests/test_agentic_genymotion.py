import json
from checkout import agentic_genymotion as gm

def test_no_token(monkeypatch):
    monkeypatch.delenv("GENYMOTION_API_TOKEN", raising=False)
    assert gm.status()["state"] == "TOKEN_NOT_CONFIGURED"

def test_device_discovery(monkeypatch):
    monkeypatch.setenv("GENYMOTION_API_TOKEN", "test-secret")
    class Response:
        def __enter__(self): return self
        def __exit__(self, *args): pass
        def read(self, n):
            return json.dumps({"instances": [{"name": gm.DEVICE, "uuid": "095be615-a8ad-4c33-8e9c-c7612fbf6c9f", "state": "ONLINE"}]}).encode()
    class Opener:
        def open(self, request, timeout):
            assert request.get_header("X-api-token") == "test-secret"
            assert request.full_url == "https://api.geny.io/cloud/v1/instances"
            return Response()
    monkeypatch.setattr(gm, "build_opener", lambda *args: Opener())
    result = gm.status()
    assert result["connected"] is True
    assert result["financially_verified"] is False
    assert "test-secret" not in str(result)
