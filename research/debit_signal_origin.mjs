export const EVIDENCE_ORIGINS = Object.freeze([
  'browser_lifecycle', 'payment_intent', 'copied_app_receipt',
  'browser_payment_response', 'device_signature', 'screen_content'
]);
/**
 * Research gate. Correlation must never be promoted to financial verification
 * merely because session/amount/recipient/nonce match.
 */
export function evidenceVerdict(input) {
  const bound = input.sessionMatches === true &&
    input.amountMatches === true && input.recipientMatches === true &&
    input.nonceMatches === true;
  if (!bound) return {status:'REJECTED',debitVerified:false,reason:'BINDING_FAILED'};
  if (EVIDENCE_ORIGINS.includes(input.origin)) {
    return {status:'CORRELATED_ONLY',debitVerified:false,reason:'PAYER_REPRODUCIBLE'};
  }
  return {status:'UNVERIFIED',debitVerified:false,reason:'NO_AUTHENTIC_DEBIT_SIGNAL'};
}
export function browserSurvey(env) {
  const nav=env.navigator || {};
  return {
    secureContext:env.isSecureContext===true,
    paymentRequestAvailable:typeof env.PaymentRequest==='function',
    clipboardReadAvailable:typeof nav.clipboard?.readText==='function',
    webShareAvailable:typeof nav.share==='function',
    screenCaptureAvailable:typeof nav.mediaDevices?.getDisplayMedia==='function',
    otherAppNotificationRead:false,
    automaticDebitEvidenceObserved:false
  };
}
