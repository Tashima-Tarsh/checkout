"""Cloud Email Observer - Independent observation provider.

Monitors authorized email accounts for UPI payment notifications and submits
signed observations to the Agentic-Recovery backend.

Security properties:
- Observation alone does NOT set financially_verified
- Device signature authentication required for submission
- Tenant isolation enforced
- Email observation is corroborating evidence only
- No SMS or email monitoring as PRIMARY transaction verification
"""

import email
import hashlib
import hmac
import imaplib
import re
import threading
import time
from dataclasses import dataclass, field
from typing import List, Optional

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ed25519

from .config import EmailObserverConfig


@dataclass
class ObservationEvent:
    """Observation event submitted to the backend."""

    observation_id: str
    device_id: str
    agent_id: Optional[str] = None
    checkout_id: Optional[str] = None
    observed_receiver_upi: Optional[str] = None
    payer_name: Optional[str] = None
    payer_upi_id: Optional[str] = None
    amount_paise: Optional[int] = None
    currency: Optional[str] = "INR"
    utr_rrn: Optional[str] = None
    app_transaction_id: Optional[str] = None
    transaction_direction: Optional[str] = "incoming"
    app_reported_status: Optional[str] = None
    transaction_timestamp: Optional[int] = None
    observation_timestamp: int = field(default_factory=lambda: int(time.time() * 1000))
    source_application: str = "email"
    evidence_type: str = "email"
    evidence_fingerprint: Optional[str] = None


class EmailObserver:
    """Cloud Email Observer that monitors email for UPI payment notifications.

    This observer connects to an IMAP server, searches for payment-related
    emails from allowed senders, extracts transaction details, signs them with
    a device key, and submits them to the Agentic-Recovery backend.

    Security:
    - Only processes emails from allowed sender domains
    - Device signs observation with Ed25519 key
    - Tenant isolation enforced via backend validation
    - Observation alone does NOT set financially_verified
    """

    def __init__(self, config: EmailObserverConfig, private_key_pem: str):
        self.config = config
        self.private_key_pem = private_key_pem
        self.private_key = serialization.load_pem_private_key(
            private_key_pem.encode(), password=None
        )
        self._running = False
        self._thread: Optional[threading.Thread] = None
        self._processed_ids: set = set()

    def start(self) -> None:
        """Start polling for emails in a background thread."""
        if self._running:
            return
        self._running = True
        self._thread = threading.Thread(target=self._poll_loop, daemon=True)
        self._thread.start()

    def stop(self) -> None:
        """Stop polling."""
        self._running = False
        if self._thread:
            self._thread.join(timeout=5)

    def _poll_loop(self) -> None:
        """Main polling loop."""
        while self._running:
            try:
                self._check_emails()
            except Exception as e:
                # Log error but continue polling
                pass
            time.sleep(self.config.check_interval_seconds)

    def _check_emails(self) -> None:
        """Check for new payment emails."""
        try:
            mail = imaplib.IMAP4_SSL(self.config.imap_host, self.config.imap_port)
            mail.login(self.config.email_address, self.config.email_password)
            mail.select("inbox")

            for sender in self.config.allowed_senders:
                _, messages = mail.search(None, f"FROM {sender}")
                if messages[0] != "OK":
                    continue

                msg_ids = messages[1][0].split()[-self.config.max_emails_per_check :]
                for msg_id in msg_ids:
                    if msg_id in self._processed_ids:
                        continue

                    _, data = mail.fetch(msg_id, "(RFC822)")
                    if data[0] is None:
                        continue

                    msg = email.message_from_bytes(data[0][1])
                    observation = self._parse_email(msg, msg_id)
                    if observation:
                        self._submit_observation(observation)

                    self._processed_ids.add(msg_id)

            mail.logout()
        except Exception:
            pass

    def _parse_email(self, msg: email.message.Message, msg_id: bytes) -> Optional[ObservationEvent]:
        """Parse email and extract payment details."""
        subject = msg["Subject"] or ""
        sender = msg["From"] or ""

        # Check if this is a payment-related email
        if not self._is_payment_email(subject, sender):
            return None

        # Extract body text
        body = self._get_email_body(msg)
        if not body:
            return None

        # Extract transaction details
        observed_receiver_upi = self._extract_upi_id(body)
        amount_paise = self._extract_amount(body)
        utr_rrn = self._extract_utr(body)
        payer_name = self._extract_payer_name(body)

        if not observed_receiver_upi or amount_paise is None:
            return None

        return ObservationEvent(
            observation_id=f"obs_email_{msg_id.decode() if isinstance(msg_id, bytes) else msg_id}",
            device_id=self.config.device_id,
            agent_id=None,
            checkout_id=None,
            observed_receiver_upi=observed_receiver_upi,
            payer_name=payer_name,
            payer_upi_id=None,
            amount_paise=amount_paise,
            currency="INR",
            utr_rrn=utr_rrn,
            app_transaction_id=None,
            transaction_direction="incoming",
            app_reported_status="SUCCESS",
            transaction_timestamp=None,
            observation_timestamp=int(time.time() * 1000),
            source_application="email",
            evidence_type="email",
            evidence_fingerprint=None,
        )

    def _is_payment_email(self, subject: str, sender: str) -> bool:
        """Check if email is payment-related from an allowed sender."""
        sender_lower = sender.lower()
        if not any(s.lower() in sender_lower for s in self.config.allowed_senders):
            return False

        subject_lower = subject.lower()
        payment_keywords = ["received", "payment", "paid", "credited", "upi", "₹", "inr"]
        return any(k in subject_lower for k in payment_keywords)

    def _get_email_body(self, msg: email.message.Message) -> str:
        """Extract text body from email."""
        body = ""
        if msg.is_multipart():
            for part in msg.walk():
                if part.get_content_type() == "text/plain":
                    payload = part.get_payload(decode=True)
                    if payload:
                        body = payload.decode("utf-8", errors="ignore")
                        break
        else:
            payload = msg.get_payload(decode=True)
            if payload:
                body = payload.decode("utf-8", errors="ignore")
        return body

    def _extract_upi_id(self, text: str) -> Optional[str]:
        """Extract UPI ID from email body."""
        match = re.search(r"[a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+", text)
        return match.group(0) if match else None

    def _extract_amount(self, text: str) -> Optional[int]:
        """Extract amount from email body and convert to paise."""
        match = re.search(r"₹?\s*([\d,]+(?:\.\d{1,2})?)", text)
        if not match:
            return None
        amount_str = match.group(1).replace(",", "")
        try:
            amount = float(amount_str)
            return int(amount * 100)
        except ValueError:
            return None

    def _extract_utr(self, text: str) -> Optional[str]:
        """Extract UTR/RRN from email body."""
        match = re.search(r"\b\d{12}\b", text)
        return match.group(0) if match else None

    def _extract_payer_name(self, text: str) -> Optional[str]:
        """Extract payer name from email body."""
        patterns = [
            re.compile(r"from\s+([^\s]+)", re.IGNORE_CASE),
            re.compile(r"paid by\s+([^\s]+)", re.IGNORE_CASE),
        ]
        for pattern in patterns:
            match = pattern.search(text)
            if match:
                return match.group(1)
        return None

    def _build_canonical_message(self, obs: ObservationEvent) -> str:
        """Build canonical message for device signature."""
        fields = [
            obs.observation_id,
            obs.device_id,
            obs.checkout_id or "",
            obs.observed_receiver_upi or "",
            obs.payer_name or "",
            obs.payer_upi_id or "",
            str(obs.amount_paise or ""),
            obs.currency or "",
            obs.utr_rrn or "",
            obs.app_transaction_id or "",
            obs.transaction_direction or "",
            obs.app_reported_status or "",
            str(obs.transaction_timestamp or ""),
            str(obs.observation_timestamp),
            obs.source_application or "",
            obs.evidence_type or "",
            obs.evidence_fingerprint or "",
        ]
        return "|".join(fields)

    def _sign_message(self, message: str) -> str:
        """Sign message with device Ed25519 key."""
        signature = self.private_key.sign(message.encode("utf-8"))
        return signature.hex()

    def _submit_observation(self, obs: ObservationEvent) -> None:
        """Submit signed observation to backend."""
        import urllib.request

        message = self._build_canonical_message(obs)
        signature = self._sign_message(message)

        payload = {
            "id": obs.observation_id,
            "device_id": obs.device_id,
            "agent_id": obs.agent_id,
            "checkout_id": obs.checkout_id,
            "observed_receiver_upi": obs.observed_receiver_upi,
            "payer_name": obs.payer_name,
            "payer_upi_id": obs.payer_upi_id,
            "amount_paise": obs.amount_paise,
            "currency": obs.currency,
            "utr_rrn": obs.utr_rrn,
            "app_transaction_id": obs.app_transaction_id,
            "transaction_direction": obs.transaction_direction,
            "app_reported_status": obs.app_reported_status,
            "transaction_timestamp": obs.transaction_timestamp,
            "observation_timestamp": obs.observation_timestamp,
            "source_application": obs.source_application,
            "evidence_type": obs.evidence_type,
            "evidence_fingerprint": obs.evidence_fingerprint,
            "signature": signature,
            "signature_timestamp": obs.observation_timestamp,
        }

        import json

        json_data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            self.config.backend_url,
            data=json_data,
            headers={
                "Content-Type": "application/json",
                "X-Tenant-Id": self.config.tenant_id,
                "X-Device-Id": self.config.device_id,
            },
            method="POST",
        )

        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                if resp.status != 202:
                    print(f"Email observer: backend returned {resp.status}")
        except Exception as e:
            print(f"Email observer: submission failed: {e}")