from pdep.protocol import *
def test_valid_synthetic():
    issuer=SimulatedIssuer();s=create_session('P2P','alice@upi',49900)
    assert Verifier({'SIMULATED_ONLY':issuer.public()}).verify(s,issuer.issue(s,'tx1'))=='SIMULATED_ISSUER_ATTESTATION_VALID'
def test_replay():
    issuer=SimulatedIssuer();s=create_session('P2P','alice@upi',49900);v=Verifier({'SIMULATED_ONLY':issuer.public()});r=issuer.issue(s,'tx1')
    assert v.verify(s,r)=='SIMULATED_ISSUER_ATTESTATION_VALID'
    assert v.verify(s,r)=='REPLAY'
def test_tamper():
    issuer=SimulatedIssuer();s=create_session('P2P','alice@upi',49900);r=issuer.issue(s,'tx1');r['payload']['amount_paise']=1
    assert Verifier({'SIMULATED_ONLY':issuer.public()}).verify(s,r)=='INVALID_PROOF'
def test_mcc():
    assert create_session('P2M','shop@upi',100,'5411').mcc=='5411'
    try:create_session('P2P','alice@upi',100,'5411');assert False
    except ValueError:pass
