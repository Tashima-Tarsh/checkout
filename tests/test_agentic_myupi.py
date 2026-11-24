import unittest
from checkout.agentic_myupi import evaluate

ORDER = dict(account_id="fixture", created=100, expires=190,
             amount_minor=100, payer_last4="1234")
ROW = dict(account_id="fixture", amount_minor=100, payer_last4="1234",
           direction="CREDIT", status="SUCCESS", timestamp=110, reference="123456789012")

class Fixture:
    def __init__(self, rows): self.rows = rows
    def candidates(self, request): return self.rows

class EvidenceTests(unittest.TestCase):
    def test_default_disabled(self):
        self.assertEqual(evaluate(ORDER)["reason"], "AUTHORIZED_SOURCE_REQUIRED")
    def test_matching_never_verifies(self):
        result = evaluate(ORDER, Fixture([ROW]))
        self.assertEqual(result["reason"], "UNATTESTED_CANDIDATE")
        self.assertFalse(result["financially_verified"])
    def test_wrong_account_time_and_direction(self):
        for change in [dict(account_id="other"), dict(timestamp=99), dict(direction="DEBIT"), dict(amount_minor=200)]:
            with self.subTest(change=change):
                self.assertEqual(evaluate(ORDER, Fixture([{**ROW, **change}]))["reason"], "NO_MATCH")
    def test_duplicate_ambiguous(self):
        self.assertEqual(evaluate(ORDER, Fixture([ROW, ROW]))["reason"], "AMBIGUOUS")
    def test_malformed(self):
        self.assertEqual(evaluate(ORDER, Fixture([None]))["reason"], "INVALID_EVIDENCE")
