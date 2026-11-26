# Agentic-Recovery

Receiver-side UPI payment observation system for the Agentic-Recovery digital recovery employee platform.

## Overview

Agentic-Recovery enables 1,000 digital recovery employees, each with:
- A unique employee ID
- An assigned Android receiving device
- One authorized receiving UPI ID
- An authenticated official UPI application
- A per-employee ledger view

Employees create checkouts using their assigned UPI ID, present the link/QR to customers, and receive authenticated observations when payments arrive. The backend matches observations to checkouts and updates employee and central ledgers.

## Architecture

```
Android Device (UPI App) → NotificationListenerService → Observer Agent → FastAPI Ingestion → n8n Workflow → PostgreSQL Ledger → Checkout View
```

## Key Design Principles

1. **Payer-side evidence only** — No customer APK, no manual UTR, no screenshots
2. **No bank/PSP integration** — No Razorpay, Cashfree, Juspay, or bank APIs
3. **No SMS/email monitoring** — Only UPI app notifications via NotificationListenerService
4. **No autonomous payment initiation** — Agents are read-only observers
5. **Observation ≠ Verification** — `financially_verified` requires independent evidence matching
6. **Device signature authenticates reporter, not settlement**

## Project Structure

```
D:\Agentic-Recovery\
├── recovery/           # FastAPI backend (models, storage, api, server)
├── tests/              # Unit and integration tests (19 tests)
├── migrations/         # Alembic database migrations
├── config/             # Policy and upstream configuration
├── skills/             # Recovery skill definition (SKILL.md)
├── adapters/           # Adapter boundary documentation
├── .venv/              # Python virtual environment
├── .env.example        # Environment template (no secrets)
├── FILE-LOCATIONS.md   # Complete file manifest
├── RUNBOOK.md          # Startup, shutdown, rollback procedures
├── requirements.txt    # Python dependencies
└── README.md           # This file
```

## Quick Start

```powershell
# 1. Activate virtual environment
D:\Agentic-Recovery\.venv\Scripts\Activate.ps1

# 2. Configure environment
Copy-Item .env.example .env
# Edit .env with your DATABASE_URL and other settings

# 3. Run migrations
D:\Agentic-Recovery\.venv\Scripts\python.exe -m alembic upgrade head

# 4. Run tests
D:\Agentic-Recovery\.venv\Scripts\python.exe -m pytest tests/test_recovery.py -v

# 5. Start server
D:\Agentic-Recovery\.venv\Scripts\uvicorn recovery.server:create_app --factory --reload --host 127.0.0.1 --port 8000
```

## Android SDK (Shared)

Android SDK is installed at `D:\Android\Sdk` (shared with checkout project):
- cmdline-tools, platform-tools, emulator
- Android 14 (API 34) platform and Google APIs system image
- AVD: `AgenticMobile0001` (Pixel 7, Android 14, Google APIs, x86_64)
- AVD directory: `D:\Agentic-Android\AVD`

## Upstream Repositories

See `config/upstreams.json` for the six upstream forks (paperclip, openclaw, mobilerun, agency-agents, hermes-agent, Open-AutoGLM). Clones are kept under `upstream/` with pinned adapter boundaries.

## License

Internal use only. Do not publish credentials, private account information, or live evidence.
