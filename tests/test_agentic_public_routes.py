from fastapi.testclient import TestClient

from checkout.agentic_app import app


def test_public_entry_points_use_existing_workspace():
    client = TestClient(app, follow_redirects=False)

    for path, target in (("/", "/merchant"), ("/admin", "/owner"), ("/admin/", "/owner")):
        response = client.get(path)
        assert response.status_code == 307
        assert response.headers["location"] == target
        assert response.headers["cache-control"] == "no-store"
        assert client.get(target).status_code == 200


def test_checkout_uses_existing_customer_assets_and_valid_identifier_shape():
    client = TestClient(app)
    assert client.get("/checkout/invalid").status_code == 404
    page = client.get("/checkout/" + "a" * 48)
    assert page.status_code == 200
    asset = "/assets/checkout.js?v=clean-checkout-1"
    assert asset in page.text
    assert client.get(asset).status_code == 200
    assert client.get('/assets/return-callback.mjs?v=1').status_code == 200
    assert "Agentic Pay" in page.text


def test_diagnostics_have_separate_path():
    client = TestClient(app)
    assert client.get("/checkout/invalid/diagnostics").status_code == 404
    assert client.get("/checkout/" + "a" * 48 + "/diagnostics").status_code == 200
