/**
 * PDEP constrained-web experiment: correlation, replay, and authenticity boundary.
 *
 * This is NOT a payment-verification library. It models how payer-controlled
 * text/URL data can be correlated with an immutable checkout challenge.
 * A matching claim may be admissible to human review, but the source is
 * untrusted. No external app, payment integration or installed component.
 */
export function normalizeVpa(value) {
  if (typeof value !== 'string') throw Error('Invalid VPA');
  const normalized = value.trim().toLowerCase();
  if (!/^[a-z0-9_.-]{2,256}@[a-z0-9_.-]{2,64}$/.test(normalized)) {
    throw Error('Invalid VPA');
  }
  return normalized;
}
function matchingDigits(a, b) {
  // This is deliberately exact decimal parsing: never accept float rounding
  // or a substring that can match a different number.
  return /^\d{1,7}(\.\d{1,2})?$/.test(a) && decimalToPaise(a) === b;
}
export function decimalToPaise(value) {
  if (typeof value !== 'string') throw Error('Expected decimal string');
  const match = /^(0|[1-9]\d{0,6})(?:\.(\d{1,2}))?$/.exec(value);
  if (!match) throw Error('Invalid amount');
  return Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'));
}
export function createChallenge({sessionId, vpa, amountPaise, nonce, createdMs, ttlMs = 900000}) {
  if (!/^ps_[A-Za-z0-9_-]{8,64}$/.test(sessionId)) throw Error('Invalid session ID');
  if (!/^[a-zA-Z0-9_-]{32,128}$/.test(nonce)) throw Error('Nonce too short');
  if (!Number.isSafeInteger(amountPaise) || amountPaise < 100) throw Error('Invalid amount');
  if (!Number.isSafeInteger(createdMs) || createdMs < 0) throw Error('Invalid time');
  if (!Number.isSafeInteger(ttlMs) || ttlMs < 1000 || ttlMs > 900000) throw Error('Invalid TTL');
  return Object.freeze({
    sessionId, vpa: normalizeVpa(vpa), amountPaise,
    nonce, createdMs, expiresMs: createdMs + ttlMs
  });
}
export class EvidenceLedger {
  constructor() {
    this.used = new Set();
  }
  /**
   * Takes structured data that was obtained via explicit consent.
   * attackerModel=PA​YER_CONTROLLED is a fundamental property, not a heuristic.
   * Compare against the server-issued challenge; do not accept payment success
   * or provenance claims from untrusted content as definitive.
   */
  assess(challenge, submitted, nowMs) {
    if (!Number.isSafeInteger(nowMs) || nowMs < 0) throw Error('Invalid timestamp');
    if (!submitted || typeof submitted !== 'object') return this.reject('MALFORMED');
    if (nowMs > challenge.expiresMs || nowMs < challenge.createdMs) return this.reject('EXPIRED');
    if (submitted.sessionId !== challenge.sessionId ||
        submitted.nonce !== challenge.nonce) return this.reject('CHALLENGE_MISMATCH');
    if (normalizeVpa(submitted.vpa) !== challenge.vpa) return this.reject('RECIPIENT_MISMATCH');
    if (!matchingDigits(submitted.amount, challenge.amountPaise)) return this.reject('AMOUNT_MISMATCH');
    if (typeof submitted.reference !== 'string' ||
        !/^[A-Za-z0-9_-]{6,64}$/.test(submitted.reference)) return this.reject('REFERENCE_MALFORMED');
    const key = challenge.sessionId + ':' + submitted.reference;
    if (this.used.has(key)) return this.reject('REPLAY');
    this.used.add(key);
    return Object.freeze({
      accepted: true, classification: 'CORRELATED_PAYER_CLAIM',
      provenanceAuthenticated: false, debitVerified: false,
      reference: submitted.reference
    });
  }
  reject(reason) {
    return Object.freeze({
      accepted: false, reason,
      classification: 'REJECTED_PAYER_CLAIM',
      provenanceAuthenticated: false, debitVerified: false
    });
  }
}
