# UPI Checkout - Milestones

## Milestone Tracker

### ✅ v1.0.0 - Initial Release (COMPLETED)
**Target**: 2026-11-25  
**Status**: ✅ COMPLETED

#### Core Features
- [x] 5-Channel Verification Protocol
  - [x] Protocol Handler (Auto-return via UPI URL)
  - [x] Passive Dwell Detection (visibilitychange + 1.2s dwell)
  - [x] Camera + OCR (Tesseract.js WASM)
  - [x] Sound Detection (Web Audio API)
  - [x] Color Pattern (SRFA) - Animated HMAC sequence
- [x] WebRTC P2P Verification Network
  - [x] Fastify + WebSocket signaling server
  - [x] Multi-channel DataChannels (control, verification, camera, audio)
  - [x] Authentication + Transaction isolation
- [x] Android Companion App
  - [x] UpiPaymentActivity (UPI intent + return)
  - [x] CameraVerificationActivity (OCR + Barcode)
  - [x] CameraForegroundService (background capture)
- [x] Unified Verification Protocol
  - [x] 5-channel evidence fusion
  - [x] Priority-based decision logic
  - [x] 120s auto-termination with paused clock
- [x] 120s Auto-termination with Paused Clock
- [x] Consent Checkbox (mandatory)
- [x] Handle-Pinned VPA Matching (N4)
- [x] Hash-Only Evidence Ledger (N5)
- [x] Capability Receipt (N3) - Informed Consent

#### Infrastructure
- [x] FastAPI Checkout API
- [x] Fastify + WebSocket Signaling Server
- [x] n8n with Python 3.12 runtime
- [x] PostgreSQL 18 (Supabase)
- [x] Redis 7 Cluster
- [x] Railway Deployment
- [x] GitHub Actions CI/CD

#### Documentation
- [x] README.md (Product Overview)
- [x] TDD.md (Technical Design Document)
- [x] IDD.md (Interface Design Document)
- [x] IMPLEMENTATION.md (Implementation Guide)
- [x] ARCHITECTURE.md (Mermaid Diagrams)
- [x] WIKI.md (Documentation Wiki)

---

### v1.1.0 - Fraud Hardening (PLANNED)
**Target**: 2026-12-15  
**Status**: 📋 PLANNED

#### Novelty Mechanisms
- [ ] **N1: Stage-Grammar Sequencing (SGS)** - 5-beat UPI narrative validation
  - [ ] 48h calibration spike (20 real + 20 replay + 20 splice + 20 trim)
  - [ ] Stage-grammar FSM implementation
  - [ ] Integration with unified protocol
- [ ] **N2: Self-Referential Frame Anchor (SRFA)**
  - [ ] 48h survivability spike (H.264 survivability)
  - [ ] HMAC-bound animated micro-pattern
  - [ ] Frame anchor verification
- [ ] **N3: Capability Receipt** (Informed Consent)
  - [ ] Capability probing (getDisplayMedia, fps, etc.)
  - [ ] Receipt UI with tier display
  - [ ] Informed consent flow

#### Infrastructure
- [ ] Collect request API endpoint
- [ ] Merchant webhook for fulfillment
- [ ] TURN server configuration for WebRTC
- [ ] Load testing (1000 concurrent sessions)

#### Testing
- [ ] N1 Calibration (48h): 20 real + 20 replay + 20 splice + 20 trim
- [ ] N2 Survivability: H.264 re-encode survivability
- [ ] Load test: 1000 concurrent sessions
- [ ] Chaos testing: Network partition, process crash

---

### v1.2.0 - Production Hardening (PLANNED)
**Target**: 2027-01-15  
**Status**: 📋 PLANNED

#### Production Hardening
- [ ] TURN server deployment (coturn)
- [ ] Rate limiting (per IP, per session)
- [ ] Circuit breaker for external services
- [ ] Circuit breaker for WebRTC connections
- [ ] Graceful degradation (fallback to lower tiers)
- [ ] Dead letter queue for failed verifications

#### Observability
- [ ] Distributed tracing (Jaeger)
- [ ] Custom Grafana dashboards
- [ ] SLO dashboards (latency, error rate, throughput)
- [ ] Automated runbook links in alerts

#### Compliance
- [ ] PCI DSS SAQ-A compliance
- [ ] RBI UPI guidelines audit
- [ ] GDPR/PDPA compliance review
- [ ] Data retention policy enforcement

---

### v2.0.0 - Platform Expansion (FUTURE)
**Target**: 2027-Q2  
**Status**: 💡 CONCEPTUAL

#### Platform Features
- [ ] Multi-merchant support (tenant isolation)
- [ ] White-label SDK (React Native, Flutter, Web)
- [ ] Merchant dashboard (React/Next.js)
- [ ] Customer-facing status page
- [ ] Webhook retry with exponential backoff
- [ ] Dispute resolution workflow
- [ ] Refund initiation API
- [ ] Subscription/recurring payments

#### Platform Integrations
- [ ] Shopify plugin
- [ ] WooCommerce plugin
- [ ] React Native SDK
- [ ] Flutter SDK
- [ ] Android SDK (native)
- [ ] iOS SDK (native)

---

## 📋 Current Sprint (v1.0.0 - DONE)

| Task | Status | Owner |
|------|--------|-------|
| Core verification engine | ✅ Done | Team |
| WebRTC signaling | ✅ Done | Team |
| Android app | ✅ Done | Team |
| Documentation | ✅ Done | Team |
| CI/CD pipeline | ✅ Done | Team |
| Production deploy | ✅ Done | Team |

---

## 🎯 Definition of Done

- [x] All tests pass (126 passed, 4 skipped)
- [x] Zero PSP/credit references
- [x] 120s auto-termination verified
- [x] Consent checkbox mandatory
- [x] Android RESULT_OK properly handled
- [x] WebRTC auth + isolation
- [x] n8n Python runtime fixed
- [x] Android domain corrected
- [x] Self-interception prevented
- [x] 120s auto-termination enforced
- [x] Consent checkbox mandatory
- [x] Android RESULT_OK properly handled
- [x] WebRTC with auth + isolation
- [x] n8n Python runtime fixed
- [x] Android domain corrected
- [x] Self-interception prevented
- [x] CI/CD green (126 passed, 4 skipped)
- [x] Documentation complete
- [x] Deployed to Railway production
- [x] Health checks passing

---

**Last Updated**: 2026-11-25  
**Next Review**: 2026-12-15 (v1.1.0 planning)