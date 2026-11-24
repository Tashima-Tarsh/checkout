import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createSession,correlate} from '../checkout/agentic_assets/evidence-lab.mjs';
const s=createSession({id:'test',nonce:'challenge',now:100,ttl:90});
const e=(id,kind,extra={})=>({id,kind,session:s.id,nonce:s.nonce,at:110,...extra});
test('bounded synthetic handshake never verifies debit',()=>{const r=correlate(s,[e('1','depart'),e('2','return'),e('3','synthetic-receipt',{financially_verified:true})],120);assert.equal(r.returned,true);assert.equal(r.financially_verified,false);});
test('reject replay, wrong session, wrong nonce, future and expired events',()=>{const a=e('1','depart');assert.deepEqual(correlate(s,[a,a,e('2','return',{session:'other'}),e('3','return',{nonce:'bad'}),e('4','return',{at:121})],120).accepted,['depart']);assert.deepEqual(correlate(s,[a],191).accepted,[]);});
test('forged matching event remains unverified',()=>assert.equal(correlate(s,[e('1','synthetic-receipt')],120).financially_verified,false));
