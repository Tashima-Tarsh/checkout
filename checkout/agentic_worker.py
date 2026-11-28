"""Dispatch durable jobs using opaque IDs and accept pending acknowledgments only."""
import json
import os
import time
from typing import Protocol
from urllib.error import URLError
from urllib.parse import urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener

from sqlalchemy import select

from checkout.agentic_api import event
from checkout.agentic_storage import jobs, make_engine, orders


class EvidenceProvider(Protocol):
    def dispatch(self, order_id: str, account_id: str) -> None: ...


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


class N8nProvider:
    def __init__(self, url, token):
        endpoint = urlsplit(url)
        hostname = endpoint.hostname or ""
        private_endpoint = (
            hostname in {"workflow.dev.disha.internal", "workflow.uat.disha.internal"}
            and endpoint.port == 5678
        )
        if (
            endpoint.scheme != "http" or not private_endpoint
            or endpoint.username or endpoint.password or endpoint.query or endpoint.fragment
            or endpoint.path != "/webhook/agentic-pay-dispatch" or len(token) < 43
        ):
            raise RuntimeError("Configure an approved private n8n webhook and a strong token")
        self.url = url
        self.token = token

    def dispatch(self, order_id, account_id):
        request = Request(
            self.url,
            data=json.dumps({"order_id": order_id, "account_id": account_id}).encode(),
            headers={"Content-Type": "application/json", "Authorization": "Bearer " + self.token},
            method="POST",
        )
        with build_opener(NoRedirect()).open(request, timeout=3) as response:
            result = json.loads(response.read(4096))
        if result != {"order_id": order_id, "status": "PENDING"}:
            raise ValueError("Invalid verification dispatch acknowledgment")


def dispatch_next(engine, provider: EvidenceProvider):
    with engine.begin() as conn:
        timestamp = int(time.time())
        row = conn.execute(
            select(jobs, orders.c.account_id, orders.c.merchant_id).join(orders)
            .where(jobs.c.attempts < 5, jobs.c.dispatched == 0, jobs.c.retry_at <= timestamp,
                   orders.c.status == "PENDING", orders.c.expires > timestamp)
            .order_by(jobs.c.created).limit(1).with_for_update(of=jobs, skip_locked=True)
        ).mappings().first()
        if row is None:
            return False
        attempts = row["attempts"] + 1
        try:
            provider.dispatch(row["order_id"], row["account_id"])
        except (OSError, URLError, ValueError):
            state = {"attempts": attempts, "retry_at": int(time.time()) + 2 ** attempts}
            event(conn, row["merchant_id"], "DISPATCH_RETRY" if attempts < 5 else "DISPATCH_EXHAUSTED")
        else:
            state = {"attempts": attempts, "dispatched": 1}
            event(conn, row["merchant_id"], "DISPATCH_ACKNOWLEDGED")
        conn.execute(jobs.update().where(jobs.c.order_id == row["order_id"]).values(**state))
        return True


def main():
    provider = N8nProvider(os.environ["AGENTIC_N8N_WEBHOOK"], os.environ["AGENTIC_N8N_TOKEN"])
    engine = make_engine()
    try:
        while True:
            if not dispatch_next(engine, provider):
                time.sleep(1)
    finally:
        engine.dispose()


if __name__ == "__main__":
    main()
