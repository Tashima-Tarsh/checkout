import test from 'node:test';
import assert from 'node:assert/strict';
import {createReturnCallback} from '../checkout/agentic_assets/return-callback.mjs';
function runCases(make, check) {
  let now=0, result=[];const tracker=make(x=>result.push(x),()=>now);
  tracker.observe('focus',{focused:true});check(result.length===0,'unarmed focus');
  tracker.arm();tracker.observe('visible',{focused:true});check(result.length===0,'no departure');
  now=3500;tracker.observe('hidden',{hidden:true});
  now=41800;tracker.observe('visible',{hidden:false,focused:true});
  check(result.length===1&&result[0].away_ms===38300&&result[0].mode==='visibility'&&result[0].financially_verified===false,'real trace replay');
  tracker.observe('focus',{focused:true});check(result.length===1,'deduplication');
  tracker.arm();now+=100;tracker.observe('blur',{hidden:false,focused:false});
  now+=1000;tracker.observe('visible',{hidden:false,focused:false});check(result.length===1,'visible but not focused');
  tracker.observe('focus',{hidden:false,focused:true});check(result.length===2&&result[1].mode==='focus','split screen return');
  tracker.arm();tracker.observe('blur');now+=300000;tracker.observe('focus',{focused:true});check(result.length===2,'expired');
  tracker.arm();tracker.observe('blur');tracker.disarm();tracker.observe('focus',{focused:true});check(result.length===2,'manual submission disarms');
  tracker.arm();tracker.observe('hidden',{hidden:true});tracker.observe('focus',{hidden:true,focused:true});check(result.length===2,'focus while hidden');
  tracker.observe('visible',{hidden:false});check(result.length===3,'return after hidden focus');
}
test('visibility/focus returns, physical trace replay, deduplication and timeout',()=>runCases(createReturnCallback,(ok,msg)=>assert.ok(ok,msg)));
