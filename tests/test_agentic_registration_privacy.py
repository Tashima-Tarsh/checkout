from fastapi import FastAPI
from fastapi.testclient import TestClient

from checkout.agentic_api import require_admin, router


def test_account_validation_redacts_sensitive_input():
    app = FastAPI()
    app.include_router(router)
    app.dependency_overrides[require_admin] = lambda: None
    client = TestClient(app)

    account = {
        "vpa": "fixture@example",
        "bank": "Test bank",
        "holder": "Test holder",
        "account_number": "bad-number-123456",
        "mobile": "bad-mobile-012345",
    }
    response = client.post("/api/admin/agentic/accounts", json=[account])

    assert response.status_code == 422
    assert response.json() == {"detail": "Invalid account registration input"}


def test_account_inventory_rejects_missing_authentication(monkeypatch):
    monkeypatch.setenv("PDEP_ADMIN_TOKEN", "a" * 32)
    monkeypatch.setenv("PDEP_ADMIN_IP_ALLOWLIST", "0.0.0.0/0,::/0")
    app = FastAPI()
    app.include_router(router)

    with TestClient(app, client=("127.0.0.1", 50000)) as client:
        response = client.get("/api/admin/agentic/accounts")

    assert response.status_code == 401
