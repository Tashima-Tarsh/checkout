import assert from 'node:assert/strict';
import {test} from 'node:test';
import {ScreenEvidenceCapability} from './screen_evidence_capability.mjs';

test('unsupported mobile browser does not attempt screen capture',async()=>{
 let calls=0;
 const probe=new ScreenEvidenceCapability({mediaDevices:{}});
 assert.equal(probe.available(),false);
 assert.equal((await probe.requestFromUserAction()).status,'UNSUPPORTED');
 assert.equal(probe.snapshot().retainedFrames,0);
 assert.equal(calls,0);
});

test('explicit browser denial fails closed',async()=>{
 const probe=new ScreenEvidenceCapability({mediaDevices:{
  getDisplayMedia: async()=>{const error=Error('denied');error.name='NotAllowedError';throw error;}
 }});
 assert.equal((await probe.requestFromUserAction()).status,'USER_DENIED_OR_BLOCKED');
 assert.equal(probe.snapshot().active,false);
 assert.equal(probe.snapshot().debitVerified,false);
});

test('lack of transient user gesture fails closed',async()=>{
 const probe=new ScreenEvidenceCapability({mediaDevices:{
  getDisplayMedia: async()=>{const e=Error('no gesture');e.name='InvalidStateError';throw e;}
 }});
 assert.equal((await probe.requestFromUserAction()).status,'NO_USER_ACTIVATION_OR_FOCUS');
});

test('consented stream stops tracks and never saves frames',async()=>{
 let stopped=0,options,ends;
 const track={stop:()=>{stopped++;},addEventListener:(event,fn)=>{ends=fn;}};
 const probe=new ScreenEvidenceCapability({now:()=>1234,mediaDevices:{
  getDisplayMedia:async optionsIn=>{options=optionsIn;return {
   getVideoTracks:()=>[track],getTracks:()=>[track]
  };}
 }});
 assert.equal((await probe.requestFromUserAction()).status,'CONSENTED_TRACK_READY');
 assert.deepEqual(options,{video:true,audio:false});
 assert.equal(probe.snapshot().active,true);
 assert.equal(probe.snapshot().startedAt,1234);
 assert.equal(probe.snapshot().retainedFrames,0);
 assert.equal(probe.stop().status,'STOPPED');
 assert.equal(stopped,1);
 assert.equal(probe.snapshot().active,false);
 assert.equal(probe.snapshot().debitVerified,false);
 ends();
 assert.equal(probe.snapshot().active,false);
});

test('even a captured screen is only payer-visible content, not debit proof',async()=>{
 const track={stop:()=>{},addEventListener:()=>{}};
 const probe=new ScreenEvidenceCapability({mediaDevices:{
  getDisplayMedia:async()=>({getVideoTracks:()=>[track],getTracks:()=>[track]})
 }});
 const result=await probe.requestFromUserAction();
 assert.equal(result.debitVerified,false);
 assert.equal(probe.snapshot().debitVerified,false);
 probe.stop();
});
