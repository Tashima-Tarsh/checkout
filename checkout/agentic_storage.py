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
# Additive table: existing orders and jobs need no column migration.
verification_claims = Table(
    "ap_verification_claims", metadata,
    Column("order_id", ForeignKey("ap_orders.id"), primary_key=True),
    Column("payer_last4", String(4), nullable=False),
    Column("created", BigInteger, nullable=False),
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
audit = Table(
    "ap_audit", metadata,
    Column("id", BigInteger().with_variant(Integer, "sqlite"), primary_key=True),
    Column("merchant_id", ForeignKey("ap_merchants.id"), index=True),
    Column("event", String(48), nullable=False),
    Column("created", BigInteger, nullable=False),
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
