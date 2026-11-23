import assert from 'node:assert/strict';
import {test} from 'node:test';
import {EVIDENCE_ORIGINS, evidenceVerdict, browserSurvey} from './debit_signal_origin.mjs';
const fields={sessionMatches:true,amountMatches:true,recipientMatches:true,nonceMatches:true};
test('every payer-controlled signal is correlation, never verified debit',()=>{
  for(const origin of EVIDENCE_ORIGINS){
    const x=evidenceVerdict({...fields,origin});
    assert.equal(x.debitVerified,false,origin);
    assert.equal(x.reason,'PAYER_REPRODUCIBLE');
  }
});
test('mismatched session, recipient, amount, nonce rejected',()=>{
  for (const key of Object.keys(fields)){
    const x=evidenceVerdict({...fields,[key]:false,origin:'copied_app_receipt'});
    assert.equal(x.status,'REJECTED');
  }
});
test('10,000 fabricated debit claims never verify',()=>{
  for(let i=0;i<10000;i++){
    const x=evidenceVerdict({...fields,origin:EVIDENCE_ORIGINS[i%EVIDENCE_ORIGINS.length],
       claimedDebit:true,claimedSigned:true,reference:'FAKE'+i});
    assert.equal(x.debitVerified,false);
  }
});
test('survey exposes browser APIs without implying actual debit observation',()=>{
  const x=browserSurvey({navigator:{clipboard:{readText(){}},share(){},mediaDevices:{getDisplayMedia(){}}},PaymentRequest:class{},isSecureContext:true});
  assert.equal(x.paymentRequestAvailable,true);
  assert.equal(x.screenCaptureAvailable,true);
  assert.equal(x.otherAppNotificationRead,false);
  assert.equal(x.automaticDebitEvidenceObserved,false);
});
test('no API still gives valid survey',()=>{
  assert.equal(browserSurvey({navigator:{}}).automaticDebitEvidenceObserved,false);
});
