import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createChallenge, decimalToPaise, EvidenceLedger} from './evidence_candidate.mjs';

const challenge = createChallenge({
  sessionId: 'ps_consent_12345', vpa: 'receiver@upi', amountPaise: 100,
  nonce: 'abcdef1234567890abcdef1234567890', createdMs: 1000
});
const claim = Object.freeze({
  sessionId: challenge.sessionId, nonce: challenge.nonce,
  vpa: 'receiver@upi', amount: '1.00', reference: 'UTR123456'
});
const accepted = (r) => r.accepted === true;

test('exact decimal amounts accepted, malformed values rejected', () => {
  assert.equal(decimalToPaise('1'), 100);
  assert.equal(decimalToPaise('1.00'), 100);
  assert.equal(decimalToPaise('99999.99'), 9999999);
  for (const s of ['1.001', '-1', '1e4', '1,000', '01.00', 'NaN', '1.5.0', '']) {
    assert.throws(() => decimalToPaise(s));
  }
});

test('valid correlated payer claim remains financially unverified', () => {
  const result = new EvidenceLedger().assess(challenge, claim, 2000);
  assert.ok(accepted(result));
  assert.equal(result.classification, 'CORRELATED_PAYER_CLAIM');
  assert.equal(result.provenanceAuthenticated, false);
  assert.equal(result.debitVerified, false);
});

test('a payer can forge a perfect correlated claim without debit', () => {
  const forged = {...claim, reference: 'FAKE12345'};
  const result = new EvidenceLedger().assess(challenge, forged, 2000);
  assert.equal(result.accepted, true);
  assert.equal(result.debitVerified, false);
  assert.equal(result.provenanceAuthenticated, false);
});

test('replay is rejected even if callback re-sent after browser return', () => {
  const ledger = new EvidenceLedger();
  assert.equal(ledger.assess(challenge, claim, 2000).accepted, true);
  const result = ledger.assess(challenge, claim, 3000);
  assert.equal(result.reason, 'REPLAY');
  assert.equal(result.debitVerified, false);
});

test('amount and VPA substitutions rejected', () => {
  for (const [field, replacement, expected] of [
    ['vpa', 'attacker@upi', 'RECIPIENT_MISMATCH'],
    ['amount', '10.00', 'AMOUNT_MISMATCH'],
    ['nonce', 'z'.repeat(32), 'CHALLENGE_MISMATCH'],
    ['sessionId', 'ps_different_12345', 'CHALLENGE_MISMATCH'],
  ]) {
    const result = new EvidenceLedger().assess(challenge, {...claim, [field]: replacement}, 2000);
    assert.equal(result.reason, expected, field);
  }
});

test('expired or clock-invalid receipt cannot become valid', () => {
  const ledger = new EvidenceLedger();
  assert.equal(ledger.assess(challenge, claim, challenge.expiresMs + 1).reason, 'EXPIRED');
  assert.equal(ledger.assess(challenge, claim, 999).reason, 'EXPIRED');
  assert.throws(() => ledger.assess(challenge, claim, Number.NaN));
});

test('correlating multiple convincing but fabricated receipts does not prove debit', () => {
  const ledger = new EvidenceLedger();
  let falseFinancialVerification = 0;
  for (let i=0; i<10000; i++) {
    const result = ledger.assess(challenge, {...claim, reference: 'FAKE' + String(i).padStart(8,'0')}, 2000);
    assert.equal(result.accepted, true);
    if (result.debitVerified) falseFinancialVerification++;
  }
  assert.equal(falseFinancialVerification, 0);
});

test('untrusted object input rejected', () => {
  const ledger = new EvidenceLedger();
  assert.equal(ledger.assess(challenge, null, 2000).reason, 'MALFORMED');
  assert.equal(ledger.assess(challenge, {}, 2000).reason, 'CHALLENGE_MISMATCH');
});

test('claimed success is not credible source authentication', () => {
  const forged = {...claim, successful: true, source: 'Google Pay', signed: true};
  const result = new EvidenceLedger().assess(challenge, forged, 2000);
  assert.equal(result.provenanceAuthenticated, false);
  assert.equal(result.debitVerified, false);
});
