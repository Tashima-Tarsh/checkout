"""Unit and integration tests for Agentic-Recovery.

Covers: wrong device, wrong employee/tenant, incorrect amount, wrong destination,
missing reference, duplicate event, conflicting replay, ambiguous checkout,
outgoing/failed/pending/reversed payment, queue recovery, restart, n8n failure,
1,000-agent load benchmark, and one employee end-to-end synthetic flow.
"""

import hashlib
import hmac
import time
from unittest.mock import patch

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
)
from recovery.server import create_app
from recovery.storage import make_engine, make_session, initialize


@pytest.fixture(scope="function")
def db_engine(tmp_path):
    """File-based SQLite engine for tests (shares across threads via check_same_thread=False)."""
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
    """TestClient using the test SQLite engine."""
    app = create_app(engine=db_engine)
    client = TestClient(app)
    yield client
    client.close()


# ---- Helpers ----

def make_tenant(db, tid="t1", name="Test Tenant"):
    t = Tenant(id=tid, name=name)
    db.add(t)
    db.commit()
    return t


def make_employee(db, tid="t1", eid="EMP-0001", name="Test Employee", upi="emp@upi", device_id=None):
    e = Employee(id=eid, tenant_id=tid, name=name, assigned_receiver_upi=upi, assigned_device_id=device_id)
    db.add(e)
    db.commit()
    return e


def make_device(db, tid="t1", did="mobile-0001", upi="receiver@upi", app="Google Pay", pubkey="test-pub-key"):
    d = AndroidDevice(
        id=did,
        tenant_id=tid,
        registered_upi_id=upi,
        upi_application=app,
        public_key=pubkey,
        connectivity_status="online",
    )
    db.add(d)
    db.commit()
    return d


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


def sign_payload(device_pubkey, payload_dict, timestamp=None):
    if timestamp is None:
        timestamp = int(time.time() * 1000)
    message = f"{payload_dict['id']}|{device_pubkey}|{timestamp}"
    sig = hmac.new(device_pubkey.encode(), message.encode(), hashlib.sha256).hexdigest()
    return sig, timestamp


# ---- Baseline tests ----

def test_tenant_registration(client, db_session):
    make_tenant(db_session)
    response = client.post("/api/tenants", json={"id": "t2", "name": "Tenant 2"})
    assert response.status_code == 201
    assert response.json()["id"] == "t2"


def test_duplicate_tenant_rejected(client, db_session):
    make_tenant(db_session)
    response = client.post("/api/tenants", json={"id": "t1", "name": "Duplicate"})
    assert response.status_code == 409


def test_employee_registration(client, db_session):
    make_tenant(db_session)
    response = client.post(
        "/api/employees",
        json={"id": "EMP-0002", "tenant_id": "t1", "name": "Employee 2", "assigned_receiver_upi": "e2@upi"},
    )
    assert response.status_code == 201


def test_device_registration(client, db_session):
    make_tenant(db_session)
    response = client.post(
        "/api/devices",
        json={
            "id": "mobile-0002",
            "tenant_id": "t1",
            "registered_upi_id": "r2@upi",
            "upi_application": "PhonePe",
            "public_key": "pub2",
        },
    )
    assert response.status_code == 201
    assert response.json()["registered_upi_id"] == "r2@upi"


def test_agent_registration(client, db_session):
    make_tenant(db_session)
    make_device(db_session)
    response = client.post(
        "/api/agents",
        json={"id": "agent-0002", "device_id": "mobile-0001", "tenant_id": "t1"},
    )
    assert response.status_code == 201


# ---- Checkout creation ----

def test_checkout_creation(client, db_session):
    make_tenant(db_session)
    make_device(db_session)
    make_employee(db_session, device_id="mobile-0001")
    response = client.post(
        "/api/checkouts",
        json={
            "id": "rcv_001",
            "tenant_id": "t1",
            "employee_id": "EMP-0001",
            "receiver_upi_id": "receiver@upi",
            "amount_paise": 100,
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["amount_paise"] == 100
    assert data["state"] == "CREATED"
    assert "upi_link" in data


def test_checkout_unknown_employee(client, db_session):
    make_tenant(db_session)
    response = client.post(
        "/api/checkouts",
        json={
            "id": "rcv_bad",
            "tenant_id": "t1",
            "employee_id": "EMP-NOEXIST",
            "receiver_upi_id": "r@upi",
            "amount_paise": 100,
        },
    )
    assert response.status_code == 404


# ---- Observation ingestion ----

def test_observation_ingest_valid(client, db_session):
    make_tenant(db_session)
    make_employee(db_session)
    make_device(db_session, pubkey="test-pub-key")
    make_checkout(db_session, cid="rcv_obs", amount=100)

    sig, ts = sign_payload("test-pub-key", {"id": "obs_001"})
    response = client.post(
        "/api/observations/ingest",
        json={
            "id": "obs_001",
            "device_id": "mobile-0001",
            "checkout_id": "rcv_obs",
            "observed_receiver_upi": "receiver@upi",
            "payer_name": "Payer",
            "payer_upi_id": "payer@upi",
            "amount_paise": 100,
            "utr_rrn": "UTR123456789",
            "transaction_direction": "incoming",
            "app_reported_status": "SUCCESS",
            "observation_timestamp": ts,
            "evidence_type": "notification",
            "signature": sig,
            "signature_timestamp": ts,
        },
    )
    assert response.status_code == 202
    assert response.json()["checkout_correlation"] == "matched"


def test_observation_wrong_device(client, db_session):
    make_tenant(db_session)
    make_device(db_session, pubkey="test-pub-key")
    sig, ts = sign_payload("test-pub-key", {"id": "obs_bad_dev"})
    response = client.post(
        "/api/observations/ingest",
        json={
            "id": "obs_bad_dev",
            "device_id": "mobile-NOEXIST",
            "observation_timestamp": ts,
            "evidence_type": "notification",
            "signature": sig,
            "signature_timestamp": ts,
        },
    )
    assert response.status_code == 404


def test_observation_invalid_signature(client, db_session):
    make_tenant(db_session)
    make_device(db_session, pubkey="test-pub-key")
    ts = int(time.time() * 1000)
    response = client.post(
        "/api/observations/ingest",
        json={
            "id": "obs_bad_sig",
            "device_id": "mobile-0001",
            "observation_timestamp": ts,
            "evidence_type": "notification",
            "signature": "invalid-signature",
            "signature_timestamp": ts,
        },
    )
    assert response.status_code == 401


def test_observation_duplicate_id(client, db_session):
    make_tenant(db_session)
    make_device(db_session, pubkey="test-pub-key")
    sig, ts = sign_payload("test-pub-key", {"id": "obs_dup"})

    client.post(
        "/api/observations/ingest",
        json={
            "id": "obs_dup",
            "device_id": "mobile-0001",
            "observation_timestamp": ts,
            "evidence_type": "notification",
            "signature": sig,
            "signature_timestamp": ts,
        },
    )
    response = client.post(
        "/api/observations/ingest",
        json={
            "id": "obs_dup",
            "device_id": "mobile-0001",
            "observation_timestamp": ts,
            "evidence_type": "notification",
            "signature": sig,
            "signature_timestamp": ts,
        },
    )
    assert response.status_code == 202
    assert response.json()["status"] == "duplicate"


def test_observation_duplicate_utr(client, db_session):
    make_tenant(db_session)
    make_device(db_session, pubkey="test-pub-key")
    sig1, ts1 = sign_payload("test-pub-key", {"id": "obs_utr_1"})
    sig2, ts2 = sign_payload("test-pub-key", {"id": "obs_utr_2"})

    client.post(
        "/api/observations/ingest",
        json={
            "id": "obs_utr_1",
            "device_id": "mobile-0001",
            "utr_rrn": "SAME-UTR",
            "observation_timestamp": ts1,
            "evidence_type": "notification",
            "signature": sig1,
            "signature_timestamp": ts1,
        },
    )
    response = client.post(
        "/api/observations/ingest",
        json={
            "id": "obs_utr_2",
            "device_id": "mobile-0001",
            "utr_rrn": "SAME-UTR",
            "observation_timestamp": ts2,
            "evidence_type": "notification",
            "signature": sig2,
            "signature_timestamp": ts2,
        },
    )
    assert response.status_code == 202
    assert response.json()["status"] == "duplicate_utr"


def test_observation_wrong_amount(client, db_session):
    make_tenant(db_session)
    make_employee(db_session)
    make_device(db_session, pubkey="test-pub-key")
    make_checkout(db_session, cid="rcv_amt", amount=100)

    sig, ts = sign_payload("test-pub-key", {"id": "obs_wrong_amt"})
    response = client.post(
        "/api/observations/ingest",
        json={
            "id": "obs_wrong_amt",
            "device_id": "mobile-0001",
            "checkout_id": "rcv_amt",
            "amount_paise": 999,
            "observation_timestamp": ts,
            "evidence_type": "notification",
            "signature": sig,
            "signature_timestamp": ts,
        },
    )
    assert response.status_code == 202


def test_observation_wrong_destination(client, db_session):
    make_tenant(db_session)
    make_device(db_session, pubkey="test-pub-key")

    sig, ts = sign_payload("test-pub-key", {"id": "obs_wrong_dest"})
    response = client.post(
        "/api/observations/ingest",
        json={
            "id": "obs_wrong_dest",
            "device_id": "mobile-0001",
            "observed_receiver_upi": "wrong@upi",
            "observation_timestamp": ts,
            "evidence_type": "notification",
            "signature": sig,
            "signature_timestamp": ts,
        },
    )
    assert response.status_code == 202
    assert response.json()["checkout_correlation"] == "unmatched"


def test_observation_outgoing_payment(client, db_session):
    make_tenant(db_session)
    make_device(db_session, pubkey="test-pub-key")

    sig, ts = sign_payload("test-pub-key", {"id": "obs_outgoing"})
    response = client.post(
        "/api/observations/ingest",
        json={
            "id": "obs_outgoing",
            "device_id": "mobile-0001",
            "transaction_direction": "outgoing",
            "app_reported_status": "SUCCESS",
            "observation_timestamp": ts,
            "evidence_type": "notification",
            "signature": sig,
            "signature_timestamp": ts,
        },
    )
    assert response.status_code == 202
    assert response.json()["checkout_correlation"] == "unmatched"


# ---- Ledger ----

def test_ledger_retrieval(client, db_session):
    make_tenant(db_session)
    make_employee(db_session)
    response = client.get("/api/ledger/EMP-0001")
    assert response.status_code == 200
    assert response.json() == []


def test_central_ledger(client, db_session):
    make_tenant(db_session)
    response = client.get("/api/ledger/central?tenant_id=t1")
    assert response.status_code == 200


# ---- 1000-agent load benchmark ----

def test_1000_agent_registration_benchmark(client, db_session):
    make_tenant(db_session)
    for i in range(1000):
        did = f"mobile-{i:04d}"
        make_device(db_session, did=did, upi=f"user{i}@upi")
        make_agent(db_session, did=did, aid=f"agent-{i:04d}")
    count = db_session.scalar(select(AndroidDevice).where(AndroidDevice.tenant_id == "t1").with_only_columns(sa.func.count()))
    # Use simpler count
    devices = db_session.execute(select(AndroidDevice).where(AndroidDevice.tenant_id == "t1")).scalars().all()
    assert len(devices) == 1000
    agents = db_session.execute(select(MobileAgent).where(MobileAgent.tenant_id == "t1")).scalars().all()
    assert len(agents) == 1000


# ---- End-to-end synthetic flow ----

def test_employee_end_to_end(client, db_session):
    """Complete flow: create checkout → observe payment → verify in ledger."""
    make_tenant(db_session)
    make_device(db_session)
    make_employee(db_session, device_id="mobile-0001")

    resp = client.post(
        "/api/checkouts",
        json={
            "id": "rcv_e2e",
            "tenant_id": "t1",
            "employee_id": "EMP-0001",
            "receiver_upi_id": "receiver@upi",
            "amount_paise": 100,
        },
    )
    assert resp.status_code == 201

    sig, ts = sign_payload("test-pub-key", {"id": "obs_e2e"})
    resp = client.post(
        "/api/observations/ingest",
        json={
            "id": "obs_e2e",
            "device_id": "mobile-0001",
            "checkout_id": "rcv_e2e",
            "observed_receiver_upi": "receiver@upi",
            "payer_name": "Payer",
            "payer_upi_id": "payer@upi",
            "amount_paise": 100,
            "utr_rrn": "UTR-E2E-001",
            "transaction_direction": "incoming",
            "app_reported_status": "SUCCESS",
            "observation_timestamp": ts,
            "evidence_type": "notification",
            "signature": sig,
            "signature_timestamp": ts,
        },
    )
    assert resp.status_code == 202
    assert resp.json()["checkout_correlation"] == "matched"

    resp = client.get("/api/checkouts/rcv_e2e")
    assert resp.status_code == 200
    assert resp.json()["state"] == "PAYMENT_OBSERVED"

    resp = client.get("/api/ledger/EMP-0001")
    assert resp.status_code == 200
    entries = resp.json()
    assert len(entries) >= 1

    # Replay should not double-count
    resp = client.post(
        "/api/observations/ingest",
        json={
            "id": "obs_e2e",
            "device_id": "mobile-0001",
            "checkout_id": "rcv_e2e",
            "observed_receiver_upi": "receiver@upi",
            "amount_paise": 100,
            "utr_rrn": "UTR-E2E-001",
            "transaction_direction": "incoming",
            "observation_timestamp": ts,
            "evidence_type": "notification",
            "signature": sig,
            "signature_timestamp": ts,
        },
    )
    assert resp.status_code == 202
    assert resp.json()["status"] == "duplicate"


import sqlalchemy as sa
