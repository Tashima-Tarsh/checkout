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
    asset = "/assets/checkout.js?v=clean-checkout-2"
    assert asset in page.text
    assert client.get(asset).status_code == 200
    assert client.get('/assets/return-callback.mjs?v=1').status_code == 200
    assert "Agentic Pay" in page.text


def test_diagnostics_have_separate_path():
    client = TestClient(app)
    assert client.get("/checkout/invalid/diagnostics").status_code == 404
    assert client.get("/checkout/" + "a" * 48 + "/diagnostics").status_code == 200


def test_public_test_checkout_is_opt_in_read_only_and_exact_amount(monkeypatch, tmp_path):
    from sqlalchemy import create_engine, select, func
    from checkout.agentic_api import now
    from checkout.agentic_storage import accounts, amount_reservations, merchants, metadata, orders

    engine = create_engine("sqlite:///" + str(tmp_path / "test-checkout.db"))
    metadata.create_all(engine)
    merchant, account, order_id = "a" * 32, "b" * 32, "c" * 48
    try:
        monkeypatch.setattr(app.state, "engine", engine, raising=False)
        client = TestClient(app, follow_redirects=False)
        monkeypatch.delenv("AGENTIC_TEST_ORDER_ID", raising=False)
        assert client.get("/agenticcheckouttest").status_code == 404
        monkeypatch.setenv("AGENTIC_TEST_ORDER_ID", "https://example.invalid/")
        assert client.get("/agenticcheckouttest").status_code == 404
        monkeypatch.setenv("AGENTIC_TEST_ORDER_ID", order_id)
        assert client.get("/agenticcheckouttest").status_code == 404
        with engine.begin() as conn:
            conn.execute(merchants.insert().values(id=merchant, name="fixture", token_hash="d" * 64))
            conn.execute(accounts.insert().values(id=account, merchant_id=merchant, vpa="fixture@example",
                bank="fixture", holder="fixture", account_cipher="fixture", mobile_cipher="fixture",
                last4="0000", account_type="PERSONAL"))
            conn.execute(orders.insert().values(id=order_id, merchant_id=merchant, account_id=account,
                amount_minor=100, created=now(), expires=now()+1800, status="AWAITING_PAYMENT"))
        assert client.get("/agenticcheckouttest").status_code == 404
        with engine.begin() as conn:
            conn.execute(amount_reservations.insert().values(order_id=order_id, account_id=account, payable_minor=101))
        assert client.get("/agenticcheckouttest").status_code == 404
        with engine.begin() as conn:
            conn.execute(amount_reservations.update().values(payable_minor=100))
        for _ in range(3):
            response = client.get("/agenticcheckouttest")
            assert response.status_code == 303
            assert response.headers["location"] == "/checkout/" + order_id
            assert response.headers["cache-control"] == "no-store"
        with engine.begin() as conn:
            assert conn.scalar(select(func.count()).select_from(orders)) == 1
            assert conn.scalar(select(func.count()).select_from(amount_reservations)) == 1
            assert conn.scalar(select(orders.c.status)) == "AWAITING_PAYMENT"
            conn.execute(orders.update().values(expires=now()-1))
        assert client.get("/agenticcheckouttest").status_code == 410
        with engine.begin() as conn:
            conn.execute(orders.update().values(expires=now()+1800, status="PENDING"))
        assert client.get("/agenticcheckouttest").status_code == 410
    finally:
        engine.dispose()
