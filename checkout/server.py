"""Browser UPI demo; no PSP, bank API or genuine debit verification."""
import io,json,os,re,secrets,sqlite3,time
from pathlib import Path
from urllib.parse import urlencode
import qrcode
from fastapi import FastAPI,HTTPException
from fastapi.responses import HTMLResponse,Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from pdep.protocol import Session,SimulatedIssuer,Verifier
ROOT=Path(__file__).parent
DB=os.environ.get('PDEP_DB',str(ROOT/'checkout.sqlite3'))
DEMO=os.environ.get('PDEP_DEMO_MODE')=='1'
ISSUER=SimulatedIssuer() if DEMO else None
VERIFIER=Verifier({'SIMULATED_ONLY':ISSUER.public()}) if DEMO else None
app=FastAPI(title='PDEP experimental checkout')
app.mount('/static',StaticFiles(directory=str(ROOT/'static')),name='static')
def connect():
    c=sqlite3.connect(DB,timeout=10);c.row_factory=sqlite3.Row;return c
with connect() as c:
    c.execute('CREATE TABLE IF NOT EXISTS sessions(id TEXT PRIMARY KEY,token TEXT,nonce TEXT,mode TEXT,vpa TEXT,name TEXT,amount INTEGER,mcc TEXT,expires INTEGER,state TEXT,attested INTEGER DEFAULT 0)')
    c.execute('CREATE TABLE IF NOT EXISTS events(id INTEGER PRIMARY KEY AUTOINCREMENT,sid TEXT,kind TEXT,created INTEGER)')
class Create(BaseModel):
    mode:str
    vpa:str
    name:str='Recipient'
    amount_paise:int
    mcc:str|None=None
class Observation(BaseModel):
    event:str
    utr:str|None=None
class Proof(BaseModel):
    receipt:dict
def load(sid):
    with connect() as c:r=c.execute('SELECT * FROM sessions WHERE id=?',(sid,)).fetchone()
    if not r:raise HTTPException(404,'Session not found')
    return dict(r)
def auth(sid,token):
    r=load(sid)
    if not secrets.compare_digest(r['token'],token):raise HTTPException(403,'Invalid token')
    return r
def uri(r):
    p=dict(pa=r['vpa'],pn=r['name'],am=f"{r['amount']/100:.2f}",cu='INR',tn='PDEP '+r['id'])
    if r['mcc']:p['mc']=r['mcc']
    return 'upi://pay?'+urlencode(p)
def view(r):
    return dict(session_id=r['id'],mode=r['mode'],vpa=r['vpa'],name=r['name'],amount_paise=r['amount'],mcc=r['mcc'],expires=r['expires'],state=r['state'],test_attested=bool(r['attested']),financially_verified=False,payment_uri=uri(r))
@app.get('/',response_class=HTMLResponse)
def home():return (ROOT/'static'/'index.html').read_text()
@app.post('/api/sessions',status_code=201)
def create(b:Create):
    if b.mode not in ('P2P','P2M') or not re.fullmatch(r'[\w.-]{2,256}@[\w.-]{2,64}',b.vpa) or not 100<=b.amount_paise<=100000000 or not 1<=len(b.name.strip())<=80:raise HTTPException(422,'Invalid session')
    if b.mcc is not None and (b.mode!='P2M' or not re.fullmatch(r'\d{4}',b.mcc)):raise HTTPException(422,'Invalid MCC')
    sid='ps_'+secrets.token_urlsafe(18);token=secrets.token_urlsafe(32)
    with connect() as c:c.execute('INSERT INTO sessions(id,token,nonce,mode,vpa,name,amount,mcc,expires,state) VALUES(?,?,?,?,?,?,?,?,?,?)',(sid,token,secrets.token_urlsafe(32),b.mode,b.vpa.lower(),b.name.strip(),b.amount_paise,b.mcc,int(time.time())+900,'AWAITING_PAYMENT'))
    return {'token':token,**view(load(sid))}
@app.get('/api/sessions/{sid}')
def get(sid:str,token:str):return view(auth(sid,token))
@app.get('/api/sessions/{sid}/qr.png')
def qr(sid:str,token:str):
    r=auth(sid,token);out=io.BytesIO();qrcode.make(uri(r)).save(out,format='PNG')
    return Response(out.getvalue(),media_type='image/png',headers={'Cache-Control':'no-store'})
@app.post('/api/sessions/{sid}/observe')
def observe(sid:str,token:str,b:Observation):
    r=auth(sid,token)
    if b.event not in ('UPI_LAUNCH_ATTEMPTED','BROWSER_RESUMED','PAYER_CLAIMED_PAID','PAYER_CANCELLED'):raise HTTPException(422,'Event')
    if b.utr is not None and (len(b.utr)>128 or not re.fullmatch(r'[A-Za-z0-9_-]*',b.utr)):raise HTTPException(422,'UTR')
    state='EXPIRED' if time.time()>r['expires'] else 'UNVERIFIED'
    with connect() as c:
        c.execute('UPDATE sessions SET state=? WHERE id=?',(state,sid))
        c.execute('INSERT INTO events(sid,kind,created) VALUES(?,?,?)',(sid,b.event,int(time.time())))
    return view(load(sid))
@app.post('/api/sessions/{sid}/proof')
def proof(sid:str,token:str,b:Proof):
    r=auth(sid,token);result='UNTRUSTED_ISSUER'
    if DEMO:result=VERIFIER.verify(Session(r['id'],r['nonce'],r['mode'],r['vpa'],r['amount'],r['mcc']),b.receipt)
    valid=result=='SIMULATED_ISSUER_ATTESTATION_VALID'
    with connect() as c:c.execute('UPDATE sessions SET attested=?,state=? WHERE id=?',(int(valid),'TEST_ATTESTED_NOT_FINANCIALLY_VERIFIED' if valid else 'UNVERIFIED',sid))
    return {'result':result,**view(load(sid))}
@app.post('/api/demo/sessions/{sid}/issue-test-proof')
def test_proof(sid:str,token:str):
    if not DEMO:raise HTTPException(404,'Demo disabled')
    r=auth(sid,token)
    return {'receipt':ISSUER.issue(Session(r['id'],r['nonce'],r['mode'],r['vpa'],r['amount'],r['mcc']),'SIM_'+secrets.token_hex(12))}
@app.get('/api/sessions/{sid}/events')
def events(sid:str,token:str):
    auth(sid,token)
    with connect() as c:rows=c.execute('SELECT kind,created FROM events WHERE sid=? ORDER BY id',(sid,)).fetchall()
    return [dict(r) for r in rows]
@app.get('/healthz')
def health():return {'ok':True,'demo':DEMO}
