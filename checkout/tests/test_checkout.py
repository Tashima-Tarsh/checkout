import importlib,pytest
from fastapi.testclient import TestClient
@pytest.fixture
def client(tmp_path,monkeypatch):
    monkeypatch.setenv('PDEP_DB',str(tmp_path/'session.sqlite3'));monkeypatch.setenv('PDEP_DEMO_MODE','1')
    import checkout.server as server
    importlib.reload(server)
    return TestClient(server.app)
def create(c,mode='P2P',mcc=None):
    r=c.post('/api/sessions',json=dict(mode=mode,vpa='person@upi',name='Person',amount_paise=49900,mcc=mcc))
    assert r.status_code==201
    return r.json()
def test_p2p_qr(client):
    s=create(client)
    assert not s['financially_verified']
    assert client.get('/api/sessions/'+s['session_id']+'/qr.png?token='+s['token']).content.startswith(b'\x89PNG')
def test_p2m(client):
    assert 'mc=5411' in create(client,'P2M','5411')['payment_uri']
def test_callback_not_verified(client):
    s=create(client)
    r=client.post('/api/sessions/'+s['session_id']+'/observe?token='+s['token'],json={'event':'BROWSER_RESUMED'})
    assert r.json()['state']=='UNVERIFIED' and r.json()['financially_verified'] is False
def test_synthetic_not_real(client):
    s=create(client);url='/api/sessions/'+s['session_id'];token='?token='+s['token']
    receipt=client.post('/api/demo'+url+'/issue-test-proof'+token).json()['receipt']
    a=client.post(url+'/proof'+token,json={'receipt':receipt}).json()
    assert a['test_attested'] and not a['financially_verified']
    b=client.post(url+'/proof'+token,json={'receipt':receipt}).json()
    assert b['result']=='REPLAY'
