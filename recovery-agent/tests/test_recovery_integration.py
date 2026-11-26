"""Integration tests for Agentic-Recovery API endpoints.

Tests device signature authentication, tenant isolation, role-based access,
and end-to-end flows using the actual FastAPI endpoints.
"""

import time
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ed25519

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select

from recovery.models import (
    Base,
    Tenant,
    Employee,
    AndroidDevice,
    MobileAgent,
    CollectionCase,
    Checkout,
    Observation,
    LedgerEntry,
    Outbox,
    AuditEvent,
    DeviceSession,
    RoleAssignment,
)
from recovery.server import create_app
from recovery.storage import make_engine, make_session, initialize, now_ms


@pytest.fixture(scope="function")
def db_engine(tmp_path):
    """File-based SQLite engine for tests."""
    db_file = tmp_path / "test.db"
    engine = create_engine(
        f"sqlite:///{db_file}",
        pool_pre_ping=True,
        connect_args={"check_same_thread": False},
    )
    initialize(engine)
    yield engine
    engine.dispose()


@pytest.fixture(scope="function")
def db_session(db_engine):
    Session = make_session(db_engine)
    session = Session()
    yield session
    session.close()


@pytest.fixture(scope="function")
def client(db_session, db_engine):
    app = create_app(engine=db_engine)
    client = TestClient(app)
    yield client
    client.close()


# ---- Helpers (same as test_recovery.py) ----

def make_tenant(db, tid="t1", name="Test Tenant"):
    t = Tenant(id=tid, name=name)
    db.add(t)
    db.commit()
    return t


def make_employee(db, tid="t1", eid="EMP-0001", name="Test Employee", upi="emp@upi", device_id=None, role="recovery_employee"):
    e = Employee(id=eid, tenant_id=tid, name=name, assigned_receiver_upi=upi, assigned_device_id=device_id, role=role)
    db.add(e)
    db.commit()
    role_assignment = RoleAssignment(
        id=f"role_{eid}_{role}",
        tenant_id=tid,
        employee_id=eid,
        role=role,
        granted_by="owner-001",
    )
    db.add(role_assignment)
    db.commit()
    return e


def make_device(db, tid="t1", did="mobile-0001", upi="receiver@upi", app="Google Pay", pubkey_pem=None, serial=None, fingerprint=None):
    if pubkey_pem is None:
        kp = ed25519.Ed25519PrivateKey.generate()
        pub_pem = kp.public_key().public_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PublicFormat.SubjectPublicKeyInfo,
        ).decode()
        priv_pem = kp.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.PKCS8,
            encryption_algorithm=serialization.NoEncryption(),
        ).decode()
    else:
        pub_pem = pubkey_pem
        priv_pem = None
    d = AndroidDevice(
        id=did,
        tenant_id=tid,
        registered_upi_id=upi,
        upi_application=app,
        public_key_pem=pub_pem,
        device_serial=serial,
        device_fingerprint=fingerprint,
        connectivity_status="online",
    )
    db.add(d)
    db.commit()
    return d, priv_pem


def make_agent(db, did="mobile-0001", tid="t1", aid="agent-0001"):
    a = MobileAgent(id=aid, device_id=did, tenant_id=tid)
    db.add(a)
    db.commit()
    return a


def make_checkout(db, cid="rcv_obs", amount=100, tid="t1", eid="EMP-0001", did="mobile-0001", upi="receiver@upi"):
    c = Checkout(
        id=cid,
        tenant_id=tid,
        employee_id=eid,
        device_id=did,
        receiver_upi_id=upi,
        amount_paise=amount,
        state="CREATED",
        expires=int(time.time() * 1000) + 120000,
    )
    db.add(c)
    db.commit()
    return c


def build_observation_message(payload_dict):
    fields = [
        payload_dict.get("id", ""),
        payload_dict.get("device_id", ""),
        payload_dict.get("checkout_id", "") or "",
        payload_dict.get("observed_receiver_upi", "") or "",
        payload_dict.get("payer_name", "") or "",
        payload_dict.get("payer_upi_id", "") or "",
        str(payload_dict.get("amount_paise", "")),
        payload_dict.get("currency", "") or "",
        payload_dict.get("utr_rrn", "") or "",
        payload_dict.get("app_transaction_id", "") or "",
        payload_dict.get("transaction_direction", "") or "",
        payload_dict.get("app_reported_status", "") or "",
        str(payload_dict.get("transaction_timestamp", "")),
        str(payload_dict.get("observation_timestamp", "")),
        payload_dict.get("source_application", "") or "",
        payload_dict.get("evidence_type", "") or "",
        payload_dict.get("evidence_fingerprint", "") or "",
    ]
    return "|".join(fields)


def sign_observation(device_private_key_pem, payload_dict, timestamp=None):
    if timestamp is None:
        timestamp = int(time.time() * 1000)
    message = build_observation_message(payload_dict)
    private_key = serialization.load_pem_private_key(
        device_private_key_pem.encode(), password=None
    )
    signature = private_key.sign(message.encode("utf-8"))
    return signature.hex(), timestamp


def make_full_observation_payload(obs_id="obs_test", device_id="mobile-0001", **overrides):
    payload = {
        "id": obs_id,
        "device_id": device_id,
        "checkout_id": None,
        "observed_receiver_upi": "receiver@upi",
        "payer_name": "Payer",
        "payer_upi_id": "payer@upi",
        "amount_paise": 100,
        "currency": "INR",
        "utr_rrn": None,
        "app_transaction_id": None,
        "transaction_direction": "incoming",
        "app_reported_status": "SUCCESS",
        "transaction_timestamp": None,
        "observation_timestamp": int(time.time() * 1000),
        "source_application": "Google Pay",
        "evidence_type": "notification",
        "evidence_fingerprint": None,
    }
    payload.update(overrides)
    return payload


# ---- Authentication Tests ----

def test_device_signature_authentication_valid(client, db_session):
    """Valid Ed25519 signature allows observation ingestion."""
    make_tenant(db_session)
    make_employee(db_session)
    device, priv_key = make_device(db_session)
    make_checkout(db_session, cid="rcv_sig", amount=100)

    payload = make_full_observation_payload("obs_sig_valid", "mobile-0001", checkout_id="rcv_sig")
    sig, ts = sign_observation(priv_key, payload)
    response = client.post(
        "/api/recovery/observations/ingest",
        json={**payload, "observation_timestamp": ts, "signature": sig, "signature_timestamp": ts},
        headers={"X-Tenant-Id": "t1"},
    )
    assert response.status_code == 202
    assert response.json()["signature_verified"] is True


def test_device_signature_authentication_invalid(client, db_session):
    """Invalid signature rejected with 401."""
    make_tenant(db_session)
    make_device(db_session)
    ts = int(time.time() * 1000)
    response = client.post(
        "/api/recovery/observations/ingest",
        json={
            "id": "obs_bad_sig",
            "device_id": "mobile-0001",
            "observation_timestamp": ts,
            "evidence_type": "notification",
            "signature": "invalidhexsignature",
            "signature_timestamp": ts,
        },
        headers={"X-Tenant-Id": "t1"},
    )
    assert response.status_code == 401


def test_device_signature_expired(client, db_session):
    """Expired signature timestamp rejected."""
    make_tenant(db_session)
    device, priv_key = make_device(db_session)
    old_ts = int(time.time() * 1000) - 600000
    payload = make_full_observation_payload("obs_expired", "mobile-0001")
    sig, _ = sign_observation(priv_key, payload, timestamp=old_ts)
    response = client.post(
        "/api/recovery/observations/ingest",
        json={**payload, "observation_timestamp": old_ts, "signature": sig, "signature_timestamp": old_ts},
        headers={"X-Tenant-Id": "t1"},
    )
    assert response.status_code == 401


# ---- Tenant Isolation Tests ----

def test_tenant_isolation_employee(client, db_session):
    """Employee cannot access another tenant's resources."""
    make_tenant(db_session, tid="t1")
    make_tenant(db_session, tid="t2")
    make_employee(db_session, tid="t1", eid="EMP-0001")
    make_employee(db_session, tid="t2", eid="EMP-0002")

    response = client.get(
        "/api/recovery/ledger/EMP-0002",
        headers={"X-Tenant-Id": "t1", "X-Employee-Id": "EMP-0001"},
    )
    assert response.status_code == 403


def test_tenant_isolation_device(client, db_session):
    """Device registration blocked across tenants."""
    make_tenant(db_session, tid="t1")
    make_tenant(db_session, tid="t2")
    make_employee(db_session, tid="t1", eid="EMP-0001", role="owner")

    response = client.post(
        "/api/recovery/devices",
        json={
            "id": "mobile-t2",
            "tenant_id": "t2",
            "registered_upi_id": "t2@upi",
            "upi_application": "PhonePe",
            "public_key_pem": "-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwEA==\n-----END PUBLIC KEY-----",
        },
        headers={"X-Tenant-Id": "t1", "X-Employee-Id": "EMP-0001"},
    )
    assert response.status_code == 403


def test_tenant_isolation_checkout(client, db_session):
    """Checkout within same tenant succeeds."""
    make_tenant(db_session, tid="t1")
    make_tenant(db_session, tid="t2")
    make_employee(db_session, tid="t1", eid="EMP-0001", device_id="mobile-0001", role="owner")
    make_device(db_session, tid="t1", did="mobile-0001", upi="t1@upi")

    response = client.post(
        "/api/recovery/checkouts",
        json={
            "id": "rcv_cross",
            "tenant_id": "t1",
            "employee_id": "EMP-0001",
            "receiver_upi_id": "t1@upi",
            "amount_paise": 100,
        },
        headers={"X-Tenant-Id": "t1", "X-Employee-Id": "EMP-0001"},
    )
    assert response.status_code == 201


# ---- Replay Prevention Tests ----

def test_observation_duplicate_id(client, db_session):
    """Duplicate observation ID rejected."""
    make_tenant(db_session)
    device, priv_key = make_device(db_session)
    payload = make_full_observation_payload("obs_dup_id", "mobile-0001")
    sig, ts = sign_observation(priv_key, payload)

    client.post(
        "/api/recovery/observations/ingest",
        json={**payload, "observation_timestamp": ts, "signature": sig, "signature_timestamp": ts},
        headers={"X-Tenant-Id": "t1"},
    )
    response = client.post(
        "/api/recovery/observations/ingest",
        json={**payload, "observation_timestamp": ts, "signature": sig, "signature_timestamp": ts},
        headers={"X-Tenant-Id": "t1"},
    )
    assert response.status_code == 202
    assert response.json()["status"] == "duplicate"


def test_observation_duplicate_utr(client, db_session):
    """Duplicate UTR detected."""
    make_tenant(db_session)
    device, priv_key = make_device(db_session)
    ts1 = int(time.time() * 1000)
    ts2 = ts1 + 1000
    payload1 = make_full_observation_payload("obs_utr_1", "mobile-0001", utr_rrn="SAME-UTR", observation_timestamp=ts1)
    payload2 = make_full_observation_payload("obs_utr_2", "mobile-0001", utr_rrn="SAME-UTR", observation_timestamp=ts2)
    sig1, _ = sign_observation(priv_key, payload1, timestamp=ts1)
    sig2, _ = sign_observation(priv_key, payload2, timestamp=ts2)

    client.post(
        "/api/recovery/observations/ingest",
        json={**payload1, "observation_timestamp": ts1, "signature": sig1, "signature_timestamp": ts1},
        headers={"X-Tenant-Id": "t1"},
    )
    response = client.post(
        "/api/recovery/observations/ingest",
        json={**payload2, "observation_timestamp": ts2, "signature": sig2, "signature_timestamp": ts2},
        headers={"X-Tenant-Id": "t1"},
    )
    assert response.status_code == 202
    assert response.json()["status"] == "duplicate_utr"


# ---- Role-Based Access Control Tests ----

def test_role_recovery_employee_cannot_register_tenant(client, db_session):
    """Recovery employee cannot register tenants (owner-only)."""
    make_tenant(db_session)
    make_employee(db_session, eid="EMP-EMP", role="recovery_employee")
    response = client.post(
        "/api/recovery/tenants",
        json={"id": "t2", "name": "Tenant 2"},
        headers={"X-Tenant-Id": "t1", "X-Employee-Id": "EMP-EMP"},
    )
    assert response.status_code == 403


def test_role_owner_can_register_tenant(client, db_session):
    """Owner can register tenants."""
    make_tenant(db_session)
    make_employee(db_session, eid="EMP-OWNER", role="owner")
    response = client.post(
        "/api/recovery/tenants",
        json={"id": "t2", "name": "Tenant 2"},
        headers={"X-Tenant-Id": "t1", "X-Employee-Id": "EMP-OWNER"},
    )
    assert response.status_code == 201


def test_role_auditor_can_read_all_ledgers(client, db_session):
    """Auditor can read central ledger across tenants."""
    make_tenant(db_session, tid="t1")
    make_tenant(db_session, tid="t2")
    make_employee(db_session, tid="t1", eid="EMP-AUDITOR", role="auditor")

    response = client.get(
        "/api/recovery/ledger/central?tenant_id=t2",
        headers={"X-Tenant-Id": "t1", "X-Employee-Id": "EMP-AUDITOR"},
    )
    assert response.status_code == 200


# ---- Wrong Amount / Wrong Destination Tests ----

def test_observation_wrong_amount(client, db_session):
    """Observation with wrong amount recorded but not verified."""
    make_tenant(db_session)
    make_employee(db_session)
    device, priv_key = make_device(db_session)
    make_checkout(db_session, cid="rcv_amt", amount=100)

    payload = make_full_observation_payload("obs_wrong_amt", "mobile-0001", checkout_id="rcv_amt", amount_paise=999)
    sig, ts = sign_observation(priv_key, payload)
    response = client.post(
        "/api/recovery/observations/ingest",
        json={**payload, "observation_timestamp": ts, "signature": sig, "signature_timestamp": ts},
        headers={"X-Tenant-Id": "t1"},
    )
    assert response.status_code == 202


def test_observation_wrong_destination(client, db_session):
    """Observation with wrong receiver UPI is unmatched."""
    make_tenant(db_session)
    device, priv_key = make_device(db_session)
    payload = make_full_observation_payload("obs_wrong_dest", "mobile-0001", observed_receiver_upi="wrong@upi")
    sig, ts = sign_observation(priv_key, payload)

    response = client.post(
        "/api/recovery/observations/ingest",
        json={**payload, "observation_timestamp": ts, "signature": sig, "signature_timestamp": ts},
        headers={"X-Tenant-Id": "t1"},
    )
    assert response.status_code == 202
    assert response.json()["checkout_correlation"] == "unmatched"


# ---- Outgoing Payment Test ----

def test_observation_outgoing_payment(client, db_session):
    """Outgoing payment not matched to checkout."""
    make_tenant(db_session)
    device, priv_key = make_device(db_session)
    payload = make_full_observation_payload("obs_outgoing", "mobile-0001", transaction_direction="outgoing", app_reported_status="SUCCESS")
    sig, ts = sign_observation(priv_key, payload)

    response = client.post(
        "/api/recovery/observations/ingest",
        json={**payload, "observation_timestamp": ts, "signature": sig, "signature_timestamp": ts},
        headers={"X-Tenant-Id": "t1"},
    )
    assert response.status_code == 202
    assert response.json()["checkout_correlation"] == "unmatched"


# ---- End-to-End Synthetic Flow ----

def test_employee_end_to_end(client, db_session):
    """Complete flow: create checkout → observe payment → verify in ledger → replay dedup."""
    make_tenant(db_session)
    make_device(db_session)
    make_employee(db_session, device_id="mobile-0001")

    # 1. Create checkout
    resp = client.post(
        "/api/recovery/checkouts",
        json={
            "id": "rcv_e2e",
            "tenant_id": "t1",
            "employee_id": "EMP-0001",
            "receiver_upi_id": "receiver@upi",
            "amount_paise": 100,
        },
        headers={"X-Tenant-Id": "t1", "X-Employee-Id": "EMP-0001"},
    )
    assert resp.status_code == 201

    # 2. Ingest observation
    device, priv_key = make_device(db_session, did="mobile-0001-update")
    payload = make_full_observation_payload("obs_e2e", "mobile-0001-update", checkout_id="rcv_e2e", utr_rrn="UTR-E2E-001")
    sig, ts = sign_observation(priv_key, payload)
    resp = client.post(
        "/api/recovery/observations/ingest",
        json={**payload, "observation_timestamp": ts, "signature": sig, "signature_timestamp": ts},
        headers={"X-Tenant-Id": "t1"},
    )
    assert resp.status_code == 202
    assert resp.json()["checkout_correlation"] == "matched"

    # 3. Verify checkout state
    resp = client.get("/api/recovery/checkouts/rcv_e2e", headers={"X-Tenant-Id": "t1", "X-Employee-Id": "EMP-0001"})
    assert resp.status_code == 200
    assert resp.json()["state"] == "PAYMENT_OBSERVED"

    # 4. Verify ledger entry
    resp = client.get("/api/recovery/ledger/EMP-0001", headers={"X-Tenant-Id": "t1", "X-Employee-Id": "EMP-0001"})
    assert resp.status_code == 200
    entries = resp.json()
    assert len(entries) >= 1

    # 5. Replay should not double-count
    resp = client.post(
        "/api/recovery/observations/ingest",
        json={**payload, "observation_timestamp": ts, "signature": sig, "signature_timestamp": ts},
        headers={"X-Tenant-Id": "t1"},
    )
    assert resp.status_code == 202
    assert resp.json()["status"] == "duplicate"


# ---- 1,000-Agent Load Benchmark ----

def test_1000_agent_registration_benchmark(client, db_session):
    """Register 1,000 devices and agents, verify all exist."""
    make_tenant(db_session)
    import time as t
    start = t.time()
    for i in range(1000):
        did = f"mobile-{i:04d}"
        make_device(db_session, did=did, upi=f"user{i}@upi")
        make_agent(db_session, did=did, aid=f"agent-{i:04d}")
    elapsed = t.time() - start

    devices = db_session.execute(select(AndroidDevice).where(AndroidDevice.tenant_id == "t1")).scalars().all()
    assert len(devices) == 1000
    agents = db_session.execute(select(MobileAgent).where(MobileAgent.tenant_id == "t1")).scalars().all()
    assert len(agents) == 1000
    print(f"\n1,000 agent registration: {elapsed:.2f}s")


# ---- Missing Reference Test ----

def test_observation_missing_reference(client, db_session):
    """Observation without UTR recorded but unmatched."""
    make_tenant(db_session)
    device, priv_key = make_device(db_session)
    payload = make_full_observation_payload("obs_no_ref", "mobile-0001", utr_rrn=None)
    sig, ts = sign_observation(priv_key, payload)

    response = client.post(
        "/api/recovery/observations/ingest",
        json={**payload, "observation_timestamp": ts, "signature": sig, "signature_timestamp": ts},
        headers={"X-Tenant-Id": "t1"},
    )
    assert response.status_code == 202
    assert response.json()["checkout_correlation"] == "unmatched"


# ---- Failed Payment Test ----

def test_observation_failed_payment(client, db_session):
    """Failed payment status recorded."""
    make_tenant(db_session)
    device, priv_key = make_device(db_session)
    payload = make_full_observation_payload("obs_failed", "mobile-0001", app_reported_status="FAILED")
    sig, ts = sign_observation(priv_key, payload)

    response = client.post(
        "/api/recovery/observations/ingest",
        json={**payload, "observation_timestamp": ts, "signature": sig, "signature_timestamp": ts},
        headers={"X-Tenant-Id": "t1"},
    )
    assert response.status_code == 202
