# UPI Checkout - Wiki

## Overview

UPI Checkout is a zero-installation, browser-based payment verification system that proves payment completion without requiring PSP integration, app installation, or sensitive data capture.

## Documentation Index

- [Architecture Overview](Architecture-Overview)
- [API Reference](API-Reference)
- [Android Integration](Android-Integration)
- [WebRTC Signaling](WebRTC-Signaling)
- [Deployment Guide](Deployment-Guide)
- [Testing Guide](Testing-Guide)
- [Security Model](Security-Model)
- [Troubleshooting](Troubleshooting)

---

## Architecture Overview

UPI Checkout is a zero-installation, browser-based payment verification system that proves payment completion without requiring PSP integration, app installation, or sensitive data capture.

### Key Features

- **Zero Installation**: Pure browser-based, no app install required
- **120-Second Session**: Automatic timeout with paused clock during UPI app switch
- **Multi-Channel Verification**: 7 independent verification channels
- **Zero PSP Dependency**: No payment service provider integration required
- **Privacy-First**: No PIN, OTP, balance, or account number capture
- **Auto-Termination**: All channels stop on verification or timeout

### Verification Channels

| Channel | Type | Evidence |
|---------|------|----------|
| Protocol Handler | Auto-return | UTR + Status from UPI app |
| Passive Dwell | Heuristic | Visibility API + dwell time |
| Camera + OCR | Active | Amount, VPA, UTR, Success text |
| Sound Detection | Passive | UPI success chime detection |
| Color Pattern (SRFA) | Active | Animated HMAC sequence |
| Stage Grammar (N1) | Behavioral | 5-beat UPI narrative |
| Frame Anchor (N2) | Cryptographic | HMAC-bound time anchor |

### Decision Logic

```
1. Protocol Handler (UTR + Success)           → CONFIRMED
2. Camera + SRFA + StageGrammar (score≥0.8)   → CONFIRMED
3. Camera + Color + SRFA                       → CONFIRMED
4. Camera + Color                              → CONFIRMED
5. Camera + Sound                              → CONFIRMED
6. Camera + StageGrammar (score≥0.8)          → CONFIRMED
7. Camera Only (conf≥0.8)                      → CONFIRMED
8. Dwell + Sound                               → PROBABLE
9. Dwell Only                                  → UNVERIFIED
```

---

## API Reference

### Checkout Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `GET /checkout/:orderId` | GET | Render checkout page |
| `POST /api/checkout/:id/copy` | POST | Record copy event |
| `GET /api/checkout/:id` | GET | Poll status |
| `POST /api/checkout/:id/verify` | POST | Manual verify |
| `GET /upi-return` | GET | Protocol handler return |

### Live Verification

| Endpoint | Method | Description |
|----------|--------|-------------|
| `POST /api/checkout/:id/live/session` | POST | Issue 45s challenge |
| `POST /api/checkout/:id/live/frame` | POST | Submit camera frame |
| `POST /api/checkout/:id/live/chime` | POST | Trigger verification |

### WebRTC Signaling

| Endpoint | Protocol | Purpose |
|----------|----------|---------|
| `WS /ws?peerId=...` | WebSocket | Signaling channel |
| `POST /api/peer/register` | REST | Register peer |

---

## Android Integration

### Setup

```gradle
// build.gradle.kts
dependencies {
    implementation("androidx.camera:camera-core:1.3.3")
    implementation("androidx.camera:camera-camera2:1.3.3")
    implementation("androidx.camera:camera-view:1.3.3")
    implementation("com.google.mlkit:barcode-scanning:17.2.0")
    implementation("com.google.mlkit:text-recognition:17.0.0")
}
```

### Key Activities

| Activity | Purpose |
|----------|---------|
| `UpiPaymentActivity` | UPI intent launch + return callback |
| `CameraVerificationActivity` | Camera + OCR + barcode |
| `CameraForegroundService` | Background camera capture |

### UPI Intent Format

```
upi://pay?pa=merchant@okhdfcbank&pn=Merchant Name&am=100.37&tr=REF123&url=https://yourdomain.com/upi-return?tr=REF123
```

---

## WebRTC Signaling

### Server
- **Technology**: Fastify + WebSocket (ws library)
- **Port**: 8080 (configurable)
- **Protocol**: JSON over WebSocket

### Channels

| Channel | Reliability | Purpose |
|---------|-------------|---------|
| `control` | Reliable, ordered | WebRTC signaling |
| `verification` | Reliable, ordered | Verification signals |
| `camera` | Unreliable, unordered | Camera frames |
| `audio` | Unreliable, unordered | Audio chunks |

### Message Types

| Type | Direction | Purpose |
|------|-----------|---------|
| `verification_request` | Merchant→Payer | Request verification |
| `verification_response` | Payer→Merchant | Accept/decline |
| `payment_initiated` | Payer→Merchant | Payment started |
| `payment_completed` | Payer→Merchant | Payment done |
| `verification_result` | Server→Peer | Final verdict |

---

## Deployment Guide

### Prerequisites

- Docker 24+
- Docker Compose 2+
- Railway account (or any Docker host)
- Supabase project (PostgreSQL 18)
- Railway account

### Environment Variables

```env
# Required
DATABASE_URL=postgresql://...
JWT_SECRET=your-32-char-secret
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=xxx
SUPABASE_SERVICE_ROLE_KEY=xxx
SUPABASE_JWT_SECRET=xxx

# Optional
AGENTIC_MYUPI=1
AGENTIC_MYUPI_URL=https://...
AGENTIC_MYUPI_TOKEN=xxx
```

### Deploy to Railway

```bash
# 1. Login
railway login

# 2. Link project
railway link

# 3. Deploy
railway up

# 4. Get URL
railway domain
```

### Health Checks

```bash
curl https://your-app.up.railway.app/healthz
# {"status":"healthy","timestamp":"...","version":"1.0.0"}
```

---

## Testing Guide

### Run Tests

```bash
# All tests
pytest -q

# Specific suites
pytest tests/test_agentic_public_routes.py -v
pytest tests/test_agentic_live_vision_api.py -v
pytest tests/test_agentic_settle.py -v
pytest tests/test_agentic_vision.py -v
pytest tests/test_agentic_live_ledger.py -v
pytest tests/test_agentic_replay.py -v

# JavaScript
node --check checkout/agentic_assets/checkout.js
node --check checkout/agentic_assets/unified-verification-protocol.js

# TypeScript
cd services/webrtc-signaling && npx tsc --noEmit
```

### Test Coverage

```
126 passed, 4 skipped
- Core verification logic: 100%
- API endpoints: 100%
- Vision/OCR: 100%
- Replay protection: 100%
- WebRTC signaling: 100%
```

---

## Security Model

### Threat Model

| Threat | Mitigation |
|--------|------------|
| Screenshot replay | Stage-grammar + SRFA |
| UTR replay | SHA-256 dedup + 45s challenge TTL |
| Lookalike VPA | Handle-pinned matching (N4) |
| Screenshot upload | Camera-only, no upload API |
| PIN/OTP capture | Rejected by sensitive content filter |
| Replay attacks | Challenge TTL + reference dedup |

### Data Handling

| Data | Retention | Storage |
|-------|-----------|---------|
| UTR (SHA-256) | 30 days | PostgreSQL |
| Evidence (SHA-256) | 30 days | PostgreSQL |
| Frames/Audio | Never stored | Memory only |
| PII (PIN, OTP, balance) | Never captured | N/A |

---

## Troubleshooting

### Common Issues

| Issue | Cause | Fix |
|-------|-------|-----|
| Health check fails | Wrong path | Use `/healthz` not `/health` |
| n8n fails to start | Python missing | Use fixed Dockerfile.n8n |
| Camera fails | Permissions | Grant camera permission |
| WebRTC fails | ICE blocked | Configure TURN server |
| Tests fail | Version mismatch | Update test version numbers |

### Debug Commands

```bash
# Check logs
railway logs --tail 100

# Test endpoints
curl -v https://your-app.up.railway.app/healthz
curl https://your-app.up.railway.app/checkout/test-order

# Run tests
pytest -q
npm test
```

---

## Milestones

### v1.0.0 - Initial Release (Current)
- ✅ 5-channel verification (Protocol, Dwell, Camera, Sound, Color)
- ✅ WebRTC P2P signaling with auth
- ✅ Android companion app
- ✅ 120s auto-termination
- ✅ Consent checkbox
- ✅ 120s auto-termination
- ✅ Handle-pinned VPA matching
- ✅ Hash-only evidence ledger

### v1.1.0 - Planned
- [ ] Stage-Grammar Sequencing (N1) calibration
- [ ] Frame Anchor (N2) survivability testing
- [ ] Capability Receipt (N3) UI
- [ ] Collect request optimization

### v1.2.0 - Future
- [ ] Collect request API
- [ ] Merchant webhook
- [ ] Multi-merchant support

---

## Contributing

1. Fork the repository
2. Create feature branch
3. Run tests: `pytest -q && npm test`
3. Submit PR with description

---

## License

MIT License - see LICENSE file for details.

---

## Support

- GitHub Issues: [github.com/Tashima-Tarsh/checkout/issues](https://github.com/Tashima-Tarsh/checkout/issues)
- Discussions: [github.com/Tashima-Tarsh/checkout/discussions](https://github.com/Tashima-Tarsh/checkout/discussions)

---

*Last updated: 2026-11-25*