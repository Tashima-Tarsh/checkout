"""Synthetic payer debit evidence tests. A real bank debit is NEVER established."""
import base64,json,re,secrets,time
from dataclasses import dataclass
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from cryptography.exceptions import InvalidSignature

def canon(p):return json.dumps(p,sort_keys=True,separators=(',',':')).encode()
def b64(b):return base64.urlsafe_b64encode(b).decode().rstrip('=')
def unb64(s):return base64.urlsafe_b64decode(s+'='*(-len(s)%4))
@dataclass(frozen=True)
class Session:
    session_id:str
    nonce:str
    mode:str
    recipient_vpa:str
    amount_paise:int
    mcc:str|None=None
def create_session(mode,vpa,amount,mcc=None):
    if mode not in ('P2P','P2M'):raise ValueError('mode')
    if not re.fullmatch(r'[\w.-]{2,256}@[\w.-]{2,64}',vpa):raise ValueError('vpa')
    if type(amount)!=int or amount<=0:raise ValueError('amount')
    if mcc is not None and (mode!='P2M' or not re.fullmatch(r'\d{4}',mcc)):raise ValueError('mcc')
    return Session('ps_'+secrets.token_hex(12),secrets.token_urlsafe(24),mode,vpa.lower(),amount,mcc)
class SimulatedIssuer:
    def __init__(self):self.key=Ed25519PrivateKey.generate()
    def public(self):return self.key.public_key()
    def issue(self,s,ref,status='DEBIT_POSTED',issued_at=None):
        p=dict(version='research/0.1',issuer='SIMULATED_ONLY',session_id=s.session_id,nonce=s.nonce,mode=s.mode,recipient_vpa=s.recipient_vpa,amount_paise=s.amount_paise,mcc=s.mcc,txref=ref,status=status,issued_at=int(time.time()) if issued_at is None else issued_at)
        return {'payload':p,'signature':b64(self.key.sign(canon(p)))}
class Verifier:
    def __init__(self,keys):
        self.keys=keys;self.used=set()
    def verify(self,s,r):
        try:
            p=r['payload']
            if p.get('issuer') not in self.keys:return 'UNTRUSTED_ISSUER'
            self.keys[p['issuer']].verify(unb64(r['signature']),canon(p))
            if p.get('version')!='research/0.1':return 'VERSION_MISMATCH'
            for k in ('session_id','nonce','mode','recipient_vpa','amount_paise','mcc'):
                if p.get(k)!=getattr(s,k):return 'BINDING_MISMATCH'
            if p.get('status')!='DEBIT_POSTED':return 'NON_QUALIFYING_STATUS'
            if type(p.get('issued_at'))!=int or not -120<=int(time.time())-p['issued_at']<=300:return 'OUTSIDE_WINDOW'
            if not isinstance(p.get('txref'),str) or not p['txref']:return 'INVALID_REFERENCE'
            ref=p['issuer'],p['txref']
            if ref in self.used:return 'REPLAY'
            self.used.add(ref)
            return 'SIMULATED_ISSUER_ATTESTATION_VALID'
        except (InvalidSignature,ValueError,KeyError,TypeError,AttributeError):return 'INVALID_PROOF'
