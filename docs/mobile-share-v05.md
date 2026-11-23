# PDEP Mobile Evidence Intake v0.5

A browser cannot automatically read notifications, SMS inboxes or data inside another app.
This implementation offers two consent-based paths:
1. On an Android browser with installed PWA support, install PDEP from the browser and use a UPI app's **Share** action, if the app and OS expose a compatible share-sheet item. Select the installed PDEP target. The server returns a single-use claim code; paste it into the originating checkout session to bind the item without sharing the checkout authorization token.
2. On any compatible browser, explicitly paste copied SMS/notification/receipt text or upload a receipt file in **Attach mobile evidence**. Only the SHA-256 digest, byte length and source category are stored; raw message bodies and screenshots are not retained.

PWA share-target support differs by browser and operating system. Google Pay's share UI is not controlled by the checkout, and an exact in-app share-to-PDEP path cannot be guaranteed.
A 10-minute one-time code links an incoming share to an authenticated checkout session. Claim codes are not payment-success credentials. Uploaded evidence is labeled **PAYER_SUBMITTED_UNVERIFIED**, and `financially_verified` stays false.

No automatic capture of SMS, notification content or device activity occurs. No native mobile app or prohibited payment-service integrations are required.

Production cautions: strict 2 MB/file limits, supported types only, hashing without storing private content, deduplication; consider additional per-IP rate limiting and explicit user consent flows before opening this to broad public use. Browser test automation is not equivalent to physical Android/iOS testing.
