/**
 * Adversarial browser-origin WebCrypto experiment.
 *
 * A genuine signature from a payer-controlled WebCrypto key demonstrates
 * control of that key, NOT that the payer authorized or completed a debit.
 *
 * Uses the same WebCrypto primitive available in secure web contexts.
 * Does not access any real account, payment app, service or private data.
 */
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {webcrypto} from 'node:crypto';

const encoder = new TextEncoder();
const subtle = webcrypto.subtle;

function stableMessage({sid,nonce,vpa,amountPaise,reference}) {
  return encoder.encode(JSON.stringify({sid,nonce,vpa,amountPaise,reference}));
}

async function payerSignedClaim({debitOccurred}) {
  // A payer device can create an origin-scoped key without payment activity.
  // extractable=false prevents export; it does not bind the key to a real debit.
  const key = await subtle.generateKey({
    name:'ECDSA', namedCurve:'P-256',
  }, false, ['sign','verify']);
  const payload = {
    sid:'ps_crypto_12345',nonce:'abcdefgh1234567890abcdefgh123456',
    vpa:'recipient@upi',amountPaise:100,reference:'TXREF123456'
  };
  const message = stableMessage(payload);
  const signature = await subtle.sign({name:'ECDSA',hash:'SHA-256'},key.privateKey,message);
  const valid = await subtle.verify({name:'ECDSA',hash:'SHA-256'},key.publicKey,signature,message);
  void debitOccurred;  // deliberately absent from observable, signed message
  return {valid,payload,publicKey:key.publicKey,signature,message};
}

test('WebCrypto signature verifies after a genuine user-initiated debit',async()=>{
  const signed=await payerSignedClaim({debitOccurred:true});
  assert.equal(signed.valid,true);
});

test('WebCrypto signature also verifies with no payment or debit',async()=>{
  const signed=await payerSignedClaim({debitOccurred:false});
  assert.equal(signed.valid,true);
});

test('attacker can sign forged receipt using nonextractable browser key',async()=>{
  const signed=await payerSignedClaim({debitOccurred:false});
  assert.equal(await subtle.verify({name:'ECDSA',hash:'SHA-256'},
    signed.publicKey,signed.signature,signed.message),true);
  // Correct decision: source must be authenticated by a debit-dependent witness.
  const financiallyVerified=false;
  assert.equal(financiallyVerified,false);
});

test('changing amount after signing must invalidate the signature',async()=>{
  const signed=await payerSignedClaim({debitOccurred:true});
  const altered={...signed.payload,amountPaise:1000};
  const authentic=await subtle.verify({name:'ECDSA',hash:'SHA-256'},
    signed.publicKey,signed.signature,stableMessage(altered));
  assert.equal(authentic,false);
});
