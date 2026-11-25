import pytest
from cryptography.fernet import Fernet
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.pool import StaticPool

from checkout import agentic_app
from checkout.agentic_api import digest
from checkout.agentic_storage import accounts, agent_sessions, isolated_database_url, jobs, merchants, metadata
from checkout.agentic_worker import dispatch_next


@pytest.fixture
def api(monkeypatch):
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    metadata.create_all(engine)
    monkeypatch.setattr(agentic_app, "make_engine", lambda: engine)
    monkeypatch.setattr(agentic_app, "initialize", lambda _: None)
    monkeypatch.setenv("AGENTIC_OWNER_TOKEN", "a" * 43)
    key = Fernet.generate_key()
    monkeypatch.setenv("AGENTIC_ACCOUNT_KEY", key.decode())
    with TestClient(agentic_app.app) as client:
        yield client, engine, key


def owner():
    return {"Authorization": "Bearer " + "a" * 43}


def merchant(client, name):
    response = client.post("/api/owner/merchants", json={"name": name}, headers=owner())
    assert response.status_code == 201
    return {"Authorization": "Bearer " + response.json()["token"]}


def account(vpa="first@example"):
    return {
        "upi_id": vpa, "bank_name": "Test Bank", "account_holder": "Test Holder",
        "receiving_account_number": "00000123456", "registered_mobile": "0000000123",
        "account_type": "PERSONAL", "mcc": "",
    }


def test_database_guard_ignores_legacy_database_url(monkeypatch):
    monkeypatch.delenv("AGENTIC_DATABASE_URL", raising=False)
    monkeypatch.setenv("DATABASE_URL", "postgresql://legacy:legacy@localhost/checkout")
    with pytest.raises(RuntimeError, match="AGENTIC_DATABASE_URL"):
        isolated_database_url()
    monkeypatch.setenv("AGENTIC_DATABASE_URL", "postgresql://legacy:legacy@localhost/checkout")
    with pytest.raises(RuntimeError, match="dedicated PostgreSQL"):
        isolated_database_url()


def test_clean_bootstrap_encryption_atomic_import_and_isolation(api):
    client, engine, key = api
    assert client.get("/api/owner/merchants", headers=owner()).json() == []
    assert client.get("/api/accounts").status_code == 401
    first = merchant(client, "First Merchant")
    second = merchant(client, "Second Merchant")
    assert client.get("/api/owner/merchants", headers=second).status_code == 401
    assert client.post("/api/accounts", headers=first, json=[account()]).status_code == 201
    header = ",".join(account().keys())
    csv = "\n".join([header, ",".join(account("second@example").values()), ",".join(account().values())])
    response = client.post("/api/accounts/import", headers=first, content=csv)
    assert response.status_code == 409
    assert client.get("/api/accounts", headers=second).json() == []
    rows = client.get("/api/agents", headers=first).json()
    assert len(rows) == 1 and rows[0]["state"] == "AUTH_REQUIRED"
    with engine.connect() as conn:
        row = conn.execute(select(accounts)).mappings().one()
        assert Fernet(key).decrypt(row["account_cipher"].encode()).decode() == "00000123456"
        assert Fernet(key).decrypt(row["mobile_cipher"].encode()).decode() == "0000000123"
        assert conn.execute(select(agent_sessions)).mappings().one()["account_id"] == row["id"]
        assert conn.execute(select(merchants)).mappings().first()["token_hash"] == digest(first["Authorization"].split()[-1])


def test_customer_checkout_is_idempotent_and_only_pending(api):
    client, engine, _ = api
    first = merchant(client, "First Merchant")
    second = merchant(client, "Second Merchant")
    assert client.post("/api/accounts", headers=first, json=[account()]).status_code == 201
    account_id = client.get("/api/accounts", headers=first).json()[0]["id"]
    payload = {"account_id": account_id, "amount_minor": 500}
    assert client.post("/api/orders", headers=second, json=payload).status_code == 404
    path = client.post("/api/orders", headers=first, json=payload).json()["checkout_path"]
    assert client.get(path).status_code == 200
    assert client.get("/api" + path).json()["upi_id"] == "first@example"
    for _ in range(2):
        result = client.post("/api" + path + "/verify", )
        assert result.status_code == 202
        assert result.json() == {"status": "PENDING", "financially_verified": False}

    class Provider:
        def dispatch(self, order_id, assigned_account_id):
            assert order_id == path.split("/")[-1]
            assert assigned_account_id == account_id

    assert dispatch_next(engine, Provider())
    assert not dispatch_next(engine, Provider())
    with engine.connect() as conn:
        assert conn.execute(select(jobs)).mappings().one()["dispatched"] == 1
    assert client.get("/api" + path).json()["status"] == "PENDING"
    assert client.get("/api/orders", headers=second).json() == []


def test_invalid_account_payload_is_redacted(api):
    client, _, _ = api
    headers = merchant(client, "First Merchant")
    item = dict(account(), registered_mobile="secret-invalid-value")
    response = client.post("/api/accounts", headers=headers, json=[item])
    assert response.status_code == 422
    assert response.json() == {"detail": "Invalid request input"}


def test_thousand_accounts_get_unique_logical_agents(api):
    client, _, _ = api
    headers = merchant(client, "Scale Fixture")
    items = [account(f"fixture-{number}@example") for number in range(1000)]
    result = client.post("/api/accounts", headers=headers, json=items)
    assert result.status_code == 201
    agents = client.get("/api/agents", headers=headers).json()
    assert len({row["agent_id"] for row in agents}) == 1000
    assert {row["state"] for row in agents} == {"AUTH_REQUIRED"}
    assert client.post("/api/accounts", headers=headers, json=[account()]).status_code == 409


def test_email_session_is_revocable_and_scoped(api, monkeypatch):
    from checkout.agentic_login import COOKIE, EMAIL, ORIGIN, PasswordLogin, configure

    client, engine, _ = api
    first = merchant(client, "UAT Merchant")
    second = merchant(client, "Other Merchant")
    assert client.post("/api/accounts", headers=first, json=[account()]).status_code == 201
    assert client.post("/api/accounts", headers=second, json=[account("other@example")]).status_code == 201
    merchant_id = client.get("/api/owner/merchants", headers=owner()).json()[0]["id"]
    password = "fixture-password-for-ci"
    monkeypatch.setenv("AGENTIC_LOGIN_PASSWORD", password)
    monkeypatch.setenv("AGENTIC_LOGIN_MERCHANT_ID", merchant_id)
    agentic_app.app.state.password_login = configure(engine, "a" * 43)
    browser = TestClient(agentic_app.app, base_url=ORIGIN)
    origin = {"Origin": ORIGIN}
    credentials = {"email": EMAIL, "password": password}
    assert browser.post("/api/auth/login", json=credentials).status_code == 403
    assert browser.post("/api/auth/login", headers=origin, json=dict(credentials, password="incorrect")).status_code == 401
    result = browser.post("/api/auth/login", headers=origin, json=credentials)
    assert result.status_code == 204
    cookie = result.headers["set-cookie"]
    assert all(value in cookie for value in (COOKIE, "HttpOnly", "Secure", "SameSite=strict"))
    assert len(browser.get("/api/owner/merchants").json()) == 2
    assert {row["vpa"] for row in browser.get("/api/accounts").json()} == {"first@example"}
    assert {row["vpa"] for row in browser.get("/api/agents").json()} == {"first@example"}
    assert browser.post("/api/accounts", json=[account("blocked@example")]).status_code == 403
    assert browser.get("/api/owner/merchants", headers=second).status_code == 401
    old_cookie = browser.cookies.get(COOKIE)
    assert browser.post("/api/auth/logout", headers=origin).status_code == 204
    assert browser.get("/api/agents", headers={"Cookie": f"{COOKIE}={old_cookie}"}).status_code == 401
    assert browser.post("/api/auth/login", headers=origin, json=credentials).status_code == 204
    agentic_app.app.state.password_login = PasswordLogin(password + "-rotated", "a" * 43, merchant_id)
    assert browser.get("/api/agents").status_code == 401

def test_no_input_and_unique_discount_reservations(api, monkeypatch):
    client, engine, _ = api
    headers = merchant(client, "Reservation merchant")
    assert client.post("/api/accounts", headers=headers, json=[account()]).status_code == 201
    aid = client.get("/api/accounts", headers=headers).json()[0]["id"]
    payload = dict(account_id=aid, amount_minor=4900, max_discount_minor=1)
    first = client.post("/api/orders", headers=headers, json=payload).json()
    second = client.post("/api/orders", headers=headers, json=payload).json()
    assert (first["payable_minor"], second["payable_minor"]) == (4900,4899)
    assert second["discount_minor"] == 1
    path = "/api" + second["checkout_path"]
    assert client.get(path).json()["amount_minor"] == 4899
    assert client.post(path+"/verify").json() == {"status":"PENDING","financially_verified":False}
    assert client.post(path+"/verify").status_code == 202
    assert client.post("/api/orders", headers=headers, json=payload).status_code == 409
    # Overlapping original prices cannot allocate the same payable amount.
    assert client.post("/api/orders", headers=headers, json=dict(payload,amount_minor=4899,max_discount_minor=0)).status_code == 409
    from checkout.agentic_storage import orders
    with engine.begin() as conn:
        conn.execute(orders.update().values(expires=1))
    assert client.post("/api/orders", headers=headers, json=payload).status_code == 409


def test_checkout_expiry_and_terminal_state_close_public_access(api):
    from checkout.agentic_api import now
    from checkout.agentic_storage import orders, amount_reservations
    from sqlalchemy import func

    client, engine, _ = api
    headers = merchant(client, "Expiry fixture")
    assert client.post("/api/accounts", headers=headers, json=[account()]).status_code == 201
    aid = client.get("/api/accounts", headers=headers).json()[0]["id"]
    for amount, state, expired in [(101, "AWAITING_PAYMENT", True), (102, "PENDING", True),
                                   (103, "PAID", False)]:
        data = client.post("/api/orders", headers=headers,
            json={"account_id": aid, "amount_minor": amount}).json()
        path = "/api" + data["checkout_path"]
        if state == "PENDING":
            assert client.post(path+"/verify").status_code == 202
        with engine.begin() as conn:
            conn.execute(orders.update().where(orders.c.id == data["id"]).values(
                status=state, expires=now()-1 if expired else now()+1800))
        response = client.get(path)
        assert response.status_code == 410
        assert "upi_id" not in response.json()
        assert client.post(path+"/verify").status_code == 410
    with engine.connect() as conn:
        assert conn.scalar(select(func.count()).select_from(orders)) == 3
        assert conn.scalar(select(func.count()).select_from(amount_reservations)) == 3
        assert conn.scalar(select(func.count()).select_from(jobs)) == 1


def test_worker_skips_expired_and_terminal_orders(api):
    from checkout.agentic_storage import orders
    from checkout.agentic_api import now
    client, engine, _ = api
    headers = merchant(client, "Worker fixture")
    assert client.post("/api/accounts", headers=headers, json=[account()]).status_code == 201
    aid = client.get("/api/accounts", headers=headers).json()[0]["id"]
    ids = []
    for amount in (501, 502, 503):
        created = client.post("/api/orders", headers=headers, json={
            "account_id": aid, "amount_minor": amount}).json()
        assert client.post("/api" + created["checkout_path"] + "/verify").status_code == 202
        ids.append(created["id"])
    with engine.begin() as conn:
        conn.execute(orders.update().where(orders.c.id == ids[0]).values(expires=now()-1))
        conn.execute(orders.update().where(orders.c.id == ids[1]).values(status="PAID"))
    class Provider:
        def dispatch(self, order_id, account_id):
            assert order_id == ids[2]
            assert account_id == aid
    assert dispatch_next(engine, Provider())
    assert not dispatch_next(engine, Provider())
    with engine.connect() as conn:
        assert set(conn.scalars(select(jobs.c.order_id).where(jobs.c.dispatched == 1))) == {ids[2]}


def test_expire_old_uat_links_only_preserves_records_and_new_orders(api):
    from checkout.agentic_storage import orders, amount_reservations, expire_previous_uat_links
    from checkout.agentic_api import now
    from sqlalchemy import func
    client, engine, _ = api
    first = merchant(client, "Expiry target")
    second = merchant(client, "Other merchant")
    assert client.post("/api/accounts", headers=first, json=[account()]).status_code == 201
    assert client.post("/api/accounts", headers=second, json=[account("other@example")]).status_code == 201
    first_id = client.get("/api/accounts", headers=first).json()[0]["id"]
    second_id = client.get("/api/accounts", headers=second).json()[0]["id"]
    timestamp = now()
    cutoff = timestamp - 10
    ids = []
    for index, (headers, aid) in enumerate([(first,first_id)]*4 + [(second,second_id)]):
        result = client.post("/api/orders", headers=headers, json={
            "account_id": aid, "amount_minor": 600+index}).json()
        ids.append(result["id"])
    assert client.post("/api/checkout/"+ids[1]+"/verify").status_code == 202
    with engine.begin() as conn:
        conn.execute(orders.update().where(orders.c.id.in_(ids)).values(created=cutoff-1, expires=timestamp+1000))
        conn.execute(orders.update().where(orders.c.id==ids[2]).values(status="PAID"))
        conn.execute(orders.update().where(orders.c.id==ids[3]).values(created=cutoff+1))
        merchant_id = conn.scalar(select(orders.c.merchant_id).where(orders.c.id==ids[0]))
    assert expire_previous_uat_links(engine, merchant_id=merchant_id, cutoff=cutoff, timestamp=timestamp)==2
    assert expire_previous_uat_links(engine, merchant_id=merchant_id, cutoff=cutoff, timestamp=timestamp)==0
    for i in (0,1):
        assert client.get("/api/checkout/"+ids[i]).status_code == 410
        assert client.post("/api/checkout/"+ids[i]+"/verify").status_code == 410
    for i in (3,4):
        assert client.get("/api/checkout/"+ids[i]).status_code == 200
    with engine.connect() as conn:
        assert conn.scalar(select(func.count()).select_from(orders))==5
        assert conn.scalar(select(func.count()).select_from(amount_reservations))==5
        assert conn.scalar(select(func.count()).select_from(jobs))==1
        assert conn.scalar(select(orders.c.status).where(orders.c.id==ids[2]))=="PAID"


def test_whole_rupee_shared_sessions_are_distinct_and_fail_closed(api):
    from checkout.agentic_storage import shared_test_orders, evidence_consumption, orders
    client, engine, _ = api
    headers = merchant(client, "Shared Amount Merchant")
    assert client.post("/api/accounts", headers=headers, json=[account()]).status_code == 201
    aid = client.get("/api/accounts", headers=headers).json()[0]["id"]
    payload = {"account_id": aid, "amount_minor": 100, "shared_amount": True}
    created = [client.post("/api/orders", headers=headers, json=payload) for _ in range(3)]
    assert all(r.status_code == 201 for r in created)
    ids = {r.json()["session_reference"] for r in created}
    assert len(ids) == 3
    for response in created:
        data = response.json()
        assert data["payable_minor"] == 100 and data["discount_minor"] == 0
        assert data["id"] == data["session_reference"]
        assert data["expires"] > 0
        path = "/api" + data["checkout_path"]
        info = client.get(path).json()
        assert info["amount_minor"] == 100 and info["upi_id"] == "first@example"
        assert info["shared_amount"] is True and not info["settlement"]["satisfied"]
        assert client.post(path + "/live/session", headers={"Origin": "https://agenticpay.thenitishkr.in"}).status_code == 409
    assert client.post("/api/orders", headers=headers, json=dict(payload, amount_minor=199)).status_code == 422
    assert client.post("/api/orders", headers=headers, json=dict(payload, max_discount_minor=1)).status_code == 422
    assert all(not row["settlement"]["satisfied"] for row in client.get("/api/orders", headers=headers).json())
    with engine.connect() as conn:
        assert set(conn.scalars(select(shared_test_orders.c.order_id))) == ids
        assert list(conn.scalars(select(evidence_consumption.c.order_id))) == []
        assert set(conn.scalars(select(orders.c.status))) == {"AWAITING_PAYMENT"}


def test_new_checkout_expires_after_exactly_120_seconds(api, monkeypatch):
    from checkout import agentic_api
    from checkout.agentic_storage import orders
    client, engine, _ = api
    headers = merchant(client, "Expiry Merchant")
    assert client.post("/api/accounts", headers=headers, json=[account()]).status_code == 201
    aid = client.get("/api/accounts", headers=headers).json()[0]["id"]
    clock = [1_800_000_000]
    monkeypatch.setattr(agentic_api, "now", lambda: clock[0])
    for shared, amount in [(False, 200), (True, 100)]:
        start = clock[0]
        response = client.post("/api/orders", headers=headers, json={
            "account_id": aid, "amount_minor": amount, "shared_amount": shared})
        assert response.status_code == 201
        order = response.json()
        path = "/api" + order["checkout_path"]
        with engine.connect() as conn:
            row = conn.execute(select(orders).where(orders.c.id == order["id"])).mappings().one()
            assert row["expires"] - row["created"] == 120
        if shared:
            assert order["expires"] == start + 120
        clock[0] = start + 119
        assert client.get(path).status_code == 200
        clock[0] = start + 120
        assert client.get(path).status_code == 410
        assert client.post(path + "/verify").status_code == 410
