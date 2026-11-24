"""Internal atomic replay primitive. Reservation is NOT authentication or payment proof."""
import hashlib
import re

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert

from checkout.agentic_storage import evidence_consumption, orders, shared_test_orders


def reserve_reference(conn, *, order_id, merchant_id, account_id, reference, now):
    """Reserve one canonical UPI reference globally across accounts and merchants.

    Caller owns the transaction. Must only be called after independent evidence
    authentication and authoritative checkout binding in a future trusted service.
    No current runtime invokes this primitive; it never changes order status.
    """
    if not isinstance(reference, str) or not re.fullmatch(r"[0-9]{12}", reference):
        return "INVALID_REFERENCE"
    order = conn.execute(select(orders).where(
        orders.c.id == order_id, orders.c.merchant_id == merchant_id,
        orders.c.account_id == account_id,
    ).with_for_update()).mappings().first()
    if order is None:
        return "SCOPE_MISMATCH"
    if conn.scalar(select(shared_test_orders.c.order_id).where(
        shared_test_orders.c.order_id == order_id)) is not None:
        return "ORDER_NOT_ELIGIBLE"
    if order["status"] != "PENDING" or not order["created"] <= now < order["expires"]:
        return "ORDER_NOT_ELIGIBLE"
    if conn.dialect.name == "postgresql":
        insert = pg_insert
    elif conn.dialect.name == "sqlite":
        insert = sqlite_insert
    else:
        raise RuntimeError("Unsupported ledger database")
    digest = hashlib.sha256(reference.encode("ascii")).hexdigest()
    stmt = insert(evidence_consumption).values(
        reference_namespace="UPI", reference_digest=digest, order_id=order_id, created=now,
    ).on_conflict_do_nothing().returning(evidence_consumption.c.order_id)
    if conn.scalar(stmt) is not None:
        return "RESERVED_ONLY"
    existing = conn.execute(select(evidence_consumption.c.order_id,
        evidence_consumption.c.reference_digest).where(
        evidence_consumption.c.order_id == order_id,
    )).first()
    if existing and existing.reference_digest == digest:
        return "ALREADY_RESERVED"
    return "REPLAY_OR_ORDER_CONFLICT"
