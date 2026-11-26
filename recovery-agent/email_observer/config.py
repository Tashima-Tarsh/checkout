"""Configuration for Cloud Email Observer."""

from dataclasses import dataclass
from typing import List, Optional


@dataclass
class EmailObserverConfig:
    """Configuration for email-based payment observation."""

    # IMAP server settings
    imap_host: str
    imap_port: int = 993
    email_address: str = ""
    email_password: str = ""  # App-specific password, never stored in code

    # Polling settings
    check_interval_seconds: int = 60
    max_emails_per_check: int = 50

    # Allowed senders for UPI payment notifications
    allowed_senders: List[str] = None

    # Tenant and device identification
    tenant_id: str = ""
    device_id: str = ""

    # Backend endpoint
    backend_url: str = ""

    def __post_init__(self):
        if self.allowed_senders is None:
            self.allowed_senders = [
                "noreply@gpay.google.com",
                "noreply@phonepe.com",
                "alerts@paytm.com",
            ]