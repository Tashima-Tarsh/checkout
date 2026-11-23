import assert from 'node:assert/strict';
import {test} from 'node:test';
import {makeNonceCarrier,analyzeRoundTrip} from './nonce_carrier.mjs';
const inputs={vpa:'recipient@upi',payeeName:'Test Recipient',amount:'1.00',nonce:'12345678901234567890123456789012'};
test('nonce embedded in UPI transaction note and parsed correctly',()=>{
  const out=makeNonceCarrier(inputs);
  const u=new URL(out.uri);
  assert.equal(u.searchParams.get('pa'),'recipient@upi');
  assert.equal(u.searchParams.get('am'),'1.00');
  assert.equal(u.searchParams.get('tn'),out.note);
  assert.ok(out.note.includes('PD'));
});
test('receipt with exact marker is associated but never verified',()=>{
  const {marker}=makeNonceCarrier(inputs);
  const result=analyzeRoundTrip({marker,copiedReceipt:'Transaction successful. Note: '+marker});
  assert.equal(result.observed,true);
  assert.equal(result.debitVerified,false);
});
test('forged no-debit receipt can echo exact marker',()=>{
  const {marker}=makeNonceCarrier(inputs);
  for(let i=0;i<10000;i++) {
    const result=analyzeRoundTrip({marker,copiedReceipt:'Fake receipt '+i+' '+marker});
    assert.equal(result.observed,true);
    assert.equal(result.debitVerified,false);
  }
});
test('wrong marker rejected',()=>{
  const {marker}=makeNonceCarrier(inputs);
  assert.equal(analyzeRoundTrip({marker,copiedReceipt:'unrelated'}).observed,false);
});
test('invalid carrier inputs rejected',()=>{
  assert.throws(()=>makeNonceCarrier({...inputs,nonce:'x'}));
  assert.throws(()=>makeNonceCarrier({...inputs,amount:'1.234'}));
  assert.throws(()=>makeNonceCarrier({...inputs,vpa:'not-vpa'}));
});
