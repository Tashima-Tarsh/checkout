from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from checkout.agentic_app import app
from checkout.agentic_api import digest
from checkout.agentic_storage import metadata, merchants

TABS = ("overview", "requests", "transactions", "trust", "ledger", "analytics", "incidents", "infrastructure", "integrations", "settings")

def test_owner_dashboard_authorization_and_queries(tmp_path, monkeypatch):
    engine = create_engine("sqlite:///" + str(tmp_path / "dashboard.db"))
    metadata.create_all(engine)
    token = "a" * 43
    monkeypatch.setattr(app.state, "engine", engine, raising=False)
    monkeypatch.setattr(app.state, "owner_token_hash", digest(token), raising=False)
    with engine.begin() as conn:
        conn.execute(merchants.insert().values(id="b"*32, name="Fixture merchant", token_hash=digest("c"*43)))
    client = TestClient(app)
    try:
        for tab in TABS:
            path = "/api/owner/dashboard/" + tab
            assert client.get(path).status_code == 401
            assert client.get(path, headers={"Authorization": "Bearer " + "c"*43}).status_code == 401
            response = client.get(path, headers={"Authorization": "Bearer " + token})
            assert response.status_code == 200, response.text
            assert isinstance(response.json()["rows"], list)
        assert client.get("/api/owner/dashboard/unknown", headers={"Authorization": "Bearer "+token}).status_code == 404
        assert "QUERY_OK" in client.get("/api/owner/dashboard/infrastructure", headers={"Authorization": "Bearer "+token}).text
        for tab in TABS[1:]:
            assert 'id="owner-data-'+tab+'"' in client.get("/owner").text
    finally:
        engine.dispose()
