"""Deterministic synthetic adversarial experiment."""
import os,sys,time
sys.path.insert(0,os.path.abspath(os.path.join(os.path.dirname(__file__),'..')))
from pdep.protocol import *
issuer=SimulatedIssuer();attacker=SimulatedIssuer();v=Verifier({'SIMULATED_ONLY':issuer.public()})
counts={'correct':0,'false_accept':0,'false_reject':0}
started = time.perf_counter()
for j in range(1000):
    mode='P2P' if j%2==0 else 'P2M'
    s=create_session(mode,'person@upi' if mode=='P2P' else 'shop@upi',100+j,'5411' if mode=='P2M' else None)
    typ=j%5;r=issuer.issue(s,'r'+str(j));expected=typ==0
    if typ==1:r=attacker.issue(s,'r'+str(j))
    elif typ==2:r['payload']['amount_paise']+=1
    elif typ==3:r=issuer.issue(create_session(mode,s.recipient_vpa,s.amount_paise,s.mcc),'r'+str(j))
    elif typ==4:r=issuer.issue(s,'r'+str(j),issued_at=int(time.time())-900)
    actual=v.verify(s,r)=='SIMULATED_ISSUER_ATTESTATION_VALID'
    counts['correct' if actual==expected else ('false_accept' if actual else 'false_reject')]+=1
print(counts, f'elapsed_seconds={time.perf_counter()-started:.3f}', 'real_upi_proven=NO')
if counts['false_accept'] or counts['false_reject']:
    raise SystemExit(1)
