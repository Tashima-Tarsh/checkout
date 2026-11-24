# Agentic Pay isolated Android/browser UAT
Reuses the checkout visual shell and synthetic boundary kit. Research-only, not served by production. No live UPI, n8n, database, payment endpoint, notification reading, SMS reading, clipboard reading, or third-party app probing. No vulnerability is asserted. 
Open android/ in Android Studio with JDK 17, SDK 35 and Gradle 8.9 (wrapper not bundled). Build in an isolated emulator. Grant only permission to post the app's own notifications.
Run python -m http.server 8765 --bind 127.0.0.1 --directory web from this directory. Use adb reverse tcp:8765 tcp:8765 and open http://127.0.0.1:8765/ in emulator Chrome (localhost permits clipboard write where supported). 
1. Record Android/browser version and permissions. Start observation, copy synthetic identifier, switch to lab app and post notification, return and click simulated I Paid. Export log before recording canary separately. 
2. Repeat without notification. 
3. In a new session intentionally enter synthetic canary in positive control and export. Run node web/test.mjs and node web/analyze.mjs exported-log.json LAB-<32 hex characters>. 
The shipped browser logs do not contain an unauthorized data acquisition path. Negative control establishes lifecycle baseline, not absence of vulnerabilities. Positive control is intentional disclosure. Never enter real banking information. Do not deploy research page to production.
References: https://developer.android.com/privacy-and-security/risks/insecure-webview-native-bridges ; https://source.android.com/docs/security/app-sandbox ; https://www.chromium.org/Home/chromium-security/site-isolation/ . These describe security boundaries, not a confirmed vulnerability.
