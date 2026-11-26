# Cloud Email Observer Implementation

## Overview

Independent observation provider that monitors authorized email accounts for
UPI payment notifications. Operates as a separate observation channel that
corroborates other evidence sources.

## Security Properties

- Observation alone does NOT set financially_verified
- Device signature authentication required for submission
- Tenant isolation enforced
- Email observation is corroborating evidence only
- No SMS or email monitoring as PRIMARY transaction verification

## Files

- `email_observer.py` - Main observer with IMAP polling and observation submission
- `config.py` - Configuration management

## Usage

```python
from recovery.email_observer.email_observer import EmailObserver
from recovery.email_observer.config import EmailObserverConfig

config = EmailObserverConfig(
    imap_host="imap.gmail.com",
    imap_port=993,
    email_address="merchant@example.com",
    email_password="APP_PASSWORD",
    tenant_id="test-tenant",
    device_id="email-observer-001",
    backend_url="https://agenticpay.thenitishkr.in/api/recovery/observations/ingest",
)

observer = EmailObserver(config)
observer.start()  # Starts polling in background thread
observer.stop()   # Stops polling
```