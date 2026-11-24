import hashlib

import pytest
from cryptography.fernet import Fernet
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, func, select
from sqlalchemy.pool import StaticPool

from checkout import agentic_app, agentic_vision_api
from checkout.agentic_api import now
from checkout.agentic_storage import accounts, amount_reservations, merchants, metadata, orders, receipt_observations


@pytest.fixture
def api(monkeypatch):
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    metadata.create_all(engine)
    merchant, account, order = "a" * 32, "b" * 32, "c" * 48
    with engine.begin() as conn:
        conn.execute(merchants.insert().values(id=merchant, name="fixture", token_hash="x" * 64))
        conn.execute(accounts.insert().values(id=account, merchant_id=merchant, vpa="fixture@example",
            bank="fixture", holder="fixture", account_cipher="fixture", mobile_cipher="fixture", last4="0000", account_type="PERSONAL"))
        conn.execute(orders.insert().values(id=order, merchant_id=merchant, account_id=account,
            amount_minor=100, created=now(), expires=now()+1800, status="AWAITING_PAYMENT"))
        conn.execute(amount_reservations.insert().values(order_id=order, account_id=account, payable_minor=100))
    monkeypatch.setattr(agentic_app, "make_engine", lambda: engine)
    monkeypatch.setattr(agentic_app, "initialize", lambda _: None)
    monkeypatch.setenv("AGENTIC_OWNER_TOKEN", "a" * 43)
    monkeypatch.setenv("AGENTIC_ACCOUNT_KEY", Fernet.generate_key().decode())
    monkeypatch.setenv("AGENTIC_VISION_LAB", "1")
    agentic_vision_api.frame_limits.clear()
    with TestClient(agentic_app.app) as client:
        yield client, engine, order
    engine.dispose()


def headers(**extra):
    return {"Authorization": "Bearer " + "a" * 43, "Content-Type": "image/png", **extra}


def test_authenticated_frames_are_scoped_replay_safe_and_non_financial(api, monkeypatch):
    client, engine, order = api
    monkeypatch.setattr(agentic_vision_api, "analyze_image", lambda *_: {
        "decision":"VISUAL_SUCCESS", "financially_verified":False, "checkout_changed":False,
    })
    assert client.post(f"/api/checkout/{order}/receipt-observation", content=b"frame").status_code == 401
    assert client.post(f"/api/checkout/{order}/receipt-observation", headers=headers(**{"X-Agentic-Synthetic":"1"}), content=b"frame").status_code == 403
    dry = client.post(f"/api/checkout/{order}/receipt-observation?dry_run=1", headers=headers(**{"X-Agentic-Synthetic":"1"}), content=b"frame")
    assert dry.json()["recognized"] is True and dry.json()["dry_run"] is True
    assert client.get(f"/api/checkout/{order}").json().get("receipt_observation") is None
    result = client.post(f"/api/checkout/{order}/receipt-observation", headers=headers(), content=b"frame")
    assert result.json()["recognized"] is True
    observation = client.get(f"/api/checkout/{order}").json()["receipt_observation"]
    assert observation == {"order_id":order, "decision":"VISUAL_SUCCESS", "advance_research":True, "financially_verified":False, "checkout_changed":False}
    replay = client.post(f"/api/checkout/{order}/receipt-observation", headers=headers(), content=b"frame")
    assert replay.json()["replayed"] is True
    with engine.connect() as conn:
        assert conn.scalar(select(func.count()).select_from(receipt_observations)) == 1
        assert conn.scalar(select(orders.c.status)) == "AWAITING_PAYMENT"
        assert conn.scalar(select(receipt_observations.c.frame_digest)) == hashlib.sha256(b"frame").hexdigest()


def test_failed_or_mismatched_frames_never_publish_observations(api, monkeypatch):
    client, _, order = api
    monkeypatch.setattr(agentic_vision_api, "analyze_image", lambda *_: {
        "decision":"AMOUNT_UNCONFIRMED", "financially_verified":False, "checkout_changed":False,
    })
    result = client.post(f"/api/checkout/{order}/receipt-observation", headers=headers(), content=b"different")
    assert result.json() == {"recognized":False, "decision":"AMOUNT_UNCONFIRMED", "financially_verified":False, "checkout_changed":False}
    assert "receipt_observation" not in client.get(f"/api/checkout/{order}").json()
