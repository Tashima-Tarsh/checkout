# Technical Design Document (TDD)

**Project:** UPI Checkout — Zero-Installation Payment Verification  
**Version:** 1.0  
**Status:** Production Ready  
**Classification:** Internal — Technical Reference

---

## 1. System Overview

### 1.1 Purpose
A zero-installation, browser-based UPI payment verification system that provides cryptographic-grade payment confirmation without PSP integration, app installation, or sensitive data capture.

### 1.2 Scope
- **In Scope:** Browser-based verification engine, Android companion app, WebRTC P2P signaling, evidence fusion engine, merchant dashboard
- **Out of Scope:** PSP integration, banking core, KYC/AML, dispute resolution, refund processing

### 1.3 Key Constraints
| Constraint | Specification |
|------------|---------------|
| **Installation** | Zero — pure browser + optional Android companion |
| **Session Duration** | 120 seconds hard limit (paused during UPI app switch) |
| **Verification Channels** | 7 (Protocol, Camera, Sound, Color, Grammar, Dwell, Protocol Handler) |
| **Privacy** | Zero PII, no PIN/OTP/balance capture, auto-expiry |
| **Deployment** | Browser + optional Android companion, zero PSP dependency |

---

## 2. System Architecture

### 2.1 High-Level Components

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           UPI CHECKOUT ECOSYSTEM                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐               │
│  │   Customer   │     │   Merchant   │     │   UPI App    │               │
│  │  (Browser)   │     │  (Browser +  │     │  (GPay/      │               │
│  │              │     │   Android)   │     │   PhonePe/   │               │
│  └──────┬───────┘     └──────┬───────┘     └──────┬───────┘               │
│        │                    │                    │                        │
│        │ 1. Checkout Page   │                    │                        │
│        │    (UPI ID + Amt)  │                    │                        │
│        ▼                    ▼                    │                        │
│  ┌─────────────────────────────────────────────────────────────────┐     │
│  │                    VERIFICATION ENGINE                          │     │
│  ├─────────────────────────────────────────────────────────────────┤     │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐  │     │
│  │  │Protocol │ │ Camera  │ │ Sound   │ │ Color   │ │ Grammar │  │     │
│  │  │ Handler │ │ + OCR   │ │ Detect  │ │ Pattern │ │ (SGS)   │  │     │
│  │  └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘  │     │
│  │       │           │           │           │           │         │     │
│  │       └───────────┴───────────┴───────────┴───────────┘         │     │
│  │                           │                                      │     │
│  │                    EVIDENCE FUSION ENGINE                        │     │
│  │                           │                                      │     │
│  │                    VERDICT: CONFIRMED / PROBABLE / UNVERIFIED   │     │
│  └─────────────────────────────────────────────────────────────────┘     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Component Specifications

### 3.1 Verification Channels (7 Channels)

| Channel | Type | Input | Output | Latency | Reliability |
|---------|------|-------|--------|---------|-------------|
| **1. Protocol Handler** | Passive | UPI return URL | {upiRef, status, amount} | <1s | High (cryptographic) |
| **2. Camera + OCR** | Active | Camera frames | {amount, vpa, utr, success} | 2-5s | High (visual) |
| **3. Color Pattern (SRFA)** | Active | Camera frames | HMAC sequence match | 2-5s | High (cryptographic) |
| **4. Sound Detection** | Passive | Microphone | Chime confidence | 1-3s | Medium |
| **5. Stage Grammar (N1)** | Active | OCR text sequence | Stage sequence score | 2-5s | High (behavioral) |
| **6. Passive Dwell** | Passive | Visibility API | Dwell time, return signal | 0s | Low (heuristic) |
| **7. Passive Dwell + Sound** | Hybrid | Dwell + audio | Combined heuristic | 1-3s | Medium |

---

### 3.2 Decision Logic (Evidence Fusion)

```
VERDICT HIERARCHY (strongest → weakest):

1. PROTOCOL_HANDLER (success + UTR)                          → CONFIRMED
2. CAMERA + SRFA + STAGE_GRAMMAR (score ≥ 0.8)              → CONFIRMED
3. CAMERA + COLOR + SRFA                                     → CONFIRMED
4. CAMERA + COLOR                                            → CONFIRMED
5. CAMERA + SOUND                                            → CONFIRMED
6. CAMERA + STAGE_GRAMMAR (score ≥ 0.8)                     → CONFIRMED
7. CAMERA_ONLY (confidence ≥ 0.8)                           → CONFIRMED
8. DWELL + SOUND                                             → PROBABLE (review)
9. DWELL_ONLY                                                → UNVERIFIED (review)
```

**Anti-Replay Guarantees:**
- Stage-Grammar Sequencing (N1): Monotonic 5-stage sequence with dwell-time bounds
- Frame Anchor (N2): HMAC-bound animated micro-pattern, time-readable from pixels
- Handle-Pinned VPA Matching: Exact localpart match, homoglyph detection
- Hash-Only Ledger: SHA-256(UTR) only, no raw UTR storage

---

## 4. Data Models

### 4.1 Core Entities

```typescript
// Core transaction reference
interface TransactionRef {
  ref: string;                    // 32-char unique, merchant-generated
  amountMinor: number;            // Paise (e.g., 10037 = ₹100.37)
  vpa: string;                    // Payee VPA (merchant@bank)
  merchantId: string;             // Merchant identifier
  createdAt: number;              // Unix ms
  expiresAt: number;              // Unix ms (created + 120s)
  status: 'AWAITING_PAYMENT' | 'PENDING' | 'PAID' | 'EXPIRED';
}

// Evidence collected per channel
interface Evidence {
  channel: 'protocol_handler' | 'camera_ocr' | 'color_pattern' | 'sound' | 
           'stage_grammar' | 'passive_dwell' | 'srfa';
  timestamp: number;
  verified: boolean;
  confidence: number;           // 0.0 - 1.0
  evidence: ChannelEvidence;    // Channel-specific data
}

// Channel-specific evidence
interface CameraEvidence {
  amounts: number[];            // Extracted amounts (paise)
  vpas: string[];               // Detected VPAs
  refs: string[];               // UTRs found
  successKeyword: boolean;
  failureKeyword: boolean;
  confidence: number;           // 0.0 - 1.0
  rawText: string;
}

interface ColorEvidence {
  matchedFrames: number;
  expectedFrames: number;
  matchRatio: number;
  verified: boolean;
}

interface SoundEvidence {
  detected: boolean;
  confidence: number;
  ratio: number;
}

interface StageGrammarEvidence {
  score: number;                // 0.0 - 1.0
  sequence: StageEvent[];       // Stage transitions with timestamps
}

interface PassiveDwellEvidence {
  dwellMs: number;
  quickReturn: boolean;
}

interface SRFAEvidence {
  verified: boolean;
  framesMatched: number;
  frameIndex: number;
}
```

### 4.2 Verdict Output

```typescript
interface VerificationResult {
  verdict: 'CONFIRMED' | 'PROBABLE' | 'UNVERIFIED' | 'FAILED' | 'EXPIRED';
  confidence: number;           // 0.0 - 1.0
  primaryChannel: string;
  evidence: Evidence[];
  requireManualReview: boolean;
  reason: string;
  timestamp: number;
}
```

---

## 5. API Contracts

### 5.1 Checkout API (Merchant → Customer)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `GET /checkout/:orderId` | GET | Render checkout page |
| `POST /api/checkout/:id/copy` | POST | Record copy event, arm verification |
| `GET /api/checkout/:id` | GET | Poll status (polling fallback) |
| `POST /api/checkout/:id/verify` | POST | Manual verify trigger |
| `GET /upi-return` | GET | Protocol handler return endpoint |

### 5.2 Verification API (Internal)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `POST /api/checkout/:id/live/session` | POST | Issue 45s challenge |
| `POST /api/checkout/:id/live/frame` | POST | Submit camera frame |
| `POST /api/checkout/:id/live/chime` | POST | Trigger verification check |
| `GET /api/checkout/:id/live/session` | GET | Get session challenge |
| `GET /api/checkout/:id/live/frame` | GET | Submit frame (GET fallback) |

### 5.3 WebRTC Signaling API

| Endpoint | Protocol | Purpose |
|----------|----------|---------|
| `WS /ws?peerId=...` | WebSocket | Signaling channel |
| `POST /api/peer/register` | REST | Register peer |
| `POST /api/peer/verify` | REST | Request verification |

---

## 6. Security Model

### 6.1 Threat Model (STRIDE)

| Threat | Mitigation |
|--------|------------|
| **Spoofing** | Protocol handler UTR verification, SRFA frame anchor |
| **Tampering** | SHA-256 evidence ledger, HMAC color sequences |
| **Repudiation** | Immutable evidence ledger, SHA-256 digests |
| **Information Disclosure** | No PII capture, hash-only ledger, auto-expiry |
| **Denial of Service** | Rate limiting, challenge TTL, connection limits |
| **Elevation of Privilege** | Capability receipt consent, no persistent permissions |

### 6.2 Cryptographic Primitives

| Purpose | Algorithm | Parameters |
|---------|-----------|------------|
| Reference dedup | SHA-256 | UTR → SHA-256(UTR) |
| Color sequence | HMAC-SHA256 | Key: per-session secret |
| Frame anchor | HMAC-SHA256 | ref\|amount\|ts\|frame\|secret |
| Session challenges | crypto.randomUUID | 32-char, 45s TTL |
| Evidence ledger | SHA-256 | session_id \|\| UTR \|\| amount \|\| VPA \|\| stage_seq \|\| anchor_phase \|\| tier |

---

## 7. Deployment Architecture

### 7.1 Infrastructure

| Component | Technology | Scaling |
|-----------|------------|---------|
| **Checkout API** | FastAPI (Python) | K8s HPA (CPU > 70%) |
| **Verification Engine** | FastAPI (Python) | Stateless, horizontal |
| **WebRTC Signaling** | Fastify + WS (Node) | Sticky sessions |
| **Database** | PostgreSQL 18 (Supabase) | Read replicas |
| **Cache/Queue** | Redis 7 | Cluster mode |
| **Object Storage** | Supabase Storage | Frames (ephemeral) |
| **Monitoring** | Prometheus + Grafana + Loki | Full stack |

### 7.2 Network Topology

```
                    ┌─────────────────────┐
                    │   Cloudflare WAF    │
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
                    │   Load Balancer     │
                    └──────────┬──────────┘
                               │
          ┌────────────────────┼────────────────────┐
          ▼                    ▼                    ▼
    ┌───────────┐       ┌───────────┐       ┌───────────┐
    │  API Pod  │       │  API Pod  │       │  API Pod  │
    │ (FastAPI) │       │ (FastAPI) │       │ (FastAPI) │
    └─────┬─────┘       └─────┬─────┘       └─────┬─────┘
          │                   │                   │
          └───────────────────┼───────────────────┘
                              ▼
                    ┌───────────────────┐
                    │   PostgreSQL 18   │
                    │    (Primary)      │
                    └───────────────────┘
```

---

## 8. Operational Requirements

### 8.1 SLAs

| Metric | Target |
|--------|--------|
| **Availability** | 99.9% (monthly) |
| **Verification Latency (P99)** | < 3s (Protocol), < 5s (Camera) |
| **Session Timeout** | 120s hard, paused during UPI app |
| **False Rejection Rate** | < 2% (Phase 1), < 1% (Phase 2) |
| **False Acceptance Rate** | < 0.01% |

### 8.2 Observability

| Signal | Tool | Retention |
|--------|------|-----------|
| Metrics | Prometheus + Grafana | 30 days |
| Logs | Loki | 30 days |
| Traces | Tempo/Jaeger | 7 days |
| Alerts | Alertmanager → PagerDuty/Slack | Real-time |

---

## 9. Testing Strategy

| Layer | Tool | Coverage Target |
|-------|------|-----------------|
| Unit | pytest / Vitest | > 90% |
| Integration | pytest + Testcontainers | > 80% |
| E2E | Playwright | Critical paths |
| Contract | Pact | Consumer-driven |
| Load | k6 | 1000 RPS sustained |
| Chaos | Litmus | Monthly |

---

## 9. Rollout Plan

| Phase | Scope | Criteria |
|-------|-------|----------|
| **Phase 1** | Internal merchants, P2M only | FRR < 5%, FAR < 0.1% |
| **Phase 2** | Beta merchants, P2P + P2M | FRR < 2%, FAR < 0.05% |
| **Phase 3** | General availability | FRR < 1%, FAR < 0.01% |

---

## 10. Open Decisions

| Decision | Options | Recommendation |
|----------|---------|----------------|
| Color pattern duration | 3s vs 5s vs 10s | 5s (balance UX vs security) |
| SRFA tile grid | 4×4 vs 8×8 | 4×4 (H.264 survivability) |
| Camera frames analyzed | 30 vs 60 | 30 (balance latency/accuracy) |
| Sound detection threshold | 0.7 vs 0.8 | 0.7 (recall priority) |
| Stage-grammar min dwell | 300ms vs 500ms | 300ms (accommodate fast UX) |

---

## 11. Appendix: Key Algorithms

### A.1 Stage-Grammar Sequencer (N1)

```python
STAGES = ['PAYEE_SCREEN', 'AMOUNT_CONFIRM', 'AUTH_SHEET', 'PROCESSING', 'SUCCESS']
MIN_DWELL_MS = 300
MAX_DWELL_MS = 30_000
MAX_TOTAL_MS = 180_000

FSM = {
    'PAYEE_SCREEN':      {'next': 'AMOUNT_CONFIRM', 'can_skip': False},
    'AMOUNT_CONFIRM':    {'next': 'AUTH_SHEET',     'can_skip': False},
    'AUTH_SHEET':        {'next': 'PROCESSING', 'can_skip': True, 'skip_to': 'SUCCESS'},
    'PROCESSING':        {'next': 'SUCCESS',        'can_skip': False},
    'SUCCESS':           {'next': None,             'can_skip': False},
}
```

### A.2 Frame Anchor Verification (N2)

```python
def verify_frame(captured_colors, ref, amount, timestamp, secret, frame_index, tolerance=30):
    # HMAC-SHA256(ref|amount|timestamp|frameIndex|secret) per tile
    expected = generate_expected_colors(ref, amount, timestamp, frame_index, secret)
    matches = sum(1 for i in range(16) if color_distance(captured[i], expected[i]) <= tolerance)
    return matches / 16 >= 0.8
```

### A.3 Stage-Grammar Scoring

```python
def score(sequence):
    completed = len([s for s in stages if s.end_time])
    score = completed / len(STAGES)
    for stage in stages:
        if stage.dwell_ms and (stage.dwell_ms < MIN or stage.dwell_ms > MAX):
            score *= 0.5
    return max(0, min(1, score))
```

---

*End of Technical Design Document*