# Flow

The server allocates a non-recycled payable paise amount under the receiving-account row lock and creates a 30-minute checkout. The payer copies the receiving UPI ID, pays that exact ID and amount in any UPI app, and starts live verification through an explicit browser display-capture action.

Every frame requires a short-lived, single-use server challenge bound to the checkout. OCR runs in memory. The settlement policy accepts only a fresh successful observation with the exact payee, exact reserved amount, and a valid unused transaction reference. The server compares these fields, reserves the reference globally, and writes `PAID` in the same transaction. Any mismatch, uncertainty, expired challenge, or replay remains unverified.

A chime only requests a fresh frame. Browser return events and copy ticks do not settle. Red is a diagnosis, not the end of the session: another fresh frame can settle before checkout expiry. A settled order remains green on reload; an expired unsettled order cannot settle retroactively.

# Privacy and data minimization

No screenshot upload, camera, microphone, or audio recording is used. Raw frames and OCR text are never persisted or returned. PIN/OTP labels, balances, and unmasked account numbers are rejected. Masked last-4 text is ignored rather than extracted. The API returns only amount, payee-match status, state, and a minimized reason. Raw payee identifiers and transaction references stay transient; storage contains only the reference digest, verdict, observed amount when relevant, and timestamps. No account history, available balance, full account number, or unrelated transaction is read or retained.

MCC is optional P2M metadata, not debit evidence.

# Whole-rupee shared amount checkout

The merchant portal requests shared-amount orders in whole rupees, without discounts. Each order has its own random 48-character checkout reference and 30-minute expiry. The public automatic UAT allocator defaults to shared ₹1 orders; the previous unique-amount allocator remains available explicitly with AGENTIC_TEST_SHARED_AMOUNT=0 for compatibility. Existing orders retain their original amount.

The checkout presents a Verification checkbox before Copy UPI ID. Ticking requests verification; it does not itself prove payment or grant capture permission. Return triggers a status check. On shared-amount orders, the reference identifies the checkout, not a UPI transaction. Copying only a VPA does not transmit the checkout reference to the UPI app. Until an independently authenticated transaction-to-order link exists, these orders remain observational and cannot consume the settlement ledger; the live frame endpoint rejects them. No financial verification is inferred from an amount, reference uniqueness, checkbox or browser return. The existing unique-amount settlement rules remain unchanged.
