# Browser checkout endpoints
POST /api/sessions; GET /api/sessions/{id}?token=...; GET /api/sessions/{id}/qr.png?token=...; POST /api/sessions/{id}/observe?token=...; POST /api/sessions/{id}/proof?token=...; POST /api/demo/sessions/{id}/issue-test-proof?token=... (demo only); GET /api/sessions/{id}/events?token=...; GET /healthz.

P2P and P2M, optional merchant MCC, UPI deep link and generated QR. Client return is best-effort and NEVER debit evidence. Query bearer tokens, SQLite and per-process verifier are demo-only.
