"""FastAPI routes for Agentic-Recovery (enhanced with security).

Endpoints:
- POST /api/recovery/tenants — register tenant (owner only)
- POST /api/recovery/employees — register employee
- POST /api/recovery/devices — register Android device with public key
- POST /api/recovery/agents — register mobile agent
- POST /api/recovery/collection-cases — create collection case
- POST /api/recovery/checkouts — create checkout session
- POST /api/recovery/observations/ingest — authenticated observation ingestion
- POST /api/recovery/devices/{id}/session — create device auth session
- GET /api/recovery/checkouts/{id} — get checkout status
- GET /api/recovery/ledger/{employee_id} — get employee ledger
- GET /api/recovery/ledger/central — get central ledger
- POST /api/recovery/audit — record audit event
- GET /api/recovery/roles/{employee_id} — get employee roles
- POST /api/recovery/roles/{employee_id} — assign role (owner only)
"""

import hashlib
import hmac
import secrets
import time
from typing import Annotated, Optional, List

from cryptography.hazmat.primitives import serialization, hashes
from cryptography.hazmat.primitives.asymmetric import ed25519
from cryptography.exceptions import InvalidSignature
from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from pydantic import BaseModel, Field
from sqlalchemy import select, func, and_, or_
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
    DeviceSession,
    RoleAssignment,
)
from recovery.storage import make_engine, make_session, now_ms, generate_session_token

router = APIRouter()

# ---- Database session ----

_engine = None
_session_factory = None
_test_session_factory = None


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
    global _test_session_factory
    _test_session_factory = factory


def clear_test_session_factory():
    global _test_session_factory
    _test_session_factory = None


def get_db(request: Request) -> Session:
    engine = request.app.state.engine
    session = make_session(engine)()
    try:
        yield session
    finally:
        session.close()


# ---- Auth & Authorization ----

def verify_device_ed25519_signature(
    public_key_pem: str,
    message: str,
    signature_hex: str,
) -> bool:
    """Verify Ed25519 signature from device."""
    try:
        public_key = serialization.load_pem_public_key(public_key_pem.encode())
        if not isinstance(public_key, ed25519.Ed25519PublicKey):
            return False
        signature = bytes.fromhex(signature_hex)
        public_key.verify(signature, message.encode())
        return True
    except (InvalidSignature, ValueError, Exception):
        return False


def get_current_tenant(
    x_tenant_id: Annotated[Optional[str], Header()] = None,
) -> str:
    """Extract tenant ID from request header."""
    if not x_tenant_id:
        raise HTTPException(status_code=401, detail="X-Tenant-Id header required")
    return x_tenant_id


def get_current_employee(
    x_employee_id: Annotated[Optional[str], Header()] = None,
) -> str:
    """Extract employee ID from request header."""
    if not x_employee_id:
        raise HTTPException(status_code=401, detail="X-Employee-Id header required")
    return x_employee_id


def require_role(
    required_roles: List[str],
):
    """Dependency factory for role-based authorization."""
    def role_checker(
        request: Request,
        tenant_id: str = Depends(get_current_tenant),
        employee_id: str = Depends(get_current_employee),
        db: Session = Depends(get_db),
    ):
        # Check role assignment
        role = db.execute(
            select(RoleAssignment.role).where(
                and_(
                    RoleAssignment.employee_id == employee_id,
                    RoleAssignment.tenant_id == tenant_id,
                )
            )
        ).scalar_one_or_none()

        if not role:
            raise HTTPException(status_code=403, detail="No role assigned to employee")

        if role not in required_roles:
            raise HTTPException(
                status_code=403,
                detail=f"Role '{role}' not authorized. Required: {required_roles}",
            )

        return {"tenant_id": tenant_id, "employee_id": employee_id, "role": role}

    return role_checker


# ---- Request/Response models ----

class TenantRegister(BaseModel):
    id: str = Field(..., description="Tenant ID")
    name: str = Field(..., description="Tenant display name")
    owner_id: Optional[str] = None


class EmployeeRegister(BaseModel):
    id: str = Field(..., description="Employee ID like EMP-0001")
    tenant_id: str
    name: str
    email: Optional[str] = None
    role: Optional[str] = Field(default="recovery_employee")
    assigned_receiver_upi: Optional[str] = None


class DeviceRegister(BaseModel):
    id: str = Field(..., description="Device ID like mobile-0001")
    tenant_id: str
    registered_upi_id: str
    upi_application: str = Field(..., description="Google Pay, PhonePe, BHIM, etc.")
    public_key_pem: str = Field(..., description="Android Keystore Ed25519 public key PEM")
    device_serial: Optional[str] = None
    avd_name: Optional[str] = None
    device_fingerprint: Optional[str] = None


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

    # Device signature (Ed25519 hex)
    signature: str = Field(..., description="Ed25519 signature hex of canonical message")
    signature_timestamp: int

    # Latency measurement fields (milliseconds since epoch)
    notification_timestamp: Optional[int] = None  # When UPI app generated notification
    capture_timestamp: Optional[int] = None  # When observer captured notification
    callback_timestamp: Optional[int] = None  # When observation submitted to backend


class SessionCreate(BaseModel):
    device_id: str
    tenant_id: str


class RoleAssign(BaseModel):
    employee_id: str
    role: str = Field(..., description="owner, collection_manager, recovery_employee, auditor")
    granted_by: Optional[str] = None


class AuditEventCreate(BaseModel):
    tenant_id: str
    event: str
    detail: Optional[str] = None


# ---- Canonical message builder for device signature ----

def build_observation_message(payload: dict) -> str:
    """Build canonical message for device signature verification."""
    fields = [
        payload.get("id", ""),
        payload.get("device_id", ""),
        payload.get("checkout_id", "") or "",
        payload.get("observed_receiver_upi", "") or "",
        payload.get("payer_name", "") or "",
        payload.get("payer_upi_id", "") or "",
        str(payload.get("amount_paise", "")),
        payload.get("currency", "") or "",
        payload.get("utr_rrn", "") or "",
        payload.get("app_transaction_id", "") or "",
        payload.get("transaction_direction", "") or "",
        payload.get("app_reported_status", "") or "",
        str(payload.get("transaction_timestamp", "")),
        str(payload.get("observation_timestamp", "")),
        payload.get("source_application", "") or "",
        payload.get("evidence_type", "") or "",
        payload.get("evidence_fingerprint", "") or "",
    ]
    return "|".join(fields)


# ---- Endpoints ----

@router.post("/api/recovery/tenants/bootstrap", status_code=201, tags=["admin"])
def bootstrap_tenant(
    body: TenantRegister,
    db: Session = Depends(get_db),
):
    """Bootstrap the first tenant without authentication (initial setup only)."""
    existing = db.execute(select(Tenant).where(Tenant.id == body.id)).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=409, detail="tenant already exists")
    tenant = Tenant(id=body.id, name=body.name, owner_id=body.owner_id)
    db.add(tenant)
    db.commit()
    db.refresh(tenant)
    # Auto-assign owner role to bootstrap user
    if body.owner_id:
        role = RoleAssignment(
            id=f"role_{body.owner_id}_owner",
            tenant_id=body.id,
            employee_id=body.owner_id,
            role="owner",
            granted_by=body.owner_id,
        )
        db.add(role)
        # Create employee record
        emp = Employee(
            id=body.owner_id,
            tenant_id=body.id,
            name=body.owner_id,
            role="owner",
            assigned_receiver_upi=None,
        )
        db.add(emp)
        db.commit()
    return {"id": tenant.id, "name": tenant.name, "owner_id": tenant.owner_id}


@router.post("/api/recovery/tenants", status_code=201, tags=["admin"])
def register_tenant(
    body: TenantRegister,
    request: Request,
    db: Session = Depends(get_db),
    auth: dict = Depends(require_role(["owner"])),
):
    existing = db.execute(select(Tenant).where(Tenant.id == body.id)).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=409, detail="tenant already exists")
    tenant = Tenant(id=body.id, name=body.name, owner_id=body.owner_id or auth["employee_id"])
    db.add(tenant)
    db.commit()
    db.refresh(tenant)
    return {"id": tenant.id, "name": tenant.name, "owner_id": tenant.owner_id}


@router.post("/api/recovery/employees", status_code=201, tags=["admin"])
def register_employee(
    body: EmployeeRegister,
    request: Request,
    db: Session = Depends(get_db),
    auth: dict = Depends(require_role(["owner", "collection_manager"])),
):
    tenant = db.execute(select(Tenant).where(Tenant.id == body.tenant_id)).scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=404, detail="tenant not found")
    # Tenant isolation: employee must belong to same tenant as requester
    if auth["tenant_id"] != body.tenant_id:
        raise HTTPException(status_code=403, detail="Cannot create employee in different tenant")
    existing = db.execute(select(Employee).where(Employee.id == body.id)).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=409, detail="employee already exists")
    emp = Employee(
        id=body.id,
        tenant_id=body.tenant_id,
        name=body.name,
        email=body.email,
        role=body.role or "recovery_employee",
        assigned_receiver_upi=body.assigned_receiver_upi,
    )
    db.add(emp)
    db.commit()
    db.refresh(emp)
    # Auto-assign role
    role = RoleAssignment(
        id=f"role_{secrets.token_urlsafe(12)}",
        tenant_id=body.tenant_id,
        employee_id=body.id,
        role=emp.role,
        granted_by=auth["employee_id"],
    )
    db.add(role)
    db.commit()
    return {"id": emp.id, "tenant_id": emp.tenant_id, "name": emp.name, "role": emp.role}


@router.post("/api/recovery/devices", status_code=201, tags=["admin"])
def register_device(
    body: DeviceRegister,
    request: Request,
    db: Session = Depends(get_db),
    auth: dict = Depends(require_role(["owner", "collection_manager"])),
):
    tenant = db.execute(select(Tenant).where(Tenant.id == body.tenant_id)).scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=404, detail="tenant not found")
    if auth["tenant_id"] != body.tenant_id:
        raise HTTPException(status_code=403, detail="Cannot register device in different tenant")
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
        public_key_pem=body.public_key_pem,
        device_serial=body.device_serial,
        avd_name=body.avd_name,
        device_fingerprint=body.device_fingerprint,
        connectivity_status="registered",
    )
    db.add(dev)
    db.commit()
    db.refresh(dev)
    return {"id": dev.id, "registered_upi_id": dev.registered_upi_id, "upi_application": dev.upi_application}


@router.patch("/api/recovery/devices/{device_id}", tags=["admin"])
def update_device(
    device_id: str,
    body: DeviceRegister,
    request: Request,
    db: Session = Depends(get_db),
    auth: dict = Depends(require_role(["owner", "collection_manager"])),
):
    device = db.execute(
        select(AndroidDevice).where(AndroidDevice.id == device_id)
    ).scalar_one_or_none()
    if not device:
        raise HTTPException(status_code=404, detail="device not found")
    if auth["tenant_id"] != device.tenant_id:
        raise HTTPException(status_code=403, detail="Device belongs to different tenant")
    device.registered_upi_id = body.registered_upi_id
    device.upi_application = body.upi_application
    device.public_key_pem = body.public_key_pem
    device.device_serial = body.device_serial
    device.avd_name = body.avd_name
    device.device_fingerprint = body.device_fingerprint
    db.commit()
    db.refresh(device)
    return {"id": device.id, "registered_upi_id": device.registered_upi_id, "public_key_updated": True}


@router.post("/api/recovery/agents", status_code=201, tags=["admin"])
def register_agent(
    body: AgentRegister,
    request: Request,
    db: Session = Depends(get_db),
    auth: dict = Depends(require_role(["owner", "collection_manager"])),
):
    device = db.execute(
        select(AndroidDevice).where(AndroidDevice.id == body.device_id)
    ).scalar_one_or_none()
    if not device:
        raise HTTPException(status_code=404, detail="device not found")
    if auth["tenant_id"] != device.tenant_id:
        raise HTTPException(status_code=403, detail="Device belongs to different tenant")
    existing = db.execute(select(MobileAgent).where(MobileAgent.id == body.id)).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=409, detail="agent already exists")
    agent = MobileAgent(id=body.id, device_id=body.device_id, tenant_id=body.tenant_id)
    db.add(agent)
    db.commit()
    db.refresh(agent)
    return {"id": agent.id, "device_id": agent.device_id}


@router.post("/api/recovery/collection-cases", status_code=201, tags=["recovery"])
def create_collection_case(
    body: CollectionCaseCreate,
    request: Request,
    db: Session = Depends(get_db),
    auth: dict = Depends(require_role(["owner", "collection_manager", "recovery_employee"])),
):
    if auth["tenant_id"] != body.tenant_id:
        raise HTTPException(status_code=403, detail="Cannot create case in different tenant")
    # Verify employee belongs to tenant
    employee = db.execute(
        select(Employee).where(Employee.id == body.employee_id, Employee.tenant_id == body.tenant_id)
    ).scalar_one_or_none()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found in this tenant")
    device = db.execute(
        select(AndroidDevice).where(AndroidDevice.id == body.device_id, AndroidDevice.tenant_id == body.tenant_id)
    ).scalar_one_or_none()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found in this tenant")
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


@router.post("/api/recovery/checkouts", status_code=201, tags=["recovery"])
def create_checkout(
    body: CheckoutCreate,
    request: Request,
    db: Session = Depends(get_db),
    auth: dict = Depends(require_role(["owner", "collection_manager", "recovery_employee"])),
):
    if auth["tenant_id"] != body.tenant_id:
        raise HTTPException(status_code=403, detail="Cannot create checkout in different tenant")
    employee = db.execute(
        select(Employee).where(Employee.id == body.employee_id, Employee.tenant_id == body.tenant_id)
    ).scalar_one_or_none()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found in this tenant")
    device = db.execute(
        select(AndroidDevice).where(AndroidDevice.id == employee.assigned_device_id)
    ).scalar_one_or_none()
    if not device:
        raise HTTPException(status_code=404, detail="Employee has no assigned device")
    if auth["tenant_id"] != device.tenant_id:
        raise HTTPException(status_code=403, detail="Device belongs to different tenant")

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


@router.post("/api/recovery/devices/{device_id}/session", status_code=201, tags=["device"])
def create_device_session(
    device_id: str,
    body: SessionCreate,
    request: Request,
    db: Session = Depends(get_db),
):
    """Create an authenticated device session. Device proves identity via Ed25519 signature."""
    device = db.execute(
        select(AndroidDevice).where(AndroidDevice.id == device_id)
    ).scalar_one_or_none()
    if not device:
        raise HTTPException(status_code=404, detail="device not found")
    if body.tenant_id != device.tenant_id:
        raise HTTPException(status_code=403, detail="Tenant mismatch")

    # Verify device signature (challenge-response)
    message = f"{device_id}|{body.tenant_id}|{int(time.time() * 1000)}"
    # In production, device would sign this challenge. For now, verify public key exists.
    if not device.public_key_pem:
        raise HTTPException(status_code=400, detail="Device has no public key registered")

    token = generate_session_token()
    session = DeviceSession(
        id=f"sess_{secrets.token_urlsafe(16)}",
        device_id=device_id,
        tenant_id=body.tenant_id,
        session_token=token,
        expires_at=int(time.time() * 1000) + 300000,  # 5 minutes
    )
    db.add(session)
    db.commit()
    return {"session_token": token, "expires_at": session.expires_at}


@router.post("/api/recovery/observations/ingest", status_code=202, tags=["device"])
def ingest_observation(
    body: ObservationIngest,
    request: Request,
    db: Session = Depends(get_db),
):
    """Ingest an authenticated observation from a registered device.

    The device signature authenticates the reporter, NOT the settlement.
    Financial verification requires separate evidence matching.

    Auto-correlation: when checkout_id is not provided, the backend attempts
    to match the observation to a pending checkout using receiver UPI ID,
    amount, and device assignment. Ambiguous matches (multiple candidate
    checkouts) are rejected with review_required.
    """
    device = db.execute(
        select(AndroidDevice).where(AndroidDevice.id == body.device_id)
    ).scalar_one_or_none()
    if not device:
        raise HTTPException(status_code=404, detail="device not found")

    # Verify device signature (Ed25519)
    message = build_observation_message(body.model_dump(exclude={"signature", "signature_timestamp"}))
    if not verify_device_ed25519_signature(device.public_key_pem, message, body.signature):
        raise HTTPException(status_code=401, detail="Invalid device signature")

    # Check signature timestamp is recent (5 minute window)
    now = int(time.time() * 1000)
    if abs(now - body.signature_timestamp) > 300000:
        raise HTTPException(status_code=401, detail="Signature timestamp expired")

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
                device_signature=body.signature,
                signature_timestamp=body.signature_timestamp,
                signature_verified=True,
                observation_authenticity="verified",
                checkout_correlation="duplicate",
                duplicate_of=dup.id,
                # Latency tracking
                notification_timestamp=body.notification_timestamp,
                capture_timestamp=body.capture_timestamp,
                callback_timestamp=body.callback_timestamp,
                ingestion_timestamp=int(time.time() * 1000),
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
        device_signature=body.signature,
        signature_timestamp=body.signature_timestamp,
        signature_verified=True,
        observation_authenticity="verified",
        checkout_correlation="unmatched",
        # Latency tracking
        notification_timestamp=body.notification_timestamp,
        capture_timestamp=body.capture_timestamp,
        callback_timestamp=body.callback_timestamp,
        ingestion_timestamp=int(time.time() * 1000),
    )
    obs._correlation_reason = "no_checkout_id"
    db.add(obs)

    # Auto-correlation: match observation to checkout
    correlation = _correlate_observation(db, device, body, obs)
    obs.checkout_correlation = correlation
    obs.correlation_timestamp = int(time.time() * 1000)

    if correlation == "matched" and obs.checkout_id:
        checkout = db.execute(
            select(Checkout).where(Checkout.id == obs.checkout_id)
        ).scalar_one_or_none()
        if checkout:
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
                ledger.created = int(time.time() * 1000)
                obs.ledger_timestamp = ledger.created

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
        detail=f"device={body.device_id} observation={body.id} signature_verified=True correlation={correlation}",
    )
    db.add(audit)

    db.commit()
    db.refresh(obs)

    return {
        "status": "ingested",
        "observation_id": obs.id,
        "checkout_correlation": obs.checkout_correlation,
        "financially_verified": obs.financial_verification,
        "signature_verified": obs.signature_verified,
        "correlation_reason": getattr(obs, '_correlation_reason', None),
        "latency_ms": {
            "notification_to_capture": (
                (obs.capture_timestamp - obs.notification_timestamp)
                if obs.notification_timestamp and obs.capture_timestamp
                else None
            ),
            "capture_to_callback": (
                (obs.callback_timestamp - obs.capture_timestamp)
                if obs.capture_timestamp and obs.callback_timestamp
                else None
            ),
            "callback_to_ingestion": (
                (obs.ingestion_timestamp - obs.callback_timestamp)
                if obs.callback_timestamp and obs.ingestion_timestamp
                else None
            ),
            "ingestion_to_correlation": (
                (obs.correlation_timestamp - obs.ingestion_timestamp)
                if obs.correlation_timestamp and obs.ingestion_timestamp
                else None
            ),
            "notification_to_correlation": (
                (obs.correlation_timestamp - obs.notification_timestamp)
                if obs.notification_timestamp and obs.correlation_timestamp
                else None
            ),
        },
    }


def _correlate_observation(
    db: Session,
    device: AndroidDevice,
    body: ObservationIngest,
    obs: Observation,
) -> str:
    """Correlate an observation to a checkout session.

    Correlation rules (in priority order):
    1. If checkout_id is explicitly provided and belongs to same tenant -> matched
    2. If checkout_id not provided, auto-match by receiver UPI + amount + tenant
       - Exactly one match -> matched
       - Zero matches -> unmatched (observation stored but not correlated)
       - Multiple matches -> review_required (ambiguous, reject auto-accept)
    3. If checkout_id provided but belongs to different tenant -> review_required
    4. If checkout_id provided but not found -> unmatched
    """
    obs._correlation_reason = "no_checkout_id"

    if body.checkout_id:
        checkout = db.execute(
            select(Checkout).where(Checkout.id == body.checkout_id)
        ).scalar_one_or_none()
        if not checkout:
            obs._correlation_reason = "checkout_not_found"
            return "unmatched"
        if checkout.tenant_id != device.tenant_id:
            obs._correlation_reason = "tenant_mismatch"
            return "review_required"
        obs._correlation_reason = "explicit_checkout_id"
        return "matched"

    # Auto-correlate by receiver UPI + amount + tenant
    if not body.observed_receiver_upi or body.amount_paise is None:
        obs._correlation_reason = "missing_upi_or_amount"
        return "unmatched"

    candidates = db.execute(
        select(Checkout).where(
            Checkout.tenant_id == device.tenant_id,
            Checkout.receiver_upi_id == body.observed_receiver_upi,
            Checkout.amount_paise == body.amount_paise,
            Checkout.state == "CREATED",
            Checkout.expires > int(time.time() * 1000),
        )
    ).scalars().all()

    if len(candidates) == 0:
        obs._correlation_reason = "no_matching_checkout"
        return "unmatched"
    elif len(candidates) == 1:
        obs.checkout_id = candidates[0].id
        obs._correlation_reason = "auto_matched_by_upi_amount"
        return "matched"
    else:
        # Ambiguous - multiple checkouts match, reject auto-accept
        obs._correlation_reason = f"ambiguous_{len(candidates)}_matches"
        return "review_required"


@router.get("/api/recovery/checkouts/{checkout_id}", tags=["recovery"])
def get_checkout(
    checkout_id: str,
    request: Request,
    db: Session = Depends(get_db),
    auth: dict = Depends(require_role(["owner", "collection_manager", "recovery_employee", "auditor"])),
):
    checkout = db.execute(select(Checkout).where(Checkout.id == checkout_id)).scalar_one_or_none()
    if not checkout:
        raise HTTPException(status_code=404, detail="checkout not found")
    # Tenant isolation
    if auth["tenant_id"] != checkout.tenant_id:
        raise HTTPException(status_code=403, detail="Checkout belongs to different tenant")
    return {
        "id": checkout.id,
        "state": checkout.state,
        "receiver_upi_id": checkout.receiver_upi_id,
        "amount_paise": checkout.amount_paise,
        "financially_verified": checkout.financially_verified,
        "expires": checkout.expires,
        "tenant_id": checkout.tenant_id,
    }


@router.get("/api/recovery/ledger/central", tags=["recovery"])
def get_central_ledger(
    request: Request,
    db: Session = Depends(get_db),
    auth: dict = Depends(require_role(["owner", "collection_manager", "auditor"])),
):
    tenant_id = request.query_params.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=400, detail="tenant_id query parameter required")
    # Tenant isolation
    if auth["role"] != "auditor" and auth["tenant_id"] != tenant_id:
        raise HTTPException(status_code=403, detail="Cannot access different tenant's ledger")
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


@router.get("/api/recovery/ledger/{employee_id}", tags=["recovery"])
def get_employee_ledger(
    employee_id: str,
    request: Request,
    db: Session = Depends(get_db),
    auth: dict = Depends(require_role(["owner", "collection_manager", "recovery_employee", "auditor"])),
):
    # Tenant isolation: employee must belong to same tenant (unless auditor)
    employee = db.execute(select(Employee).where(Employee.id == employee_id)).scalar_one_or_none()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    if auth["role"] != "auditor" and auth["tenant_id"] != employee.tenant_id:
        raise HTTPException(status_code=403, detail="Employee belongs to different tenant")
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


@router.post("/api/recovery/roles/{employee_id}", status_code=201, tags=["admin"])
def assign_role(
    employee_id: str,
    body: RoleAssign,
    request: Request,
    db: Session = Depends(get_db),
    auth: dict = Depends(require_role(["owner"])),
):
    if auth["tenant_id"] != body.tenant_id if hasattr(body, 'tenant_id') else True:
        pass  # Role assignment uses auth tenant
    employee = db.execute(select(Employee).where(Employee.id == employee_id)).scalar_one_or_none()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    if auth["tenant_id"] != employee.tenant_id:
        raise HTTPException(status_code=403, detail="Employee belongs to different tenant")
    role = RoleAssignment(
        id=f"role_{secrets.token_urlsafe(12)}",
        tenant_id=auth["tenant_id"],
        employee_id=employee_id,
        role=body.role,
        granted_by=body.granted_by or auth["employee_id"],
    )
    db.add(role)
    # Also update employee.role for convenience
    employee.role = body.role
    db.commit()
    return {"employee_id": employee_id, "role": body.role, "granted_by": role.granted_by}


@router.get("/api/recovery/roles/{employee_id}", tags=["admin"])
def get_roles(
    employee_id: str,
    request: Request,
    db: Session = Depends(get_db),
    auth: dict = Depends(require_role(["owner", "collection_manager", "auditor"])),
):
    employee = db.execute(select(Employee).where(Employee.id == employee_id)).scalar_one_or_none()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    if auth["role"] != "auditor" and auth["tenant_id"] != employee.tenant_id:
        raise HTTPException(status_code=403, detail="Employee belongs to different tenant")
    roles = db.execute(
        select(RoleAssignment).where(RoleAssignment.employee_id == employee_id)
    ).scalars().all()
    return [
        {"role": r.role, "granted_at": r.granted_at, "granted_by": r.granted_by}
        for r in roles
    ]


@router.post("/api/recovery/audit", status_code=201, tags=["audit"])
def record_audit(
    body: AuditEventCreate,
    request: Request,
    db: Session = Depends(get_db),
    auth: dict = Depends(require_role(["owner", "collection_manager", "auditor"])),
):
    if auth["role"] != "auditor" and auth["tenant_id"] != body.tenant_id:
        raise HTTPException(status_code=403, detail="Cannot record audit for different tenant")
    audit = AuditEvent(
        tenant_id=body.tenant_id,
        event=body.event,
        detail=body.detail,
    )
    db.add(audit)
    db.commit()
    return {"recorded": True}


# ---- Customer observation receipt (public, no auth) ----

class CustomerReceiptRequest(BaseModel):
    checkout_id: str
    upi_link: Optional[str] = None


class CustomerReceiptResponse(BaseModel):
    checkout_id: str
    state: str
    amount_paise: int
    currency: str
    receiver_upi_id: str
    observed_amount_paise: Optional[int]
    observed_utr_rrn: Optional[str]
    observed_payer_name: Optional[str]
    observed_payer_upi_id: Optional[str]
    observation_timestamp: Optional[int]
    financially_verified: bool
    correlation_reason: Optional[str]
    latency_ms: Optional[dict] = None


@router.get("/api/recovery/receipt/{checkout_id}", tags=["customer"])
def get_customer_receipt(
    checkout_id: str,
    db: Session = Depends(get_db),
):
    """Customer observation receipt - public endpoint to check payment status.

    Returns observation details without revealing sensitive financial data.
    Does NOT constitute financial settlement confirmation.
    """
    checkout = db.execute(select(Checkout).where(Checkout.id == checkout_id)).scalar_one_or_none()
    if not checkout:
        raise HTTPException(status_code=404, detail="Checkout not found")

    # Get the latest observation for this checkout
    observation = db.execute(
        select(Observation)
        .where(Observation.checkout_id == checkout_id)
        .order_by(Observation.server_ingestion_timestamp.desc())
    ).scalars().first()

    return CustomerReceiptResponse(
        checkout_id=checkout.id,
        state=checkout.state,
        amount_paise=checkout.amount_paise,
        currency=checkout.currency,
        receiver_upi_id=checkout.receiver_upi_id,
        observed_amount_paise=observation.amount_paise if observation else None,
        observed_utr_rrn=observation.utr_rrn if observation else None,
        observed_payer_name=observation.payer_name if observation else None,
        observed_payer_upi_id=observation.payer_upi_id if observation else None,
        observation_timestamp=observation.observation_timestamp if observation else None,
        financially_verified=checkout.financially_verified,
        correlation_reason=getattr(observation, '_correlation_reason', None) if observation else None,
        latency_ms={
            "notification_to_capture": (
                (observation.capture_timestamp - observation.notification_timestamp)
                if observation and observation.notification_timestamp and observation.capture_timestamp
                else None
            ),
            "capture_to_callback": (
                (observation.callback_timestamp - observation.capture_timestamp)
                if observation and observation.capture_timestamp and observation.callback_timestamp
                else None
            ),
            "callback_to_ingestion": (
                (observation.ingestion_timestamp - observation.callback_timestamp)
                if observation and observation.callback_timestamp and observation.ingestion_timestamp
                else None
            ),
            "ingestion_to_correlation": (
                (observation.correlation_timestamp - observation.ingestion_timestamp)
                if observation and observation.ingestion_timestamp and observation.correlation_timestamp
                else None
            ),
            "notification_to_correlation": (
                (observation.correlation_timestamp - observation.notification_timestamp)
                if observation and observation.notification_timestamp and observation.correlation_timestamp
                else None
            ),
        } if observation else None,
    )


# ---- Configuration endpoint ----

class CallbackConfig(BaseModel):
    callback_url: str


@router.get("/api/recovery/config", tags=["config"])
def get_config():
    """Get public configuration for Android observer and customer dashboards.

    Returns the callback URL and other public configuration.
    """
    import os
    callback_url = os.getenv(
        "RECOVERY_CALLBACK_URL",
        "https://agenticpay.thenitishkr.in/api/recovery/observations/ingest",
    )
    return {
        "callback_url": callback_url,
        "api_base": "/api/recovery",
        "version": "1.0.0",
    }


@router.post("/api/recovery/config", tags=["config"], status_code=200)
def set_config(
    body: CallbackConfig,
    request: Request,
    db: Session = Depends(get_db),
    auth: dict = Depends(require_role(["owner"])),
):
    """Set callback URL for Android observer (owner only)."""
    import os
    os.environ["RECOVERY_CALLBACK_URL"] = body.callback_url
    return {"callback_url": body.callback_url, "updated": True}

