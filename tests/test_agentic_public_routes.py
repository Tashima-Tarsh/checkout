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
    asset = "/assets/checkout.js?v=clean-checkout-7"
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
        monkeypatch.delenv("AGENTIC_TEST_AUTO", raising=False)
        monkeypatch.delenv("AGENTIC_TEST_AMOUNT_MINOR", raising=False)
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
        monkeypatch.setenv("AGENTIC_TEST_AMOUNT_MINOR", "101")
        assert client.get("/agenticcheckouttest").status_code == 303
        for invalid in ("0", "1.01", "200", "-101", "abc"):
            # 200 is syntactically valid but must not match the reserved 101.
            monkeypatch.setenv("AGENTIC_TEST_AMOUNT_MINOR", invalid)
            assert client.get("/agenticcheckouttest").status_code == 404
        monkeypatch.setenv("AGENTIC_TEST_AMOUNT_MINOR", "101")
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


def test_automatic_test_checkout_allocates_distinct_amounts_and_reuses_session(monkeypatch, tmp_path):
    from sqlalchemy import create_engine, select, func
    from checkout.agentic_api import now
    from checkout.agentic_storage import accounts, amount_reservations, merchants, metadata, orders

    engine = create_engine("sqlite:///" + str(tmp_path / "auto-checkout.db"))
    metadata.create_all(engine)
    merchant, account = "a"*32, "b"*32
    origin = "https://agenticpay.thenitishkr.in"
    try:
        monkeypatch.setattr(app.state, "engine", engine, raising=False)
        monkeypatch.setattr(app.state, "owner_token_hash", "f"*64, raising=False)
        monkeypatch.setenv("AGENTIC_LOGIN_MERCHANT_ID", merchant)
        monkeypatch.setenv("AGENTIC_TEST_AUTO", "1")
        monkeypatch.delenv("AGENTIC_TEST_SHARED_AMOUNT", raising=False)
        with engine.begin() as conn:
            conn.execute(merchants.insert().values(id=merchant, name="fixture", token_hash="d"*64))
            conn.execute(accounts.insert().values(id=account, merchant_id=merchant, vpa="fixture@example",
                bank="fixture", holder="fixture", account_cipher="fixture", mobile_cipher="fixture",
                last4="0000", account_type="PERSONAL"))
            conn.execute(orders.insert().values(id="e"*48, merchant_id=merchant, account_id=account,
                amount_minor=100, created=now()-7200, expires=now()-3600, status="AWAITING_PAYMENT"))
        clients = [TestClient(app, base_url=origin, follow_redirects=False) for _ in range(2)]
        paths = []
        for client in clients:
            assert client.post("/api/agenticcheckouttest", headers={"origin":origin}).status_code == 403
            page = client.get("/agenticcheckouttest")
            assert page.status_code == 200
            assert "/assets/test-checkout-entry.js" in page.text
            assert client.post("/api/agenticcheckouttest", headers={"origin":"https://example.invalid"}).status_code == 403
            with engine.connect() as conn:
                assert conn.scalar(select(func.count()).select_from(amount_reservations)) == len(paths)
            result = client.post("/api/agenticcheckouttest", headers={"origin":origin})
            assert result.status_code == 200
            path = result.json()["checkout_path"]
            assert client.post("/api/agenticcheckouttest", headers={"origin":origin}).json()["checkout_path"] == path
            assert client.get("/agenticcheckouttest").headers["location"] == path
            paths.append(path)
        assert paths[0] != paths[1]
        with engine.connect() as conn:
            assert set(conn.scalars(select(amount_reservations.c.payable_minor))) == {101,102}
            assert conn.scalar(select(func.count()).select_from(orders)) == 3
        with engine.begin() as conn:
            conn.execute(orders.update().where(orders.c.id == paths[0].split("/")[-1]).values(status="PENDING"))
        assert clients[0].get("/agenticcheckouttest").status_code == 200
        fresh = clients[0].post("/api/agenticcheckouttest", headers={"origin":origin}).json()["checkout_path"]
        assert fresh not in paths
        assert clients[0].get("/api"+fresh).json()["amount_minor"] == 103
        monkeypatch.setenv("AGENTIC_TEST_AUTO", "0")
        assert clients[0].post("/api/agenticcheckouttest", headers={"origin":origin}).status_code == 404
    finally:
        engine.dispose()


def test_shared_uat_amount_has_no_pool_exhaustion_and_cannot_consume_evidence(monkeypatch, tmp_path):
    from sqlalchemy import create_engine, select, func
    from checkout.agentic_api import now, unused_payable
    from checkout.agentic_replay import reserve_reference
    from checkout.agentic_storage import accounts, amount_reservations, merchants, metadata, orders, shared_test_orders
    engine = create_engine("sqlite:///" + str(tmp_path / "shared-test.db"))
    metadata.create_all(engine)
    merchant, account = "a"*32, "b"*32
    origin = "https://agenticpay.thenitishkr.in"
    try:
        monkeypatch.setattr(app.state, "engine", engine, raising=False)
        monkeypatch.setattr(app.state, "owner_token_hash", "f"*64, raising=False)
        monkeypatch.setenv("AGENTIC_LOGIN_MERCHANT_ID", merchant)
        monkeypatch.setenv("AGENTIC_TEST_AUTO", "1")
        monkeypatch.setenv("AGENTIC_TEST_SHARED_AMOUNT", "1")
        monkeypatch.setenv("AGENTIC_TEST_AMOUNT_MINOR", "100")
        with engine.begin() as conn:
            conn.execute(merchants.insert().values(id=merchant,name="fixture",token_hash="d"*64))
            conn.execute(accounts.insert().values(id=account,merchant_id=merchant,vpa="fixture@example",
                bank="fixture",holder="fixture",account_cipher="fixture",mobile_cipher="fixture",
                last4="0000",account_type="PERSONAL"))
            conn.execute(orders.insert(), [dict(id=format(v,"048x"), merchant_id=merchant,
                account_id=account,amount_minor=v,created=now()-7200,expires=now()-3600,
                status="AWAITING_PAYMENT") for v in range(100,200)])
            conn.execute(amount_reservations.insert(), [dict(order_id=format(v,"048x"),
                account_id=account,payable_minor=v) for v in range(100,200)])
        ids = []
        # Do not enter app lifespan: use isolated fixture engine as above.
        for _ in range(2):
            client = TestClient(app,base_url=origin,follow_redirects=False)
            assert client.get("/agenticcheckouttest").status_code == 200
            result = client.post("/api/agenticcheckouttest",headers={"origin":origin})
            assert result.status_code == 200
            path = result.json()["checkout_path"]
            assert client.get("/api"+path).json()["amount_minor"] == 100
            assert client.post("/api/agenticcheckouttest",headers={"origin":origin}).json()["checkout_path"] == path
            assert client.post("/api"+path+"/verify").status_code == 202
            ids.append(path.split("/")[-1])
        assert len(set(ids)) == 2
        with engine.begin() as conn:
            assert conn.scalar(select(func.count()).select_from(amount_reservations)) == 100
            assert set(conn.scalars(select(shared_test_orders.c.order_id))) == set(ids)
            assert unused_payable(conn,account,100,100) is None
            for oid in ids:
                assert reserve_reference(conn,order_id=oid,merchant_id=merchant,
                    account_id=account,reference="123456789012",now=now()) == "ORDER_NOT_ELIGIBLE"
    finally:
        engine.dispose()


def test_split_screen_research_isolated_from_payment_checkout():
    client = TestClient(app)
    page = client.get("/research/split-screen")
    assert page.status_code == 200
    assert "synthetic pixel test" in page.text
    assert "/assets/split-screen-pixel-ui.mjs" in page.text
    assert "display-capture=(self)" in page.headers["permissions-policy"]
    assert "default-src 'self'" in page.headers["content-security-policy"]
    assert client.get("/assets/split-screen-pixel-ui.mjs").status_code == 200
    assert client.get("/assets/split-screen-pixel-probe.mjs").status_code == 200
    assert client.post("/research/split-screen").status_code == 405
    assert "/research/split-screen" not in client.get("/checkout/" + "a"*48).text


def test_vision_permission_uat_isolated():
    client = TestClient(app)
    page = client.get("/research/vision-uat")
    assert page.status_code == 200
    assert "Synthetic test only" in page.text
    assert "/assets/vision-uat.js" in page.text
    assert "connect-src 'none'" in page.headers["content-security-policy"]
    assert "display-capture=(self)" in page.headers["permissions-policy"]
    assert client.get("/assets/vision-uat.js").status_code == 200
    assert client.post("/research/vision-uat").status_code == 405
    assert "/research/vision-uat" not in client.get("/checkout/" + "a"*48).text


def test_existing_uat_alias_synthetic_demo_mode(monkeypatch):
    monkeypatch.setenv("AGENTIC_TEST_VISION_DEMO", "1")
    monkeypatch.setenv("AGENTIC_TEST_AUTO", "1")
    client = TestClient(app)
    page = client.get("/agenticcheckouttest")
    assert page.status_code == 200
    assert "Synthetic test only" in page.text
    assert "/assets/vision-uat.js" in page.text
    assert "connect-src 'none'" in page.headers["content-security-policy"]
    assert "display-capture=(self)" in page.headers["permissions-policy"]
    assert client.post("/api/agenticcheckouttest").status_code == 404
    monkeypatch.setenv("AGENTIC_TEST_VISION_DEMO", "0")
    monkeypatch.setenv("AGENTIC_TEST_AUTO", "0")
    monkeypatch.delenv("AGENTIC_TEST_ORDER_ID", raising=False)
    assert client.get("/agenticcheckouttest").status_code == 404
