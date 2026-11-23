import assert from 'node:assert/strict';
import {test} from 'node:test';
import {analyzePaymentResponse, paymentCapabilities} from './payment_response_probe.mjs';
const expected={
  expectedSessionId:'ps_abc12345',expectedAmountPaise:100,
  expectedVpa:'person@upi',expectedMethod:'https://tez.google.com/pay'
};
const response={
  methodName:'https://tez.google.com/pay',
  details:{sessionId:'ps_abc12345',amountPaise:100,vpa:'person@upi',status:'SUCCESS'}
};

test('PaymentRequest availability is capability, not debit result',()=>{
  const c=paymentCapabilities({PaymentRequest:class FakeRequest{},isSecureContext:true});
  assert.equal(c.canAttemptBrowserPaymentUI,true);
  assert.equal(c.canPromiseCrossAppDebitVerification,false);
  assert.equal(c.canAutomaticallyReadOtherAppSMS,false);
  assert.equal(c.canAutomaticallyReadOtherAppNotifications,false);
});

test('matching browser-mediated response is not financial attestation',()=>{
  const out=analyzePaymentResponse({...expected,paymentResponse:response});
  assert.equal(out.kind,'CORRELATED_BROWSER_RESPONSE');
  assert.equal(out.debitVerified,false);
  assert.equal(out.provenanceAuthenticated,false);
});

test('fake payment response can be made with no debit',()=>{
  let forged=0;
  for(let i=0;i<10000;i++){
    const attackerResponse=structuredClone(response);
    attackerResponse.details.transactionReference='FAKE_'+i;
    const verdict=analyzePaymentResponse({...expected,paymentResponse:attackerResponse});
    assert.equal(verdict.kind,'CORRELATED_BROWSER_RESPONSE');
    assert.equal(verdict.debitVerified,false);
    forged++;
  }
  assert.equal(forged,10000);
});

test('unexpected UPI recipient, amount, session or method is rejected',()=>{
  for(const [field,value] of [['sessionId','other'],['amountPaise',999],['vpa','attacker@upi']]){
    const edited=structuredClone(response);
    edited.details[field]=value;
    assert.equal(analyzePaymentResponse({...expected,paymentResponse:edited}).kind,'UNMATCHED_RESPONSE');
  }
  assert.equal(analyzePaymentResponse({...expected,paymentResponse:{...response,methodName:'unknown'}}).kind,'UNMATCHED_RESPONSE');
});

test('no handler or malformed response never verifies',()=>{
  assert.equal(paymentCapabilities({PaymentRequest:undefined,isSecureContext:true}).canAttemptBrowserPaymentUI,false);
  assert.equal(analyzePaymentResponse({...expected,paymentResponse:null}).debitVerified,false);
  assert.equal(analyzePaymentResponse({...expected,paymentResponse:{details:'bad'}}).debitVerified,false);
});
