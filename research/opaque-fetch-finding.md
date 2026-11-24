# Cross-origin opaque fetch negative control — 2026-11-24

Hypothesis: ordinary checkout JavaScript can read a debit-dependent response from another origin without cooperation using no-cors fetch. Fetch standard: https://fetch.spec.whatwg.org/#concept-filtered-response-opaque . The opaque response hides status, headers and body. Test two controlled origins with equal-length opposite synthetic outcomes, no CORS permission. Expected identical observable response fields; normal CORS fetch must reject. This does not test timing side channels or real payment providers. Client-reported traces can also be fabricated and are never proof; a nonce or replay cache cannot authenticate them.

Local Chromium attempt blocked by administrator policy (ERR_BLOCKED_BY_ADMINISTRATOR on localhost); no browser result claimed. CI experiment added after Playwright installation. Main baseline 4eaa1bee9bf83a0dbf506a22879ea453e88dc64e, successful run 45289067915. No physical devices or live UPI tests. No production changes.

Next hypothesis: a provider-authorized browser-only independent TLS verifier can bind authenticated response content to a fresh checkout challenge without extension; test on controlled HTTPS origin before any real provider access. Existing TLSNotary extension and verifier-output experiments do not establish this capability.
