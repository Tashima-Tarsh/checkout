# Cloud Email Observer - Independent Observation Provider

## Overview

The Cloud Email Observer is an independent observation provider that monitors
authorized email accounts for UPI payment notifications. It operates as a
separate observation channel that corroborates other evidence sources.

## Security Model

- Observation alone does NOT set financially_verified
- Device/signature authentication required for submission
- Tenant isolation enforced
- No SMS or email monitoring as PRIMARY transaction verification
- Email observation is corroborating evidence only

## Implementation

The email observer consists of:

1. **Email Poller** - Connects to IMAP server, monitors for UPI payment emails
2. **Email Parser** - Extracts transaction details from email content
3. **Observation Submitter** - Signs and submits observations to backend
4. **Deduplication** - Prevents duplicate observations via UTR checking

## Configuration

```python
EMAIL_OBSERVER_CONFIG = {
    "imap_host": "imap.gmail.com",
    "imap_port": 993,
    "email_address": "merchant@example.com",
    "email_password": "APP_PASSWORD",  # App-specific password, never stored in code
    "check_interval_seconds": 60,
    "allowed_senders": [
        "noreply@gpay.google.com",
        "noreply@phonepe.com",
        "alerts@paytm.com",
    ],
    "tenant_id": "test-tenant",
    "device_id": "email-observer-001",
    "backend_url": "https://agenticpay.thenitishkr.in/api/recovery/observations/ingest",
}
```

## Usage

```python
from recovery.email_observer import EmailObserver

observer = EmailObserver(config)
observer.start()  # Starts polling in background thread
observer.stop()   # Stops polling
```

## Files

- `email_observer.py` - Main observer implementation
- `email_parser.py` - Email content parsing
- `email_config.py` - Configuration management

## Security Notes

- Email credentials should use app-specific passwords, never primary passwords
- IMAP over TLS (port 993) is required
- Email observations are tagged with evidence_type="email"
- Duplicate UTR detection prevents replay attacks
- Observations from email are NOT treated as standalone financial verification