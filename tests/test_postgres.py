import importlib
import os
from concurrent.futures import ThreadPoolExecutor

import pytest
from fastapi.testclient import TestClient


@pytest.mark.skipif(not os.getenv("PDEP_TEST_POSTGRES"), reason="Dedicated PostgreSQL required")
def test_postgres_migrations_persistence_and_duplicate_observations():
    import checkout.server as server

    app = importlib.reload(server).app
    with TestClient(app) as client:
        assert client.get("/healthz").status_code == 200
        response = client.post("/api/sessions", json={"mode": "P2M", "vpa": "person@upi", "amount_paise": 100})
        assert response.status_code == 201
        session = response.json()
    with TestClient(app) as client:
        path = "/api/sessions/" + session["session_id"]
        headers = {"Authorization": "Bearer " + session["token"]}
        assert client.get(path, headers=headers).json()["state"] == "AWAITING_PAYMENT"

        def observe(_):
            return client.post(path + "/observe", headers=headers, json={"event": "BROWSER_RESUMED"})

        with ThreadPoolExecutor(max_workers=4) as executor:
            assert all(result.status_code == 200 for result in executor.map(observe, range(8)))
        assert len(client.get(path + "/events", headers=headers).json()) == 1
        assert client.post("/api/demo" + path + "/issue-test-proof", headers=headers).status_code == 404
