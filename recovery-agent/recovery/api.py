"""FastAPI routes for Agentic-Recovery backend.

Endpoints:
- POST /api/tenants — register tenant
- POST /api/employees — register employee
- POST /api/devices — register Android device
- POST /api/agents — register mobile agent
- POST /api/collection-cases — create collection case
- POST /api/checkouts — create checkout session
- POST /api/observations/ingest — authenticated observation ingestion
- GET /api/checkouts/{id} — get checkout status
- GET /api/ledger/{employee_id} — get employee ledger
- GET /api/ledger/central — get central ledger
- POST /api/audit — record audit event
"""

import hashlib
import hmac
import secrets
import time
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from pydantic import BaseModel, Field
from sqlalchemy import select, func
from sqlalchemy.orm import Session

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
from recovery.storage import make_engine, make_session, now_ms

router = APIRouter()

# In-memory engine for local testing; production uses PostgreSQL
_engine = None
_session_factory = None
_test_session_factory = None  # Override for testing


def get_engine() -> object:
    global _engine
    if _engine is None:
        _engine = make_engine()
    return _engine


def get_session_factory() -> object:
    global _session_factory, _test_session_factory
    if _test_session_factory is not None:
        return _test_session_factory
    if _session_factory is None:
        _session_factory = make_session(get_engine())
    return _session_factory


def set_test_session_factory(factory):
    """Override the session factory for testing (called by test fixtures)."""
    global _test_session_factory
    _test_session_factory = factory


def clear_test_session_factory():
    """Clear the test session factory override."""
    global _test_session_factory
    _test_session_factory = None


def get_db(request: Request) -> Session:
    engine = request.app.state.engine
    session = make_session(engine)()
    try:
        yield session
    finally:
        session.close()


# ---- Request/Response models ----

class TenantRegister(BaseModel):
    id: str = Field(..., description="Tenant ID")
    name: str = Field(..., description="Tenant display name")


class EmployeeRegister(BaseModel):
    id: str = Field(..., description="Employee ID like EMP-0001")
    tenant_id: str
    name: str
    email: Optional[str] = None
    assigned_receiver_upi: Optional[str] = None


class DeviceRegister(BaseModel):
    id: str = Field(..., description="Device ID like mobile-0001")
    tenant_id: str
    registered_upi_id: str
    upi_application: str = Field(..., description="Google Pay, PhonePe, BHIM, etc.")
    public_key: str = Field(..., description="Android Keystore public key PEM")
    device_serial: Optional[str] = None
    avd_name: Optional[str] = None


class AgentRegister(BaseModel):
    id: str = Field(..., description="Agent ID like agent-0001")
    device_id: str
    tenant_id: str


class CollectionCaseCreate(BaseModel):
    id: str
    tenant_id: str
    employee_id: str
    device_id: str
    title: str
    target_amount_paise: int
    currency: str = "INR"


class CheckoutCreate(BaseModel):
    id: str
    tenant_id: str
    employee_id: str
    receiver_upi_id: str
    amount_paise: int
    currency: str = "INR"
    collection_case_id: Optional[str] = None


class ObservationIngest(BaseModel):
    id: str
    device_id: str
    agent_id: Optional[str] = None
    checkout_id: Optional[str] = None

    # Observed fields
    observed_receiver_upi: Optional[str] = None
    payer_name: Optional[str] = None
    payer_upi_id: Optional[str] = None
    amount_paise: Optional[int] = None
    currency: Optional[str] = "INR"
    utr_rrn: Optional[str] = None
    app_transaction_id: Optional[str] = None
    transaction_direction: Optional[str] = "incoming"
    app_reported_status: Optional[str] = None
    transaction_timestamp: Optional[int] = None
    observation_timestamp: int
    source_application: Optional[str] = None
    evidence_type: str = "notification"
    evidence_fingerprint: Optional[str] = None

    # Device signature for authenticity
    signature: str = Field(..., description="HMAC-SHA256 signature using device private key")
    signature_timestamp: int


class AuditEventCreate(BaseModel):
    tenant_id: str
    event: str
    detail: Optional[str] = None


# ---- Auth helpers ----

def verify_device_signature(
    device_public_key_pem: str,
    payload: dict,
    signature: str,
    signature_timestamp: int,
    tolerance_ms: int = 300000,
) -> bool:
    """Verify device observation signature using HMAC-SHA256.

    In production, this would use the device's public key for asymmetric verification.
    For local development, we use HMAC with the public key as the shared secret.
    """
    # Reject stale signatures
    now = int(time.time() * 1000)
    if abs(now - signature_timestamp) > tolerance_ms:
        return False

    # Build canonical message
    message = f"{payload['id']}|{device_public_key_pem}|{signature_timestamp}"
    expected = hmac.new(
        device_public_key_pem.encode(),
        message.encode(),
        hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(expected, signature)


# ---- Endpoints ----

@router.post("/api/tenants", status_code=201)
def register_tenant(body: TenantRegister, db: Session = Depends(get_db)):
    existing = db.execute(select(Tenant).where(Tenant.id == body.id)).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=409, detail="tenant already exists")
    tenant = Tenant(id=body.id, name=body.name)
    db.add(tenant)
    db.commit()
    db.refresh(tenant)
    return {"id": tenant.id, "name": tenant.name}


@router.post("/api/employees", status_code=201)
def register_employee(body: EmployeeRegister, db: Session = Depends(get_db)):
    tenant = db.execute(select(Tenant).where(Tenant.id == body.tenant_id)).scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=404, detail="tenant not found")
    existing = db.execute(select(Employee).where(Employee.id == body.id)).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=409, detail="employee already exists")
    emp = Employee(
        id=body.id,
        tenant_id=body.tenant_id,
        name=body.name,
        email=body.email,
        assigned_receiver_upi=body.assigned_receiver_upi,
    )
    db.add(emp)
    db.commit()
    db.refresh(emp)
    return {"id": emp.id, "tenant_id": emp.tenant_id, "name": emp.name}


@router.post("/api/devices", status_code=201)
def register_device(body: DeviceRegister, db: Session = Depends(get_db)):
    tenant = db.execute(select(Tenant).where(Tenant.id == body.tenant_id)).scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=404, detail="tenant not found")
    existing = db.execute(
        select(AndroidDevice).where(AndroidDevice.id == body.id)
    ).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=409, detail="device already exists")
    dev = AndroidDevice(
        id=body.id,
        tenant_id=body.tenant_id,
        registered_upi_id=body.registered_upi_id,
        upi_application=body.upi_application,
        public_key=body.public_key,
        device_serial=body.device_serial,
        avd_name=body.avd_name,
        connectivity_status="registered",
    )
    db.add(dev)
    db.commit()
    db.refresh(dev)
    return {"id": dev.id, "registered_upi_id": dev.registered_upi_id}


@router.post("/api/agents", status_code=201)
def register_agent(body: AgentRegister, db: Session = Depends(get_db)):
    device = db.execute(
        select(AndroidDevice).where(AndroidDevice.id == body.device_id)
    ).scalar_one_or_none()
    if not device:
        raise HTTPException(status_code=404, detail="device not found")
    existing = db.execute(select(MobileAgent).where(MobileAgent.id == body.id)).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=409, detail="agent already exists")
    agent = MobileAgent(id=body.id, device_id=body.device_id, tenant_id=body.tenant_id)
    db.add(agent)
    db.commit()
    db.refresh(agent)
    return {"id": agent.id, "device_id": agent.device_id}


@router.post("/api/collection-cases", status_code=201)
def create_collection_case(body: CollectionCaseCreate, db: Session = Depends(get_db)):
    case = CollectionCase(
        id=body.id,
        tenant_id=body.tenant_id,
        employee_id=body.employee_id,
        device_id=body.device_id,
        title=body.title,
        target_amount_paise=body.target_amount_paise,
        currency=body.currency,
    )
    db.add(case)
    db.commit()
    db.refresh(case)
    return {"id": case.id, "status": case.status}


@router.post("/api/checkouts", status_code=201)
def create_checkout(body: CheckoutCreate, db: Session = Depends(get_db)):
    employee = db.execute(select(Employee).where(Employee.id == body.employee_id)).scalar_one_or_none()
    if not employee:
        raise HTTPException(status_code=404, detail="employee not found")
    device = db.execute(
        select(AndroidDevice).where(AndroidDevice.id == employee.assigned_device_id)
    ).scalar_one_or_none()
    if not device:
        raise HTTPException(status_code=404, detail="employee has no assigned device")

    expires = int(time.time() * 1000) + 120000  # 120 seconds
    upi_link = f"upi://pay?pa={device.registered_upi_id}&am={body.amount_paise / 100:.2f}&cu={body.currency}"
    checkout = Checkout(
        id=body.id,
        tenant_id=body.tenant_id,
        employee_id=body.employee_id,
        collection_case_id=body.collection_case_id,
        device_id=device.id,
        receiver_upi_id=device.registered_upi_id,
        amount_paise=body.amount_paise,
        currency=body.currency,
        upi_link=upi_link,
        state="CREATED",
        expires=expires,
    )
    db.add(checkout)
    db.commit()
    db.refresh(checkout)
    return {
        "id": checkout.id,
        "receiver_upi_id": checkout.receiver_upi_id,
        "amount_paise": checkout.amount_paise,
        "upi_link": checkout.upi_link,
        "expires": checkout.expires,
        "state": checkout.state,
    }


@router.post("/api/observations/ingest", status_code=202)
def ingest_observation(body: ObservationIngest, request: Request, db: Session = Depends(get_db)):
    """Ingest an authenticated observation from a registered device.

    The device signature authenticates the reporter, NOT the settlement.
    Financial verification requires separate evidence matching.
    """
    device = db.execute(
        select(AndroidDevice).where(AndroidDevice.id == body.device_id)
    ).scalar_one_or_none()
    if not device:
        raise HTTPException(status_code=404, detail="device not found")

    # Verify device signature
    if not verify_device_signature(
        device.public_key,
        body.model_dump(exclude={"signature", "signature_timestamp"}),
        body.signature,
        body.signature_timestamp,
    ):
        raise HTTPException(status_code=401, detail="invalid device signature")

    # Check for duplicate observation ID
    existing = db.execute(
        select(Observation).where(Observation.id == body.id)
    ).scalar_one_or_none()
    if existing:
        return {"status": "duplicate", "observation_id": body.id}

    # Check for duplicate UTR if provided
    if body.utr_rrn:
        dup = db.execute(
            select(Observation).where(Observation.utr_rrn == body.utr_rrn)
        ).scalar_one_or_none()
        if dup:
            obs = Observation(
                id=body.id,
                tenant_id=device.tenant_id,
                device_id=body.device_id,
                agent_id=body.agent_id,
                checkout_id=body.checkout_id,
                observed_receiver_upi=body.observed_receiver_upi,
                payer_name=body.payer_name,
                payer_upi_id=body.payer_upi_id,
                amount_paise=body.amount_paise,
                currency=body.currency,
                utr_rrn=body.utr_rrn,
                app_transaction_id=body.app_transaction_id,
                transaction_direction=body.transaction_direction,
                app_reported_status=body.app_reported_status,
                transaction_timestamp=body.transaction_timestamp,
                observation_timestamp=body.observation_timestamp,
                source_application=body.source_application,
                evidence_type=body.evidence_type,
                evidence_fingerprint=body.evidence_fingerprint,
                observation_authenticity="verified",
                checkout_correlation="duplicate",
                duplicate_of=dup.id,
            )
            db.add(obs)
            db.commit()
            return {"status": "duplicate_utr", "observation_id": body.id, "duplicate_of": dup.id}

    obs = Observation(
        id=body.id,
        tenant_id=device.tenant_id,
        device_id=body.device_id,
        agent_id=body.agent_id,
        checkout_id=body.checkout_id,
        observed_receiver_upi=body.observed_receiver_upi,
        payer_name=body.payer_name,
        payer_upi_id=body.payer_upi_id,
        amount_paise=body.amount_paise,
        currency=body.currency,
        utr_rrn=body.utr_rrn,
        app_transaction_id=body.app_transaction_id,
        transaction_direction=body.transaction_direction,
        app_reported_status=body.app_reported_status,
        transaction_timestamp=body.transaction_timestamp,
        observation_timestamp=body.observation_timestamp,
        source_application=body.source_application,
        evidence_type=body.evidence_type,
        evidence_fingerprint=body.evidence_fingerprint,
        observation_authenticity="verified",
        checkout_correlation="unmatched",
    )
    db.add(obs)

    # Try to correlate with checkout
    if body.checkout_id:
        checkout = db.execute(
            select(Checkout).where(Checkout.id == body.checkout_id)
        ).scalar_one_or_none()
        if checkout:
            obs.checkout_correlation = "matched"
            checkout.state = "PAYMENT_OBSERVED"

            # Create ledger entry
            if body.amount_paise is not None:
                ledger = LedgerEntry(
                    id=f"led_{secrets.token_urlsafe(12)}",
                    tenant_id=device.tenant_id,
                    employee_id=checkout.employee_id,
                    checkout_id=checkout.id,
                    observation_id=obs.id,
                    amount_paise=body.amount_paise,
                    currency=body.currency or "INR",
                    entry_type="credit",
                    state="pending",
                    reference=body.utr_rrn or body.app_transaction_id,
                )
                db.add(ledger)

    # Add to outbox for n8n processing
    outbox = Outbox(
        id=f"out_{secrets.token_urlsafe(12)}",
        tenant_id=device.tenant_id,
        event_type="observation_received",
        payload=body.model_dump_json(),
    )
    db.add(outbox)

    # Audit event
    audit = AuditEvent(
        tenant_id=device.tenant_id,
        event="OBSERVATION_INGESTED",
        detail=f"device={body.device_id} observation={body.id}",
    )
    db.add(audit)

    db.commit()
    db.refresh(obs)

    return {
        "status": "ingested",
        "observation_id": obs.id,
        "checkout_correlation": obs.checkout_correlation,
        "financially_verified": obs.financial_verification,
    }


@router.get("/api/checkouts/{checkout_id}")
def get_checkout(checkout_id: str, db: Session = Depends(get_db)):
    checkout = db.execute(select(Checkout).where(Checkout.id == checkout_id)).scalar_one_or_none()
    if not checkout:
        raise HTTPException(status_code=404, detail="checkout not found")
    return {
        "id": checkout.id,
        "state": checkout.state,
        "receiver_upi_id": checkout.receiver_upi_id,
        "amount_paise": checkout.amount_paise,
        "financially_verified": checkout.financially_verified,
        "expires": checkout.expires,
    }


@router.get("/api/ledger/{employee_id}")
def get_employee_ledger(employee_id: str, db: Session = Depends(get_db)):
    entries = db.execute(
        select(LedgerEntry).where(LedgerEntry.employee_id == employee_id)
    ).scalars().all()
    return [
        {
            "id": e.id,
            "checkout_id": e.checkout_id,
            "amount_paise": e.amount_paise,
            "currency": e.currency,
            "entry_type": e.entry_type,
            "state": e.state,
            "reference": e.reference,
            "created": e.created,
        }
        for e in entries
    ]


@router.get("/api/ledger/central")
def get_central_ledger(tenant_id: str, db: Session = Depends(get_db)):
    entries = db.execute(
        select(LedgerEntry).where(LedgerEntry.tenant_id == tenant_id)
    ).scalars().all()
    return [
        {
            "id": e.id,
            "employee_id": e.employee_id,
            "checkout_id": e.checkout_id,
            "amount_paise": e.amount_paise,
            "state": e.state,
        }
        for e in entries
    ]


@router.post("/api/audit", status_code=201)
def record_audit(body: AuditEventCreate, db: Session = Depends(get_db)):
    audit = AuditEvent(
        tenant_id=body.tenant_id,
        event=body.event,
        detail=body.detail,
    )
    db.add(audit)
    db.commit()
    return {"recorded": True}
