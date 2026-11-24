// Proposed CREDIT adapter contract, not observed MyUPI DOM labels.
// Input may be synthetic or user-controlled; this parser never attests payment.
export function normalizeCreditCandidate(row) {
  if (!row || row.direction !== 'CREDIT' || row.status !== 'SUCCESS') return null;
  if (!Number.isSafeInteger(row.amountMinor) || row.amountMinor <= 0) return null;
  if (typeof row.reference !== 'string' || !/^\d{12}$/.test(row.reference)) return null;
  if (typeof row.payerLast4 !== 'string' || !/^\d{4}$/.test(row.payerLast4)) return null;
  if (typeof row.receivingAccountId !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(row.receivingAccountId)) return null;
  if (typeof row.occurredAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(row.occurredAt)) return null;
  const occurredAtMs = Date.parse(row.occurredAt);
  if (!Number.isFinite(occurredAtMs)) return null;
  return Object.freeze({direction:'CREDIT',status:'SUCCESS',amountMinor:row.amountMinor,
    reference:row.reference,payerLast4:row.payerLast4,receivingAccountId:row.receivingAccountId,
    occurredAtMs,provenance:'UNTRUSTED_CANDIDATE',paymentVerified:false});
}
// Diagnostic matching only. Never use as a paid-state transition.
export function findCreditCandidates(order, rows) {
  if (!order || !Array.isArray(rows) || !Number.isSafeInteger(order.createdAtMs) ||
      !Number.isSafeInteger(order.deadlineMs) || order.deadlineMs < order.createdAtMs) return [];
  return rows.map(normalizeCreditCandidate).filter(r => r &&
    r.receivingAccountId === order.receivingAccountId &&
    r.amountMinor === order.amountMinor && r.payerLast4 === order.payerLast4 &&
    r.occurredAtMs >= order.createdAtMs && r.occurredAtMs <= order.deadlineMs);
}
