/**
 * PDEP novelty experiment: nonce-carrier round trip.
 * The browser embeds a single-use challenge into the UPI transaction note,
 * then checks whether information voluntarily carried back by the user
 * contains the same challenge. This establishes CORRELATION, not settlement.
 */
export function makeNonceCarrier({vpa, payeeName, amount, nonce}) {
  if (!/^[a-zA-Z0-9_-]{24,96}$/.test(nonce)) throw Error('Weak nonce');
  if (!/^[\w.-]+@[\w.-]+$/.test(vpa)) throw Error('Bad VPA');
  if (!/^(0|[1-9]\d{0,5})\.\d{2}$/.test(amount)) throw Error('Bad amount');
  const marker = 'PD' + nonce.slice(0, 26);
  const note = 'PDEP ' + marker;
  const params = new URLSearchParams({pa:vpa,pn:payeeName,am:amount,cu:'INR',tn:note});
  return {uri:'upi://pay?' + params.toString(), marker, note};
}
export function analyzeRoundTrip({marker, copiedReceipt, reportedReference}) {
  if (typeof copiedReceipt !== 'string' || typeof marker !== 'string')
    return {observed:false,debitVerified:false,reason:'MISSING_INPUT'};
  const trimmed=copiedReceipt.slice(0, 10000);
  // A pasted receipt can be forged: correlation alone is never promoted
  // to authentic evidence.
  const observed=trimmed.includes(marker);
  return {observed, debitVerified:false, status: observed ?
    'CHALLENGE_ECHO_OBSERVED_UNTRUSTED' : 'CHALLENGE_NOT_FOUND',
    source:'PAYER_CONTROLLED_PASTE',
    reportedReference:typeof reportedReference === 'string' ? reportedReference.slice(0,100) : null};
}
