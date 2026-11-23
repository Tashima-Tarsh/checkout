# PDEP physical mobile debit-evidence test matrix

**The only three objectives:** (1) automatic genuine debit evidence capture on payer mobile using ordinary browser; (2) genuine debit versus forgery; (3) physical Android and iOS validation with existing UPI apps.

No physical-device transactions are claimed by adding this protocol.

## Authorized physical test setup
Use only your own two test-controlled UPI identities, an ordinary browser tab over HTTPS, and already-installed UPI applications. Do not install PDEP native apps, PWAs or browser extensions. Do not upload full receipts, financial account numbers, PINs, SMS contents, or phone numbers.

| Test | Android Chrome + Google Pay | Android Chrome + PhonePe | iOS Safari + available UPI app |
| --- | --- | --- | --- |
| Actual successful debit and return | Not run | Not run | Not run |
| Cancel payment before debit | Not run | Not run | Not run |
| App open/close without payment | Not run | Not run | Not run |
| Forged return and replay | Not run | Not run | Not run |
| Payment note nonce echoed in app share | Not run | Not run | Not run |
| Share content into existing browser tab without installation | Not run | Not run | Not run |
| Verify authentic origin of debit-dependent field | Not run | Not run | Not run |

## Record
- OS / browser / UPI app versions, physical vs emulated, permission prompts.
- Time-bound session ID and nonce challenge; payment amount and recipient bound.
- Whether any **automatic** browser-observable field changes ONLY upon debit.
- How often a fake/cancelled transaction generates the same observation.
- Whether shared evidence comes from an origin the payer cannot impersonate.
- Preserve redacted local logs without exposing financial identifiers.

## Honest release gate
Pass only when Android and iOS actual UPI app trials establish an authenticated, nonce-bound, anti-replay debit-dependent observation with no false debit verified in negative controls. Simulated tests and browser API availability are not substitutes for real-device outcomes.
