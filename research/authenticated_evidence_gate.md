# PDEP authenticated evidence feasibility gate

Research only; do not alter production debit state. No credentials, OTP, PIN,
cookies, browser session tokens, or unrelated transaction history are collected.

## Verified public documentation

- NPCI MyUPI: https://www.npci.org.in/product/myupi.html
  Cross-app transaction history and support are documented. An independently
  verifiable receipt, exact schema, correlation field and latency are unconfirmed.
- TLSNotary: https://tlsnotary.org/docs/extension/
  The documented browser client requires an extension. An ordinary browser
  integration without installation is unvalidated.
- TLSNotary FAQ: https://tlsnotary.org/docs/faq/
  MPC-TLS establishes provenance of selected server response data; it does
  not itself establish that the provider's semantics equal completed debit.

## Acceptance contract

A future authorized evidence adapter must establish issuer identity, proof
validity and freshness, final debit semantics, exact recipient, integer minor
units, unique reference and authoritative correlation to the checkout challenge.
All must match the server-owned 90-second session. A missing challenge or
ambiguous match must remain unverified. Atomically consume the transaction
reference once across sessions. Expiry means unverified, not proof of nonpayment.

Never accept browser-reported booleans asserting proof validity. A future
adapter must verify the original cryptographic proof on the server and derive
all fields from its authenticated content. No adapter is configured today.

## Physical acceptance test (not yet performed)

Use a consented, test-controlled account through the provider's normal supported
interface. Observe only the test transaction and record redacted field
availability and latency. Determine if an authorized proof interface exists
without installing software. Compare successful debit against cancellation,
wrong recipient and pending/reversed status. Do not bypass authentication,
access controls or provider restrictions. No automated transfer is performed.

Browser-only debit authorization is a separate unresolved requirement.
