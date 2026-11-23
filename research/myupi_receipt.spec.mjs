import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeMyUpiDisplay as normalize} from './myupi_receipt.mjs';
const row={directionLabel:'Paid to', statusLabel:'Payment successful',
amount:'₹1', transactionId:'000000000001', dateTime:'23 Nov 2026, 2:22 am',
debitedBank:'Example Bank A', beneficiaryBank:'Example Bank B',
beneficiaryLast4:'1234', paymentMode:'BANK ACCOUNT', upiApp:'GOOGLE PAY'};
test('observed receipt shape normalizes but never verifies debit',()=>{
 const r=normalize(row); assert.equal(r.amountMinor,100);
 assert.equal(r.financialDebitVerified,false); assert.equal(r.recipientVerified,false);
});
test('payer cannot override verification',()=>assert.equal(normalize({...row,financialDebitVerified:true}).financialDebitVerified,false));
test('failed or inbound payment rejected',()=>{
 assert.equal(normalize({...row,statusLabel:'Payment failed'}),null);
 assert.equal(normalize({...row,directionLabel:'Received from'}),null);
});
test('malformed values rejected',()=>{
 for(const amount of ['₹0','₹1.001','₹-1','₹1e3']) assert.equal(normalize({...row,amount}),null);
 assert.equal(normalize({...row,transactionId:''}),null);
});
test('decimal amounts exact',()=>assert.equal(normalize({...row,amount:'₹1.05'}).amountMinor,105));
