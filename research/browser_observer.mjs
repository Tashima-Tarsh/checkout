/**
 * PDEP browser-side activity probe, not a debit witness.
 *
 * This module observes ONLY the checkout document's lifecycle.
 * It does not access other applications, notifications, or SMS.
 * A single attempt is cryptographically bound to the session on the server,
 * not to external app state.
 */
export class BrowserObserver {
  constructor({clock = () => performance.now(), send = () => {}, maxAgeMs = 900000} = {}) {
    this.clock = clock;
    this.send = send;
    this.maxAgeMs = maxAgeMs;
    this.active = null;
  }

  start(sessionId, attemptId) {
    if (!sessionId || !attemptId) throw new Error('Session and attempt are required');
    this.active = {
      sessionId, attemptId, startedAt: this.clock(),
      awayAt: null, returnedAt: null, outcome: 'HANDOFF_ATTEMPTED',
      traces: [{kind: 'HANDOFF_ATTEMPTED', elapsedMs: 0}]
    };
    this.send({sessionId, attemptId, event: 'HANDOFF_ATTEMPTED'});
  }

  onHidden(cause = 'visibilitychange') {
    const a = this.active;
    if (!a || a.returnedAt !== null || a.awayAt !== null || this.isExpired(a)) return;
    a.awayAt = this.clock();
    a.traces.push({kind: 'BROWSER_HIDDEN', cause, elapsedMs: a.awayAt - a.startedAt});
    this.send({sessionId: a.sessionId, attemptId: a.attemptId, event: 'BROWSER_HIDDEN'});
  }

  onVisible(cause = 'visibilitychange') {
    const a = this.active;
    if (!a || a.awayAt === null || a.returnedAt !== null || this.isExpired(a)) return;
    a.returnedAt = this.clock();
    a.outcome = 'BROWSER_RETURN_OBSERVED';
    a.traces.push({kind: 'BROWSER_RETURN_OBSERVED', cause,
                   elapsedMs: a.returnedAt - a.startedAt});
    this.send({sessionId: a.sessionId, attemptId: a.attemptId,
               event: 'BROWSER_RETURN_OBSERVED'});
  }

  isExpired(a = this.active) {
    return !a || this.clock() - a.startedAt > this.maxAgeMs;
  }

  snapshot() {
    if (!this.active) return null;
    const a = this.active;
    return {
      sessionId: a.sessionId, attemptId: a.attemptId,
      outcome: this.isExpired(a) ? 'EXPIRED' : a.outcome,
      awayObserved: a.awayAt !== null,
      returnObserved: a.returnedAt !== null,
      debitVerified: false,
      traces: a.traces.map(t => ({...t})),
    };
  }
}

/** Attach only with the payer's informed checkout action; no passive tracking. */
export function attachBrowserLifecycle(observer, doc = document, win = window) {
  const hide = () => observer.onHidden('visibilitychange');
  const visible = () => observer.onVisible('visibilitychange');
  const visibility = () => doc.visibilityState === 'hidden' ? hide() : visible();
  const pagehide = () => observer.onHidden('pagehide');
  const pageshow = () => observer.onVisible('pageshow');
  const focus = () => {
    if (doc.visibilityState === 'visible') observer.onVisible('focus');
  };
  doc.addEventListener('visibilitychange', visibility);
  win.addEventListener('pagehide', pagehide);
  win.addEventListener('pageshow', pageshow);
  win.addEventListener('focus', focus);
  return () => {
    doc.removeEventListener('visibilitychange', visibility);
    win.removeEventListener('pagehide', pagehide);
    win.removeEventListener('pageshow', pageshow);
    win.removeEventListener('focus', focus);
  };
}
