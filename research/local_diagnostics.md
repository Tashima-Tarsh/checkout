# Local checkout diagnostic research

Opt-in: add diagnostic_lab=1 to a test checkout URL in an approved research deployment. Press Start local trace before the controlled experiment, then Stop trace. Copy the redacted JSON manually if required. No trace is uploaded or persisted; navigation or browser discard can lose it. The normal checkout remains unchanged when the flag is absent. No payment is required for the synthetic browser test.

Only fixed first-party event labels and 100 ms relative times are retained, for at most 64 events and five minutes of event recording. No URL, app ID, receipt, pixels, clipboard contents, credential, payment details or device identifier is recorded. A trace does not prove which app opened or whether debit occurred. The module does not invoke any new payment action or financial state transition. The existing I Paid behavior remains unchanged.

Controlled Android comparisons: on an authorized test device, use existing OS diagnostic facilities under the operator's control; retain only redacted aggregate experiment labels (success, cancellation, no payment), not private app contents. Compare checkout observations across these labelled trials. Keep ground truth separate from browser observations. An identical observation across labels rejects its use as a deterministic debit proof. Physical trials are not claimed.

Current limits: no screenshot acquisition, no cross-app handshake, no live debit source, no Android trace importer. These are not solved by browser telemetry. Do not enable covert collection or test third-party targets. Do not deploy without green CI and owner approval.

Diagnostics now require the separate `/checkout/<order-id>/diagnostics?diagnostic_lab=1` path. The standard checkout ignores diagnostic query flags and never renders start/stop controls.
