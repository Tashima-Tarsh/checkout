# Mobilerun Adapter — Android Observation Interface

## Pinned Upstream
- Repository: https://github.com/droidrun/mobilerun.git
- Pinned SHA: e34004270a9d7b68824b94a3a5ba6698cefea69d
- Branch: main
- Purpose: Authorized mobile interface research (observation testing only)

## Android Observer Interface

### Observer: NotificationListenerService (Kotlin)
- Package: `com.agentic.recovery.observer`
- Permission: `BIND_NOTIFICATION_LISTENER_SERVICE` (user-granted)
- Allowlist: Only approved UPI application packages (Google Pay, PhonePe, BHIM)
- Processing: Payment notifications only; OTPs and unrelated messages excluded
- Output: Amount, direction, status, timestamp, payer, UTR/RRN (if displayed)

### Observer: Native Android Keystore
- Key generation: Device-scoped key pair in Android Keystore
- Public key: Registered with backend during device enrollment
- Event signing: Device signs observation payload with private key
- Backend verification: Verify signature with registered public key

### Data Flow
1. UPI app shows payment notification
2. NotificationListenerService receives notification
3. Observer filters to payment events from allowlisted packages
4. Observer extracts available transaction fields
5. Observer signs observation with device private key
6. Observer POSTs signed observation to `/api/recovery/observations/ingest`
7. Backend verifies signature, correlates with checkout, updates ledger

### Constraints
- No customer-side APK installation
- No interception of encrypted traffic
- No access to private app storage
- No SMS/email transaction monitoring
- No autonomous payment initiation
- Observation alone does NOT set financially_verified

## License Status
REVIEW_REQUIRED — verify before production activation.

## Integration Status
ACTIVE (synthetic mode) — Observer interface defined locally.
Kotlin observer APK not yet built (requires Android Studio build).
Mock adapter used for all automated tests.