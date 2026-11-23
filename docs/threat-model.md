# Threat model
Payer fully controls browser and can root their device, inject JS, fake UTR/screenshots, manipulate app-return events, reuse old receipts and fabricate callbacks. These client observations never set financially_verified=true.

Synthetic Ed25519 signatures only validate cryptographic mechanics, not real debits. Real payment finality, refunds/reversals, privileged issuer keys and identity binding remain unsolved. Do not treat this code as production-ready.
