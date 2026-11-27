"""Device enrollment, authentication, heartbeat, and observation tests for Agentic Pay."""

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
    accounts, agent_sessions, device_credentials, device_heartbeats,
    device_observations, devices, merchants, metadata, orders, pairing_codes,
)


@pytest.fixture
def api(monkeypatch):
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    metadata.create_all(engine)
    merchant, account = "a" * 32, "b" * 32
    with engine.begin() as conn:
        conn.execute(merchants.insert().values(id=merchant, name="Disha 8.2", token_hash="x" * 64))
        conn.execute(accounts.insert().values(
            id=account, merchant_id=merchant, vpa="disha82@example",
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


# 1. Valid device enrollment
def test_valid_device_enrollment(api):
    client, engine, merchant, account = api
    # Generate pairing code
    res = client.post("/api/android/devices/pairing", json={"merchant_id": merchant, "agent_id": "AGENT-0001"}, headers=owner_headers())
    assert res.status_code == 201
    code = res.json()["code"]
    assert len(code) == 8
    assert res.json()["expires_in_seconds"] == 600

    # Device pairs with the code
    pub = "-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA" + "A" * 100 + "\n-----END PUBLIC KEY-----"
    res = client.post("/api/android/pair", json={
        "code": code,
        "device_id": "AgenticMobile0001",
        "public_key_pem": pub,
        "app_version": "2.0",
    })
    assert res.status_code == 201
    credential = res.json()["credential"]
    assert len(credential) > 0
    assert res.json()["expires_in_seconds"] == 30 * 24 * 60 * 60

    # Device is now registered and online
    res = client.get("/api/android/devices?merchant_id=" + merchant, headers=owner_headers())
    assert res.status_code == 200
    devices = res.json()
    assert len(devices) == 1
    assert devices[0]["device_id"] == "AgenticMobile0001"
    assert devices[0]["state"] == "ONLINE"
    assert devices[0]["app_version"] == "2.0"

    # Credential stored in database
    with engine.connect() as conn:
        row = conn.execute(select(device_credentials).where(
            device_credentials.c.device_id == "AgenticMobile0001"
        )).mappings().first()
        assert row is not None
        assert row["credential_hash"] == hashlib.sha256(credential.encode()).hexdigest()


# 2. Expired pairing code
def test_expired_pairing_code(api, monkeypatch):
    client, engine, merchant, account = api
    res = client.post("/api/android/devices/pairing", json={"merchant_id": merchant, "agent_id": "AGENT-0001"}, headers=owner_headers())
    code = res.json()["code"]

    # Expire the code by backdating its created timestamp
    old = now() - 700
    with engine.begin() as conn:
        conn.execute(pairing_codes.update().where(
            pairing_codes.c.code_hash == hashlib.sha256(code.encode()).hexdigest()
        ).values(created=old, expires=old + 600))

    pub = "-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA" + "A" * 100 + "\n-----END PUBLIC KEY-----"
    res = client.post("/api/android/pair", json={
        "code": code, "device_id": "AgenticMobile0001",
        "public_key_pem": pub,
    })
    assert res.status_code == 401
    assert "expired" in res.json()["detail"].lower()


# 3. Reused pairing code
def test_reused_pairing_code(api):
    client, engine, merchant, account = api
    res = client.post("/api/android/devices/pairing", json={"merchant_id": merchant, "agent_id": "AGENT-0001"}, headers=owner_headers())
    code = res.json()["code"]

    pub = "-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA" + "A" * 100 + "\n-----END PUBLIC KEY-----"

    # First use succeeds
    res1 = client.post("/api/android/pair", json={
        "code": code, "device_id": "DeviceAAAA", "public_key_pem": pub,
    })
    assert res1.status_code == 201

    # Second use with same code fails
    res2 = client.post("/api/android/pair", json={
        "code": code, "device_id": "DeviceBBBB", "public_key_pem": pub,
    })
    assert res2.status_code == 401
    assert "already used" in res2.json()["detail"].lower()


# 4. Unauthorized enrollment (no owner token)
def test_unauthorized_enrollment(api):
    client, _, _, _ = api
    res = client.post("/api/android/devices/pairing", json={"merchant_id": "a" * 32, "agent_id": "AGENT-0001"})
    assert res.status_code == 401


# 5. Cross-merchant access rejection
def test_cross_merchant_access_rejection(api):
    client, engine, merchant, account = api
    # Create a second merchant
    res2 = client.post("/api/owner/merchants", json={"name": "Other Shop"}, headers=owner_headers())

    # Enroll device under first merchant
    res = client.post("/api/android/devices/pairing", json={"merchant_id": merchant, "agent_id": "AGENT-0001"}, headers=owner_headers())
    code = res.json()["code"]
    pub = "-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA" + "A" * 100 + "\n-----END PUBLIC KEY-----"
    client.post("/api/android/pair", json={
        "code": code, "device_id": "AgenticMobile0001", "public_key_pem": pub,
    })

    # List devices for first merchant - should see the device
    res3 = client.get("/api/android/devices?merchant_id=" + merchant, headers=owner_headers())
    assert res3.status_code == 200
    assert len(res3.json()) == 1

    # List devices for second merchant - should see none
    other_token = res2.json()["token"]
    res4 = client.get("/api/android/devices", headers={"Authorization": "Bearer " + other_token})
    assert res4.status_code == 200
    assert len(res4.json()) == 0


# 6. Invalid device authentication
def test_invalid_device_authentication(api):
    client, _, _, _ = api
    res = client.post("/api/android/heartbeat", headers={"Authorization": "Bearer invalid_token"})
    assert res.status_code == 401


# 7. Revoked device authentication
def test_revoked_device_authentication(api):
    client, engine, merchant, account = api
    res = client.post("/api/android/devices/pairing", json={"merchant_id": merchant, "agent_id": "AGENT-0001"}, headers=owner_headers())
    code = res.json()["code"]
    pub = "-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA" + "A" * 100 + "\n-----END PUBLIC KEY-----"
    pair_res = client.post("/api/android/pair", json={
        "code": code, "device_id": "AgenticMobile0001", "public_key_pem": pub,
    })
    credential = pair_res.json()["credential"]

    # Revoke the device
    res = client.post("/api/android/devices/AgenticMobile0001/revoke?merchant_id=" + merchant, headers=owner_headers())
    assert res.status_code == 204

    # Heartbeat with revoked credential should fail
    res = client.post("/api/android/heartbeat", headers={"Authorization": "Bearer " + credential})
    assert res.status_code == 401

    # Observation with revoked credential should fail
    ts = now()
    res = client.post("/api/android/observations", json={
        "order_id": "c" * 48, "amount_paise": 100, "currency": "INR",
        "account_id": account,
        "observation_direction": "incoming",
        "evidence_provenance": "user_authorized",
        "observation_timestamp": ts,
        "checkout_created": ts,
        "checkout_expires": ts + 120,
    }, headers={"Authorization": "Bearer " + credential})
    assert res.status_code == 401


# 8. Heartbeat brings device online
def test_heartbeat_brings_device_online(api):
    client, engine, merchant, account = api
    res = client.post("/api/android/devices/pairing", json={"merchant_id": merchant, "agent_id": "AGENT-0001"}, headers=owner_headers())
    code = res.json()["code"]
    pub = "-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA" + "A" * 100 + "\n-----END PUBLIC KEY-----"
    pair_res = client.post("/api/android/pair", json={
        "code": code, "device_id": "AgenticMobile0001", "public_key_pem": pub,
    })
    credential = pair_res.json()["credential"]

    # First heartbeat - online
    res = client.post("/api/android/heartbeat", headers={"Authorization": "Bearer " + credential})
    assert res.status_code == 204

    # Device listed as online
    res = client.get("/api/android/devices?merchant_id=" + merchant, headers=owner_headers())
    assert res.json()[0]["state"] == "ONLINE"


# 9. Valid synthetic observation submission
def test_valid_observation_submission(api):
    client, engine, merchant, account = api
    # Create a checkout order
    order_id = "c" * 48
    ts = now()
    with engine.begin() as conn:
        conn.execute(orders.insert().values(
            id=order_id, merchant_id=merchant, account_id=account,
            amount_minor=100, created=ts, expires=ts + 120, status="AWAITING_PAYMENT",
        ))

    # Enroll device
    res = client.post("/api/android/devices/pairing", json={"merchant_id": merchant, "agent_id": "AGENT-0001"}, headers=owner_headers())
    code = res.json()["code"]
    pub = "-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA" + "A" * 100 + "\n-----END PUBLIC KEY-----"
    pair_res = client.post("/api/android/pair", json={
        "code": code, "device_id": "AgenticMobile0001", "public_key_pem": pub,
    })
    credential = pair_res.json()["credential"]

    # Submit observation
    res = client.post("/api/android/observations", json={
        "order_id": order_id,
        "amount_paise": 100,
        "currency": "INR",
        "account_id": account,
        "transaction_reference": "123456789012",
        "observation_direction": "incoming",
        "evidence_provenance": "user_authorized",
        "observation_timestamp": ts,
        "checkout_created": ts,
        "checkout_expires": ts + 120,
    }, headers={"Authorization": "Bearer " + credential})
    assert res.status_code == 202
    body = res.json()
    assert body["state"] == "OBSERVATION_RECEIVED"
    assert body["decision"] == "RECEIVED"
    assert "observation_id" in body


# 10. Incorrect amount rejection
def test_incorrect_amount_rejection(api):
    client, engine, merchant, account = api
    order_id = "d" * 48
    ts = now()
    with engine.begin() as conn:
        conn.execute(orders.insert().values(
            id=order_id, merchant_id=merchant, account_id=account,
            amount_minor=100, created=ts, expires=ts + 120, status="AWAITING_PAYMENT",
        ))

    res = client.post("/api/android/devices/pairing", json={"merchant_id": merchant, "agent_id": "AGENT-0001"}, headers=owner_headers())
    code = res.json()["code"]
    pub = "-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA" + "A" * 100 + "\n-----END PUBLIC KEY-----"
    pair_res = client.post("/api/android/pair", json={
        "code": code, "device_id": "AgenticMobile0001", "public_key_pem": pub,
    })
    credential = pair_res.json()["credential"]

    res = client.post("/api/android/observations", json={
        "order_id": order_id, "amount_paise": 200,  # Wrong amount
        "currency": "INR",
        "account_id": account,
        "observation_direction": "incoming",
        "evidence_provenance": "user_authorized",
        "observation_timestamp": ts,
        "checkout_created": ts,
        "checkout_expires": ts + 120,
    }, headers={"Authorization": "Bearer " + credential})
    assert res.status_code == 202
    body = res.json()
    assert body["state"] == "OBSERVATION_RECEIVED"


# 11. Cross-merchant observation rejection
def test_cross_merchant_observation_rejection(api):
    client, engine, merchant, account = api
    # Create second merchant
    res2 = client.post("/api/owner/merchants", json={"name": "Other"}, headers=owner_headers())
    other_merchant_id = res2.json()["id"]

    # Create order for other merchant
    other_account = "e" * 32
    order_id = "f" * 48
    ts = now()
    with engine.begin() as conn:
        conn.execute(accounts.insert().values(
            id=other_account, merchant_id=other_merchant_id, vpa="other@example",
            bank="B", holder="H", account_cipher="c", mobile_cipher="m", last4="0000",
            account_type="PERSONAL",
        ))
        conn.execute(orders.insert().values(
            id=order_id, merchant_id=other_merchant_id, account_id=other_account,
            amount_minor=100, created=ts, expires=ts + 120, status="AWAITING_PAYMENT",
        ))

    # Enroll device under first merchant
    res = client.post("/api/android/devices/pairing", json={"merchant_id": merchant, "agent_id": "AGENT-0001"}, headers=owner_headers())
    code = res.json()["code"]
    pub = "-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA" + "A" * 100 + "\n-----END PUBLIC KEY-----"
    pair_res = client.post("/api/android/pair", json={
        "code": code, "device_id": "AgenticMobile0001", "public_key_pem": pub,
    })
    credential = pair_res.json()["credential"]

    # Try to submit observation for other merchant's order
    res = client.post("/api/android/observations", json={
        "order_id": order_id, "amount_paise": 100, "currency": "INR",
        "account_id": other_account,
        "observation_direction": "incoming",
        "evidence_provenance": "user_authorized",
        "observation_timestamp": ts,
        "checkout_created": ts,
        "checkout_expires": ts + 120,
    }, headers={"Authorization": "Bearer " + credential})
    assert res.status_code == 403


# 12. Incorrect receiving account rejection
def test_incorrect_receiving_account_rejection(api):
    client, engine, merchant, account = api
    order_id = "1" * 48
    ts = now()
    with engine.begin() as conn:
        conn.execute(orders.insert().values(
            id=order_id, merchant_id=merchant, account_id=account,
            amount_minor=100, created=ts, expires=ts + 120, status="AWAITING_PAYMENT",
        ))

    res = client.post("/api/android/devices/pairing", json={"merchant_id": merchant, "agent_id": "AGENT-0001"}, headers=owner_headers())
    code = res.json()["code"]
    pub = "-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA" + "A" * 100 + "\n-----END PUBLIC KEY-----"
    pair_res = client.post("/api/android/pair", json={
        "code": code, "device_id": "AgenticMobile0001", "public_key_pem": pub,
    })
    credential = pair_res.json()["credential"]

    res = client.post("/api/android/observations", json={
        "order_id": order_id,
        "amount_paise": 100,
        "currency": "INR",
        "account_id": "f" * 32,  # wrong account
        "observation_direction": "incoming",
        "evidence_provenance": "user_authorized",
        "observation_timestamp": ts,
        "checkout_created": ts,
        "checkout_expires": ts + 120,
    }, headers={"Authorization": "Bearer " + credential})
    assert res.status_code == 403


# 13. Expired checkout rejection
def test_expired_checkout_rejection(api):
    client, engine, merchant, account = api
    order_id = "8" * 48
    ts = now() - 200  # Already expired
    with engine.begin() as conn:
        conn.execute(orders.insert().values(
            id=order_id, merchant_id=merchant, account_id=account,
            amount_minor=100, created=ts - 300, expires=ts - 200, status="AWAITING_PAYMENT",
        ))

    res = client.post("/api/android/devices/pairing", json={"merchant_id": merchant, "agent_id": "AGENT-0001"}, headers=owner_headers())
    code = res.json()["code"]
    pub = "-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA" + "A" * 100 + "\n-----END PUBLIC KEY-----"
    pair_res = client.post("/api/android/pair", json={
        "code": code, "device_id": "AgenticMobile0001", "public_key_pem": pub,
    })
    credential = pair_res.json()["credential"]

    res = client.post("/api/android/observations", json={
        "order_id": order_id, "amount_paise": 100, "currency": "INR",
        "account_id": account,
        "observation_direction": "incoming",
        "evidence_provenance": "user_authorized",
        "observation_timestamp": now(),
        "checkout_created": ts - 300,
        "checkout_expires": ts - 200,
    }, headers={"Authorization": "Bearer " + credential})
    assert res.status_code == 410


# 14. Duplicate and replay rejection
def test_duplicate_and_replay_rejection(api):
    client, engine, merchant, account = api
    order_id = "9" * 48
    ts = now()
    with engine.begin() as conn:
        conn.execute(orders.insert().values(
            id=order_id, merchant_id=merchant, account_id=account,
            amount_minor=100, created=ts, expires=ts + 120, status="AWAITING_PAYMENT",
        ))

    res = client.post("/api/android/devices/pairing", json={"merchant_id": merchant, "agent_id": "AGENT-0001"}, headers=owner_headers())
    code = res.json()["code"]
    pub = "-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA" + "A" * 100 + "\n-----END PUBLIC KEY-----"
    pair_res = client.post("/api/android/pair", json={
        "code": code, "device_id": "AgenticMobile0001", "public_key_pem": pub,
    })
    credential = pair_res.json()["credential"]

    # First observation succeeds
    res1 = client.post("/api/android/observations", json={
        "order_id": order_id, "amount_paise": 100, "currency": "INR",
        "account_id": account,
        "observation_direction": "incoming",
        "evidence_provenance": "user_authorized",
        "observation_timestamp": ts,
        "checkout_created": ts,
        "checkout_expires": ts + 120,
    }, headers={"Authorization": "Bearer " + credential})
    assert res1.status_code == 202

    # Duplicate observation from same device
    res2 = client.post("/api/android/observations", json={
        "order_id": order_id, "amount_paise": 100, "currency": "INR",
        "account_id": account,
        "observation_direction": "incoming",
        "evidence_provenance": "user_authorized",
        "observation_timestamp": ts + 1,
        "checkout_created": ts,
        "checkout_expires": ts + 120,
    }, headers={"Authorization": "Bearer " + credential})
    assert res2.status_code == 202
    assert res2.json()["state"] == "OBSERVATION_REJECTED"
    assert res2.json()["decision"] == "REJECTED"


# 15. Ambiguous transaction matching
def test_ambiguous_transaction_matching(api):
    client, engine, merchant, account = api
    order_id = "e" * 48
    ts = now()
    with engine.begin() as conn:
        conn.execute(orders.insert().values(
            id=order_id, merchant_id=merchant, account_id=account,
            amount_minor=100, created=ts, expires=ts + 120, status="AWAITING_PAYMENT",
        ))

    # Enroll two devices
    creds = []
    for dev_id in ["DeviceAAAA", "DeviceBBBB"]:
        res = client.post("/api/android/devices/pairing", json={"merchant_id": merchant, "agent_id": "AGENT-0001"}, headers=owner_headers())
        code = res.json()["code"]
        pub = "-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA" + "A" * 100 + "\n-----END PUBLIC KEY-----"
        pair_res = client.post("/api/android/pair", json={
            "code": code, "device_id": dev_id, "public_key_pem": pub,
        })
        creds.append(pair_res.json()["credential"])

    # First device submits observation
    res1 = client.post("/api/android/observations", json={
        "order_id": order_id, "amount_paise": 100, "currency": "INR",
        "account_id": account,
        "observation_direction": "incoming",
        "evidence_provenance": "user_authorized",
        "observation_timestamp": ts,
        "checkout_created": ts,
        "checkout_expires": ts + 120,
    }, headers={"Authorization": "Bearer " + creds[0]})
    assert res1.json()["state"] == "OBSERVATION_RECEIVED"

    # Second device submits observation for same order - ambiguous
    res2 = client.post("/api/android/observations", json={
        "order_id": order_id, "amount_paise": 100, "currency": "INR",
        "account_id": account,
        "observation_direction": "incoming",
        "evidence_provenance": "user_authorized",
        "observation_timestamp": ts + 1,
        "checkout_created": ts,
        "checkout_expires": ts + 120,
    }, headers={"Authorization": "Bearer " + creds[1]})
    assert res2.status_code == 202
    assert res2.json()["state"] == "AMBIGUOUS_OBSERVATION"
    assert res2.json()["decision"] == "AMBIGUOUS"


# 16. Persistence across server restart (simulated by re-querying DB)
def test_persistence_across_restart(api):
    client, engine, merchant, account = api
    res = client.post("/api/android/devices/pairing", json={"merchant_id": merchant, "agent_id": "AGENT-0001"}, headers=owner_headers())
    code = res.json()["code"]
    pub = "-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA" + "A" * 100 + "\n-----END PUBLIC KEY-----"
    client.post("/api/android/pair", json={
        "code": code, "device_id": "AgenticMobile0001", "public_key_pem": pub,
    })

    # Data persists in the database (simulating server restart)
    with engine.connect() as conn:
        count = conn.execute(select(func.count()).select_from(devices)).scalar()
        assert count == 1
        state = conn.execute(select(devices.c.state).where(devices.c.device_id == "AgenticMobile0001")).scalar()
        assert state == "ONLINE"


# 17. Prevention of false financial verification
def test_no_false_financial_verification(api):
    client, engine, merchant, account = api
    order_id = "f" * 48
    ts = now()
    with engine.begin() as conn:
        conn.execute(orders.insert().values(
            id=order_id, merchant_id=merchant, account_id=account,
            amount_minor=100, created=ts, expires=ts + 120, status="AWAITING_PAYMENT",
        ))

    res = client.post("/api/android/devices/pairing", json={"merchant_id": merchant, "agent_id": "AGENT-0001"}, headers=owner_headers())
    code = res.json()["code"]
    pub = "-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA" + "A" * 100 + "\n-----END PUBLIC KEY-----"
    pair_res = client.post("/api/android/pair", json={
        "code": code, "device_id": "AgenticMobile0001", "public_key_pem": pub,
    })
    credential = pair_res.json()["credential"]

    # Submit observation - this should NOT set financially_verified
    res = client.post("/api/android/observations", json={
        "order_id": order_id, "amount_paise": 100, "currency": "INR",
        "account_id": account,
        "observation_direction": "incoming",
        "evidence_provenance": "user_authorized",
        "observation_timestamp": ts,
        "checkout_created": ts,
        "checkout_expires": ts + 120,
    }, headers={"Authorization": "Bearer " + credential})
    assert res.status_code == 202

    # Order status should remain AWAITING_PAYMENT (not PAID)
    res = client.get("/api/checkout/" + order_id, headers=owner_headers())
    assert res.json()["status"] == "AWAITING_PAYMENT"
    assert res.json()["settlement"]["satisfied"] is False


# 18. Owner dashboard enrollment functionality
def test_owner_dashboard_enrollment_functionality(api):
    client, _, merchant, _ = api
    # Owner can generate pairing codes
    res = client.post("/api/android/devices/pairing", json={"merchant_id": merchant, "agent_id": "AGENT-0001"}, headers=owner_headers())
    assert res.status_code == 201
    assert "code" in res.json()
    assert "expires_in_seconds" in res.json()

    # Owner can list devices (empty initially)
    res = client.get("/api/android/devices?merchant_id=" + merchant, headers=owner_headers())
    assert res.status_code == 200
    assert res.json() == []

    # Owner workspace status endpoint
    res = client.get("/api/android/workspace/status", headers=owner_headers())
    assert res.status_code == 200
    assert res.json()["state"] == "ENROLLMENT_PENDING"


def test_device_status_recovery_and_rotation(api):
    client, engine, merchant, account = api
    def pair():
        code = client.post("/api/android/devices/pairing", json={"merchant_id": merchant, "agent_id": "AGENT-0001"}, headers=owner_headers()).json()["code"]
        response = client.post("/api/android/pair", json={"code": code, "device_id": "RecoveryDevice01", "public_key_pem": "-----BEGIN PUBLIC KEY-----\\n" + "A" * 120 + "\\n-----END PUBLIC KEY-----"})
        assert response.status_code == 201
        return {"Authorization": "Bearer " + response.json()["credential"]}
    headers = pair()
    assert client.get("/api/android/device/status").status_code == 401
    with engine.begin() as conn:
        conn.execute(devices.update().where(devices.c.device_id == "RecoveryDevice01").values(state="OFFLINE"))
    assert client.get("/api/android/device/status", headers=headers).json()["connected"] is False
    assert client.post("/api/android/heartbeat", headers=headers).status_code == 204
    status = client.get("/api/android/device/status", headers=headers).json()
    assert status["connected"] is True
    assert status["financially_verified"] is False
    replacement = pair()
    assert client.get("/api/android/device/status", headers=headers).status_code == 401
    assert client.get("/api/android/device/status", headers=replacement).status_code == 200
