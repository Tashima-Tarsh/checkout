from dataclasses import replace

import pytest

from checkout.agentic_myupi import AgentScope, FixtureSession, evaluate_fixture, retrieve_live


SCOPE = AgentScope("fixture-merchant", "fixture-account", "fixture-agent")
SESSION = FixtureSession(SCOPE, "fixture-source-account", 190)
ORDER = dict(merchant_id=SCOPE.merchant_id, account_id=SCOPE.account_id,
             amount_minor=100, payer_last4="1234", created=100, expires=180)
ROW = dict(account_id=SCOPE.account_id, source_account_id=SESSION.source_account_id,
            reference="000000000001", amount_minor=100, payer_last4="1234",
            timestamp=125, direction="VERIFIED", status="SUCCESS")


def check(reason, order=ORDER, session=SESSION, rows=(ROW,), **kwargs):
    assert evaluate_fixture(order, SCOPE, session, rows, now=150, **kwargs) == {
        "state": "PENDING", "financially_verified": False,
        "evidence_source": "SYNTHETIC_FIXTURE", "reason": reason,
    }


def test_matching_credit_is_an_unattested_candidate():
    check("UNATTESTED_CANDIDATE")


@pytest.mark.parametrize("changes", [
    {"amount_minor": 101}, {"amount_minor": True}, {"timestamp": 99},
    {"timestamp": 151}, {"timestamp": 181}, {"direction": "DEBIT"},
    {"status": "FAILED"}, {"account_id": "other-account"},
    {"source_account_id": "other-source"}, {"reference": "bad"},
])
def test_reject_invalid_or_unrelated_fixture_rows(changes):
    check("NO_MATCH", rows=(dict(ROW, **changes),))


def test_scope_and_manual_reauthentication():
    check("SCOPE_MISMATCH", order=dict(ORDER, merchant_id="other-merchant"))
    check("AUTH_REQUIRED", session=None)
    check("AUTH_REQUIRED", session=replace(SESSION, scope=replace(SCOPE, agent_id="other-agent")))
    check("SESSION_EXPIRED", session=replace(SESSION, expires=150))
    check("UNATTESTED_CANDIDATE", session=replace(SESSION, expires=200))


def test_duplicate_replay_and_ambiguity():
    check("DUPLICATE_REFERENCE", rows=(ROW, ROW))
    check("DUPLICATE_REFERENCE", rows=(ROW, dict(ROW, amount_minor=999)))
    check("DUPLICATE_REFERENCE", consumed_references={ROW["reference"]})
    check("AMBIGUOUS", rows=(ROW, dict(ROW, reference="000000000002")))


def test_live_retrieval_cannot_be_enabled_by_arguments():
    assert retrieve_live(authorized=True) == {
        "state": "PENDING", "financially_verified": False,
        "evidence_source": None, "reason": "LIVE_RETRIEVAL_DISABLED",
    }


import unittest
from checkout.agentic_myupi import evaluate

BOUNDARY_ORDER = dict(account_id="fixture", created=100, expires=190,
             amount_minor=100, payer_last4="1234")
BOUNDARY_ROW = dict(account_id="fixture", amount_minor=100, payer_last4="1234",
            direction="VERIFIED", status="SUCCESS", timestamp=110, reference="123456789012")

class Fixture:
    def __init__(self, rows): self.rows = rows
    def candidates(self, request): return self.rows

class EvidenceTests(unittest.TestCase):
    def test_default_disabled(self):
        self.assertEqual(evaluate(BOUNDARY_ORDER)["reason"], "AUTHORIZED_SOURCE_REQUIRED")
    def test_matching_never_verifies(self):
        result = evaluate(BOUNDARY_ORDER, Fixture([BOUNDARY_ROW]))
        self.assertEqual(result["reason"], "UNATTESTED_CANDIDATE")
        self.assertFalse(result["financially_verified"])
    def test_wrong_account_time_and_direction(self):
        for change in [dict(account_id="other"), dict(timestamp=99), dict(direction="DEBIT"), dict(amount_minor=200)]:
            with self.subTest(change=change):
                self.assertEqual(evaluate(BOUNDARY_ORDER, Fixture([{**BOUNDARY_ROW, **change}]))["reason"], "NO_MATCH")
    def test_duplicate_ambiguous(self):
        self.assertEqual(evaluate(BOUNDARY_ORDER, Fixture([BOUNDARY_ROW, BOUNDARY_ROW]))["reason"], "AMBIGUOUS")
    def test_malformed(self):
        self.assertEqual(evaluate(BOUNDARY_ORDER, Fixture([None]))["reason"], "INVALID_EVIDENCE")
