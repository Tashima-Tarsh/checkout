import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createTrace} from '../checkout/agentic_assets/checkout-diagnostics.mjs';
test('requires explicit start and records only fixed event names',()=>{
 let now=100;const t=createTrace(()=>now);
 t.record('copy-ok');assert.deepEqual(t.snapshot().events,[]);
 t.start();now=125;t.record('copy-ok');t.record('private-content');
 assert.deepEqual(t.snapshot().events,[{event:'start',ms:0},{event:'copy-ok',ms:25}]);
 assert.equal(t.snapshot().financially_verified,false);
});
test('deadline and stop block further collection',()=>{
 let now=0;const t=createTrace(()=>now);t.start();now=90000;t.record('paid-click');
 assert.equal(t.snapshot().active,false);assert.equal(t.snapshot().events.length,1);
 t.start();t.record('stop');t.record('visible');assert.equal(t.snapshot().events.length,2);
});
test('bounded trace and detached snapshots',()=>{
 const t=createTrace(()=>0);t.start();for(let i=0;i<300;i++)t.record('focus');
 const result=t.snapshot();assert.equal(result.events.length,127);assert.equal(result.active,false);
 result.events[0].event='tampered';assert.equal(t.snapshot().events[0].event,'start');
});
test('success and cancellation can generate identical browser observations',()=>{
 const run=()=>{const t=createTrace(()=>0);t.start();for(const event of ['copy-ok','hidden','visible','paid-click','request-ok'])t.record(event);return t.snapshot();};
 assert.deepEqual(run(),run());assert.equal(run().financially_verified,false);
});
