# Agentic-Recovery Skill

## Purpose
Receiver-side UPI payment observation skill for the Agentic-Recovery system. Provides least-privilege tools for checkout creation, observation reporting, ledger lookup, and escalation.

## Tools

### create_checkout
Create a payment checkout session for an assigned employee.
- Input: employee_id, receiver_upi_id, amount_paise, currency, collection_case_id
- Output: checkout_id, upi_link, qr_code, expires, state
- Least privilege: Can only create checkouts for employees in the same tenant

### report_observation
Submit an authenticated observation from a registered Android device.
- Input: device_id, observation_id, observed fields, signature, signature_timestamp
- Output: observation_id, checkout_correlation, financially_verified
- Least privilege: Requires valid device signature; signature authenticates reporter, not settlement

### lookup_ledger
Query employee or central ledger entries.
- Input: employee_id or tenant_id
- Output: list of ledger entries with amounts, states, references

### escalate
Flag a transaction for manual review.
- Input: checkout_id, reason, severity
- Output: escalation_id, status

## Constraints
- No agent can change amounts
- No agent can assign its own receiver
- No agent can generate reference numbers
- No agent can trigger transfers
- No agent can declare settlement (financially_verified requires separate evidence)
- Deterministic parsing and matching do not require an LLM
- Event-driven workers share one inference pool

## State Machine
CREATED → AWAITING_PAYMENT → PAYMENT_OBSERVED → DETAILS_INCOMPLETE → MATCH_PENDING → APP_REPORTED_SUCCESS → RECONCILED → FINANCIALLY_VERIFIED → FAILED → REVERSED → EXPIRED → REVIEW_REQUIRED

## Security
- Device-scoped credentials
- Encrypted transport (HTTPS)
- Replay prevention (nonce + timestamp)
- Rate limiting
- Idempotency (unique event IDs)
- Redacted audit trails (no secrets in detail field)
