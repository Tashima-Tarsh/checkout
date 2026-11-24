import unittest
from time import monotonic
from agentic_account_workers import Account, Order, AccountRegistry, AccountWorker, dispatch

class WorkersTest(unittest.TestCase):
    def setUp(self):
        self.accounts = [Account(f"a{i}", f"fixture{i}@example", f"{i:04d}", f"secret-ref-{i}", True) for i in range(1000)]
        self.registry = AccountRegistry(self.accounts)
        self.calls = []
        def read(account_id, deadline):
            self.calls.append(account_id)
            return [{"account_id": account_id, "direction": "CREDIT", "status": "SUCCESS",
                     "amount_minor": 100, "payer_last4": "0123", "occurred_at_ms": 1001,
                     "reference": "123456789012", "paymentVerified": True}]
        self.workers = {a.account_id: AccountWorker(a, read) for a in self.accounts}

    def test_all_1000_routes(self):
        for a in self.accounts:
            result = dispatch(self.registry, self.workers, Order(a.account_id, 100, "0123", 1000, 2000), monotonic()+10)
            self.assertEqual(result, {"state":"PENDING","reason":"UNATTESTED_CANDIDATE"})
        self.assertEqual(self.calls, [a.account_id for a in self.accounts])

    def test_cross_account(self):
        self.workers["a0"] = self.workers["a1"]
        result = dispatch(self.registry, self.workers, Order("a0",100,"0123",1000,2000),monotonic()+10)
        self.assertEqual(result["reason"], "ACCOUNT_UNAVAILABLE")
        self.assertEqual(self.calls, [])

    def test_timeout(self):
        result = dispatch(self.registry,self.workers,Order("a0",100,"0123",1000,2000),monotonic()-1)
        self.assertEqual(result["reason"],"TIMEOUT")
        self.assertEqual(self.calls, [])

    def test_duplicate(self):
        with self.assertRaises(ValueError):
            AccountRegistry([self.accounts[0],self.accounts[0]])

if __name__ == "__main__":
    unittest.main()
