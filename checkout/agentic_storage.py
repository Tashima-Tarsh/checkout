"""Agentic Pay storage is independent of the checkout service."""
import os

from sqlalchemy import (
    BigInteger, Boolean, Float, Column, ForeignKey, ForeignKeyConstraint, Integer, MetaData,
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
    Column("upi_id", String(321)),
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


merchant_profiles = Table(
    "ap_merchant_profiles", metadata,
    Column("id", String(32), primary_key=True),
    Column("clerk_user_id", String(255), nullable=False, unique=True),
    Column("email", String(254), nullable=False),
    Column("business_name", String(150), nullable=False),
    Column("gst_number", String(15)),
    Column("tier", String(20), server_default=text("'starter'")),
    Column("monthly_volume_estimate", BigInteger),
    Column("api_key_hash", String(64)),
    Column("api_key_prefix", String(20)),
    Column("subscription_status", String(20), server_default=text("'trial'")),
    Column("trial_ends_at", BigInteger),
    Column("created_at", BigInteger, nullable=False),
    Column("updated_at", BigInteger),
)

upi_ledger = Table(
    "ap_upi_ledger", metadata,
    Column("id", String(48), primary_key=True),
    Column("upi_id", String(321), nullable=False),
    Column("merchant_id", String(32), ForeignKey("ap_merchants.id"), nullable=False),
    Column("order_id", String(48)),
    Column("amount_minor", BigInteger, nullable=False),
    Column("currency", String(8), server_default=text("'INR'")),
    Column("direction", String(16), server_default=text("'outgoing'")),
    Column("created", BigInteger, nullable=False),
    Column("status", String(16), server_default=text("'pending'")),
    Column("cooldown_until", BigInteger),
    Column("daily_count", Integer, server_default=text("0")),
    Column("daily_volume", BigInteger, server_default=text("0")),
    Column("penalty_until", BigInteger),
    Column("blacklisted", Boolean, server_default=text("FALSE")),
    Column("success_rate", Float, server_default=text("1.0")),
    Column("last_transaction", BigInteger),
)

upi_health = Table(
    "ap_upi_health", metadata,
    Column("upi_id", String(321), primary_key=True),
    Column("merchant_id", String(32), ForeignKey("ap_merchants.id"), nullable=False),
    Column("cooldown_until", BigInteger, server_default=text("0")),
    Column("daily_count", Integer, server_default=text("0")),
    Column("daily_volume", BigInteger, server_default=text("0")),
    Column("last_daily_reset", BigInteger, server_default=text("0")),
    Column("rapid_fire_count", Integer, server_default=text("0")),
    Column("rapid_fire_window_start", BigInteger, server_default=text("0")),
    Column("penalty_until", BigInteger, server_default=text("0")),
    Column("blacklisted", Boolean, server_default=text("FALSE")),
    Column("blacklist_reason", String(200)),
    Column("success_count", Integer, server_default=text("0")),
    Column("failure_count", Integer, server_default=text("0")),
    Column("success_rate", Float, server_default=text("1.0")),
    Column("last_transaction", BigInteger, server_default=text("0")),
    Column("warmup_required", Boolean, server_default=text("FALSE")),
)

upi_rotation_log = Table(
    "ap_upi_rotation_log", metadata,
    Column("id", String(48), primary_key=True),
    Column("merchant_id", String(32), ForeignKey("ap_merchants.id"), nullable=False),
    Column("upi_id", String(321), nullable=False),
    Column("order_id", String(48)),
    Column("amount_minor", BigInteger),
    Column("decision", String(32), nullable=False),
    Column("reason", String(200)),
    Column("correlation_id", String(64)),
    Column("created", BigInteger, nullable=False),
)

workers = Table(
    "ap_workers", metadata,
    Column("id", String(48), primary_key=True),
    Column("merchant_id", String(32), ForeignKey("ap_merchants.id"), nullable=False),
    Column("device_id", String(48), nullable=False),
    Column("worker_index", Integer, nullable=False),
    Column("upi_id", String(321)),
    Column("upi_app", Text, nullable=False),
    Column("status", Text, nullable=False, server_default=text("'IDLE'")),
    Column("current_order_id", String(48)),
    Column("last_heartbeat", BigInteger, server_default=text("0")),
    Column("auto_mode", Boolean, server_default=text("FALSE")),
    Column("daily_txns", Integer, server_default=text("0")),
    Column("daily_volume", BigInteger, server_default=text("0")),
    Column("created_at", BigInteger, nullable=False),
    Column("updated_at", BigInteger, nullable=False),
)

device_upi_apps = Table(
    "ap_device_upi_apps", metadata,
    Column("id", String(48), primary_key=True),
    Column("device_id", String(48), ForeignKey("ap_devices.device_id"), nullable=False),
    Column("app_name", Text, nullable=False),
    Column("app_package", Text, nullable=False),
    Column("is_installed", Boolean, server_default=text("FALSE")),
    Column("is_enabled", Boolean, server_default=text("FALSE")),
    Column("last_checked", BigInteger, server_default=text("0")),
    Column("created_at", BigInteger, nullable=False),
)

automation_config = Table(
    "ap_automation_config", metadata,
    Column("id", String(48), primary_key=True),
    Column("merchant_id", String(32), ForeignKey("ap_merchants.id"), nullable=False),
    Column("device_id", String(48), nullable=False),
    Column("auto_checkout", Boolean, server_default=text("FALSE")),
    Column("auto_verify", Boolean, server_default=text("FALSE")),
    Column("auto_refund", Boolean, server_default=text("FALSE")),
    Column("auto_rotate_upi", Boolean, server_default=text("FALSE")),
    Column("daily_txn_target", Integer, server_default=text("100")),
    Column("min_amount_paise", Integer, server_default=text("100")),
    Column("max_amount_paise", Integer, server_default=text("100000000")),
    Column("p2p_daily_cap_paise", Integer, server_default=text("7000000")),
    Column("created_at", BigInteger, nullable=False),
    Column("updated_at", BigInteger, nullable=False),
)

auto_checkout = Table(
    "ap_auto_checkout", metadata,
    Column("id", String(48), primary_key=True),
    Column("merchant_id", String(32), ForeignKey("ap_merchants.id"), nullable=False),
    Column("device_id", String(48), nullable=False),
    Column("worker_id", String(48)),
    Column("upi_id", String(321)),
    Column("amount_minor", BigInteger, nullable=False),
    Column("mode", Text, nullable=False, server_default=text("'P2P'")),
    Column("status", Text, nullable=False, server_default=text("'PENDING'")),
    Column("order_id", String(48)),
    Column("checkout_path", String(255)),
    Column("expires_at", BigInteger, nullable=False),
    Column("created_at", BigInteger, nullable=False),
    Column("processed_at", BigInteger),
    Column("error", Text),
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
    """Create missing tables and add backward-compatible columns."""
    with engine.begin() as connection:
        metadata.create_all(connection)
        inspector = inspect(connection)
        for table, additions in {
            "ap_audit": {"order_id": "VARCHAR(48)", "detail": "TEXT"},
            "ap_merchants": {"email": "VARCHAR(254)"},
            "ap_orders": {"mode": "VARCHAR(4) DEFAULT 'P2P'", "upi_id": "VARCHAR(321)"},
        }.items():
            columns = {c["name"] for c in inspector.get_columns(table)}
            for name, definition in additions.items():
                if name not in columns:
                    connection.execute(text(f"ALTER TABLE {table} ADD COLUMN {name} {definition}"))
