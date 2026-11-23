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
