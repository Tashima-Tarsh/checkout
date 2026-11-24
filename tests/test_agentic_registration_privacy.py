import pytest
from cryptography.fernet import Fernet
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.pool import StaticPool

from checkout import agentic_app
from checkout.agentic_api import digest
from checkout.agentic_storage import accounts, agent_sessions, isolated_database_url, jobs, merchants, metadata
from checkout.agentic_worker import dispatch_next


@pytest.fixture
def api(monkeypatch):
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    metadata.create_all(engine)
    monkeypatch.setattr(agentic_app, "make_engine", lambda: engine)
    monkeypatch.setattr(agentic_app, "initialize", lambda _: None)
    monkeypatch.setenv("AGENTIC_OWNER_TOKEN", "a" * 43)
    key = Fernet.generate_key()
    monkeypatch.setenv("AGENTIC_ACCOUNT_KEY", key.decode())
    with TestClient(agentic_app.app) as client:
        yield client, engine, key


def owner():
    return {"Authorization": "Bearer " + "a" * 43}


def merchant(client, name):
    response = client.post("/api/owner/merchants", json={"name": name}, headers=owner())
    assert response.status_code == 201
    return {"Authorization": "Bearer " + response.json()["token"]}


def account(vpa="first@example"):
    return {
        "upi_id": vpa, "bank_name": "Test Bank", "account_holder": "Test Holder",
        "receiving_account_number": "00000123456", "registered_mobile": "0000000123",
        "account_type": "PERSONAL", "mcc": "",
    }


def test_database_guard_ignores_legacy_database_url(monkeypatch):
    monkeypatch.delenv("AGENTIC_DATABASE_URL", raising=False)
    monkeypatch.setenv("DATABASE_URL", "postgresql://legacy:legacy@localhost/checkout")
    with pytest.raises(RuntimeError, match="AGENTIC_DATABASE_URL"):
        isolated_database_url()
    monkeypatch.setenv("AGENTIC_DATABASE_URL", "postgresql://legacy:legacy@localhost/checkout")
    with pytest.raises(RuntimeError, match="dedicated PostgreSQL"):
        isolated_database_url()


def test_clean_bootstrap_encryption_atomic_import_and_isolation(api):
    client, engine, key = api
    assert client.get("/api/owner/merchants", headers=owner()).json() == []
    assert client.get("/api/accounts").status_code == 401
    first = merchant(client, "First Merchant")
    second = merchant(client, "Second Merchant")
    assert client.get("/api/owner/merchants", headers=second).status_code == 401
    assert client.post("/api/accounts", headers=first, json=[account()]).status_code == 201
    header = ",".join(account().keys())
    csv = "\n".join([header, ",".join(account("second@example").values()), ",".join(account().values())])
    response = client.post("/api/accounts/import", headers=first, content=csv)
    assert response.status_code == 409
    assert client.get("/api/accounts", headers=second).json() == []
    rows = client.get("/api/agents", headers=first).json()
    assert len(rows) == 1 and rows[0]["state"] == "AUTH_REQUIRED"
    with engine.connect() as conn:
        row = conn.execute(select(accounts)).mappings().one()
        assert Fernet(key).decrypt(row["account_cipher"].encode()).decode() == "00000123456"
        assert Fernet(key).decrypt(row["mobile_cipher"].encode()).decode() == "0000000123"
        assert conn.execute(select(agent_sessions)).mappings().one()["account_id"] == row["id"]
        assert conn.execute(select(merchants)).mappings().first()["token_hash"] == digest(first["Authorization"].split()[-1])


def test_customer_checkout_is_idempotent_and_only_pending(api):
    client, engine, _ = api
    first = merchant(client, "First Merchant")
    second = merchant(client, "Second Merchant")
    assert client.post("/api/accounts", headers=first, json=[account()]).status_code == 201
    account_id = client.get("/api/accounts", headers=first).json()[0]["id"]
    payload = {"account_id": account_id, "amount_minor": 500}
    assert client.post("/api/orders", headers=second, json=payload).status_code == 404
    path = client.post("/api/orders", headers=first, json=payload).json()["checkout_path"]
    assert client.get(path).status_code == 200
    assert client.get("/api" + path).json()["upi_id"] == "first@example"
    for _ in range(2):
        result = client.post("/api" + path + "/verify", json={"payer_last4": "0123"})
        assert result.status_code == 202
        assert result.json() == {"status": "PENDING", "financially_verified": False}

    class Provider:
        def dispatch(self, order_id, assigned_account_id):
            assert order_id == path.split("/")[-1]
            assert assigned_account_id == account_id

    assert dispatch_next(engine, Provider())
    assert not dispatch_next(engine, Provider())
    with engine.connect() as conn:
        assert conn.execute(select(jobs)).mappings().one()["dispatched"] == 1
    assert client.get("/api" + path).json()["status"] == "PENDING"
    assert client.get("/api/orders", headers=second).json() == []


def test_invalid_account_payload_is_redacted(api):
    client, _, _ = api
    headers = merchant(client, "First Merchant")
    item = dict(account(), registered_mobile="secret-invalid-value")
    response = client.post("/api/accounts", headers=headers, json=[item])
    assert response.status_code == 422
    assert response.json() == {"detail": "Invalid request input"}


def test_thousand_accounts_get_unique_logical_agents(api):
    client, _, _ = api
    headers = merchant(client, "Scale Fixture")
    items = [account(f"fixture-{number}@example") for number in range(1000)]
    result = client.post("/api/accounts", headers=headers, json=items)
    assert result.status_code == 201
    agents = client.get("/api/agents", headers=headers).json()
    assert len({row["agent_id"] for row in agents}) == 1000
    assert {row["state"] for row in agents} == {"AUTH_REQUIRED"}
    assert client.post("/api/accounts", headers=headers, json=[account()]).status_code == 409
