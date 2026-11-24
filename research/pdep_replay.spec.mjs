import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {generateKeyPairSync,sign,verify} from 'node:crypto';
test('fixture authentication precedes atomic unique reservation',()=>{
 const db=new DatabaseSync(':memory:');
 try {
 db.exec('CREATE TABLE consumed(ref TEXT PRIMARY KEY, order_id TEXT UNIQUE NOT NULL)');
 const issuer=generateKeyPairSync('ed25519'),other=generateKeyPairSync('ed25519');
 const reserve=(ref,order,sig)=>{
 const payload=Buffer.from(JSON.stringify([ref,order]));
 if(!verify(null,payload,issuer.publicKey,sig))return false;
 return db.prepare('INSERT INTO consumed VALUES (?,?) ON CONFLICT DO NOTHING').run(ref,order).changes===1;
 };
 const signature=(key,ref,order)=>sign(null,Buffer.from(JSON.stringify([ref,order])),key);
 assert.equal(reserve('fixture','a',signature(other.privateKey,'fixture','a')),false);
 assert.equal(reserve('fixture','a',signature(issuer.privateKey,'fixture','a')),true);
 assert.equal(reserve('fixture','b',signature(issuer.privateKey,'fixture','b')),false);
 assert.equal(reserve('other','a',signature(issuer.privateKey,'other','a')),false);
 } finally {db.close();}
});
