# Browser-mediated UPI PaymentResponse: capability hypothesis

## Evidence and research scope
Google Pay for India's developer documentation describes a browser
`PaymentRequest.show()` flow that returns a structured `PaymentResponse`.
This is a more direct browser observation than `visibilitychange`.
References:
- https://developers.google.com/pay/india/api/web/pay-ui
- https://developers.google.com/pay/india/api/web/handle-response
- https://developer.mozilla.org/en-US/docs/Web/API/Payment_Request_API

## Hard constraints
1. The documented example uses a merchant-specific payment method and merchant
   data. We **have not shown** it works for arbitrary P2P recipients, any UPI
   app, iOS Safari, or without provider onboarding. Do not silently add it to
   customer checkout.
2. Documentation describes subsequent server-side verification. This research
   does not use any prohibited integration and cannot claim a completed debit.
3. An attacker can fabricate a `PaymentResponse`-shaped JSON object and submit
   it to an ordinary web endpoint. Therefore mere shape/field consistency has
   no authenticated financial provenance.
4. Application-level `PaymentResponse.complete()` is not a payment receipt.
5. No live transaction, handset, or external application was used in this probe.

## Falsifiable next experiment
On an explicitly authorized physical Android and iOS test device, determine:
- whether a browser's supported payment handler can return a response in the
  user's strict no-install scenario;
- whether merchant-specific configuration is required;
- whether any response has an issuer-authenticated, replay-proof and
  session-bound debit-dependent property;
- whether attacker-controlled browser replay produces the same observed data.

If provider onboarding or out-of-band verification is necessary, mark this
candidate **incompatible with project constraints**, not complete.
Run: `node --test research/payment_response_probe.spec.mjs`.
