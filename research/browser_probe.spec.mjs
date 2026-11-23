import assert from 'node:assert/strict';
import {test} from 'node:test';
import {BrowserObserver} from './browser_observer.mjs';

const make = () => {
  let now = 0;
  const sent = [];
  const observer = new BrowserObserver({clock: () => now, send: x => sent.push(x)});
  return {observer, sent, advance: x => {now += x;}};
};

test('legitimate return after handoff is recorded but does not verify debit', () => {
  const t=make();t.observer.start('ps_1','at_1');t.advance(70);
  t.observer.onHidden();t.advance(15000);t.observer.onVisible();
  assert.equal(t.observer.snapshot().outcome,'BROWSER_RETURN_OBSERVED');
  assert.equal(t.observer.snapshot().debitVerified,false);
  assert.equal(t.sent.length,3);
});

test('fake payment and real payment can have indistinguishable browser traces', () => {
  const simulate = completedDebit => {
    const t=make();t.observer.start('ps_1','at_1');t.advance(70);
    t.observer.onHidden();t.advance(15000);t.observer.onVisible();
    return t.observer.snapshot();
  };
  assert.deepEqual(simulate(true),simulate(false),
    'Browser lifecycle alone cannot distinguish a payment from a cancel');
});

test('return before any observed hide does not create a callback', () => {
  const t=make();t.observer.start('ps_1','at_1');t.observer.onVisible();
  assert.equal(t.sent.length,1);
  assert.equal(t.observer.snapshot().returnObserved,false);
});

test('duplicate lifecycle notifications are idempotent', () => {
  const t=make();t.observer.start('ps_1','at_1');t.observer.onHidden('pagehide');
  t.observer.onHidden('visibilitychange');t.observer.onVisible('pageshow');
  t.observer.onVisible('focus');
  assert.equal(t.sent.length,3);
});

test('expired window cannot record a new return', () => {
  const t=make();t.observer.start('ps_1','at_1');t.observer.onHidden();
  t.advance(900001);t.observer.onVisible();
  assert.equal(t.observer.snapshot().outcome,'EXPIRED');
  assert.equal(t.observer.snapshot().debitVerified,false);
});

test('attempt switching discards the old attempt observations', () => {
  const t=make();t.observer.start('ps_1','at_1');t.observer.onHidden();
  t.observer.start('ps_2','at_2');t.observer.onVisible();
  assert.equal(t.sent.at(-1).event,'HANDOFF_ATTEMPTED');
  assert.equal(t.observer.snapshot().sessionId,'ps_2');
});

test('returned browser event is always observation, not proof', () => {
  const t=make();t.observer.start('ps_1','at_1');t.observer.onHidden();
  t.observer.onVisible();assert.equal(t.observer.snapshot().debitVerified,false);
});


// Deterministic adversarial fuzz: same event traces are possible both with and
// without a debit. This avoids treating navigation correlation as payment proof.
function seeded(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function scenario(seed, isDebit) {
  const random = seeded(seed);
  let now = 0;
  const events = [];
  const observer = new BrowserObserver({
    clock: () => now,
    send: event => events.push(event),
  });
  observer.start('ps_fuzz_' + seed, 'at_fuzz_' + seed);
  const loops = 4 + Math.floor(random() * 25);
  for (let i = 0; i < loops; i++) {
    now += 1 + Math.floor(random() * 6000);
    const chosen = Math.floor(random() * 4);
    if (chosen === 0) observer.onHidden('pagehide');
    if (chosen === 1) observer.onHidden('visibilitychange');
    if (chosen === 2) observer.onVisible('pageshow');
    if (chosen === 3) observer.onVisible('focus');
  }
  // The `isDebit` truth is intentionally NOT available to the observer;
  // this models the same observable browser path with opposite payment outcomes.
  void isDebit;
  return {snapshot: observer.snapshot(), events};
}

test('10000 paired debit/cancel browser traces remain indistinguishable', () => {
  for (let seed=1; seed<=10000; seed++) {
    const completed = scenario(seed, true);
    const cancelled = scenario(seed, false);
    assert.deepEqual(completed, cancelled, 'Trace parity failed at seed ' + seed);
    assert.equal(completed.snapshot.debitVerified, false);
  }
});

test('tamper with callback event stream cannot set verified status', () => {
  const t=make();
  t.observer.start('ps_critical', 'at_critical');
  t.observer.onHidden();
  t.observer.onVisible();
  t.sent.push({sessionId: 'ps_critical', attemptId: 'at_critical',
               event: 'PAYER_ASSERTS_DEBIT'});
  assert.equal(t.observer.snapshot().debitVerified, false);
});
