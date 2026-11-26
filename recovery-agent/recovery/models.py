"""SQLAlchemy ORM models for Agentic-Recovery (enhanced with security).

Tables:
- tenants: isolated business tenants
- employees: recovery employees (1,000 target) with role
- android_devices: managed receiving Android devices with crypto keys
- mobile_agents: per-device logical agents
- collection_cases: collection assignments
- checkouts: payment checkout sessions
- observations: authenticated receiver-side observation events
- ledger_entries: central ledger records
- outbox: durable event outbox for n8n
- audit_events: redacted audit trail
- device_sessions: device authentication sessions
- role_assignments: tenant-scoped role bindings
"""

import time
import sqlalchemy as sa
from sqlalchemy import (
    BigInteger, Boolean, Column, ForeignKey, Integer,
    String, Text, UniqueConstraint, Index,
)
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()


def _now_ms() -> int:
    return int(time.time() * 1000)


class Tenant(Base):
    __tablename__ = "ap_tenants"

    id = Column(String(64), primary_key=True)
    name = Column(String(128), nullable=False)
    owner_id = Column(String(128), nullable=True)
    owner_email = Column(String(256), nullable=True)
    receiving_upi_id = Column(String(128), nullable=True)
    bank_alert_email = Column(String(256), nullable=True)
    collection_threshold_paise = Column(Integer, nullable=True, default=100)
    shop_state = Column(String(16), nullable=False, default="CLOSED")  # OPEN, CLOSED
    observation_mode = Column(String(16), nullable=False, default="EMAIL")  # EMAIL, ANDROID, BOTH
    created = Column(BigInteger, nullable=False, default=_now_ms)

    employees = relationship("Employee", back_populates="tenant")
    devices = relationship("AndroidDevice", back_populates="tenant")
    checkouts = relationship("Checkout", back_populates="tenant")
    observations = relationship("Observation", back_populates="tenant")
    roles = relationship("RoleAssignment", back_populates="tenant")


class Employee(Base):
    __tablename__ = "ap_employees"

    id = Column(String(64), primary_key=True)  # employee ID like EMP-0001
    tenant_id = Column(String(64), ForeignKey("ap_tenants.id"), nullable=False, index=True)
    name = Column(String(128), nullable=False)
    email = Column(String(256))
    role = Column(String(32), nullable=False, default="recovery_employee")  # owner, collection_manager, recovery_employee, auditor
    assigned_device_id = Column(String(64), ForeignKey("ap_android_devices.id"), nullable=True)
    assigned_receiver_upi = Column(String(128), nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    created = Column(BigInteger, nullable=False, default=_now_ms)

    tenant = relationship("Tenant", back_populates="employees")
    device = relationship("AndroidDevice", foreign_keys=[assigned_device_id])
    checkouts = relationship("Checkout", back_populates="employee")


class AndroidDevice(Base):
    __tablename__ = "ap_android_devices"

    id = Column(String(64), primary_key=True)  # device ID like mobile-0001
    tenant_id = Column(String(64), ForeignKey("ap_tenants.id"), nullable=False, index=True)
    device_serial = Column(String(128), nullable=True)  # adb serial number
    avd_name = Column(String(128), nullable=True)
    registered_upi_id = Column(String(128), nullable=False)
    upi_application = Column(String(64), nullable=False)  # Google Pay, PhonePe, etc.
    public_key_pem = Column(Text, nullable=False)  # Android Keystore public key (PEM)
    device_fingerprint = Column(String(128), nullable=True)  # Hardware-bound device fingerprint
    is_active = Column(Boolean, nullable=False, default=True)
    last_heartbeat = Column(BigInteger, nullable=True)
    connectivity_status = Column(String(32), nullable=False, default="registered")
    created = Column(BigInteger, nullable=False, default=_now_ms)

    tenant = relationship("Tenant", back_populates="devices")
    agent = relationship("MobileAgent", back_populates="device", uselist=False)
    observations = relationship("Observation", back_populates="device")
    sessions = relationship("DeviceSession", back_populates="device")


class MobileAgent(Base):
    __tablename__ = "ap_mobile_agents"

    id = Column(String(64), primary_key=True)  # agent ID like agent-0001
    device_id = Column(String(64), ForeignKey("ap_android_devices.id"), nullable=False, index=True, unique=True)
    tenant_id = Column(String(64), ForeignKey("ap_tenants.id"), nullable=False, index=True)
    observation_cursor = Column(BigInteger, nullable=False, default=0)
    processing_state = Column(String(32), nullable=False, default="idle")
    last_event_id = Column(String(128), nullable=True)
    created = Column(BigInteger, nullable=False, default=_now_ms)

    device = relationship("AndroidDevice", back_populates="agent")
    tenant = relationship("Tenant")


class CollectionCase(Base):
    __tablename__ = "ap_collection_cases"

    id = Column(String(64), primary_key=True)
    tenant_id = Column(String(64), ForeignKey("ap_tenants.id"), nullable=False, index=True)
    employee_id = Column(String(64), ForeignKey("ap_employees.id"), nullable=False, index=True)
    device_id = Column(String(64), ForeignKey("ap_android_devices.id"), nullable=False, index=True)
    title = Column(String(256), nullable=False)
    target_amount_paise = Column(Integer, nullable=False)
    currency = Column(String(8), nullable=False, default="INR")
    status = Column(String(32), nullable=False, default="open")
    created = Column(BigInteger, nullable=False, default=_now_ms)

    tenant = relationship("Tenant")
    employee = relationship("Employee")
    device = relationship("AndroidDevice")
    checkouts = relationship("Checkout", back_populates="collection_case")


class Checkout(Base):
    __tablename__ = "ap_checkouts"

    id = Column(String(64), primary_key=True)  # checkout ID like rcv_...
    tenant_id = Column(String(64), ForeignKey("ap_tenants.id"), nullable=False, index=True)
    employee_id = Column(String(64), ForeignKey("ap_employees.id"), nullable=False, index=True)
    collection_case_id = Column(String(64), ForeignKey("ap_collection_cases.id"), nullable=True, index=True)
    device_id = Column(String(64), ForeignKey("ap_android_devices.id"), nullable=False, index=True)
    receiver_upi_id = Column(String(128), nullable=False)
    amount_paise = Column(Integer, nullable=False)
    currency = Column(String(8), nullable=False, default="INR")
    upi_link = Column(Text, nullable=True)
    qr_code = Column(Text, nullable=True)
    state = Column(String(32), nullable=False, default="CREATED")
    expires = Column(BigInteger, nullable=False)
    financially_verified = Column(Boolean, nullable=False, default=False)
    created = Column(BigInteger, nullable=False, default=_now_ms)

    tenant = relationship("Tenant", back_populates="checkouts")
    employee = relationship("Employee", back_populates="checkouts")
    collection_case = relationship("CollectionCase", back_populates="checkouts")
    device = relationship("AndroidDevice")
    observations = relationship("Observation", back_populates="checkout")
    ledger_entries = relationship("LedgerEntry", back_populates="checkout")


class Observation(Base):
    __tablename__ = "ap_observations"

    id = Column(String(128), primary_key=True)  # observation event ID
    tenant_id = Column(String(64), ForeignKey("ap_tenants.id"), nullable=False, index=True)
    device_id = Column(String(64), ForeignKey("ap_android_devices.id"), nullable=False, index=True)
    checkout_id = Column(String(64), ForeignKey("ap_checkouts.id"), nullable=True, index=True)
    agent_id = Column(String(64), ForeignKey("ap_mobile_agents.id"), nullable=True, index=True)

    # Observed fields (never fabricated)
    observed_receiver_upi = Column(String(128), nullable=True)
    payer_name = Column(String(128), nullable=True)
    payer_upi_id = Column(String(128), nullable=True)
    amount_paise = Column(Integer, nullable=True)
    currency = Column(String(8), nullable=True)
    utr_rrn = Column(String(64), nullable=True)
    app_transaction_id = Column(String(128), nullable=True)
    transaction_direction = Column(String(16), nullable=True)  # incoming, outgoing
    app_reported_status = Column(String(32), nullable=True)
    transaction_timestamp = Column(BigInteger, nullable=True)
    observation_timestamp = Column(BigInteger, nullable=False)
    server_ingestion_timestamp = Column(BigInteger, nullable=False, default=_now_ms)
    source_application = Column(String(64), nullable=True)
    evidence_type = Column(String(32), nullable=False)  # notification, history, etc.
    evidence_fingerprint = Column(String(128), nullable=True)

    # Security fields
    device_signature = Column(String(512), nullable=False)  # Device-signed event
    signature_timestamp = Column(BigInteger, nullable=False)
    signature_verified = Column(Boolean, nullable=False, default=False)

    # Latency measurement fields (milliseconds since epoch)
    notification_timestamp = Column(BigInteger, nullable=True)  # When UPI app generated notification
    capture_timestamp = Column(BigInteger, nullable=True)  # When observer captured notification
    callback_timestamp = Column(BigInteger, nullable=True)  # When observation submitted to backend
    ingestion_timestamp = Column(BigInteger, nullable=True)  # When backend received observation
    correlation_timestamp = Column(BigInteger, nullable=True)  # When checkout was correlated
    ledger_timestamp = Column(BigInteger, nullable=True)  # When ledger entry was created

    # Matching and verification
    observation_authenticity = Column(String(32), nullable=False, default="pending")  # verified, rejected
    checkout_correlation = Column(String(32), nullable=False, default="unmatched")  # matched, review_required, unmatched
    financial_verification = Column(Boolean, nullable=False, default=False)
    duplicate_of = Column(String(128), nullable=True)  # references another observation id

    created = Column(BigInteger, nullable=False, default=_now_ms)

    tenant = relationship("Tenant", back_populates="observations")
    device = relationship("AndroidDevice", back_populates="observations")
    checkout = relationship("Checkout", back_populates="observations")

    __table_args__ = (
        Index("ix_ap_observations_device_ingested", "device_id", "server_ingestion_timestamp"),
        Index("ix_ap_observations_utr", "utr_rrn"),
    )


class LedgerEntry(Base):
    __tablename__ = "ap_ledger_entries"

    id = Column(String(64), primary_key=True)
    tenant_id = Column(String(64), ForeignKey("ap_tenants.id"), nullable=False, index=True)
    employee_id = Column(String(64), ForeignKey("ap_employees.id"), nullable=True, index=True)
    checkout_id = Column(String(64), ForeignKey("ap_checkouts.id"), nullable=True, index=True)
    observation_id = Column(String(128), ForeignKey("ap_observations.id"), nullable=True, index=True)

    amount_paise = Column(Integer, nullable=False)
    currency = Column(String(8), nullable=False, default="INR")
    entry_type = Column(String(32), nullable=False)  # credit, debit, reversal
    state = Column(String(32), nullable=False, default="pending")  # pending, confirmed, reversed
    reference = Column(String(128), nullable=True)
    created = Column(BigInteger, nullable=False, default=_now_ms)

    tenant = relationship("Tenant")
    employee = relationship("Employee")
    checkout = relationship("Checkout", back_populates="ledger_entries")


class Outbox(Base):
    __tablename__ = "ap_outbox"

    id = Column(String(64), primary_key=True)
    tenant_id = Column(String(64), ForeignKey("ap_tenants.id"), nullable=False, index=True)
    event_type = Column(String(64), nullable=False)
    payload = Column(Text, nullable=False)
    processed = Column(Boolean, nullable=False, default=False)
    created = Column(BigInteger, nullable=False, default=_now_ms)
    processed_at = Column(BigInteger, nullable=True)

    tenant = relationship("Tenant")


class AuditEvent(Base):
    __tablename__ = "ap_audit_events"

    id = Column(Integer, primary_key=True, autoincrement=True)
    tenant_id = Column(String(64), ForeignKey("ap_tenants.id"), nullable=False, index=True)
    event = Column(String(64), nullable=False)
    detail = Column(Text, nullable=True)  # redacted - no secrets
    created = Column(BigInteger, nullable=False, default=_now_ms)

    tenant = relationship("Tenant")


class DeviceSession(Base):
    __tablename__ = "ap_device_sessions"

    id = Column(String(128), primary_key=True)
    device_id = Column(String(64), ForeignKey("ap_android_devices.id"), nullable=False, index=True)
    tenant_id = Column(String(64), ForeignKey("ap_tenants.id"), nullable=False, index=True)
    session_token = Column(String(256), nullable=False, unique=True)
    expires_at = Column(BigInteger, nullable=False)
    created_at = Column(BigInteger, nullable=False, default=_now_ms)
    is_revoked = Column(Boolean, nullable=False, default=False)

    device = relationship("AndroidDevice", back_populates="sessions")
    tenant = relationship("Tenant")


class RoleAssignment(Base):
    __tablename__ = "ap_role_assignments"

    id = Column(String(64), primary_key=True)
    tenant_id = Column(String(64), ForeignKey("ap_tenants.id"), nullable=False, index=True)
    employee_id = Column(String(64), ForeignKey("ap_employees.id"), nullable=False, index=True)
    role = Column(String(32), nullable=False)  # owner, collection_manager, recovery_employee, auditor
    granted_at = Column(BigInteger, nullable=False, default=_now_ms)
    granted_by = Column(String(128), nullable=True)

    tenant = relationship("Tenant")
    employee = relationship("Employee")

    __table_args__ = (
        UniqueConstraint("employee_id", "role", name="uq_ap_role_assignments_employee_role"),
    )


class EmailConfig(Base):
    """Email configuration for email-first observation mode.

    Stores OAuth token and IMAP connection settings for authorized
    read-only access to the receiving account's email inbox.
    Never stores passwords - only OAuth refresh tokens.
    """

    __tablename__ = "ap_email_configs"

    id = Column(String(64), primary_key=True)
    tenant_id = Column(String(64), ForeignKey("ap_tenants.id"), nullable=False, index=True, unique=True)
    email_address = Column(String(256), nullable=False)
    imap_host = Column(String(256), nullable=False, default="imap.gmail.com")
    imap_port = Column(Integer, nullable=False, default=993)
    oauth_refresh_token = Column(Text, nullable=True)  # Encrypted OAuth refresh token
    oauth_access_token = Column(Text, nullable=True)  # Short-lived access token
    oauth_token_expiry = Column(BigInteger, nullable=True)
    is_connected = Column(Boolean, nullable=False, default=False)
    last_polled = Column(BigInteger, nullable=True)
    allowed_senders = Column(Text, nullable=True)  # JSON array of allowed sender domains
    created = Column(BigInteger, nullable=False, default=_now_ms)
    updated = Column(BigInteger, nullable=False, default=_now_ms)

    tenant = relationship("Tenant")


class EmailObservationEvent(Base):
    """Email-based observation event submitted to the backend.

    Corroborating evidence source - does NOT independently set
    financially_verified. Used alongside device observations for
    cross-validation.
    """

    __tablename__ = "ap_email_observation_events"

    id = Column(String(128), primary_key=True)
    tenant_id = Column(String(64), ForeignKey("ap_tenants.id"), nullable=False, index=True)
    email_message_id = Column(String(256), nullable=False, index=True)  # Email Message-ID for dedup
    checkout_id = Column(String(64), ForeignKey("ap_checkouts.id"), nullable=True, index=True)
    agent_id = Column(String(64), ForeignKey("ap_mobile_agents.id"), nullable=True, index=True)

    # Observed fields from email
    observed_receiver_upi = Column(String(128), nullable=True)
    payer_name = Column(String(128), nullable=True)
    payer_upi_id = Column(String(128), nullable=True)
    amount_paise = Column(Integer, nullable=True)
    currency = Column(String(8), nullable=True)
    utr_rrn = Column(String(64), nullable=True)
    app_transaction_id = Column(String(128), nullable=True)
    transaction_direction = Column(String(16), nullable=True)
    app_reported_status = Column(String(32), nullable=True)
    transaction_timestamp = Column(BigInteger, nullable=True)
    observation_timestamp = Column(BigInteger, nullable=False)
    server_ingestion_timestamp = Column(BigInteger, nullable=False, default=_now_ms)
    source_email = Column(String(256), nullable=True)
    evidence_type = Column(String(32), nullable=False, default="email")
    evidence_fingerprint = Column(String(128), nullable=True)

    # Security
    observation_authenticity = Column(String(32), nullable=False, default="pending")
    checkout_correlation = Column(String(32), nullable=False, default="unmatched")
    financial_verification = Column(Boolean, nullable=False, default=False)

    created = Column(BigInteger, nullable=False, default=_now_ms)

    tenant = relationship("Tenant")
    checkout = relationship("Checkout")

    __table_args__ = (
        Index("ix_ap_email_observations_tenant_ingested", "tenant_id", "server_ingestion_timestamp"),
        Index("ix_ap_email_observations_utr", "utr_rrn"),
        UniqueConstraint("email_message_id", name="uq_ap_email_observations_message_id"),
    )
