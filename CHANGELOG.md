# Changelog

All notable changes to UPI Checkout will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0] - 2026-11-25

### Added

#### Core Verification Engine
- **5-Channel Verification Protocol**
  - Protocol Handler (auto-return via UPI URL)
  - Passive Dwell Detection (visibilitychange + 1.2s dwell)
  - Camera + OCR (Tesseract.js WASM)
  - Sound Detection (Web Audio API)
  - Color Pattern (SRFA) - Animated HMAC sequence

- **WebRTC P2P Verification Network**
  - Fastify + WebSocket signaling server
  - Multi-channel DataChannels (control, verification, camera, audio)
  - Authentication + Transaction isolation
  - Auth challenges + response handling

- **Android Companion App**
  - UpiPaymentActivity (UPI intent + return)
  - CameraVerificationActivity (OCR + Barcode)
  - CameraForegroundService (background capture)
  - Proper UPI return handling via protocol handler

- **Unified Verification Protocol**
  - 5-channel evidence fusion
  - Priority-based decision logic
  - 120s auto-termination with paused clock
  - Consent checkbox (mandatory)

#### Security & Privacy
- Handle-Pinned VPA Matching (N4) - defeats lookalike VPA
- Hash-Only Evidence Ledger (N5) - SHA-256 digests only
- No PII capture (PIN/OTP/balance/account# rejected)
- Zero PSP dependency
- Zero installation requirement

#### Infrastructure
- FastAPI Checkout API
- Fastify + WebSocket Signaling Server
- n8n with Python 3.12 runtime
- PostgreSQL 18 (Supabase)
- Redis 7 Cluster
- Railway Deployment
- GitHub Actions CI/CD

#### Documentation
- README.md (Product Overview)
- TDD.md (Technical Design Document)
- IDD.md (Interface Design Document)
- IMPLEMENTATION.md (Implementation Guide)
- ARCHITECTURE.md (Mermaid Diagrams)
- WIKI.md (Documentation Wiki)
- MILESTONES.md (Milestone Tracker)

---

### Fixed

- **Docker Compose**: Removed non-existent `db` service, uses PostgreSQL 18
- **Android Bridge**: Uses actual production domain (`disha8-2.thenitishkr.in`)
- **Native Bridge**: Prevents self-interception of UPI intent
- **RESULT_OK Handling**: Explicitly documented as NOT proof of payment
- **WebRTC Signaling**: Added authentication + transaction isolation
- **n8n Dockerfile**: Fixed Python 3.12 runtime compatibility
- **Missing Files**: Added docker-compose.yml, docker-compose.uat.yml
- **Android Domain**: Corrected to actual production domain
- **Self-Interception**: Prevented in UpiPaymentActivity
- **RESULT_OK Handling**: Explicit documentation it's NOT proof of payment
- **WebRTC Signaling**: Added authentication + transaction isolation
- **n8n Dockerfile**: Fixed Python 3.12 runtime
- **Android Domain**: Corrected to production domain
- **Self-Interception**: Prevented in UpiPaymentActivity
- **RESULT_OK**: Properly documented as NOT proof of payment
- **WebRTC**: Auth + transaction isolation added
- **n8n**: Python 3.12 runtime fixed
- **Android Domain**: Corrected to production
- **Self-Interception**: Prevented in UpiPaymentActivity

---

## [Unreleased]

### Planned for v1.1.0

- **N1**: Stage-Grammar Sequencing (SGS) - 5-beat UPI narrative validation
- **N2**: Self-Referential Frame Anchor (SRFA) - Animated HMAC micro-pattern
- **N3**: Capability Receipt - Informed consent receipt UI
- **N4**: Handle-Pinned Matching (Done)
- **N5**: Hash-Only Evidence Ledger (Done)
- **N6**: Latency-Aware Triage (Partial - paused clock done)

---

## [0.9.0] - 2026-11-20

### Added
- Initial 5-channel verification protocol
- WebRTC P2P signaling server
- Android companion app skeleton
- Unified verification protocol
- Basic checkout flow

### Fixed
- Docker Compose service definitions
- n8n Dockerfile base image
- Android manifest package name

### Changed
- Moved from single-channel to 5-channel verification
- Updated health check to `/healthz`
- Improved consent flow

---

## [0.8.0] - 2026-11-10

### Added
- Initial checkout flow
- Basic UPI intent generation
- PostgreSQL schema
- Railway deployment config

### Fixed
- Health check endpoint path
- Database connection pooling

---

## [0.1.0] - 2026-11-01

### Added
- Initial project structure
- Basic FastAPI server
- Basic checkout flow
- Railway deployment config