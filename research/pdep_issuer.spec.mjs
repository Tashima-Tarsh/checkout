import {test} from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign,verify} from 'node:crypto';
test('independent fixture issuer rejects client key and altered claim',()=>{
 const issuer=generateKeyPairSync('ed25519'),client=generateKeyPairSync('ed25519');
 const claim=Buffer.from('synthetic fixture only');
 assert.equal(verify(null,claim,issuer.publicKey,sign(null,claim,issuer.privateKey)),true);
 assert.equal(verify(null,claim,issuer.publicKey,sign(null,claim,client.privateKey)),false);
 assert.equal(verify(null,Buffer.from('altered'),issuer.publicKey,sign(null,claim,issuer.privateKey)),false);
});
