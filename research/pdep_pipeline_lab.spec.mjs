import {test} from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign,verify} from 'node:crypto';
test('synthetic pipeline binds scope and consumes reference once',()=>{
 const {publicKey,privateKey}=generateKeyPairSync('ed25519'),seen=new Set();
 const order=['fixture-order',100,'fixture-recipient','nonce'];
 const claim=[...order,'fixture-reference'];
 const bytes=x=>Buffer.from(JSON.stringify(x));
 const sig=sign(null,bytes(claim),privateKey);
 const accept=(c,s)=>{if(!verify(null,bytes(c),publicKey,s)||JSON.stringify(c.slice(0,4))!==JSON.stringify(order)||seen.has(c[4]))return false;seen.add(c[4]);return true;};
 assert.equal(accept([...order,'wrong'],sig),false);assert.equal(accept(claim,sig),true);assert.equal(accept(claim,sig),false);
 // In-memory fixture only; never changes financial state.
});
