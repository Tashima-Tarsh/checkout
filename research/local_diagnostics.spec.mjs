import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createTrace} from '../checkout/agentic_assets/local-diagnostics.mjs';
test('explicit opt-in, redacted and immutable output',()=>{
  let now=10; const t=createTrace(()=>now);
  assert.equal(t.record('paid_click'),false);
  t.start(); now=189;
  assert.equal(t.record('hidden'),true);
  assert.equal(t.record('secret-data'),false);
  const a=t.snapshot(); a.events[0].kind='changed';
  assert.deepEqual(t.snapshot().events,[{kind:'start',ms:0},{kind:'hidden',ms:100}]);
  assert.equal(t.snapshot().financially_verified,false);
});
test('bounded time and events, stopped trace cannot record',()=>{
  let now=0; const t=createTrace(()=>now);
  t.start(); now=300000; assert.equal(t.record('visible'),false);
  assert.equal(t.snapshot().active,false);
  now=0;t.start();for(let i=0;i<100;i++) t.record('visible');
  assert.equal(t.snapshot().events.length,64);
  assert.equal(t.snapshot().active,false);
  t.start();t.stop();assert.equal(t.record('paid_click'),false);
});
test('no inference of payment from identical browser event sequences',()=>{
  const simulate=()=>{const t=createTrace(()=>0);t.start();
    for(const e of ['copy_ok','hidden','visible','paid_click','verify_ok']) t.record(e);
    t.stop();return t.snapshot();};
  assert.deepEqual(simulate(),simulate());
  assert.equal(simulate().financially_verified,false);
});
