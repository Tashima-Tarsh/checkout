"""SQLAlchemy ORM models for Agentic-Recovery.

Tables:
- tenants: isolated business tenants
- employees: recovery employees (1,000 target)
- android_devices: managed receiving Android devices
- mobile_agents: per-device logical agents
- collection_cases: collection assignments
- checkouts: payment checkout sessions
- observations: authenticated receiver-side observation events
- ledger_entries: central ledger records
- outbox: durable event outbox for n8n
- audit_events: redacted audit trail
"""

import time
import sqlalchemy as sa
from sqlalchemy import (
    BigInteger, Boolean, Column, ForeignKey, Integer,
    String, Text, UniqueConstraint, Index,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()


def _now_ms() -> int:
    return int(time.time() * 1000)


class Tenant(Base):
    __tablename__ = "ap_tenants"

    id = Column(String(64), primary_key=True)
    name = Column(String(128), nullable=False)
    created = Column(BigInteger, nullable=False, default=_now_ms)

    employees = relationship("Employee", back_populates="tenant")
    devices = relationship("AndroidDevice", back_populates="tenant")
    checkouts = relationship("Checkout", back_populates="tenant")
    observations = relationship("Observation", back_populates="tenant")


class Employee(Base):
    __tablename__ = "ap_employees"

    id = Column(String(64), primary_key=True)  # employee ID like EMP-0001
    tenant_id = Column(String(64), ForeignKey("ap_tenants.id"), nullable=False, index=True)
    name = Column(String(128), nullable=False)
    email = Column(String(256))
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
    public_key = Column(Text, nullable=False)  # Android Keystore public key (PEM)
    is_active = Column(Boolean, nullable=False, default=True)
    last_heartbeat = Column(BigInteger, nullable=True)
    connectivity_status = Column(String(32), nullable=False, default="offline")
    created = Column(BigInteger, nullable=False, default=_now_ms)

    tenant = relationship("Tenant", back_populates="devices")
    agent = relationship("MobileAgent", back_populates="device", uselist=False)
    observations = relationship("Observation", back_populates="device")


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
    detail = Column(Text, nullable=True)
    created = Column(BigInteger, nullable=False, default=_now_ms)

    tenant = relationship("Tenant")
