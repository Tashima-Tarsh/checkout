import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, func, select
from sqlalchemy.pool import StaticPool

from checkout import agentic_app, agentic_live_vision_api
from checkout.agentic_api import digest, now
from checkout.agentic_storage import (
    accounts,
    amount_reservations,
    evidence_consumption,
    live_verification_challenges,
    merchants,
    metadata,
    orders,
)

ORIGIN = "https://agenticpay.thenitishkr.in"


@pytest.fixture
def live(monkeypatch):
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    metadata.create_all(engine)
    merchant, account, oid = "a" * 32, "b" * 32, "c" * 48
    token = "m" * 43
    with engine.begin() as conn:
        conn.execute(merchants.insert().values(id=merchant, name="fixture", token_hash=digest(token)))
        conn.execute(accounts.insert().values(
            id=account, merchant_id=merchant, vpa="merchant@example", bank="fixture",
            holder="fixture", account_cipher="fixture", mobile_cipher="fixture",
            last4="0000", account_type="PERSONAL",
        ))
        conn.execute(orders.insert().values(
            id=oid, merchant_id=merchant, account_id=account, amount_minor=10037,
            created=now()-10, expires=now()+1800, status="AWAITING_PAYMENT",
        ))
        conn.execute(amount_reservations.insert().values(
            order_id=oid, account_id=account, payable_minor=10037,
        ))
    monkeypatch.setattr(agentic_app.app.state, "engine", engine, raising=False)
    monkeypatch.setattr(agentic_live_vision_api, "analyze_live_frame", lambda *_: {
        "sensitive_content": False, "success": True, "amount_minor": 10037,
        "payee": "merchant@example", "reference": "123456789012",
    })
    client = TestClient(agentic_app.app)
    yield client, engine, oid, token
    client.close()
    engine.dispose()


def challenge(client, oid):
    response = client.post(f"/api/checkout/{oid}/live/session", headers={"Origin": ORIGIN})
    assert response.status_code == 200
    assert response.json()["media_retained"] is False
    return response.json()["challenge"]


def frame(client, oid, token=None):
    headers = {"Origin": ORIGIN, "Content-Type": "image/png"}
    if token is not None:
        headers["X-Agentic-Challenge"] = token
    return client.post(f"/api/checkout/{oid}/live/frame", headers=headers, content=b"live-frame-bytes")


def test_fresh_exact_live_evidence_turns_checkout_and_merchant_ledger_green(live):
    client, engine, oid, token = live
    response = frame(client, oid, challenge(client, oid))
    assert response.status_code == 200
    assert response.json() == {
        "satisfied": True, "state": "SETTLED", "reason": "Verified payment.",
        "seen": {"amount_minor": 10037, "payee_ok": True},
    }
    assert "123456789012" not in response.text
    assert "merchant@example" not in response.text
    with engine.connect() as conn:
        assert conn.scalar(select(orders.c.status)) == "PAID"
        assert conn.scalar(select(evidence_consumption.c.order_id)) == oid
        assert conn.scalar(select(func.count()).select_from(live_verification_challenges)) == 0
    checkout = client.get(f"/api/checkout/{oid}").json()
    assert checkout["status"] == "PAID"
    assert checkout["settlement"]["satisfied"] is True
    assert checkout["live_verification"] == {"enabled": True, "time_bound": True, "media_retained": False}
    ledger = client.get("/api/orders", headers={"Authorization": "Bearer " + token}).json()
    assert ledger[0]["settlement"] == {
        "satisfied": True, "state": "SETTLED", "reason": "Verified payment.",
    }


def test_wrong_amount_is_red_with_figure_and_no_sensitive_fields(live, monkeypatch):
    client, engine, oid, _ = live
    monkeypatch.setattr(agentic_live_vision_api, "analyze_live_frame", lambda *_: {
        "sensitive_content": False, "success": True, "amount_minor": 15000,
        "payee": "merchant@example", "reference": "123456789012",
    })
    result = frame(client, oid, challenge(client, oid)).json()
    assert result == {
        "satisfied": False, "state": "WRONG_AMOUNT",
        "reason": "₹150.00 observed — this order needs ₹100.37.",
        "seen": {"amount_minor": 15000, "payee_ok": True},
    }
    with engine.connect() as conn:
        assert conn.scalar(select(orders.c.status)) == "AWAITING_PAYMENT"
        assert conn.scalar(select(evidence_consumption.c.order_id)) is None


def test_wrong_payee_is_red_without_echoing_payee_identifier(live, monkeypatch):
    client, engine, oid, _ = live
    monkeypatch.setattr(agentic_live_vision_api, "analyze_live_frame", lambda *_: {
        "sensitive_content": False, "success": True, "amount_minor": 10037,
        "payee": "other@example", "reference": "123456789012",
    })
    response = frame(client, oid, challenge(client, oid))
    result = response.json()
    assert result["state"] == "WRONG_PAYEE"
    assert result["seen"] == {"amount_minor": 10037, "payee_ok": False}
    assert "other@example" not in response.text
    with engine.connect() as conn:
        assert conn.scalar(select(orders.c.status)) == "AWAITING_PAYMENT"


def test_sensitive_frame_is_rejected_without_storage(live, monkeypatch):
    client, engine, oid, _ = live
    monkeypatch.setattr(agentic_live_vision_api, "analyze_live_frame", lambda *_: {
        "sensitive_content": True,
    })
    response = frame(client, oid, challenge(client, oid))
    assert response.json()["state"] == "SENSITIVE_CONTENT_REJECTED"
    assert "seen" in response.json()
    with engine.connect() as conn:
        assert conn.scalar(select(orders.c.status)) == "AWAITING_PAYMENT"
        assert conn.scalar(select(evidence_consumption.c.order_id)) is None
        assert conn.scalar(select(func.count()).select_from(live_verification_challenges)) == 0


def test_missing_or_reused_challenge_cannot_settle(live):
    client, engine, oid, _ = live
    missing = frame(client, oid)
    assert missing.json()["state"] == "CHALLENGE_EXPIRED"
    token = challenge(client, oid)
    # First result is red but consumes the challenge; replaying it cannot pass.
    monkeypatch = pytest.MonkeyPatch()
    monkeypatch.setattr(agentic_live_vision_api, "analyze_live_frame", lambda *_: {
        "sensitive_content": False, "success": False, "amount_minor": None,
        "payee": None, "reference": None,
    })
    assert frame(client, oid, token).json()["state"] == "NOT_YET"
    monkeypatch.setattr(agentic_live_vision_api, "analyze_live_frame", lambda *_: {
        "sensitive_content": False, "success": True, "amount_minor": 10037,
        "payee": "merchant@example", "reference": "123456789012",
    })
    assert frame(client, oid, token).json()["state"] == "CHALLENGE_EXPIRED"
    monkeypatch.undo()
    with engine.connect() as conn:
        assert conn.scalar(select(orders.c.status)) == "AWAITING_PAYMENT"


def test_chime_only_requests_a_fresh_frame_and_paid_reload_stays_green(live):
    client, engine, oid, _ = live
    response = client.post(f"/api/checkout/{oid}/live/chime", headers={"Origin": ORIGIN})
    assert response.status_code == 202
    assert response.json() == {"satisfied": False, "state": "CHECK_REQUESTED", "media_retained": False}
    assert client.get(f"/api/checkout/{oid}").json()["settlement"]["satisfied"] is False
    assert frame(client, oid, challenge(client, oid)).json()["satisfied"] is True
    with engine.begin() as conn:
        conn.execute(orders.update().values(expires=now()-1))
    checkout = client.get(f"/api/checkout/{oid}").json()
    assert checkout["status"] == "PAID"
    assert checkout["settlement"]["satisfied"] is True
