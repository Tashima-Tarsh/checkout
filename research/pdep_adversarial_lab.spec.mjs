import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {fuse} from './evidence_fusion.mjs';
test('10000 untrusted observations never authorize payment',()=>{
 for(let i=0;i<10000;i++){const b=randomBytes(1)[0];assert.equal(fuse({returned:!!(b&1),matched:!!(b&2),replay:!!(b&4),expired:!!(b&8)}).financially_verified,false);}
});
