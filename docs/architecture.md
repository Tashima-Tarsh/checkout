# Flow
Browser creates session -> UPI intent or on-screen QR -> payer uses existing UPI app -> optional browser resume callback -> server logs UNVERIFIED -> synthetic signature research tests.

No bank/PSP APIs, financial webhooks, native checkout app, receipt validation from a live issuer or merchant credit check.

MCC is optional P2M metadata. Proof of actual debit would require an independently verifiable trusted issuer attestation and a supported browser delivery mechanism.
