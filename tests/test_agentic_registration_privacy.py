from ipaddress import ip_address

from cryptography.fernet import Fernet
from fastapi import FastAPI
from fastapi.testclient import TestClient

from sqlalchemy import create_engine, select
from sqlalchemy.pool import StaticPool

from checkout import vpa_admin
from checkout.agentic_api import require_admin, router
from checkout.agentic_storage import accounts, agent_sessions


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
    monkeypatch.setenv("PDEP_ADMIN_IP_ALLOWLIST", "127.0.0.1/32")
    monkeypatch.setattr(vpa_admin, "_client_ip", lambda request: ip_address("127.0.0.1"))
    app = FastAPI()
    app.include_router(router)

    with TestClient(app) as client:
        response = client.get("/api/admin/agentic/accounts")

    assert response.status_code == 401


def test_registration_encrypts_fields_and_rolls_back_duplicate_batch(monkeypatch):
    key = Fernet.generate_key()
    monkeypatch.setenv("AGENTIC_ACCOUNT_KEY", key.decode())
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    accounts.create(engine)
    agent_sessions.create(engine)
    app = FastAPI()
    app.state.engine = engine
    app.include_router(router)
    app.dependency_overrides[require_admin] = lambda: None
    account = {
        "vpa": "fixture@example",
        "bank": "Test bank",
        "holder": "Test holder",
        "account_number": "000000123456",
        "mobile": "0000000123",
    }
    with TestClient(app) as client:
        url = "/api/admin/agentic/accounts"
        assert client.post(url, json=[account]).json() == {"registered": 1}
        response = client.post(
            url, json=[dict(account, vpa="another@example"), account]
        )
        assert response.status_code == 409
        inventory = client.get(url).json()

    assert len(inventory) == 1
    assert inventory[0]["last4"] == "3456"
    assert inventory[0]["state"] == "AUTH_REQUIRED"
    with engine.connect() as conn:
        stored = conn.execute(select(accounts)).mappings().one()
        assert conn.execute(select(agent_sessions)).mappings().one()["account_id"] == stored["id"]
    cipher = Fernet(key)
    for column, field in (("account_cipher", "account_number"), ("mobile_cipher", "mobile")):
        ciphertext = stored[column]
        assert ciphertext != account[field]
        assert cipher.decrypt(ciphertext.encode()).decode() == account[field]
