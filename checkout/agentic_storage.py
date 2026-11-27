"""Agentic Pay storage is independent of the checkout service."""
import os

from sqlalchemy import (
    BigInteger, Column, ForeignKey, ForeignKeyConstraint, Integer, MetaData,
    String, Table, Text, UniqueConstraint, create_engine, inspect, text,
)
from sqlalchemy.engine import make_url

metadata = MetaData()
merchants = Table(
    "ap_merchants", metadata,
    Column("id", String(32), primary_key=True),
    Column("name", String(150), nullable=False),
    Column("token_hash", String(64), unique=True, nullable=False),
    Column("email", String(254), nullable=True),
)
subscriptions = Table(
    "ap_subscriptions", metadata,
    Column("merchant_id", ForeignKey("ap_merchants.id"), primary_key=True),
    Column("subject", String(64), unique=True, nullable=False),
    Column("slug", String(30), unique=True, nullable=False),
    Column("gst", String(15), nullable=False),
    Column("bank_cipher", Text, nullable=False),
    Column("monthly_volume", BigInteger, nullable=False),
    Column("period", String(8), nullable=False),
    Column("trial_until", BigInteger, nullable=False),
    Column("paid_until", BigInteger),
)
daily_issuance = Table(
    "ap_daily_issuance", metadata,
    Column("mobile_key", String(64), primary_key=True),
    Column("day", String(10), primary_key=True),
    Column("reserved_paise", BigInteger, nullable=False),
)
accounts = Table(
    "ap_accounts", metadata,
    Column("id", String(32), primary_key=True),
    Column("merchant_id", ForeignKey("ap_merchants.id"), nullable=False, index=True),
    Column("vpa", String(321), unique=True, nullable=False),
    Column("bank", String(100), nullable=False),
    Column("holder", String(100), nullable=False),
    Column("account_cipher", Text, nullable=False),
    Column("mobile_cipher", Text, nullable=False),
    Column("last4", String(4), nullable=False),
    Column("account_type", String(8), nullable=False),
    Column("mcc", String(4)),
    UniqueConstraint("merchant_id", "id"),
)
agent_sessions = Table(
    "ap_agent_sessions", metadata,
    Column("account_id", ForeignKey("ap_accounts.id"), primary_key=True),
    Column("agent_id", String(32), unique=True, nullable=False),
    Column("state", String(32), nullable=False),
    Column("expires", BigInteger, nullable=False),
)
orders = Table(
    "ap_orders", metadata,
    Column("id", String(48), primary_key=True),
    Column("merchant_id", ForeignKey("ap_merchants.id"), nullable=False, index=True),
    Column("account_id", String(32), nullable=False),
    Column("amount_minor", Integer, nullable=False),
    Column("created", BigInteger, nullable=False),
    Column("expires", BigInteger, nullable=False),
    Column("status", String(16), nullable=False),
    Column("mode", String(4), nullable=False, default="P2P"),
    ForeignKeyConstraint(["merchant_id", "account_id"], ["ap_accounts.merchant_id", "ap_accounts.id"]),
)
jobs = Table(
    "ap_verification_jobs", metadata,
    Column("order_id", ForeignKey("ap_orders.id"), primary_key=True),
    Column("created", BigInteger, nullable=False),
    Column("attempts", Integer, nullable=False, server_default="0"),
    Column("dispatched", Integer, nullable=False, server_default="0"),
    Column("retry_at", BigInteger, nullable=False, server_default="0"),
)
# Pilot: never recycle an allocated amount automatically, including expired orders.
amount_reservations = Table(
    "ap_amount_reservations", metadata,
    Column("order_id", ForeignKey("ap_orders.id"), primary_key=True),
    Column("account_id", ForeignKey("ap_accounts.id"), nullable=False),
    Column("payable_minor", Integer, nullable=False),
    UniqueConstraint("account_id", "payable_minor"),
)
# Explicitly marked repeat-amount UAT orders are observational only.
shared_test_orders = Table(
    "ap_shared_test_orders", metadata,
    Column("order_id", ForeignKey("ap_orders.id"), primary_key=True),
)
# Only an independently authenticated source may eventually consume this ledger.
# No public or worker ingestion endpoint is enabled by this schema.
evidence_consumption = Table(
    "ap_evidence_consumption", metadata,
    Column("reference_namespace", String(64), primary_key=True),
    Column("reference_digest", String(64), primary_key=True),
    Column("order_id", ForeignKey("ap_orders.id"), unique=True, nullable=False),
    Column("created", BigInteger, nullable=False),
)
# Latest live-evidence verdict used by both checkout and the merchant ledger.
# No image, audio, raw reference, payee text, balance, or account data is stored.
settlement_states = Table(
    "ap_settlement_states", metadata,
    Column("order_id", ForeignKey("ap_orders.id"), primary_key=True),
    Column("state", String(32), nullable=False),
    Column("observed_minor", Integer),
    Column("updated", BigInteger, nullable=False),
)
# Short-lived, single-use capabilities bind each live frame to one checkout.
# Only the challenge digest is stored; the browser holds the raw challenge.
live_verification_challenges = Table(
    "ap_live_verification_challenges", metadata,
    Column("challenge_digest", String(64), primary_key=True),
    Column("order_id", ForeignKey("ap_orders.id"), nullable=False, index=True),
    Column("created", BigInteger, nullable=False),
    Column("expires", BigInteger, nullable=False),
)
# Visual deduplication only; never consumes the financial evidence ledger.
receipt_observations = Table(
    "ap_receipt_observations", metadata,
    Column("order_id", ForeignKey("ap_orders.id"), primary_key=True),
    Column("frame_digest", String(64), unique=True, nullable=False),
    Column("reference_digest", String(64), unique=True, nullable=False),
    Column("decision", String(32), nullable=False),
    Column("created", BigInteger, nullable=False),
    Column("expires", BigInteger, nullable=False),
)
audit = Table(
    "ap_audit", metadata,
    Column("id", BigInteger().with_variant(Integer, "sqlite"), primary_key=True),
    Column("merchant_id", ForeignKey("ap_merchants.id"), index=True),
    Column("order_id", String(48), index=True),
    Column("event", String(48), nullable=False),
    Column("detail", Text, nullable=True),
    Column("created", BigInteger, nullable=False),
)

# Registered receiver devices bound to one merchant and one agent.
devices = Table(
    "ap_devices", metadata,
    Column("device_id", String(64), primary_key=True),
    Column("merchant_id", ForeignKey("ap_merchants.id"), nullable=False, index=True),
    Column("agent_id", String(32), nullable=False, index=True),
    Column("public_key_pem", Text, nullable=False),
    Column("state", String(32), nullable=False, server_default="ENROLLMENT_PENDING"),
    Column("created", BigInteger, nullable=False),
    Column("last_heartbeat", BigInteger, nullable=True),
    Column("app_version", String(32), nullable=True),
    Column("revoked_at", BigInteger, nullable=True),
    Column("revoked_reason", String(64), nullable=True),
)

# Short-lived, single-use pairing codes generated by the owner workspace.
pairing_codes = Table(
    "ap_pairing_codes", metadata,
    Column("code_hash", String(64), primary_key=True),
    Column("merchant_id", ForeignKey("ap_merchants.id"), nullable=False, index=True),
    Column("agent_id", String(32), nullable=False, index=True),
    Column("device_id", String(64), nullable=True),
    Column("expires", BigInteger, nullable=False),
    Column("used", BigInteger, nullable=True),
    Column("created", BigInteger, nullable=False),
)

# Device authentication credentials (hashed) issued after successful pairing.
device_credentials = Table(
    "ap_device_credentials", metadata,
    Column("device_id", String(64), ForeignKey("ap_devices.device_id", use_alter=True, name="fk_device_credentials_device"), primary_key=True),
    Column("credential_hash", String(64), nullable=False),
    Column("created", BigInteger, nullable=False),
    Column("expires", BigInteger, nullable=True),
    Column("revoked", BigInteger, nullable=True),
)

# Transaction-specific evidence submitted by an enrolled receiver device.
device_observations = Table(
    "ap_device_observations", metadata,
    Column("observation_id", String(64), primary_key=True),
    Column("device_id", String(64), ForeignKey("ap_devices.device_id", use_alter=True, name="fk_device_observations_device"), nullable=False, index=True),
    Column("order_id", String(48), ForeignKey("ap_orders.id"), nullable=False, index=True),
    Column("merchant_id", ForeignKey("ap_merchants.id"), nullable=False, index=True),
    Column("account_id", String(32), ForeignKey("ap_accounts.id"), nullable=False, index=True),
    Column("amount_paise", Integer, nullable=False),
    Column("currency", String(8), nullable=False),
    Column("transaction_reference", String(128), nullable=True),
    Column("observation_direction", String(16), nullable=False),
    Column("evidence_provenance", String(32), nullable=False),
    Column("observation_timestamp", BigInteger, nullable=False),
    Column("checkout_created", BigInteger, nullable=False),
    Column("checkout_expires", BigInteger, nullable=False),
    Column("state", String(32), nullable=False, server_default="OBSERVATION_RECEIVED"),
    Column("created", BigInteger, nullable=False),
    Column("matched_at", BigInteger, nullable=True),
    Column("decision", String(32), nullable=True),
    Column("rejection_reason", String(64), nullable=True),
)

# Device heartbeat records for online/offline state tracking.
device_heartbeats = Table(
    "ap_device_heartbeats", metadata,
    Column("id", BigInteger().with_variant(Integer, "sqlite"), primary_key=True),
    Column("device_id", String(64), ForeignKey("ap_devices.device_id", use_alter=True, name="fk_device_heartbeats_device"), nullable=False, index=True),
    Column("received_at", BigInteger, nullable=False),
    Column("created", BigInteger, nullable=False),
)

# Incoming merchant credit events observed on the device.
# One row per unique event_id; idempotent redelivery preserves prior state.
credit_events = Table(
    "ap_credit_events", metadata,
    Column("event_id", String(64), primary_key=True),
    Column("device_id", String(64), ForeignKey("ap_devices.device_id", use_alter=True, name="fk_credit_events_device"), nullable=False, index=True),
    Column("merchant_id", String(32), ForeignKey("ap_merchants.id"), nullable=False, index=True),
    Column("amount_paise", Integer, nullable=False),
    Column("currency", String(8), nullable=False),
    Column("observation_direction", String(16), nullable=False),
    Column("receiving_account_id", String(32), ForeignKey("ap_accounts.id"), nullable=False, index=True),
    Column("transaction_reference", String(128), nullable=True, index=True),
    Column("observation_timestamp", BigInteger, nullable=False),
    Column("source_app_id", String(256), nullable=True),
    Column("state", String(32), nullable=False, server_default="OBSERVATION_RECEIVED"),
    Column("matched_order_id", String(48), nullable=True, index=True),
    Column("created", BigInteger, nullable=False),
    Column("updated", BigInteger, nullable=False),
)


def isolated_database_url():
    configured = os.environ.get("AGENTIC_DATABASE_URL")
    if not configured:
        raise RuntimeError("AGENTIC_DATABASE_URL is required")
    url = make_url(configured)
    if (
        url.drivername not in {"postgres", "postgresql", "postgresql+psycopg"}
        or url.database != "agenticpay"
        or url.username != "agenticpay"
        or not url.password
    ):
        raise RuntimeError("Use a dedicated PostgreSQL database and role named agenticpay")
    return url.set(drivername="postgresql+psycopg")


def make_engine():
    return create_engine(isolated_database_url(), pool_pre_ping=True, hide_parameters=True)


def initialize(engine):
    with engine.begin() as connection:
        database, role = connection.execute(text("SELECT current_database(), current_user")).one()
        if (database, role) != ("agenticpay", "agenticpay"):
            raise RuntimeError("Agentic Pay database identity check failed")
        connection.execute(text("SELECT pg_advisory_xact_lock(69151541)"))
        if any(
            name.startswith("checkout_") or name == "alembic_version"
            for name in inspect(connection).get_table_names(schema="public")
        ):
            raise RuntimeError("Legacy checkout objects found in Agentic Pay database")
        metadata.create_all(connection)


def expire_previous_uat_links(engine, *, merchant_id, cutoff, timestamp):
    """Expire open links from a fixed historical window, preserving every record."""
    if not isinstance(cutoff, int) or not 0 < cutoff <= timestamp:
        raise ValueError("Invalid checkout expiry cutoff")
    with engine.begin() as conn:
        result = conn.execute(orders.update().where(
            orders.c.merchant_id == merchant_id,
            orders.c.created <= cutoff,
            orders.c.expires > timestamp,
            orders.c.status.in_(("AWAITING_PAYMENT", "PENDING")),
        ).values(expires=cutoff))
        return result.rowcount


def ensure_schema(engine):
    """Add order_id and detail columns to ap_audit on existing databases (idempotent)."""
    from sqlalchemy import inspect
    with engine.begin() as connection:
        inspector = inspect(connection)
        columns = {c["name"] for c in inspector.get_columns("ap_audit")}
        if "order_id" not in columns:
            connection.execute(text(
                "ALTER TABLE ap_audit ADD COLUMN order_id VARCHAR(48)"
            ))
        if "detail" not in columns:
            connection.execute(text(
                "ALTER TABLE ap_audit ADD COLUMN detail TEXT"
            ))
        merchant_cols = {c["name"] for c in inspector.get_columns("ap_merchants")}
        if "email" not in merchant_cols:
            connection.execute(text(
                "ALTER TABLE ap_merchants ADD COLUMN email VARCHAR(254)"
            ))
        # merchant_profiles table (idempotent)
        merchant_cols = {c["name"] for c in inspector.get_columns("ap_merchant_profiles")}
        if not merchant_cols:
            connection.execute(text(
                "CREATE TABLE ap_merchant_profiles ("
                "id VARCHAR(32) PRIMARY KEY,"
                "clerk_user_id VARCHAR(255) UNIQUE NOT NULL,"
                "email VARCHAR(254) NOT NULL,"
                "business_name VARCHAR(150) NOT NULL,"
                "gst_number VARCHAR(15),"
                "tier VARCHAR(20) DEFAULT 'starter',"
                "monthly_volume_estimate BIGINT,"
                "api_key_hash VARCHAR(64),"
                "api_key_prefix VARCHAR(20),"
                "subscription_status VARCHAR(20) DEFAULT 'trial',"
                "trial_ends_at BIGINT,"
                "created_at BIGINT NOT NULL,"
                "updated_at BIGINT"
                ")"
            ))
        # orders.mode column migration (idempotent)
        order_cols = {c["name"] for c in inspector.get_columns("ap_orders")}
        if "mode" not in order_cols:
            connection.execute(text(
                "ALTER TABLE ap_orders ADD COLUMN mode VARCHAR(4) DEFAULT 'P2P'"
            ))
        if "upi_id" not in order_cols:
            connection.execute(text(
                "ALTER TABLE ap_orders ADD COLUMN upi_id VARCHAR(321)"
            ))
        # UPI per-ID ledger table (idempotent)
        upi_ledger_cols = {c["name"] for c in inspector.get_columns("ap_upi_ledger")}
        if not upi_ledger_cols:
            connection.execute(text(
                "CREATE TABLE ap_upi_ledger ("
                "id VARCHAR(48) PRIMARY KEY,"
                "upi_id VARCHAR(321) NOT NULL,"
                "merchant_id VARCHAR(32) NOT NULL,"
                "order_id VARCHAR(48),"
                "amount_minor BIGINT NOT NULL,"
                "currency VARCHAR(8) DEFAULT 'INR',"
                "direction VARCHAR(16) DEFAULT 'outgoing',"
                "created BIGINT NOT NULL,"
                "status VARCHAR(16) DEFAULT 'pending',"
                "cooldown_until BIGINT,"
                "daily_count INT DEFAULT 0,"
                "daily_volume BIGINT DEFAULT 0,"
                "penalty_until BIGINT,"
                "blacklisted BOOLEAN DEFAULT FALSE,"
                "success_rate DOUBLE PRECISION DEFAULT 1.0,"
                "last_transaction BIGINT,"
                "CONSTRAINT fk_upi_ledger_merchant FOREIGN KEY (merchant_id) REFERENCES ap_merchants(id)"
                ")"
            ))
        # UPI health state table (idempotent)
        upi_health_cols = {c["name"] for c in inspector.get_columns("ap_upi_health")}
        if not upi_health_cols:
            connection.execute(text(
                "CREATE TABLE ap_upi_health ("
                "upi_id VARCHAR(321) PRIMARY KEY,"
                "merchant_id VARCHAR(32) NOT NULL,"
                "cooldown_until BIGINT DEFAULT 0,"
                "daily_count INT DEFAULT 0,"
                "daily_volume BIGINT DEFAULT 0,"
                "last_daily_reset BIGINT DEFAULT 0,"
                "rapid_fire_count INT DEFAULT 0,"
                "rapid_fire_window_start BIGINT DEFAULT 0,"
                "penalty_until BIGINT DEFAULT 0,"
                "blacklisted BOOLEAN DEFAULT FALSE,"
                "blacklist_reason VARCHAR(200),"
                "success_count INT DEFAULT 0,"
                "failure_count INT DEFAULT 0,"
                "success_rate DOUBLE PRECISION DEFAULT 1.0,"
                "last_transaction BIGINT DEFAULT 0,"
                "warmup_required BOOLEAN DEFAULT FALSE,"
                "CONSTRAINT fk_upi_health_merchant FOREIGN KEY (merchant_id) REFERENCES ap_merchants(id)"
                ")"
            ))
        # UPI rotation audit log table (idempotent)
        upi_rotation_cols = {c["name"] for c in inspector.get_columns("ap_upi_rotation_log")}
        if not upi_rotation_cols:
            connection.execute(text(
                "CREATE TABLE ap_upi_rotation_log ("
                "id VARCHAR(48) PRIMARY KEY,"
                "merchant_id VARCHAR(32) NOT NULL,"
                "upi_id VARCHAR(321) NOT NULL,"
                "order_id VARCHAR(48),"
                "amount_minor BIGINT,"
                "decision VARCHAR(32) NOT NULL,"
                "reason VARCHAR(200),"
                "correlation_id VARCHAR(64),"
                "created BIGINT NOT NULL,"
                "CONSTRAINT fk_upi_rotation_merchant FOREIGN KEY (merchant_id) REFERENCES ap_merchants(id)"
                ")"
            ))
        # Workers table: 15 workers per agent device (1 per UPI ID)
        workers_cols = {c["name"] for c in inspector.get_columns("ap_workers")}
        if not workers_cols:
            connection.execute(text(
                "CREATE TABLE ap_workers ("
                "id VARCHAR(48) PRIMARY KEY,"
                "merchant_id VARCHAR(32) NOT NULL,"
                "device_id VARCHAR(48) NOT NULL,"
                "worker_index INT NOT NULL,"
                "upi_id VARCHAR(321),"
                "upi_app TEXT NOT NULL,"
                "status TEXT NOT NULL DEFAULT 'IDLE',"
                "current_order_id VARCHAR(48),"
                "last_heartbeat BIGINT DEFAULT 0,"
                "auto_mode BOOLEAN DEFAULT TRUE,"
                "daily_txns INT DEFAULT 0,"
                "daily_volume BIGINT DEFAULT 0,"
                "created_at BIGINT NOT NULL,"
                "updated_at BIGINT NOT NULL,"
                "CONSTRAINT fk_workers_merchant FOREIGN KEY (merchant_id) REFERENCES ap_merchants(id)"
                ")"
            ))
        # Device UPI apps inventory (pre-installed apps on merchant Android)
        device_upi_apps_cols = {c["name"] for c in inspector.get_columns("ap_device_upi_apps")}
        if not device_upi_apps_cols:
            connection.execute(text(
                "CREATE TABLE ap_device_upi_apps ("
                "id VARCHAR(48) PRIMARY KEY,"
                "device_id VARCHAR(48) NOT NULL,"
                "app_name TEXT NOT NULL,"
                "app_package TEXT NOT NULL,"
                "is_installed BOOLEAN DEFAULT TRUE,"
                "is_enabled BOOLEAN DEFAULT TRUE,"
                "last_checked BIGINT DEFAULT 0,"
                "created_at BIGINT NOT NULL,"
                "CONSTRAINT fk_device_upi_apps_device FOREIGN KEY (device_id) REFERENCES ap_devices(id)"
                ")"
            ))
        # Automation config per merchant/device
        automation_cols = {c["name"] for c in inspector.get_columns("ap_automation_config")}
        if not automation_cols:
            connection.execute(text(
                "CREATE TABLE ap_automation_config ("
                "id VARCHAR(48) PRIMARY KEY,"
                "merchant_id VARCHAR(32) NOT NULL,"
                "device_id VARCHAR(48) NOT NULL,"
                "auto_checkout BOOLEAN DEFAULT TRUE,"
                "auto_verify BOOLEAN DEFAULT TRUE,"
                "auto_refund BOOLEAN DEFAULT TRUE,"
                "auto_rotate_upi BOOLEAN DEFAULT TRUE,"
                "daily_txn_target INT DEFAULT 100,"
                "min_amount_paise INT DEFAULT 100,"
                "max_amount_paise INT DEFAULT 100000000,"
                "p2p_daily_cap_paise INT DEFAULT 7000000,"
                "created_at BIGINT NOT NULL,"
                "updated_at BIGINT NOT NULL,"
                "CONSTRAINT fk_automation_merchant FOREIGN KEY (merchant_id) REFERENCES ap_merchants(id)"
                ")"
            ))
        # Auto checkout queue
        auto_checkout_cols = {c["name"] for c in inspector.get_columns("ap_auto_checkout")}
        if not auto_checkout_cols:
            connection.execute(text(
                "CREATE TABLE ap_auto_checkout ("
                "id VARCHAR(48) PRIMARY KEY,"
                "merchant_id VARCHAR(32) NOT NULL,"
                "device_id VARCHAR(48) NOT NULL,"
                "worker_id VARCHAR(48),"
                "upi_id VARCHAR(321),"
                "amount_minor BIGINT NOT NULL,"
                "mode TEXT NOT NULL DEFAULT 'P2P',"
                "status TEXT NOT NULL DEFAULT 'PENDING',"
                "order_id VARCHAR(48),"
                "checkout_path VARCHAR(255),"
                "expires_at BIGINT NOT NULL,"
                "created_at BIGINT NOT NULL,"
                "processed_at BIGINT,"
                "error TEXT,"
                "CONSTRAINT fk_auto_checkout_merchant FOREIGN KEY (merchant_id) REFERENCES ap_merchants(id)"
                ")"
            ))
