import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fuse} from './evidence_fusion.mjs';
test('balanced indistinguishable synthetic observations cannot discriminate',()=>{
 const rows=Array.from({length:1000},(_,i)=>({label:i%2,score:fuse({matched:true}).score}));
 const pos=rows.filter(r=>r.label===1),neg=rows.filter(r=>r.label===0);
 assert.equal(pos[0].score,neg[0].score);
 const brier=rows.reduce((s,r)=>s+(r.score-r.label)**2,0)/rows.length;
 assert.ok(brier>=0.25);
 assert.equal(fuse({matched:true}).financially_verified,false);
});
