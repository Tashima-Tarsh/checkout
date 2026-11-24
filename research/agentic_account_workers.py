"""Research-only account-isolated orchestration. No live portal access."""
from dataclasses import dataclass
from collections.abc import Callable
from time import monotonic
import re

@dataclass(frozen=True)
class Account:
    account_id: str
    upi_id: str
    receiving_last4: str
    mobile_secret_ref: str
    enabled: bool = False

@dataclass(frozen=True)
class Order:
    account_id: str
    amount_minor: int
    payer_last4: str
    created_at_ms: int
    expires_at_ms: int

class AccountRegistry:
    def __init__(self, accounts):
        self._accounts = {}
        upis = set()
        for a in accounts:
            if not a.account_id or not a.upi_id or not a.mobile_secret_ref or not re.fullmatch(r"[0-9]{4}", a.receiving_last4):
                raise ValueError("invalid account")
            if a.account_id in self._accounts or a.upi_id.lower() in upis:
                raise ValueError("duplicate account or UPI")
            self._accounts[a.account_id] = a
            upis.add(a.upi_id.lower())

    def resolve(self, account_id):
        a = self._accounts.get(account_id)
        return a if a and a.enabled else None

class AccountWorker:
    def __init__(self, account: Account, read_candidates: Callable):
        self.account = account
        self._read = read_candidates

    def inspect(self, order: Order, deadline: float):
        if not self.account.enabled or order.account_id != self.account.account_id:
            return {"state": "PENDING", "reason": "ACCOUNT_MISMATCH"}
        if type(order.amount_minor) is not int or order.amount_minor <= 0 or not re.fullmatch(r"[0-9]{4}", order.payer_last4) or order.created_at_ms > order.expires_at_ms:
            return {"state": "PENDING", "reason": "INVALID_ORDER"}
        if monotonic() >= deadline:
            return {"state": "PENDING", "reason": "TIMEOUT"}
        try:
            rows = self._read(self.account.account_id, deadline)
            matches = [r for r in rows if r.get("account_id") == self.account.account_id
                and r.get("direction") == "CREDIT" and r.get("status") == "SUCCESS"
                and type(r.get("amount_minor")) is int and r["amount_minor"] == order.amount_minor
                and r.get("payer_last4") == order.payer_last4
                and type(r.get("occurred_at_ms")) is int
                and order.created_at_ms <= r["occurred_at_ms"] <= order.expires_at_ms
                and isinstance(r.get("reference"), str) and re.fullmatch(r"[0-9]{12}", r["reference"])]
        except Exception:
            return {"state": "PENDING", "reason": "SOURCE_UNAVAILABLE"}
        if monotonic() >= deadline:
            return {"state": "PENDING", "reason": "TIMEOUT"}
        return {"state": "PENDING", "reason": "UNATTESTED_CANDIDATE" if len(matches) == 1 else "AMBIGUOUS" if matches else "NO_MATCH"}

def dispatch(registry, workers, order, deadline):
    account = registry.resolve(order.account_id)
    worker = workers.get(order.account_id)
    if account is None or worker is None or worker.account != account:
        return {"state": "PENDING", "reason": "ACCOUNT_UNAVAILABLE"}
    return worker.inspect(order, deadline)
