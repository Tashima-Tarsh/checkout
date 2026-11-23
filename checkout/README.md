# Browser checkout API

Create a session with `POST /api/sessions`. The response provides a session ID and a bearer credential once. Send `Authorization: Bearer <token>` on subsequent session requests. The HTML checkout keeps the token in memory.

| Route | Purpose |
| --- | --- |
| `GET /api/sessions/{id}` | Read the amount, recipient, URI, expiry and evidence state |
| `GET /api/sessions/{id}/qr.png` | Generate the QR image for an active session |
| `POST /api/sessions/{id}/observe` | Record an idempotent browser observation |
| `POST /api/sessions/{id}/proof` | Record the proof validation result |
| `GET /api/sessions/{id}/events` | Read browser observations |
| `POST /api/demo/sessions/{id}/issue-test-proof` | Issue a synthetic receipt in local demo mode |
| `GET /healthz` | Check application and database readiness |

P2P uses a personal recipient. P2M supports optional merchant MCC. Browser observations and synthetic receipts leave financial verification false.
