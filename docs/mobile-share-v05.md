# PDEP v0.5: browser-only mobile evidence collection (no installation)

**No app installation, PWA, service worker, native SDK, or extension is required or used.**

The payer initiates UPI from an ordinary browser session. A return to the browser is recorded as a **device observation** only. Google Pay and other UPI apps control their own Share actions; a regular webpage cannot register itself as an OS-native share destination without installation. Therefore, a supported zero-install flow is:

1. After an UPI-app action, the payer copies shared receipt text, notification text, or SMS content, or saves a receipt file using functionality already available on their device.
2. The payer returns to the open checkout page and selects **Attach mobile evidence**.
3. The payer pastes the text or chooses the file from the browser, and explicitly submits it.
4. The server binds its SHA-256 digest, byte length and source label to the authenticated checkout session. Duplicate bytes are deduplicated by a database uniqueness constraint. No raw messages, SMS, screenshots, or files are retained in the checkout database.
5. Browser return, screenshots, payer claims and locally shared content **do not prove debit**, even if amount and VPA appear to match. Nothing changes `financially_verified` to true.

No bank API, PSP integration, aggregator, webhook, SMS permissions or notification-reading permissions are used.

## Testing requirements
Test Android Chrome and iOS Safari in real devices when accessible; Playwright emulation alone is not a native UPI test. Model rooted-device tampering, forged messages, replay, cross-session evidence and malicious uploads. No actual financial transactions are performed automatically.

## Production deployment
This branch adds one additive `0004_mobile_share` migration for evidence digests. Existing PostgreSQL sessions and routing inventory are unaffected. Deployment to Railway must pass CI and live health checks first.
