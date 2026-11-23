import assert from 'node:assert/strict';
import {test} from 'node:test';
import {LiveCaptureProbe} from './live_capture_probe.mjs';
test('no screen API gives testable unsupported state',async()=>{
  const p=new LiveCaptureProbe({mediaDevices:{}});
  assert.equal((await p.start()).status,'UNSUPPORTED');
  assert.equal(p.report().savedPixels,0);
});
test('consent starts track and logs actual mute/unmute/ended status',async()=>{
  const callbacks={};let stops=0;let time=1;
  const track={readyState:'live',muted:false,getSettings:()=>({displaySurface:'monitor'}),
    addEventListener:(event,fn)=>{callbacks[event]=fn;},
    stop:()=>{stops++;}};
  const p=new LiveCaptureProbe({clock:()=>time++,mediaDevices:{
    getDisplayMedia:async()=>({getVideoTracks:()=>[track],getTracks:()=>[track]})
  }});
  assert.equal((await p.start()).status,'ACTIVE');
  p.onDocumentVisibility(true);
  track.muted=true; callbacks.mute();
  p.onDocumentVisibility(false);
  callbacks.unmute();
  assert.deepEqual(p.report().events.map(e=>e.kind),[
    'CAPTURE_CONSENT_REQUESTED','CAPTURE_ACTIVE','PAGE_HIDDEN','TRACK_MUTED',
    'PAGE_VISIBLE','TRACK_UNMUTED'
  ]);
  p.stop();
  assert.equal(stops,1);
  assert.equal(p.report().debitVerified,false);
});
test('denial never causes fake active capture',async()=>{
  const p=new LiveCaptureProbe({mediaDevices:{getDisplayMedia:async()=>{
    const e=Error('denied');e.name='NotAllowedError';throw e;
  }}});
  assert.equal((await p.start()).status,'REJECTED');
  assert.equal(p.report().active,false);
});
test('track end marks discontinued capture',async()=>{
  let onEnd;
  const track={addEventListener:(name,fn)=>{if(name==='ended')onEnd=fn;},getSettings:()=>({})};
  const p=new LiveCaptureProbe({mediaDevices:{
    getDisplayMedia:async()=>({getVideoTracks:()=>[track]})
  }});
  await p.start();onEnd();
  assert.equal(p.report().active,false);
  assert.ok(p.report().events.some(e=>e.kind==='TRACK_ENDED'));
});
