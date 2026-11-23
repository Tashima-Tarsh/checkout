import importlib
from urllib.parse import parse_qs, urlsplit

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.delenv("DATABASE_URL", raising=False)
    monkeypatch.setenv("PDEP_DB", str(tmp_path / "sessions.sqlite3"))
    monkeypatch.setenv("PDEP_DEMO_MODE", "1")
    import checkout.server as server
    with TestClient(importlib.reload(server).app) as client:
        yield client


def create(client, mode="P2P", mcc=None):
    response = client.post("/api/sessions", json={
        "mode": mode, "vpa": "person@upi", "name": "Person", "amount_paise": 49900, "mcc": mcc,
    })
    assert response.status_code == 201
    session = response.json()
    return session, "/api/sessions/" + session["session_id"], {
        "Authorization": "Bearer " + session["token"]
    }


def test_p2p_qr_and_authorization(client):
    session, path, headers = create(client)
    params = parse_qs(urlsplit(session["payment_uri"]).query)
    assert params["pa"] == ["person@upi"] and params["am"] == ["499.00"]
    assert "mc" not in params and session["token"] not in session["payment_uri"]
    assert client.get(path, params={"token": session["token"]}).status_code == 401
    assert client.get(path + "/qr.png", headers=headers).content.startswith(b"\x89PNG")
    assert "token" not in client.get(path, headers=headers).json()
    _, _, another_token = create(client)
    assert client.get(path, headers=another_token).status_code == 404


@pytest.mark.parametrize("mcc", [None, "5411"])
def test_p2m(client, mcc):
    session, _, _ = create(client, "P2M", mcc)
    assert parse_qs(urlsplit(session["payment_uri"]).query).get("mc") == ([mcc] if mcc else None)


def test_personal_mcc_rejected(client):
    response = client.post("/api/sessions", json={
        "mode": "P2P", "vpa": "person@upi", "amount_paise": 100, "mcc": "5411",
    })
    assert response.status_code == 422


def test_callback_is_idempotent_and_unverified(client):
    _, path, headers = create(client)
    for _ in range(2):
        response = client.post(path + "/observe", headers=headers, json={"event": "BROWSER_RESUMED"})
        assert response.json()["state"] == "BROWSER_RETURNED"
        assert response.json()["financially_verified"] is False
    assert len(client.get(path + "/events", headers=headers).json()) == 1


def test_synthetic_proof_is_unverified_and_cannot_replay(client):
    _, path, headers = create(client)
    receipt = client.post("/api/demo/sessions/" + path.rsplit("/", 1)[-1] + "/issue-test-proof", headers=headers).json()["receipt"]
    response = client.post(path + "/proof", headers=headers, json={"receipt": receipt}).json()
    assert response["test_attested"] and not response["financially_verified"]
    response = client.post(path + "/proof", headers=headers, json={"receipt": receipt}).json()
    assert response["result"] == "REPLAY"
    assert response["state"] == "SIMULATED_PROOF_VALID"


def test_expired_session(client):
    from checkout.storage import sessions

    _, path, headers = create(client)
    with client.app.state.engine.begin() as connection:
        connection.execute(sessions.update().values(expires=1))
    assert client.get(path, headers=headers).json()["state"] == "EXPIRED"
    assert client.get(path + "/qr.png", headers=headers).status_code == 410
    assert client.post(path + "/observe", headers=headers, json={"event": "BROWSER_RESUMED"}).status_code == 410
