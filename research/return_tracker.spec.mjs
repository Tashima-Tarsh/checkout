import {test} from 'node:test';
import assert from 'node:assert/strict';
import {returnTracker} from '../checkout/agentic_assets/return-tracker.mjs';
test('return triggers once, never verifies debit', () => {
 const results=[]; const t=returnTracker(x=>results.push(x),()=>1);
 t.observe('focus'); t.arm(); t.observe('focus'); assert.equal(results.length,0);
 t.observe('hidden',true); t.observe('visible'); t.observe('focus');
 assert.equal(results.length,1); assert.equal(results[0].financially_verified,false);
});
test('cancel and successful payment are indistinguishable from lifecycle alone',()=>{
 const run=()=>{let result;const t=returnTracker(x=>result=x,()=>1);t.arm();t.observe('blur');t.observe('focus');return result;};
 assert.deepEqual(run(),run());
});
