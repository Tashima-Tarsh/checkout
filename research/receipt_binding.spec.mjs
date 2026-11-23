import {test} from 'node:test';
import assert from 'node:assert/strict';

// Research-only: normalized rows supplied as synthetic fixtures. This does
// not verify TLS, authenticate a payment provider, or authorize debit.
function correlate(session, rows, now) {
  if (!Number.isSafeInteger(now) || now < session.start || now >= session.start + 120_000)
    return 'EXPIRED';
  const candidates = rows.filter(r => r.direction === 'DEBIT' &&
    r.status === 'SUCCESS' && r.recipient === session.recipient &&
    r.amountMinor === session.amountMinor && Number.isSafeInteger(r.at) &&
    r.at >= session.start && r.at <= now &&
    typeof r.reference === 'string' && r.reference.length > 0);
  const bound = candidates.filter(r => r.challenge === session.challenge);
  if (bound.length > 1) return 'AMBIGUOUS';
  if (bound.length === 1) return 'CORRELATED_ONLY';
  return candidates.length ? 'UNBOUND' : 'NO_MATCH';
}
const s = {start: 1000, recipient: 'research@upi', amountMinor: 100, challenge: 'test-session-A'};
const r = {direction:'DEBIT', status:'SUCCESS', recipient:s.recipient, amountMinor:100, at:2000, reference:'fixture-1', challenge:s.challenge};
for (const [name, rows, now, expected] of [
  ['matching synthetic receipt', [r], 3000, 'CORRELATED_ONLY'],
  ['missing challenge', [{...r,challenge:undefined}], 3000, 'UNBOUND'],
  ['wrong challenge', [{...r,challenge:'other'}], 3000, 'UNBOUND'],
  ['wrong recipient', [{...r,recipient:'other@upi'}], 3000, 'NO_MATCH'],
  ['wrong amount', [{...r,amountMinor:101}], 3000, 'NO_MATCH'],
  ['credit instead of debit', [{...r,direction:'CREDIT'}], 3000, 'NO_MATCH'],
  ['pending transaction', [{...r,status:'PENDING'}], 3000, 'NO_MATCH'],
  ['old transaction', [{...r,at:999}], 3000, 'NO_MATCH'],
  ['future transaction', [{...r,at:3001}], 3000, 'NO_MATCH'],
  ['missing transaction reference', [{...r,reference:''}], 3000, 'NO_MATCH'],
  ['duplicate matching receipts', [r,{...r,reference:'fixture-2'}], 3000, 'AMBIGUOUS'],
  ['deadline boundary', [r], 121000, 'EXPIRED'],
]) test(name, () => assert.equal(correlate(s,rows,now),expected));
