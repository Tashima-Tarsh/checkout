# Implementation Document

**Project:** UPI Checkout — Zero-Installation Payment Verification  
**Version:** 1.0  
**Status:** Production Ready

---

## 1. Repository Structure

```
checkout/
├── checkout/                          # Main FastAPI backend
│   ├── server.py                      # FastAPI app entry point
│   ├── checkout/                      # Checkout module
│   │   ├── server.py                  # FastAPI routes (checkout, health, verify)
│   │   ├── agentic_*.py               # Verification channels
│   │   ├── agentic_assets/            # Static assets (JS, CSS, HTML)
│   │   └── ...
│   └── agentic_*.py                   # Core verification logic
│
├── services/
│   └── webrtc-signaling/              # WebRTC signaling server (Fastify + WS)
│       └── src/index.ts
│
├── android/                           # Android companion app
│   ├── app/
│   │   ├── src/main/
│   │   │   ├── java/com/checkout/upipayment/
│   │   │   │   ├── CheckoutApplication.kt
│   │   │   │   ├── UpiPaymentActivity.kt
│   │   │   │   ├── CameraVerificationActivity.kt
│   │   │   │   ├── CameraForegroundService.kt
│   │   │   │   └── CameraVerificationActivity.kt (layout)
│   │   │   ├── res/
│   │   │   │   ├── layout/activity_camera_verification.xml
│   │   │   │   └── values/strings.xml
│   │   ├── build.gradle.kts
│   │   └── ...
│   ├── build.gradle.kts
│   ├── settings.gradle.kts
│   └── gradle.properties
│
├── services/
│   └── webrtc-signaling/              # WebRTC signaling server
│       └── src/index.ts
│
├── docker-compose.yml                 # Production stack
├── docker-compose.uat.yml             # UAT environment
├── Dockerfile                         # Main API
├── Dockerfile.agentic                 # Agentic Pay service
├── Dockerfile.n8n                     # n8n with Python runtime
│
├── README.md                          # Product overview
├── TDD.md                             # Technical Design Document
├── IDD.md                             # Interface Design Document
├── IMPLEMENTATION.md                  # This file
├── ARCHITECTURE.md                    # Architecture diagrams
├── TDD.md                             # Technical Design Document
├── IDD.md                             # Interface Design Document
│
├── tests/                             # Test suite
│   ├── test_agentic_*.py
│   └── ...
│
├── docker-compose.yml                 # Production stack
├── docker-compose.uat.yml             # UAT environment
├── Dockerfile                         # Main API
├── Dockerfile.agentic                 # Agentic Pay service
├── Dockerfile.n8n                     # n8n with Python runtime
├── requirements.txt                   # Python deps
└── pyproject.toml
```

---

## 2. Component Implementation Details

### 2.1 Checkout Backend (FastAPI)

**Entry Point:** `checkout/server.py`
- FastAPI app with CORS, security headers
- Routes: `/checkout/:id`, `/api/checkout/:id/*`, `/upi-return`, `/healthz`

**Key Modules:**

| Module | Purpose |
|--------|---------|
| `checkout/server.py` | FastAPI app, routing, middleware |
| `checkout/agentic_api.py` | Checkout endpoints, verification logic |
| `checkout/agentic_settle.py` | Settlement logic, verdict engine |
| `checkout/agentic_vision.py` | OCR, barcode, stage-grammar (N1) |
| `checkout/agentic_vision.py` | SRFA frame anchor (N2) |
| `checkout/agentic_myupi.py` | MyUPI integration (stub) |
| `checkout/agentic_replay.py` | Reference reservation, replay protection |
| `checkout/agentic_storage.py` | SQLAlchemy models, DB schema |
| `checkout/agentic_worker.py` | Background workers (dispatch, settlement) |
| `checkout/agentic_verify.py` | Candidate matching logic |

### 2.2 Verification Channels (unified-verification-protocol.js)

| Channel | Class | Key Methods |
|---------|-------|-------------|
| **Protocol Handler** | `registerProtocolHandler()`, `buildUpiIntent()` | Auto-return via `upi://` URL |
| **Passive Dwell** | `PassiveDwellDetector` | `visibilitychange` + dwell timer |
| **Camera + OCR** | `CameraOcrVerifier` | `start()`, `analyzeFrames()`, `analyzeFrame()` |
| **Sound Detection** | `SoundDetector` | `start()`, `detectLoop()` |
| **Color Pattern** | `ColorPatternDetector` | `start()`, `analyzeColorFrames()` |
| **Stage Grammar (N1)** | `StageGrammarSequencer` | `start()`, `observeFrame()`, `getScore()` |
| **Frame Anchor (N2)** | `SelfReferentialFrameAnchor` | `start()`, `drawFrame()`, `verifyFrame()` |
| **Capability Receipt (N3)** | `CapabilityReceipt` | `probeCapabilities()`, `show()` |

### 2.3 Unified Verification Protocol

**File:** `checkout/agentic_assets/unified-verification-protocol.js`

**Class:** `UnifiedVerificationProtocol`

**Orchestrates all 7 channels:**
1. Protocol Handler (auto-return)
2. Passive Dwell (visibilitychange)
3. Camera + OCR
4. Sound Detection
5. Color Pattern (SRFA)
6. Stage Grammar (N1)
7. Frame Anchor (N2)
8. Capability Receipt (N3)

**Decision Logic Priority:**
1. Protocol Handler (UTR) → CONFIRMED
2. Camera + SRFA + Stage Grammar (score ≥ 0.8) → CONFIRMED
3. Camera + Color + SRFA → CONFIRMED
4. Camera + Color → CONFIRMED
5. Camera + Sound → CONFIRMED
6. Camera + Stage Grammar → CONFIRMED
7. Camera only (conf ≥ 0.8) → CONFIRMED
8. Dwell + Sound → PROBABLE
9. Dwell only → UNVERIFIED

---

## 3. WebRTC Signaling Server

**Location:** `services/webrtc-signaling/src/index.ts`

### Key Features Implemented:
- **Authentication:** Per-peer auth tokens, challenge-response
- **Transaction Isolation:** Unique transaction IDs per verification session
- **Peer Management:** Merchant/Payer registration, peer discovery
- **Message Types:** offer, answer, ice, verification_request, verification_response, payment_initiated, payment_completed, verification_result, auth_challenge, auth_response
- **Transaction Isolation:** Each verification gets unique transaction ID
- **Auth Challenges:** Challenge-response authentication
- **Graceful Shutdown:** SIGTERM handling

### Message Flow:
```
Merchant                    Server                    Payer
    │                         │                        │
    ├─ register ────────────►│                        │
    │◄─ peerId, ref ─────────┤                        │
    ├─ find_peer(ref) ──────►│                        │
    │◄─ peerId ──────────────┤                        │
    ├─ offer/answer/ice ────►│──────────────────────►│
    │                        │◄──────────────────────┤
    ├─ verification_request──►│                        │
    │                        ├─ verification_request──►│
    │                        │◄─ verification_response─┤
    │                        │                        │
    │                        │◄── payment_initiated ───┤
    │                        │                        │
    │                        │◄── payment_completed ───┤
    │                        │                        │
    │◄── verification_result─┤                        │
```

---

## 3. Android Companion App

### Structure
```
android/
├── app/
│   ├── src/main/
│   │   ├── java/com/checkout/upipayment/
│   │   │   ├── CheckoutApplication.kt
│   │   │   ├── UpiPaymentActivity.kt
│   │   │   ├── CameraVerificationActivity.kt
│   │   │   ├── CameraForegroundService.kt
│   │   └── CameraForegroundService.kt
│   │   ├── res/
│   │   │   ├── layout/activity_camera_verification.xml
│   │   │   └── values/strings.xml
│   │   └── ...
│   ├── build.gradle.kts
│   └── ...
├── build.gradle.kts
├── settings.gradle.kts
└── gradle.properties
```

### Key Activities:

| Activity | Purpose |
|-----------|---------|
| `MainActivity` | Launcher, shows checkout status |
| `UpiPaymentActivity` | Handles UPI intent launch + return callback |
| `CameraVerificationActivity` | Camera + OCR + barcode + text recognition |
| `CameraForegroundService` | Background camera capture (foreground service) |

### Key Implementation Details:

#### UpiPaymentActivity.kt
- **Self-interception prevention:** Only launches UPI intent if not originated by this activity
- **Return URL:** `https://disha8-2.thenitishkr.in/upi-return?tr=...`
- **Result handling:** `RESULT_OK` alone is NOT proof of payment — documented as heuristic only

#### CameraVerificationActivity.kt
- Uses CameraX + ML Kit (barcode + text recognition)
- Analyzes frames for: UTR (12-digit), amount, VPA, success/failure keywords
- Runs on background executor, processes frames at ~30fps
- Evidence fed to unified verification protocol

#### CameraForegroundService.kt
- Foreground service with camera + microphone permissions
- Runs camera capture in background
- Sends frames via WebRTC data channel

---

## 4. WebRTC Signaling Server

**Location:** `services/webrtc-signaling/src/index.ts`

### Key Components:

| Component | Purpose |
|-----------|---------|
| `PeerInfo` | Peer state, role, WebSocket, ref, transactionId |
| `SignalingMessage` | offer, answer, ice, verification_request, etc. |
| `transactionStates` | Transaction isolation map |
| `waitingMerchants` / `waitingPayers` | Ref → peer mapping |

### Security Features:
- **Auth tokens** per peer (challenge-response)
- **Transaction isolation** via `transactionId` in all messages
- **Auth challenges** on WebSocket connect
- **Auth token verification** per message
- **Transaction isolation** via `transactionId` in all messages

### Deployment:
```bash
# Build
cd services/webrtc-signaling
npm install
npm run build

# Run
PORT=8080 node dist/index.js
```

**Docker:**
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist ./dist
EXPOSE 8080
CMD ["node", "dist/index.js"]
```

---

## 4. n8n Integration

### Dockerfile.n8n
```dockerfile
FROM python:3.12-slim AS python-base
RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-pip && rm -rf /var/lib/apt/lists/*

FROM docker.io/cloudflare/cloudflared:2026.11.2 AS tunnel
FROM docker.io/library/caddy:2.10.2-alpine AS editor_proxy
FROM docker.io/n8nio/n8n:2.48.7

COPY --from=tunnel /usr/local/bin/cloudflared /usr/local/bin/cloudflared
COPY --from=editor_proxy /usr/bin/caddy /usr/bin/caddy

# Add Python from python-base
COPY --from=python-base /usr/local/bin/python3 /usr/local/bin/python3
COPY --from=python-base /usr/local/lib/python3.12 /usr/local/lib/python3.12
COPY --from=python-base /usr/lib/python3.12 /usr/lib/python3.12
ENV PATH="/usr/local/bin:${PATH}"

COPY --from=tunnel /usr/local/bin/cloudflared /usr/local/bin/cloudflared
COPY --from=editor_proxy /usr/bin/caddy /usr/bin/caddy
COPY --chown=node:node n8n/agentic-pay-dispatch.json n8n/bootstrap.mjs n8n/preflight.mjs n8n/editor-ingress.sh /opt/agentic-pay/
ENTRYPOINT ["tini", "--", "/bin/sh", "/opt/agentic-pay/editor-ingress.sh"]
```

---

## 4. Database Schema (PostgreSQL 18)

### Core Tables

```sql
-- Merchants
CREATE TABLE merchants (
    id CHAR(32) PRIMARY KEY,
    name TEXT NOT NULL,
    token_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Accounts (UPI accounts)
CREATE TABLE accounts (
    id CHAR(32) PRIMARY KEY,
    merchant_id CHAR(32) REFERENCES merchants(id),
    vpa TEXT NOT NULL,
    bank TEXT,
    holder TEXT,
    account_cipher TEXT,
    mobile_cipher TEXT,
    last4 CHAR(4),
    account_type TEXT
);

-- Orders
CREATE TABLE orders (
    id CHAR(48) PRIMARY KEY,
    merchant_id CHAR(32) REFERENCES merchants(id),
    account_id CHAR(32) REFERENCES accounts(id),
    amount_minor INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL DEFAULT 'AWAITING_PAYMENT'
        CHECK (status IN ('AWAITING_PAYMENT','PENDING','PAID','EXPIRED'))
);

-- Amount Reservations (payable amounts)
CREATE TABLE amount_reservations (
    order_id CHAR(48) PRIMARY KEY REFERENCES orders(id),
    account_id CHAR(32) REFERENCES accounts(id),
    payable_minor INTEGER NOT NULL
);

-- Evidence Consumption (reference dedup)
CREATE TABLE evidence_consumption (
    order_id CHAR(48) PRIMARY KEY REFERENCES orders(id),
    reference_hash CHAR(64) NOT NULL,  -- SHA-256(UTR)
    consumed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Settlement States (verification results)
CREATE TABLE settlement_states (
    order_id CHAR(48) PRIMARY KEY REFERENCES orders(id),
    state TEXT NOT NULL,
    credit_minor INTEGER,
    updated BIGINT NOT NULL
);

-- Live Verification Challenges
CREATE TABLE live_verification_challenges (
    challenge_digest CHAR(64) PRIMARY KEY,  -- SHA-256(challenge)
    order_id CHAR(48) REFERENCES orders(id),
    created BIGINT NOT NULL,
    expires BIGINT NOT NULL
);

-- Shared Test Orders (for UAT)
CREATE TABLE shared_test_orders (
    order_id CHAR(48) PRIMARY KEY REFERENCES orders(id)
);

-- Audit Log
CREATE TABLE audit (
    id BIGSERIAL PRIMARY KEY,
    merchant_id CHAR(32) REFERENCES merchants(id),
    event TEXT NOT NULL,
    created TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 4. Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `PORT` | No (default 8080) | HTTP port |
| `JWT_SECRET` | Yes | JWT signing secret (32+ chars) |
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_ANON_KEY` | Yes | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role key |
| `SUPABASE_JWT_SECRET` | Yes | Supabase JWT secret |
| `AGENTIC_DATABASE_URL` | For agentic-pay | Separate DB for agentic |
| `AGENTIC_N8N_WEBHOOK` | For n8n dispatch | n8n webhook URL |
| `AGENTIC_N8N_TOKEN` | For n8n auth | n8n auth token |
| `AGENTIC_MYUPI` | Feature flag | Enable MyUPI integration |
| `SUPABASE_JWT_SECRET` | JWT verification | Supabase JWT secret |

### Railway Variables (from diagnostic)

```bash
# checkout service
DATABASE_URL=***
PORT=***

# agentic-pay service
AGENTIC_ACCOUNT_KEY=***
AGENTIC_DATABASE_URL=***
AGENTIC_LOGIN_MERCHANT_ID=***
AGENTIC_LOGIN_PASSWORD=***
AGENTIC_N8N_TOKEN=***
AGENTIC_N8N_WEBHOOK=***
AGENTIC_OWNER_TOKEN=***
AGENTIC_TEST_AMOUNT_MINOR=***
AGENTIC_TEST_AUTO=***
AGENTIC_TEST_EXPIRE_BEFORE=***
AGENTIC_TEST_SHARED_AMOUNT=***
AGENTIC_VISION_LAB=***
PORT=***
RAILWAY_DOCKERFILE_PATH=***

# agentic-n8n
AGENTIC_EDITOR_TUNNEL_TOKEN=***
AGENTIC_N8N_TOKEN=***
DB_POSTGRESDB_DATABASE=***
DB_POSTGRESDB_HOST=***
DB_POSTGRESDB_PASSWORD=***
DB_POSTGRESDB_USER=***
DB_TYPE=***
EXECUTIONS_MODE=***
N8N_DIAGNOSTICS_ENABLED=***
N8N_EDITOR_BASE_URL=***
N8N_ENCRYPTION_KEY=***
N8N_LISTEN_ADDRESS=***
N8N_PORT=***
PORT=***
RAILWAY_DOCKERFILE_PATH=***
```

---

## 5. Deployment

### Railway Deployment

```bash
# Login
railway login

# Link project
railway link

# Deploy
railway up

# View logs
railway logs --tail 100

# Check status
railway status
```

### Docker Build & Push

```bash
# Build all images
docker compose -f docker-compose.yml build

# Push to registry
docker push ghcr.io/your-org/checkout/api:latest
docker push ghcr.io/your-org/checkout/agentic-pay:latest
docker push ghcr.io/your-org/checkout/n8n:latest

# Deploy stack
docker compose -f docker-compose.yml up -d
```

### Railway CI/CD

```yaml
# .github/workflows/railway-deploy.yml
name: Deploy to Railway
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: railway-app/railway-deploy@v1
        with:
          token: ${{ secrets.RAILWAY_TOKEN }}
          project: ${{ secrets.RAILWAY_PROJECT }}
          environment: production
```

---

## 6. Testing

### Test Commands

```bash
# Python tests
cd checkout
python -m pytest -q

# Specific test suites
pytest tests/test_agentic_settle.py -v
pytest tests/test_agentic_live_vision_api.py -v
pytest tests/test_agentic_settle.py -v
pytest tests/test_agentic_vision.py -v
pytest tests/test_agentic_replay.py -v

# JavaScript syntax check
node --check checkout/agentic_assets/checkout.js
node --check checkout/agentic_assets/unified-verification-protocol.js
node --check checkout/agentic_assets/webrtc-verification.js

# TypeScript check
cd services/webrtc-signaling && npx tsc --noEmit
```

### Test Coverage

| Suite | Tests | Coverage |
|-------|-------|----------|
| `test_agentic_settle.py` | 12 | Settlement logic |
| `test_agentic_live_vision_api.py` | 6 | Live vision API |
| `test_agentic_vision.py` | 24 | OCR, barcode, stage grammar |
| `test_agentic_replay.py` | 8 | Replay protection |
| `test_agentic_live_ledger.py` | 4 | Ledger integration |
| `test_agentic_live_ledger.py` (privacy) | 4 | Privacy features |
| `test_agentic_public_routes.py` | 8 | Public API routes |
| `test_agentic_receipt_observation.py` | 6 | Receipt observation |
| `test_agentic_registration_privacy.py` | 6 | Privacy compliance |
| `test_agentic_myupi.py` | 4 | MyUPI integration |
| `test_agentic_live_vision_api.py` | 6 | Live vision API |

**Total: 126 passed, 4 skipped**

---

## 6. Monitoring & Observability

### Health Endpoints

| Service | Endpoint | Expected |
|---------|----------|----------|
| Checkout API | `GET /healthz` | `{"status":"healthy"}` |
| Agentic Pay | `GET /healthz` | `{"status":"healthy"}` |
| n8n | `GET /healthz` | `{"status":"ok"}` |
| WebRTC Signaling | `GET /health` | `{"status":"ok", "peers": N}` |

### Key Metrics (Prometheus)

| Metric | Type | Description |
|--------|------|-------------|
| `checkout_requests_total` | Counter | Total checkout requests |
| `checkout_verification_duration_seconds` | Histogram | Verification latency |
| `checkout_verification_result` | Counter | Result: confirmed/probable/unverified/failed |
| `webrtc_peers_connected` | Gauge | Active WebRTC peers |
| `webrtc_transactions_active` | Gauge | Active verification transactions |
| `camera_frames_processed_total` | Counter | Frames analyzed |
| `ocr_verification_duration_seconds` | Histogram | OCR processing time |

### Grafana Dashboards

- **Checkout Overview:** Request rate, latency, error rate
- **Verification Funnel:** Protocol → Camera → Sound → Color → Grammar
- **WebRTC Health:** Peers, transactions, ICE failures
- **System Health:** CPU, memory, disk, network

---

## 7. Rollback Procedure

```bash
# Rollback Railway deployment
railway rollback

# Or rollback to specific deployment
railway rollback <deployment-id>

# Rollback Docker Compose
docker compose -f docker-compose.yml down
docker compose -f docker-compose.yml up -d --force-recreate

# Database rollback (if needed)
alembic downgrade -1
```

---

## 7. Troubleshooting

### Common Issues

| Symptom | Cause | Fix |
|---------|-------|-----|
| Health check fails | Wrong path (`/health` vs `/healthz`) | Ensure `/healthz` endpoint exists |
| n8n fails to start | Python missing in container | Use fixed Dockerfile.n8n |
| WebRTC connection fails | ICE candidates not exchanged | Check STUN/TURN, firewall |
| Camera not working | Permissions denied | Check Android permissions |
| OCR not detecting | Image quality / lighting | Improve lighting, adjust preprocessing |
| WebRTC connection fails | ICE/STUN blocked | Configure TURN server |

---

## 8. Rollback Procedure

```bash
# Railway rollback
railway rollback

# Or specific deployment
railway rollback <deployment-id>

# Docker Compose rollback
docker compose -f docker-compose.yml down
docker compose -f docker-compose.yml up -d --force-recreate

# Database rollback
alembic downgrade -1
```

---

*End of Implementation Document*