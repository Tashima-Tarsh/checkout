"""Database engine, session helpers, and schema initialization for Agentic-Recovery."""

import os
import time
from typing import Generator, Optional

from sqlalchemy import create_engine, event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

from recovery.models import Base

from dotenv import load_dotenv
load_dotenv()

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+psycopg2://agentic_recovery:changeme@localhost:5432/agentic_recovery",
)


def make_engine(database_url: Optional[str] = None, **kwargs) -> Engine:
    """Create SQLAlchemy engine. For SQLite testing, pass check_same_thread=False."""
    url = database_url or DATABASE_URL
    connect_args = kwargs.pop("connect_args", {})
    if url.startswith("sqlite"):
        connect_args.setdefault("check_same_thread", False)
    engine = create_engine(
        url,
        pool_pre_ping=True,
        pool_recycle=3600,
        echo=False,
        connect_args=connect_args,
        **kwargs,
    )
    return engine


def initialize(engine: Engine) -> None:
    """Create all tables if they do not exist."""
    Base.metadata.create_all(engine)


def make_session(engine: Engine) -> sessionmaker:
    """Return a configured sessionmaker bound to the engine."""
    return sessionmaker(bind=engine, autoflush=False, autocommit=False)


def now_ms() -> int:
    """Return current time in milliseconds since epoch."""
    return int(time.time() * 1000)


def ensure_schema(engine: Engine) -> None:
    """Idempotent schema check — verifies all expected tables exist."""
    from sqlalchemy import inspect
    inspector = inspect(engine)
    expected = {
        "ap_tenants",
        "ap_employees",
        "ap_android_devices",
        "ap_mobile_agents",
        "ap_collection_cases",
        "ap_checkouts",
        "ap_observations",
        "ap_ledger_entries",
        "ap_outbox",
        "ap_audit_events",
    }
    actual = set(inspector.get_table_names())
    missing = expected - actual
    if missing:
        raise RuntimeError(f"Missing tables after initialization: {missing}")
