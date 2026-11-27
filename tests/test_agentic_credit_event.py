"""Credit event correlation tests for G Shop v2.4 automatic merchant credit detection."""

import hashlib
import secrets
import time

import pytest
from cryptography.fernet import Fernet
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, func, select
from sqlalchemy.pool import StaticPool

from checkout import agentic_app
from checkout.agentic_api import now
from checkout.agentic_storage import (
    accounts, agent_sessions, credit_events, device_credentials,
    device_heartbeats, devices, merchants, metadata, orders, pairing_codes,
)


@pytest.fixture
def api(monkeypatch):
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    metadata.create_all(engine)
    merchant, account = "a" * 32, "b" * 32
    with engine.begin() as conn:
        conn.execute(merchants.insert().values(id=merchant, name="Disha", token_hash="x" * 64))
        conn.execute(accounts.insert().values(
            id=account, merchant_id=merchant, vpa="disha@example.in",
            bank="Test Bank", holder="Disha Holder", account_cipher="c",
            mobile_cipher="m", last4="1234", account_type="MERCHANT"))
    monkeypatch.setattr(agentic_app, "make_engine", lambda: engine)
    monkeypatch.setattr(agentic_app, "initialize", lambda _: None)
    monkeypatch.setenv("AGENTIC_OWNER_TOKEN", "a" * 43)
    monkeypatch.setenv("AGENTIC_ACCOUNT_KEY", Fernet.generate_key().decode())
    with TestClient(agentic_app.app) as client:
        yield client, engine, merchant, account
    engine.dispose()


def owner_headers():
    return {"Authorization": "Bearer " + "a" * 43}


def enroll_device(client, merchant, device_id="AgenticMobile0001"):
    res = client.post("/api/android/devices/pairing",
                      json={"merchant_id": merchant, "agent_id": "AGENT-0001"},
                      headers=owner_headers())
    assert res.status_code == 201
    code = res.json()["code"]
    pub = ("-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA" + "A" * 100 +
           "\n-----END PUBLIC KEY-----")
    pair_res = client.post("/api/android/pair", json={
        "code": code, "device_id": device_id, "public_key_pem": pub,
    })
    assert pair_res.status_code == 201
    return pair_res.json()["credential"]


def create_order(client, engine, merchant, account, amount_minor=100, status="AWAITING_PAYMENT", expired=False):
    order_id = secrets.token_hex(24)
    ts = now()
    if expired:
        created = ts - 300
        expires = ts - 200
    else:
        created = ts
        expires = ts + 120
    with engine.begin() as conn:
        conn.execute(orders.insert().values(
            id=order_id, merchant_id=merchant, account_id=account,
            amount_minor=amount_minor, created=created, expires=expires, status=status,
        ))
    return order_id, ts


def submit_credit_event(client, credential, event):
    return client.post("/api/android/credit-event", json=event,
                       headers={"Authorization": "Bearer " + credential})


def credit_event_payload(*, event_id, amount_paise=100, currency="INR",
                         direction="incoming", account_id, reference=None,
                         timestamp=None, source_app_id="com.phonepe.app"):
    if timestamp is None:
        timestamp = now()
    return {
        "event_id": event_id,
        "amount_paise": amount_paise,
        "currency": currency,
        "observation_direction": direction,
        "receiving_account_id": account_id,
        "transaction_reference": reference,
        "observation_timestamp": timestamp,
        "source_app_id": source_app_id,
    }


# 1. Valid incoming credit event with one eligible checkout → MATCHED
def test_valid_credit_event_matched(api):
    client, engine, merchant, account = api
    credential = enroll_device(client, merchant)
    order_id, ts = create_order(client, engine, merchant, account, amount_minor=100)

    event = credit_event_payload(
        event_id=hashlib.sha256(b"evt-1").hexdigest(),
        amount_paise=100,
        account_id=account,
        reference="123456789012",
        timestamp=ts,
    )
    res = submit_credit_event(client, credential, event)
    assert res.status_code == 202
    body = res.json()
    assert body["state"] == "OBSERVATION_MATCHED"
    assert body["decision"] == "MATCHED"
    assert body["matched_order_id"] == order_id

    # Checkout UI should reflect the match
    res = client.get("/api/checkout/" + order_id, headers=owner_headers())
    assert res.json()["settlement"]["state"] == "OBSERVATION_MATCHED"


# 2. Wrong amount → RECEIVED (unmatched, no checkout with that amount)
def test_wrong_amount(api):
    client, engine, merchant, account = api
    credential = enroll_device(client, merchant)
    create_order(client, engine, merchant, account, amount_minor=100)

    event = credit_event_payload(
        event_id=hashlib.sha256(b"evt-2").hexdigest(),
        amount_paise=200,  # wrong amount
        account_id=account,
        reference="123456789013",
        timestamp=now(),
    )
    res = submit_credit_event(client, credential, event)
    assert res.status_code == 202
    body = res.json()
    assert body["state"] == "OBSERVATION_RECEIVED"
    assert body["matched_order_id"] is None


# 3. Wrong receiving account → REJECTED
def test_wrong_receiving_account(api):
    client, engine, merchant, account = api
    credential = enroll_device(client, merchant)
    create_order(client, engine, merchant, account, amount_minor=100)

    event = credit_event_payload(
        event_id=hashlib.sha256(b"evt-3").hexdigest(),
        amount_paise=100,
        account_id="f" * 32,  # wrong account
        reference="123456789014",
        timestamp=now(),
    )
    res = submit_credit_event(client, credential, event)
    assert res.status_code == 202
    body = res.json()
    assert body["state"] == "OBSERVATION_REJECTED"
    assert body["matched_order_id"] is None


# 4. Wrong merchant → device credential only works for its own merchant
def test_wrong_merchant(api):
    client, engine, merchant, account = api
    # Create a second merchant and enroll device under first
    credential = enroll_device(client, merchant)
    # Create an order under a different merchant
    other_merchant = "z" * 32
    other_account = "c" * 32
    with engine.begin() as conn:
        conn.execute(merchants.insert().values(id=other_merchant, name="Other", token_hash="y" * 64))
        conn.execute(accounts.insert().values(
            id=other_account, merchant_id=other_merchant, vpa="other@example.in",
            bank="B", holder="H", account_cipher="c", mobile_cipher="m", last4="0000",
            account_type="MERCHANT"))
        create_order_internal = create_order
    order_id, ts = create_order(client, engine, other_merchant, other_account, amount_minor=100)

    event = credit_event_payload(
        event_id=hashlib.sha256(b"evt-4").hexdigest(),
        amount_paise=100,
        account_id=other_account,
        reference="123456789015",
        timestamp=ts,
    )
    res = submit_credit_event(client, credential, event)
    assert res.status_code == 202
    body = res.json()
    assert body["state"] == "OBSERVATION_REJECTED"
    assert body["matched_order_id"] is None


# 5. Outgoing transaction → REJECTED
def test_outgoing_transaction(api):
    client, engine, merchant, account = api
    credential = enroll_device(client, merchant)
    create_order(client, engine, merchant, account, amount_minor=100)

    event = credit_event_payload(
        event_id=hashlib.sha256(b"evt-5").hexdigest(),
        amount_paise=100,
        account_id=account,
        reference="123456789016",
        timestamp=now(),
        direction="outgoing",
    )
    res = submit_credit_event(client, credential, event)
    assert res.status_code == 202
    body = res.json()
    assert body["state"] == "OBSERVATION_REJECTED"


# 6. Missing transaction reference → still works (reference optional)
def test_missing_transaction_reference(api):
    client, engine, merchant, account = api
    credential = enroll_device(client, merchant)
    order_id, ts = create_order(client, engine, merchant, account, amount_minor=100)

    event = credit_event_payload(
        event_id=hashlib.sha256(b"evt-6").hexdigest(),
        amount_paise=100,
        account_id=account,
        reference=None,
        timestamp=ts,
    )
    res = submit_credit_event(client, credential, event)
    assert res.status_code == 202
    body = res.json()
    assert body["state"] == "OBSERVATION_MATCHED"
    assert body["matched_order_id"] == order_id


# 7. Unsupported currency → REJECTED
def test_unsupported_currency(api):
    client, engine, merchant, account = api
    credential = enroll_device(client, merchant)
    create_order(client, engine, merchant, account, amount_minor=100)

    event = credit_event_payload(
        event_id=hashlib.sha256(b"evt-7").hexdigest(),
        amount_paise=100,
        account_id=account,
        reference="123456789017",
        timestamp=now(),
        currency="USD",
    )
    res = submit_credit_event(client, credential, event)
    assert res.status_code == 202
    body = res.json()
    assert body["state"] == "OBSERVATION_REJECTED"


# 8. Duplicate transaction reference → REJECTED (already matched)
def test_duplicate_transaction_reference(api):
    client, engine, merchant, account = api
    credential = enroll_device(client, merchant)
    order_id, ts = create_order(client, engine, merchant, account, amount_minor=100)

    # First event matches
    event1 = credit_event_payload(
        event_id=hashlib.sha256(b"evt-8a").hexdigest(),
        amount_paise=100,
        account_id=account,
        reference="123456789018",
        timestamp=ts,
    )
    res1 = submit_credit_event(client, credential, event1)
    assert res1.json()["state"] == "OBSERVATION_MATCHED"

    # Second event with same reference → rejected
    event2 = credit_event_payload(
        event_id=hashlib.sha256(b"evt-8b").hexdigest(),
        amount_paise=100,
        account_id=account,
        reference="123456789018",  # same reference
        timestamp=ts + 1,
    )
    res2 = submit_credit_event(client, credential, event2)
    assert res2.status_code == 202
    body = res2.json()
    assert body["state"] == "OBSERVATION_REJECTED"


# 9. Duplicate event delivery → previous state preserved
def test_duplicate_event_delivery(api):
    client, engine, merchant, account = api
    credential = enroll_device(client, merchant)
    order_id, ts = create_order(client, engine, merchant, account, amount_minor=100)

    event = credit_event_payload(
        event_id=hashlib.sha256(b"evt-9").hexdigest(),
        amount_paise=100,
        account_id=account,
        reference="123456789019",
        timestamp=ts,
    )
    res1 = submit_credit_event(client, credential, event)
    assert res1.json()["state"] == "OBSERVATION_MATCHED"

    # Same event_id delivered again
    res2 = submit_credit_event(client, credential, event)
    assert res2.status_code == 202
    body = res2.json()
    assert body["state"] == "OBSERVATION_MATCHED"
    assert body["matched_order_id"] == order_id


# 10. Simultaneous identical payments → both match separate checkouts
def test_simultaneous_identical_payments(api):
    client, engine, merchant, account = api
    credential = enroll_device(client, merchant)
    # Note: amount_reservations has UniqueConstraint(account_id, payable_minor),
    # so two orders with the same amount for the same account cannot both be reserved.
    # This test verifies two separate checkouts with different amounts each match.
    order_id_1, ts = create_order(client, engine, merchant, account, amount_minor=100)
    order_id_2, _ = create_order(client, engine, merchant, account, amount_minor=200)

    event1 = credit_event_payload(
        event_id=hashlib.sha256(b"evt-10a").hexdigest(),
        amount_paise=100,
        account_id=account,
        reference="123456789020",
        timestamp=ts,
    )
    res1 = submit_credit_event(client, credential, event1)
    assert res1.json()["matched_order_id"] == order_id_1

    event2 = credit_event_payload(
        event_id=hashlib.sha256(b"evt-10b").hexdigest(),
        amount_paise=200,
        account_id=account,
        reference="123456789021",
        timestamp=ts,
    )
    res2 = submit_credit_event(client, credential, event2)
    assert res2.json()["matched_order_id"] == order_id_2


# 11. Ambiguous checkout matching → AMBIGUOUS
def test_ambiguous_checkout_matching(api):
    client, engine, merchant, account = api
    credential = enroll_device(client, merchant)
    ts = now()
    # Create two orders with same amount for same account (bypassing reservation uniqueness
    # by direct insert to simulate ambiguity)
    order_id_1 = secrets.token_hex(24)
    order_id_2 = secrets.token_hex(24)
    with engine.begin() as conn:
        conn.execute(orders.insert().values(
            id=order_id_1, merchant_id=merchant, account_id=account,
            amount_minor=100, created=ts, expires=ts + 120, status="AWAITING_PAYMENT",
        ))
        conn.execute(orders.insert().values(
            id=order_id_2, merchant_id=merchant, account_id=account,
            amount_minor=100, created=ts, expires=ts + 120, status="AWAITING_PAYMENT",
        ))

    event = credit_event_payload(
        event_id=hashlib.sha256(b"evt-11").hexdigest(),
        amount_paise=100,
        account_id=account,
        reference="123456789022",
        timestamp=ts,
    )
    res = submit_credit_event(client, credential, event)
    assert res.status_code == 202
    body = res.json()
    assert body["state"] == "AMBIGUOUS_OBSERVATION"
    assert body["decision"] == "AMBIGUOUS"
    assert body["matched_order_id"] is None


# 12. Event received after expiry → RECEIVED (unmatched, checkout expired)
def test_event_after_expiry(api):
    client, engine, merchant, account = api
    credential = enroll_device(client, merchant)
    order_id, ts = create_order(client, engine, merchant, account, amount_minor=100, expired=True)

    event = credit_event_payload(
        event_id=hashlib.sha256(b"evt-12").hexdigest(),
        amount_paise=100,
        account_id=account,
        reference="123456789023",
        timestamp=now(),
    )
    res = submit_credit_event(client, credential, event)
    assert res.status_code == 202
    body = res.json()
    assert body["state"] == "OBSERVATION_RECEIVED"
    assert body["matched_order_id"] is None


# 13. Revoked device credential → 401
def test_revoked_device_credential(api):
    client, engine, merchant, account = api
    credential = enroll_device(client, merchant)

    # Revoke the device
    res = client.post("/api/android/devices/AgenticMobile0001/revoke?merchant_id=" + merchant,
                      headers=owner_headers())
    assert res.status_code == 204

    event = credit_event_payload(
        event_id=hashlib.sha256(b"evt-13").hexdigest(),
        amount_paise=100,
        account_id=account,
        reference="123456789024",
        timestamp=now(),
    )
    res = submit_credit_event(client, credential, event)
    assert res.status_code == 401


# 14. Expired device credential → 401
def test_expired_device_credential(api, monkeypatch):
    client, engine, merchant, account = api
    credential = enroll_device(client, merchant)

    # Expire the credential
    old = now() - 1
    with engine.begin() as conn:
        conn.execute(device_credentials.update().where(
            device_credentials.c.device_id == "AgenticMobile0001"
        ).values(expires=old))

    event = credit_event_payload(
        event_id=hashlib.sha256(b"evt-14").hexdigest(),
        amount_paise=100,
        account_id=account,
        reference="123456789025",
        timestamp=now(),
    )
    res = submit_credit_event(client, credential, event)
    assert res.status_code == 401


# 22. No false financial verification → credit event does not set financially_verified / PAID
def test_no_false_financial_verification(api):
    client, engine, merchant, account = api
    credential = enroll_device(client, merchant)
    order_id, ts = create_order(client, engine, merchant, account, amount_minor=100)

    event = credit_event_payload(
        event_id=hashlib.sha256(b"evt-22").hexdigest(),
        amount_paise=100,
        account_id=account,
        reference="123456789026",
        timestamp=ts,
    )
    res = submit_credit_event(client, credential, event)
    assert res.json()["state"] == "OBSERVATION_MATCHED"

    # Order should NOT be PAID — only observation matched
    res = client.get("/api/checkout/" + order_id, headers=owner_headers())
    assert res.json()["status"] == "AWAITING_PAYMENT"
    assert res.json()["settlement"]["satisfied"] is False


# Credit events table stores the record
def test_credit_event_stored(api):
    client, engine, merchant, account = api
    credential = enroll_device(client, merchant)
    order_id, ts = create_order(client, engine, merchant, account, amount_minor=100)

    event = credit_event_payload(
        event_id=hashlib.sha256(b"evt-store").hexdigest(),
        amount_paise=100,
        account_id=account,
        reference="123456789027",
        timestamp=ts,
        source_app_id="com.google.android.apps.nbu.paisa.user",
    )
    submit_credit_event(client, credential, event)

    with engine.connect() as conn:
        row = conn.execute(select(credit_events).where(
            credit_events.c.event_id == hashlib.sha256(b"evt-store").hexdigest()
        )).mappings().first()
        assert row is not None
        assert row["state"] == "OBSERVATION_MATCHED"
        assert row["matched_order_id"] == order_id
        assert row["source_app_id"] == "com.google.android.apps.nbu.paisa.user"
        assert row["amount_paise"] == 100
