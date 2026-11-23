# PDEP Web-Browser-Only Evidence Research — experiment charter

Inspired by [karpathy/autoresearch](https://github.com/karpathy/autoresearch).
The benchmark MUST NOT be adjusted to make a weak candidate appear reliable.

## Non-negotiable architecture
- No custom Android/iOS apps, installed PWA, browser extensions, native SDKs.
- No privileged access to payer device, SMS inbox, notifications, or other apps.
- No payment-service APIs, webhooks, or external callbacks.
- Payee identity, amount and attempt must be bound to the checkout session.
- Browser observations are never described as authenticated debit evidence.
- User consent for anything shared from their device.
- Do not infer that a forged or simulated receipt means a real debit.

## Research question
Can any ordinary-browser-observable signal distinguish a successful
UPI debit from app cancellation, fake screen, passive app-switch, or a
compromised payer with the same browser lifecycle trace?

The relevant adversary can control their browser and supply arbitrary
JavaScript callbacks, receipt images, or copied text.

## Experiment loop
1. Hypothesize a browser-accessible signal.
2. Implement a single candidate in a research branch.
3. Simulate pairs of real/no-debit executions with identical device traces.
4. Record false positives at a fixed target: no false verified-debit.
5. Test 15-minute expiry, duplicates, replay, and tampering.
6. Keep only improvements in anti-replay, consent, or observation accuracy.
7. If the attacker can reproduce the signal without debit, reject it as proof.
8. Append measured results to results.tsv, including failures.

Run: `node --test research/browser_probe.spec.mjs`.
When browser automation is configured, also run Playwright with lifecycle
simulations on Android/iOS-like viewports. These are emulations, not real apps.

Do not attempt silent cross-app observation: the browser sandbox cannot access
another app's screens, Google Pay's private activity, or SMS contents.
A JavaScript listener remains in the checkout document even if the browser app
is backgrounded; it is not an observer inside the UPI app.

## Candidate matrix

| Candidate | Mechanism | Attacker reproduces without debit? | Proves debit? |
| --- | --- | --- | --- |
| visibilitychange/pagehide/pageshow | Browser document lifecycle | Yes | No |
| elapsed time outside browser | Time correlation | Yes | No |
| URL intent launch | Payment initiation | Yes | No |
| manually shared text/receipt | User-provided content | Yes | No |
| payer-side crypto signature | Attacker-controlled device | Yes | No |

Success requires identifying and validating an authentically debit-dependent
signal that a payer adversary cannot fabricate. If no such signal exists within
this trust boundary, report the impossibility clearly instead of marketing a
false 'zero fraud' result.

### References
- https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API
- https://developer.mozilla.org/en-US/docs/Web/API/Window/pagehide_event
- https://github.com/karpathy/autoresearch
- https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/How_to/Share_data_between_apps

## Adversarial fuzz extension

The test runner now compares 10,000 pairs of deterministic lifecycle traces,
one labeled debit and the other cancellation. The label is withheld from the
observer. The check asserts byte-for-byte equality of the observed traces and
never sets a positive debit verdict. This is a **negative control**, not an
observed real-payment dataset or proof of the absence of every possible signal.

The next research workstream is discovering a payer-visible artifact
which has an authenticated origin and an unforgeable session binding, and
testing whether such an artifact is obtainable using ordinary web-page
capabilities alone. The browser security boundary must be respected.


## Candidate 005: Browser-return plus exact session challenge correlation

New experimental code: `research/evidence_candidate.mjs`.
This adds strict amount/VPA matching, 15-minute challenge expiry, reference replay
rejection, and no external dependencies. It intentionally accepts an exact
payer-created receipt as **correlated but unverified**, not as a debit.

Negative control: a malicious payer can fabricate `source=Google Pay`,
`signed=true`, an exact amount, VPA, session nonce, and reference entirely
without a debit. No cryptographic signature is actually supplied by the
payment app or independently checked. The 10,000 fabricated receipts remain
unverified. This is a synthetic adversarial experiment, not real device data.

**Research implication:** To prove financial debit, identify a genuine
debit-dependent signal outside the payer's ability to forge. Do not treat
metadata matching as an authentication oracle.

Run both browser lifecycle and evidence candidate suites with:
`node --test research/*.spec.mjs`.

## Candidate 006: Payer-local nonextractable WebCrypto signing

Test suite: `research/device_signature.spec.mjs`. The same browser key can
validly sign an invented transaction whether a debit occurred or not. Marking
the private key nonextractable does **not** change that fact. An altered amount
invalidates the signature, so the signature protects payload integrity, but
not the truth of the payment assertion.

Expected classifications: `SIGNATURE_VALID` and `DEBIT_UNVERIFIED`.
No native application or installation required; pure browser-compatible
WebCrypto experiment. Reject this signal as debit evidence unless a genuine
debit-dependent signer with authenticated origin is identified.
