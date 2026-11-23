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


def test_admin_import_routes_and_ip_whitelist(client, monkeypatch):
    monkeypatch.setenv("PDEP_ADMIN_TOKEN", "test-admin-token-with-at-least-32-chars")
    monkeypatch.setenv("PDEP_ADMIN_IP_ALLOWLIST", "127.0.0.0/8")
    # TestClient uses the logical peer 'testclient' by default; this is not an IP.
    # Create an explicit local peer to simulate a direct allowlisted admin client.
    from fastapi.testclient import TestClient
    from io import BytesIO
    from openpyxl import Workbook
    local = TestClient(client.app, client=("127.0.0.1", 50000))
    headers = {"Authorization": "Bearer test-admin-token-with-at-least-32-chars"}
    workbook = Workbook()
    sheet = workbook.active
    sheet.append(["route_key", "mode", "vpa", "mcc", "priority", "enabled"])
    sheet.append(["primary", "P2P", "person@upi", None, 10, "true"])
    sheet.append(["business", "P2M", "shop@upi", 5411, 5, "true"])
    sheet.append(["business", "P2M", "backup@upi", None, 20, "true"])
    saved = BytesIO()
    workbook.save(saved)
    saved.seek(0)
    assert local.post("/api/admin/vpas/import", files={
        "file": ("routes.xlsx", saved, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    }).status_code == 401
    saved.seek(0)
    ok = local.post("/api/admin/vpas/import", headers=headers, files={
        "file": ("routes.xlsx", saved, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    })
    assert ok.status_code == 200, ok.text
    assert ok.json()["imported"] == 3
    routed = local.post("/api/sessions", json={
        "mode": "P2M", "route_key": "business", "name": "Shop", "amount_paise": 49900
    })
    assert routed.status_code == 201, routed.text
    data = routed.json()
    assert data["vpa"] == "shop@upi"
    assert data["mcc"] == "5411"
    assert data["financially_verified"] is False
    assert "pa=shop%40upi" in data["payment_uri"]
    personal = local.post("/api/sessions", json={
        "mode": "P2P", "route_key": "primary", "name": "Person", "amount_paise": 100
    })
    assert personal.status_code == 201
    assert personal.json()["mcc"] is None
    assert local.post("/api/sessions", json={
        "mode": "P2M", "route_key": "missing", "name": "Shop", "amount_paise": 100
    }).status_code == 422
    assert local.post("/api/sessions", json={
        "mode": "P2M", "route_key": "business", "vpa": "attacker@upi", "amount_paise": 100
    }).status_code == 422


def test_admin_proxy_spoof_and_unconfigured_fail_closed(client, monkeypatch):
    from fastapi.testclient import TestClient
    monkeypatch.setenv("PDEP_ADMIN_TOKEN", "test-admin-token-with-at-least-32-chars")
    monkeypatch.setenv("PDEP_ADMIN_IP_ALLOWLIST", "203.0.113.5/32")
    local = TestClient(client.app, client=("198.51.100.10", 50000))
    response = local.get("/api/admin/vpas", headers={
        "Authorization": "Bearer test-admin-token-with-at-least-32-chars",
        "X-Forwarded-For": "203.0.113.5",
    })
    assert response.status_code == 403
    monkeypatch.delenv("PDEP_ADMIN_IP_ALLOWLIST")
    assert local.get("/api/admin/vpas").status_code == 503


def test_import_rejects_bad_csv_and_formulas(client, monkeypatch):
    from fastapi.testclient import TestClient
    monkeypatch.setenv("PDEP_ADMIN_TOKEN", "test-admin-token-with-at-least-32-chars")
    monkeypatch.setenv("PDEP_ADMIN_IP_ALLOWLIST", "127.0.0.1/32")
    local = TestClient(client.app, client=("127.0.0.1", 50000))
    headers = {"Authorization": "Bearer test-admin-token-with-at-least-32-chars"}
    malformed = "route_key,mode,vpa,mcc,priority,enabled\nprimary,P2M,NOT_A_VPA,,1,true\n"
    response = local.post("/api/admin/vpas/import", headers=headers,
                          files={"file": ("routes.csv", malformed, "text/csv")})
    assert response.status_code == 422
    from openpyxl import Workbook
    from io import BytesIO
    wb = Workbook()
    ws = wb.active
    ws.append(["route_key", "mode", "vpa", "mcc", "priority", "enabled"])
    ws.append(["business", "P2M", "=HYPERLINK(\"https://example.invalid\")", None, 1, "true"])
    out = BytesIO()
    wb.save(out)
    out.seek(0)
    response = local.post("/api/admin/vpas/import", headers=headers, files={
        "file": ("routes.xlsx", out, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    })
    assert response.status_code == 422


def test_forged_client_callback_never_verifies_debit(client):
    session, path, headers = create(client)
    for event in ("UPI_LAUNCH_ATTEMPTED", "BROWSER_RESUMED", "PAYER_CLAIMED_PAID", "PAYER_CANCELLED"):
        result = client.post(path + "/observe", headers=headers, json={"event": event})
        assert result.status_code == 200
        assert result.json()["financially_verified"] is False
    assert client.get(path, headers=headers).json()["financially_verified"] is False


def test_p2p_direct_does_not_require_route_or_mcc(client):
    result = client.post("/api/sessions", json={
        "mode": "P2P", "vpa": "recipient@upi", "name": "Recipient",
        "amount_paise": 100, "mcc": None, "route_key": None
    })
    assert result.status_code == 201, result.text
    data = result.json()
    assert data["vpa"] == "recipient@upi"
    assert data["mcc"] is None
    assert "mc=" not in data["payment_uri"]
    assert data["financially_verified"] is False


def test_saas_appearance_admin_and_observations(client, monkeypatch):
    from fastapi.testclient import TestClient
    monkeypatch.setenv("PDEP_ADMIN_TOKEN", "test-admin-token-with-at-least-32-chars")
    monkeypatch.setenv("PDEP_ADMIN_IP_ALLOWLIST", "127.0.0.1/32")
    local = TestClient(client.app, client=("127.0.0.1", 50000))
    headers = {"Authorization": "Bearer test-admin-token-with-at-least-32-chars"}
    public = local.get("/api/appearance")
    assert public.status_code == 200
    assert public.json()["theme"] == "midnight"
    assert local.get("/api/admin/overview").status_code == 401
    assert local.get("/api/admin/overview", headers=headers).status_code == 200
    appearance = {"brand_name": "StudioPay", "headline": "Pay securely",
                  "accent": "#06B6D4", "theme": "aurora", "logo_letter": "S"}
    updated = local.put("/api/admin/appearance", headers=headers, json=appearance)
    assert updated.status_code == 200, updated.text
    assert local.get("/api/appearance").json() == appearance
    bad = {**appearance, "accent": "#000000"}
    assert local.put("/api/admin/appearance", headers=headers, json=bad).status_code == 422
    assert local.get("/api/appearance").json() == appearance
    overview = local.get("/api/admin/overview", headers=headers).json()
    assert overview["financially_verified"] == 0
