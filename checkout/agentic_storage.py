"""Operator-owned Agentic Pay inventory; not financial evidence."""
from sqlalchemy import Table, Column, String, Integer, BigInteger, Text, ForeignKey, UniqueConstraint
from checkout.storage import metadata

accounts = Table("agentic_accounts", metadata,
    Column("id", String(32), primary_key=True),
    Column("vpa", String(321), nullable=False, unique=True),
    Column("bank", String(100), nullable=False),
    Column("holder", String(100), nullable=False),
    Column("account_cipher", Text, nullable=False),
    Column("mobile_cipher", Text, nullable=False),
    Column("last4", String(4), nullable=False))
agent_sessions = Table("agentic_sessions", metadata,
    Column("account_id", ForeignKey("agentic_accounts.id"), primary_key=True),
    Column("state", String(32), nullable=False),
    Column("expires", BigInteger, nullable=False))
consumed = Table("agentic_consumed_references", metadata,
    Column("reference", String(128), primary_key=True),
    Column("order_id", String(64), nullable=False, unique=True))
