// Research-only gate; not connected to checkout or any payment network.
// The configured adapter is a trusted server-side dependency, never supplied by the payer.
export async function evaluateEvidence({session, proof, verifyProof, now = Date.now}) {
  const rejected = reason => ({status:'UNVERIFIED', reason, financialDebitVerified:false});
  const validTime = t => Number.isSafeInteger(t);
  if (!session || !validTime(session.start) || !Number.isSafeInteger(session.amountMinor) ||
      session.amountMinor <= 0 || typeof session.challenge !== 'string' || !session.challenge ||
      typeof session.recipient !== 'string' || !session.recipient)
    return rejected('INVALID_SESSION');
  const inWindow = t => validTime(t) && t >= session.start && t < session.start + 120000;
  if (!inWindow(now())) return rejected('EXPIRED');
  if (typeof verifyProof !== 'function') return rejected('NO_TRUSTED_ADAPTER');
  let rows;
  try { rows = await verifyProof(proof); } catch { return rejected('PROOF_INVALID'); }
  const completedAt = now();
  if (!inWindow(completedAt)) return rejected('EXPIRED');
  if (!Array.isArray(rows)) return rejected('PROOF_INVALID');
  const matches = rows.filter(r => r && r.direction === 'DEBIT' &&
    r.status === 'SUCCESS' && r.recipient === session.recipient &&
    r.amountMinor === session.amountMinor && inWindow(r.at) && r.at <= completedAt &&
    r.challenge === session.challenge && typeof r.reference === 'string' && r.reference.length);
  if (matches.length !== 1) return rejected(matches.length ? 'AMBIGUOUS' : 'NO_BOUND_DEBIT');
  // Never assert production debit: real adapter, source semantics and durable
  // atomic reference consumption have not been validated.
  return {status:'RESEARCH_MATCH_ONLY', financialDebitVerified:false};
}
