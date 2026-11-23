/**
 * Browser PaymentRequest capability experiment (NO live payment execution).
 * The web payment handler may return structured data from a payment app, but a
 * JS object or reported success is NOT authenticated proof that funds moved.
 * This code never invokes show() or a third-party endpoint.
 */
export function analyzePaymentResponse({
  paymentResponse, expectedSessionId, expectedAmountPaise,
  expectedVpa, expectedMethod
}) {
  if (!paymentResponse || typeof paymentResponse !== 'object') {
    return {kind:'NO_RESPONSE', debitVerified:false};
  }
  const reportedMethod = String(paymentResponse.methodName ?? '');
  const details = paymentResponse.details;
  if (!details || typeof details !== 'object') {
    return {kind:'MALFORMED', debitVerified:false};
  }
  const methodMatches = reportedMethod === expectedMethod;
  // Fields are candidates only: a malicious page can construct the same JS
  // object. No external authenticator is verified by this module.
  const fields = {
    methodMatches,
    sessionMatches: details.sessionId === expectedSessionId,
    amountMatches: details.amountPaise === expectedAmountPaise,
    vpaMatches: typeof details.vpa === 'string' &&
      details.vpa.toLowerCase() === expectedVpa.toLowerCase(),
    responseReported: true
  };
  return {
    kind: Object.values(fields).every(Boolean) ? 'CORRELATED_BROWSER_RESPONSE' : 'UNMATCHED_RESPONSE',
    fields,
    debitVerified:false,
    provenanceAuthenticated:false,
    trustBoundary:'APP_TO_BROWSER_RESPONSE_NOT_SETTLEMENT_ATTESTATION'
  };
}

export function paymentCapabilities(env) {
  const paymentRequestAvailable = typeof env?.PaymentRequest === 'function';
  const secureContext = env?.isSecureContext === true;
  return {
    paymentRequestAvailable, secureContext,
    canAttemptBrowserPaymentUI: paymentRequestAvailable && secureContext,
    canAutomaticallyReadOtherAppNotifications:false,
    canAutomaticallyReadOtherAppSMS:false,
    canPromiseCrossAppDebitVerification:false
  };
}
