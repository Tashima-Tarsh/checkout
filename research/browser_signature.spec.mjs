import {test} from 'node:test';
import assert from 'node:assert/strict';
// Synthetic research only; no external app access or financial state.
const subtle = globalThis.crypto.subtle;
const encode = x => new TextEncoder().encode(JSON.stringify(x));
test('browser signatures authenticate claims, not debits', async () => {
  const key = await subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},false,['sign','verify']);
  const claim = ['synthetic-order',100,'synthetic-recipient','nonce',90000,'SUCCESS'];
  for (const simulatedDebit of [true,false]) {
    const signature = await subtle.sign({name:'ECDSA',hash:'SHA-256'},key.privateKey,encode(claim));
    assert.equal(await subtle.verify({name:'ECDSA',hash:'SHA-256'},key.publicKey,signature,encode(claim)),true);
    const verdict = {simulatedDebit, financially_verified:false};
    assert.equal(verdict.financially_verified,false);
    assert.equal(await subtle.verify({name:'ECDSA',hash:'SHA-256'},key.publicKey,signature,encode([...claim, 'modified'])),false);
  }
});
