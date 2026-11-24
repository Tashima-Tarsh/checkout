import test from 'node:test';
import assert from 'node:assert/strict';
// Controlled model only: fresh proof envelope does not imply fresh debit.
function candidate(row, session, observedAt, consumed) {
  if (row.direction !== 'DEBIT' || row.status !== 'SUCCESS' ||
      row.recipient !== session.recipient || row.amount !== session.amount ||
      row.challenge !== session.challenge || !Number.isSafeInteger(row.at) ||
      row.at < session.start || row.at > observedAt || observedAt >= session.end ||
      typeof row.reference !== 'string' || !row.reference) return false;
  const key = JSON.stringify([row.source, row.reference]);
  if (consumed.has(key)) return false;
  consumed.add(key); // synchronous model only; durable DB transaction still needed
  return true;
}
const s={recipient:'test@upi',amount:100,challenge:'challenge-A',start:1000,end:91000};
const r={direction:'DEBIT',status:'SUCCESS',recipient:s.recipient,amount:100,challenge:s.challenge,at:1100,reference:'fixture-1',source:'controlled-source'};
test('fresh envelope cannot refresh old transaction',()=>assert.equal(candidate({...r,at:999},s,1200,new Set()),false));
test('future transaction rejected',()=>assert.equal(candidate({...r,at:1201},s,1200,new Set()),false));
test('cross-session replay rejected even if challenge changes in fixture',()=>{const used=new Set();assert.equal(candidate(r,s,1200,used),true);assert.equal(candidate({...r,challenge:'B'},{...s,challenge:'B'},1200,used),false)});
test('matching fabricated row still passes model: provenance indispensable',()=>assert.equal(candidate({...r},s,1200,new Set()),true));
test('expiry boundary rejected',()=>assert.equal(candidate(r,s,s.end,new Set()),false));
