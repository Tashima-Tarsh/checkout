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
    assert params == {"pa": ["person@upi"], "pn": ["Person"], "am": ["499.00"], "cu": ["INR"]}
    assert session["token"] not in session["payment_uri"]
    assert client.get(path, params={"token": session["token"]}).status_code == 401
    assert client.get(path + "/qr.png", headers=headers).content.startswith(b"\x89PNG")
    assert "token" not in client.get(path, headers=headers).json()
    _, _, another_token = create(client)
    assert client.get(path, headers=another_token).status_code == 404


@pytest.mark.parametrize("mcc", [None, "5411"])
def test_p2m(client, mcc):
    session, _, _ = create(client, "P2M", mcc)
    assert parse_qs(urlsplit(session["payment_uri"]).query).get("mc") == ([mcc] if mcc else None)


def test_personal_payment_uri_escapes_name_and_ignores_stale_mcc():
    from checkout.server import uri

    payment_uri = uri({"id": "internal", "mode": "P2P", "vpa": "person@upi",
                       "name": "A & B + Café", "amount": 100, "mcc": "5411"})
    assert payment_uri == (
        "upi://pay?pa=person%40upi&pn=A%20%26%20B%20%2B%20Caf%C3%A9&am=1.00&cu=INR"
    )


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
    assert public.json()["theme"] == "light"
    assert local.get("/api/admin/overview").status_code == 401
    assert local.get("/api/admin/overview", headers=headers).status_code == 200
    appearance = {"brand_name": "StudioPay", "headline": "Pay securely",
                  "accent": "#06B6D4", "theme": "lilac", "logo_letter": "S"}
    updated = local.put("/api/admin/appearance", headers=headers, json=appearance)
    assert updated.status_code == 200, updated.text
    assert local.get("/api/appearance").json() == appearance
    bad = {**appearance, "accent": "#000000"}
    assert local.put("/api/admin/appearance", headers=headers, json=bad).status_code == 422
    assert local.get("/api/appearance").json() == appearance
    overview = local.get("/api/admin/overview", headers=headers).json()
    assert overview["financially_verified"] == 0


def test_mobile_share_text_digest_and_dedup(client):
    from checkout.storage import mobile_evidence
    _, path, headers = create(client)
    text = "UPI debit message voluntarily copied by payer"
    response = client.post(path + "/evidence", headers=headers,
                           data={"source": "sms_paste", "text": text})
    assert response.status_code == 200, response.text
    assert response.json()["accepted"] is True
    assert response.json()["financially_verified"] is False
    again = client.post(path + "/evidence", headers=headers,
                        data={"source": "sms_paste", "text": text})
    assert again.status_code == 200
    assert again.json()["duplicate"] is True
    with client.app.state.engine.connect() as conn:
        stored = conn.execute(mobile_evidence.select()).mappings().all()
    assert len(stored) == 1
    assert stored[0]["evidence_hash"] != text
    assert text not in str(dict(stored[0]))
    assert client.get(path + "/evidence", headers=headers).json()["financially_verified"] is False


def test_mobile_evidence_rejects_oversized_and_bad_types(client):
    _, path, headers = create(client)
    bad = client.post(path + "/evidence", headers=headers, data={
        "source": "app_share", "text": "fake notification"},
        files={"file": ("fake.png", b"not a file", "image/png")})
    assert bad.status_code == 422
    empty = client.post(path + "/evidence", headers=headers,
                        data={"source": "sms_paste", "text": ""})
    assert empty.status_code == 422
    oversize = client.post(path + "/evidence", headers=headers,
        files={"file": ("huge.png", b"x"*(2*1024*1024+1), "image/png")})
    assert oversize.status_code == 413
    unsupported = client.post(path + "/evidence", headers=headers,
        files={"file": ("receipt.exe", b"not safe", "application/octet-stream")})
    assert unsupported.status_code == 415


def test_mobile_evidence_auth_and_expiration(client):
    from checkout.storage import sessions
    _, path, headers = create(client)
    assert client.post(path + "/evidence", data={"text": "fake"}).status_code == 401
    with client.app.state.engine.begin() as conn:
        conn.execute(sessions.update().values(expires=1))
    result = client.post(path + "/evidence", data={"text": "fake"}, headers=headers)
    assert result.status_code == 410


def test_admin_checkout_feed_is_authorized(client, monkeypatch):
    from fastapi.testclient import TestClient
    monkeypatch.setenv("PDEP_ADMIN_TOKEN", "test-admin-token-with-at-least-32-chars")
    monkeypatch.setenv("PDEP_ADMIN_IP_ALLOWLIST", "127.0.0.1/32")
    local = TestClient(client.app, client=("127.0.0.1", 50000))
    assert local.get("/api/admin/checkouts").status_code == 401
    session, _, _ = create(client)
    headers = {"Authorization": "Bearer test-admin-token-with-at-least-32-chars"}
    response = local.get("/api/admin/checkouts", headers=headers)
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["items"][0]["session_id"] == session["session_id"]
    assert "token" not in data["items"][0]
    assert data["items"][0]["financially_verified"] is False
    assert local.get("/api/admin/checkouts?limit=500", headers=headers).status_code == 422
