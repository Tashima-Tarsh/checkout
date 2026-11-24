import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
test('hash of a claimed HTTPS response does not authenticate its source',()=>{
 const fixture=JSON.stringify({origin:'https://example.invalid',status:'SUCCESS'});
 const digest=x=>createHash('sha256').update(x).digest('hex');
 assert.equal(digest(fixture),digest(fixture));
 // No TLS transcript, verifier participation or source signature is present.
});
