"""Database setup shared by the application and migrations."""
import os

from sqlalchemy import Boolean, Column, Index, Integer, MetaData, String, Table, create_engine
from sqlalchemy.engine import URL


def database_url():
    url = os.getenv("DATABASE_URL")
    if url:
        if url.startswith(("postgres://", "postgresql://")):
            url = "postgresql+psycopg://" + url.split("://", 1)[1]
        if not url.startswith("postgresql+psycopg://"):
            raise RuntimeError("DATABASE_URL must point to PostgreSQL")
        return url
    if os.getenv("RAILWAY_ENVIRONMENT") or os.getenv("PDEP_REQUIRE_POSTGRES") == "1":
        raise RuntimeError("DATABASE_URL is required for deployment")
    return URL.create("sqlite", database=os.getenv("PDEP_DB", "checkout-v2.sqlite3"))


def make_engine():
    return create_engine(database_url(), pool_pre_ping=True, hide_parameters=True)


metadata = MetaData()

# Opt-in payer evidence. Only content digests, no raw screenshots or messages.
mobile_evidence = Table(
    "checkout_mobile_evidence", metadata,
    Column("id", String(64), primary_key=True),
    Column("sid", String(64), nullable=False),
    Column("source", String(40), nullable=False),
    Column("evidence_hash", String(64), nullable=False),
    Column("length_bytes", Integer, nullable=False),
    Column("created", Integer, nullable=False),
    __import__("sqlalchemy").UniqueConstraint("sid", "evidence_hash",
                                               name="uq_checkout_evidence_digest"),
)
sessions = Table(
    "checkout_sessions", metadata,
    Column("id", String(64), primary_key=True),
    Column("token_hash", String(64), nullable=False),
    Column("nonce", String(64), nullable=False),
    Column("mode", String(3), nullable=False),
    Column("vpa", String(321), nullable=False),
    Column("name", String(80), nullable=False),
    Column("amount", Integer, nullable=False),
    Column("mcc", String(4)),
    Column("expires", Integer, nullable=False, index=True),
    Column("state", String(40), nullable=False),
)
events = Table(
    "checkout_events", metadata,
    Column("sid", String(64), primary_key=True),
    Column("kind", String(40), primary_key=True),
    Column("created", Integer, nullable=False),
)
receipts = Table(
    "checkout_receipts", metadata,
    Column("issuer", String(32), primary_key=True),
    Column("reference", String(128), primary_key=True),
)

creation_limits = Table(
    "checkout_creation_limits", metadata,
    Column("bucket", Integer, primary_key=True),
    Column("count", Integer, nullable=False),
)

# A single operator-owned tenant's persistent UI appearance.
checkout_settings = Table(
    "checkout_settings", metadata,
    Column("id", Integer, primary_key=True),
    Column("brand_name", String(40), nullable=False),
    Column("headline", String(70), nullable=False),
    Column("accent", String(7), nullable=False),
    Column("theme", String(20), nullable=False),
    Column("logo_letter", String(1), nullable=False),
)

# Operator-managed routing inventory; never used as debit evidence.
vpa_routes = Table(
    "checkout_vpa_routes", metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("route_key", String(64), nullable=False),
    Column("mode", String(3), nullable=False),
    Column("vpa", String(321), nullable=False),
    Column("mcc", String(4)),
    Column("priority", Integer, nullable=False),
    Column("enabled", Boolean, nullable=False),
    Index("ix_checkout_vpa_routes_match", "route_key", "mode", "enabled", "priority"),
)
