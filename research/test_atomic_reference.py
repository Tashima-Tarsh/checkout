"""Research-only durable replay experiment; no source authentication."""
import sqlite3
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier


def initialize(path):
    with sqlite3.connect(path) as db:
        db.execute('CREATE TABLE consumed (source TEXT NOT NULL, reference TEXT NOT NULL, session TEXT NOT NULL, PRIMARY KEY(source, reference))')


def consume(path, source, reference, session, *, abort=False):
    with sqlite3.connect(path, timeout=10) as db:
        try:
            db.execute('INSERT INTO consumed VALUES (?, ?, ?)', (source, reference, session))
            if abort:
                db.rollback()
                return 'ROLLED_BACK'
        except sqlite3.IntegrityError:
            return 'REPLAY'
    return 'RESEARCH_RESERVED_ONLY'


def test_concurrent_sessions(tmp_path):
    path = tmp_path / 'lab.db'
    initialize(path)
    barrier = Barrier(2)
    def submit(session):
        barrier.wait(timeout=5)
        return consume(path, 'fixture', 'ref', session)
    with ThreadPoolExecutor(2) as pool:
        assert sorted(pool.map(submit, ['A', 'B'])) == ['REPLAY', 'RESEARCH_RESERVED_ONLY']


def test_reopen_and_rollback(tmp_path):
    path = tmp_path / 'lab.db'
    initialize(path)
    assert consume(path, 'fixture', 'ref', 'A', abort=True) == 'ROLLED_BACK'
    assert consume(path, 'fixture', 'ref', 'B') == 'RESEARCH_RESERVED_ONLY'
    assert consume(path, 'fixture', 'ref', 'C') == 'REPLAY'


def test_fabricated_reference_is_not_authenticated(tmp_path):
    path = tmp_path / 'lab.db'
    initialize(path)
    assert consume(path, 'fixture', 'invented', 'A') == 'RESEARCH_RESERVED_ONLY'
    # Reservation alone cannot distinguish a fabricated reference from a debit.
    assert consume(path, 'other-fixture', 'invented', 'B') == 'RESEARCH_RESERVED_ONLY'
