"""PostgreSQL CI tests use the dedicated Agentic Pay fixture database only."""
import os
import secrets
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier

import pytest
from sqlalchemy import create_engine, select, func

from checkout.agentic_storage import accounts, evidence_consumption, merchants, metadata, orders, make_engine, initialize
from checkout.agentic_replay import reserve_reference


@pytest.fixture
def ledger(tmp_path):
    # Explicit PostgreSQL fixture switch prevents touching deployed databases.
    pg = os.environ.get("AP_REPLAY_POSTGRES") == "1"
    if pg:
        engine = make_engine()
        assert engine.url.host == "127.0.0.1"
        initialize(engine)
    else:
        engine = create_engine("sqlite:///" + str(tmp_path / "ledger.db"))
        metadata.create_all(engine)
    merchant = secrets.token_hex(16)
    account = secrets.token_hex(16)
    ids = [secrets.token_hex(24) for _ in range(2)]
    with engine.begin() as conn:
        conn.execute(merchants.insert().values(id=merchant,name="fixture",token_hash=secrets.token_hex(32)))
        conn.execute(accounts.insert().values(id=account,merchant_id=merchant,vpa=account+"@example",
            bank="fixture",holder="fixture",account_cipher="fixture",mobile_cipher="fixture",last4="0000",account_type="PERSONAL"))
        conn.execute(orders.insert(), [dict(id=i,merchant_id=merchant,account_id=account,
            amount_minor=100,created=100,expires=200,status="PENDING") for i in ids])
    try:
        yield engine, merchant, account, ids
    finally:
        with engine.begin() as conn:
            conn.execute(evidence_consumption.delete().where(evidence_consumption.c.order_id.in_(ids)))
            conn.execute(orders.delete().where(orders.c.id.in_(ids)))
            conn.execute(accounts.delete().where(accounts.c.id==account))
            conn.execute(merchants.delete().where(merchants.c.id==merchant))
        engine.dispose()


def test_atomic_concurrent_replay(ledger):
    engine, merchant, account, ids = ledger
    barrier = Barrier(2)
    ref = str(secrets.randbelow(10**12)).zfill(12)
    def run(i):
        barrier.wait(timeout=10)
        with engine.begin() as conn:
            return reserve_reference(conn, order_id=i, merchant_id=merchant, account_id=account, reference=ref, now=150)
    with ThreadPoolExecutor(max_workers=2) as pool:
        assert sorted(pool.map(run, ids)) == ["REPLAY_OR_ORDER_CONFLICT", "RESERVED_ONLY"]
    with engine.connect() as conn:
        assert conn.scalar(select(func.count()).select_from(evidence_consumption).where(evidence_consumption.c.order_id.in_(ids))) == 1
        assert set(conn.scalars(select(orders.c.status).where(orders.c.id.in_(ids)))) == {"PENDING"}


def test_scope_rollback_idempotence(ledger):
    engine, merchant, account, ids = ledger
    ref = str(secrets.randbelow(10**12)).zfill(12)
    args = dict(order_id=ids[0],merchant_id=merchant,account_id=account,reference=ref,now=150)
    with engine.connect() as conn:
        tx=conn.begin()
        assert reserve_reference(conn, **dict(args, account_id="wrong")) == "SCOPE_MISMATCH"
        assert reserve_reference(conn, **dict(args, now=200)) == "ORDER_NOT_ELIGIBLE"
        assert reserve_reference(conn, **args) == "RESERVED_ONLY"
        tx.rollback()
    with engine.begin() as conn:
        assert reserve_reference(conn, **args) == "RESERVED_ONLY"
        assert reserve_reference(conn, **args) == "ALREADY_RESERVED"
        assert reserve_reference(conn, **dict(args, order_id=ids[1])) == "REPLAY_OR_ORDER_CONFLICT"
        assert reserve_reference(conn, **dict(args, reference="invalid")) == "INVALID_REFERENCE"
