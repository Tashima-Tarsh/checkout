# Architecture Document

**Project:** UPI Checkout — Zero-Installation Payment Verification  
**Version:** 1.0  
**Status:** Production Ready

---

## 1. System Context

```mermaid
graph TB
    subgraph "Customer"
        C[Customer Browser<br/>Any Device]
    end
    
    subgraph "Merchant"
        M[Merchant Browser<br/>Checkout Page]
        MA[Merchant Phone<br/>Android App]
    end
    
    subgraph "Payment"
        U[UPI App<br/>GPay/PhonePe/Paytm]
    end
    
    subgraph "Infrastructure"
        API[Checkout API<br/>FastAPI]
        WS[WebRTC Signaling<br/>Fastify + WS]
        DB[(PostgreSQL 18<br/>Supabase)]
        REDIS[(Redis 7)]
        N8N[n8n Workflow<br/>Python + Cloudflare]
    end
    
    subgraph "Monitoring"
        PROM[Prometheus]
        GRAF[Grafana]
        LOKI[Loki]
        JAEGER[Jaeger]
    end

    C -->|1. Opens Checkout| M
    M -->|2. Shows UPI ID + Amount| C
    C -->|2. Copies UPI ID| M
    C -->|3. Opens UPI App| U
    U -->|4. Pays Exact Amount| U
    U -->|5. Returns to Browser| C
    M -->|6. Auto-detects Return| C
    M -->|7. Verification Runs| C
    M -->|8. Shows Result| C
    
    M -.->|WebRTC P2P| MA
    MA -.->|Camera/Audio| M
    
    M -->|API Calls| API
    MA -->|Camera/Audio| M
    API --> DB
    API --> REDIS
    API -->|Webhook Dispatch| N8N
    N8N -->|Webhook Dispatch| WS
    WS <-->|WebSocket| MA
    WS -->|Signaling| M
    
    API --> PROM
    WS --> PROM
    API --> LOKI
    WS --> LOKI
    API --> JAEGER
    PROM --> GRAF
    LOKI --> GRAF
```

---

## 2. Payment Verification Flow

```mermaid
sequenceDiagram
    participant C as Customer Browser
    participant M as Merchant Browser
    participant MA as Merchant Android App
    participant U as UPI App
    participant API as Checkout API
    participant WS as WebRTC Signaling
    participant DB as Database
    participant V as Verification Engine

    Note over C,M: 1. CHECKOUT INITIATION
    C->>M: GET /checkout/:orderId
    M-->>C: Render checkout (UPI ID, amount, consent checkbox)
    
    Note over C,M: 2. USER ACTION
    C->>M: Ticks consent checkbox
    M->>M: armVerification() called
    M->>C: Shows "Verification armed"
    
    C->>M: Clicks "Copy UPI ID"
    M->>C: Copies UPI ID to clipboard
    M->>M: armVerification() called
    M->>M: Starts verification (arms dwell, sound, etc.)
    
    Note over C,U: 3. PAYMENT
    C->>U: Opens UPI app, pastes VPA, enters amount
    U->>U: Customer authorizes payment (PIN/biometric)
    U->>U: Payment processed
    U->>C: Returns to browser (or auto-return via protocol handler)
    
    Note over C,M: 4. RETURN & VERIFICATION
    alt Protocol Handler Return
        U->>C: Redirects to /upi-return?tr=REF&upi_ref=UTR&status=success
        C->>API: GET /upi-return?tr=REF&upi_ref=UTR&status=success
        API->>DB: Verify ref, attempt settlement
        API-->>C: Redirect to /checkout/:orderId
    else Passive Return
        C->>M: User returns to browser tab
        M->>M: visibilitychange: visible + dwell > 1.2s
        M->>API: Triggers verification check
    end
    
    Note over M,V: VERIFICATION PIPELINE
    par Parallel Verification Channels
        M->>V: Channel 1: Protocol Handler (auto-return UTR)
        M->>V: Channel 2: Passive Dwell (dwell > 1.2s)
        M->>MA: Request camera access
        MA-->>M: Camera frames (WebRTC DataChannel)
        M->>V: Channel 3: Camera OCR (amount, VPA, UTR, success)
        M->>V: Channel 4: Sound Detection (UPI chime)
        M->>V: Channel 5: Color Pattern (SRFA)
        M->>V: Channel 6: Stage Grammar (N1)
    end
    
    V->>V: Evidence Fusion Engine
    V->>V: Decision Logic
    
    alt Verified
        V->>DB: Write evidence, reserve reference
        V->>DB: Update order status = PAID
        V-->>M: Verified (Green)
    else Unverified
        V-->>M: Shows reason (Red/Yellow)
    end
    
    M-->>C: Update UI (Green/Red/Yellow)
```

---

## 3. Verification Pipeline Detail

```mermaid
flowchart TD
    A[Verification Triggered] --> B{Protocol Handler<br/>Return URL?}
    
    B -->|Yes| B1[Extract UTR, Status<br/>Amount, VPA from URL]
    B -->|No| B2[Passive Dwell Detection<br/>visibilitychange + dwell > 1.2s]
    
    B1 --> C[Protocol Handler Channel<br/>Evidence: UTR, Status, Amount, VPA]
    B2 --> D[Passive Dwell Channel<br/>Evidence: Dwell Time, Quick Return]
    
    C --> E{Evidence Fusion}
    D --> E
    
    E --> F[Camera OCR Channel<br/>Amount, VPA, UTR, Success]
    E --> G[Sound Detection Channel<br/>UPI Chime Confidence]
    E --> H[Color Pattern (SRFA)<br/>HMAC Sequence Match]
    E --> I[Stage Grammar (N1)<br/>5-Beat Sequence Score]
    E --> F[Passive Dwell<br/>Dwell Time, Quick Return]
    
    F --> G{Evidence Fusion Engine}
    G --> H{Decision Logic}
    
    H -->|Protocol: Success + UTR| H1[CONFIRMED<br/>Channel: protocol_handler]
    H -->|Camera+SRFA+StageGrammar≥0.8| H2[CONFIRMED<br/>Camera+SRFA+StageGrammar]
    H -->|Camera+Color+SRFA| H3[CONFIRMED<br/>Camera+Color+SRFA]
    H -->|Camera+Color| H4[CONFIRMED<br/>Camera+Color]
    H -->|Camera+Sound| H5[CONFIRMED<br/>Camera+Sound]
    H -->|Camera+StageGrammar≥0.8| H6[CONFIRMED<br/>Camera+StageGrammar]
    H -->|Camera Only (conf≥0.8)| H7[CONFIRMED<br/>Camera Only]
    H -->|Dwell+Sound| H8[PROBABLE<br/>Require Review]
    H -->|Dwell Only| H9[UNVERIFIED<br/>Require Review]
    H -->|Default| H10[FAILED/EXPIRED]
    
    H1 --> I[Write Evidence<br/>Reserve Reference<br/>Order=PAID]
    H2 --> I
    H3 --> I
    H4 --> I
    H5 --> I
    H6 --> I
    H7 --> I
    H8 --> J[Mark PROBABLE<br/>Queue for Review]
    H9 --> K[Mark UNVERIFIED<br/>Queue for Review]
    H10 --> L[Mark FAILED/EXPIRED]
    
    I --> M[Update Order=PAID<br/>Reserve Reference<br/>Write Evidence Ledger]
    J --> M
    K --> M
    L --> M
```

---

## 4. WebRTC P2P Verification Flow

```mermaid
sequenceDiagram
    participant M as Merchant Browser
    participant S as Signaling Server
    participant P as Payer Browser
    participant MA as Merchant Android App
    
    Note over M,S,P: SETUP
    M->>S: register(merchant, ref)
    P->>S: register(payer, ref)
    
    M->>S: find_peer(ref)
    S-->>M: peerFound(payerId)
    
    M->>S: offer
    S->>P: offer
    P->>S: answer
    S->>M: answer
    
    M->>S: ice
    S->>P: ice
    P->>S: ice
    S->>M: ice
    
    Note over M,P: Data Channels Established
    par Data Channels
        M->>P: control (reliable)
        M->>P: verification (reliable)
        M->>P: camera (unreliable)
        M->>P: audio (unreliable)
    end
    
    Note over M,P: VERIFICATION FLOW
    M->>P: verification_request{ref, amount, vpa, transactionId}
    P->>M: verification_response{accepted: true}
    
    P->>P: Launch UPI App (upi://pay?...)
    P->>P: User pays in UPI app
    P->>M: payment_initiated{ref}
    
    par Verification
        P->>M: Camera frames (DataChannel: camera)
        P->>M: Audio chunks (DataChannel: audio)
        M->>M: OCR + Color + Stage Grammar + Sound
    end
    
    P->>M: payment_completed{ref, upiRef, status}
    M->>M: Verify with evidence
    M->>P: verification_result{verified: true}
    M->>M: Update order=PAID, reserve reference
```

---

## 3. Infrastructure Deployment

```mermaid
graph TB
    subgraph "GitHub"
        GH[GitHub Repo<br/>main branch]
    end
    
    subgraph "CI/CD"
        GHA[GitHub Actions<br/>CI/CD Pipeline]
    end
    
    subgraph "Railway Cloud"
        subgraph "Services"
            API[Checkout API<br/>FastAPI × 3]
            AP[Agentic Pay<br/>FastAPI × 2]
            N8N[n8n Workflow<br/>Python + Cloudflare]
            WS[WebRTC Signaling<br/>Fastify × 2]
            REDIS[(Redis 7<br/>Cluster)]
            PG[(PostgreSQL 18<br/>Supabase)]
        end
    end
    
    subgraph "Monitoring"
        PROM[Prometheus]
        GRAF[Grafana]
        LOKI[Loki]
        JAEGER[Jaeger]
    end
    
    subgraph "DNS/CDN"
        CF[Cloudflare<br/>WAF + CDN]
        DNS[Route53<br/>disha8-2.thenitishkr.in]
    end

    GH -->|push main| GHA
    GHA -->|build & test| GHA
    GHA -->|deploy| API
    GHA -->|deploy| AP
    GHA -->|deploy| N8N
    GHA -->|deploy| WS
    
    API --> PG
    AP --> PG
    N8N --> PG
    WS --> PG
    API --> REDIS
    AP --> REDIS
    
    API --> PROM
    WS --> PROM
    API --> LOKI
    WS --> LOKI
    
    CF -->|WAF + CDN| API
    CF -->|WAF + CDN| WS
    DNS --> CF
```

---

## 4. Data Flow

```mermaid
flowchart LR
    subgraph "Customer Journey"
        C1[Customer Opens<br/>Checkout Page]
        C2[Copies UPI ID<br/>Arms Verification]
        C3[Opens UPI App<br/>Pays Exact Amount]
        C4[Returns to Browser]
    end
    
    subgraph "Verification"
        V1[Protocol Handler<br/>Auto-return UTR]
        V2[Passive Dwell<br/>Dwell > 1.2s]
        V3[Camera OCR<br/>Amount/VPA/UTR]
        V4[Sound Detection<br/>Chime Recognition]
        V5[Color Pattern<br/>HMAC Sequence]
        V6[Stage Grammar<br/>5-Beat Sequence]
        V7[Passive Dwell<br/>Heuristic]
    end
    
    subgraph "Decision"
        D1[Evidence Fusion<br/>7 Channels]
        D2[Decision Logic<br/>Priority Order]
        D3[Verdict<br/>CONFIRMED/PROBABLE/UNVERIFIED]
    end
    
    subgraph "Outcome"
        O1[Verified: PAID<br/>Reserve Reference]
        O2[Probable: Review]
        O3[Unverified: Retry]
        O4[Failed: Reject]
    end
    
    C1 --> C2 --> C3 --> C4
    C4 --> V1 & V2 & V3 & V4 & V5 & V6 & V7
    V1 & V2 & V3 & V4 & V5 & V6 & V7 --> D1
    D1 --> D2 --> D3
    D3 --> O1 & O2 & O3 & O4
```

---

## 5. Security Boundaries

```mermaid
graph TB
    subgraph "Public Internet"
        C[Customer]
        U[UPI App]
    end
    
    subgraph "DMZ / Edge"
        CF[Cloudflare WAF<br/>DDoS + Rate Limit]
        LB[Load Balancer]
    end
    
    subgraph "Private Network"
        subgraph "App Layer"
            API[Checkout API<br/>FastAPI × 3]
            WS[WebRTC Signaling<br/>Fastify × 2]
            AP[Agentic Pay<br/>FastAPI × 2]
            N8N[n8n Workflow]
        end
        
        subgraph "Data Layer"
            PG[(PostgreSQL 18<br/>Primary + Replicas)]
            REDIS[(Redis 7<br/>Cluster)]
        end
        
        subgraph "Observability"
            PROM[Prometheus]
            GRAF[Grafana]
            LOKI[Loki]
            JAEGER[Jaeger]
        end
    end
    
    subgraph "Mobile"
        MA[Merchant Android App]
    end
    
    C --> CF
    U --> CF
    CF --> LB
    LB --> API
    LB --> WS
    MA -.->|WebRTC| API
    MA -.->|Camera/Audio| API
    
    API --> PG
    API --> REDIS
    WS --> PG
    WS --> REDIS
    AP --> PG
    N8N --> PG
    
    API --> PROM
    WS --> PROM
    API --> LOKI
    WS --> LOKI
    API --> JAEGER
    
    classDef public fill:#e1f5fe,stroke:#01579b
    classDef private fill:#f3e5f5,stroke:#4a148c
    classDef data fill:#e8f5e9,stroke:#1b5e20
    
    class C,U public
    class CF,LB public
    class API,WS,AP,N8N private
    class PG,REDIS data
    class PROM,GRAF,LOKI,JAEGER private
```

---

## 5. Verification Decision Tree

```mermaid
flowchart TD
    Start([Verification Triggered]) --> A{Evidence<br/>Available?}
    
    A -->|Protocol Handler<br/>UTR + Success| B[CONFIRMED<br/>Channel: protocol_handler]
    
    A -->|Camera OCR<br/>Verified + SRFA<br/>Verified + StageGrammar<br/>Score ≥ 0.8| B2[CONFIRMED<br/>Camera + SRFA +<br/>StageGrammar]
    
    A -->|Camera OCR<br/>Verified + Color<br/>Verified + SRFA| C[CONFIRMED<br/>Camera + Color +<br/>SRFA]
    
    A -->|Camera OCR<br/>Verified + Color| D[CONFIRMED<br/>Camera + Color]
    
    A -->|Camera OCR<br/>Verified + Sound| E[CONFIRMED<br/>Camera + Sound]
    
    A -->|Camera OCR<br/>Verified + StageGrammar<br/>Score ≥ 0.8| F[CONFIRMED<br/>Camera + StageGrammar]
    
    A -->|Camera OCR<br/>Verified + Conf ≥ 0.8| G[CONFIRMED<br/>Camera Only]
    
    A -->|Dwell + Sound| H[PROBABLE<br/>Require Review]
    
    A -->|Dwell Only| I[UNVERIFIED<br/>Require Review]
    
    A -->|No Evidence| J[FAILED/EXPIRED]
    
    B --> K[Update Order=PAID<br/>Reserve Reference<br/>Write Evidence Ledger]
    B2 --> K
    C --> K
    D --> K
    E --> K
    F --> K
    G --> K
    
    H --> L[Queue for Manual Review]
    I --> L
    J --> M[Mark FAILED/EXPIRED]
    
    K --> N[Order Status = PAID<br/>Evidence Ledger Updated]
    L --> O[Queue for Manual Review]
    M --> P[Mark EXPIRED/FAILED]
```

---

## 6. Deployment Pipeline

```mermaid
graph LR
    subgraph "Development"
        DEV[Developer<br/>git push main]
    end
    
    subgraph "CI/CD"
        GHA[GitHub Actions<br/>CI Pipeline]
        
        subgraph "Jobs"
            LINT[Lint + TypeCheck<br/>ESLint + TSC + Ruff]
            UNIT[Unit Tests<br/>pytest + Vitest]
            INTEG[Integration Tests<br/>Testcontainers]
            BUILD[Docker Build<br/>Multi-stage]
            TEST_E2E[E2E Tests<br/>Playwright]
            SEC[Security Scan<br/>Trivy + CodeQL]
        end
    end
    
    subgraph "Registry"
        GHCR[GHCR<br/>ghcr.io/org/app]
    end
    
    subgraph "Deploy"
        RAIL[Railway<br/>Auto-deploy]
        HEALTH[Health Checks<br/>/healthz]
    end
    
    subgraph "Environments"
        STG[UAT Staging<br/>uat-staging.env]
        PROD[Production<br/>production.env]
    end
    
    DEV -->|push| GHA
    GHA --> LINT
    GHA --> UNIT
    GHA --> INTEG
    GHA --> BUILD
    GHA --> TEST_E2E
    GHA --> SEC
    LINT -->|pass| UNIT
    UNIT -->|pass| INTEG
    INTEG -->|pass| BUILD
    BUILD -->|pass| TEST_E2E
    TEST_E2E -->|pass| SEC
    SEC -->|pass| GHCR
    GHCR -->|push| RAIL
    RAIL -->|deploy| STG
    STG -->|health| HEALTH
    HEALTH -->|pass| PROD
```

---

## 7. Data Flow Summary

```mermaid
flowchart LR
    subgraph "Input"
        I1[Customer<br/>UPI Payment]
        I2[Merchant<br/>Consent + Copy]
    end
    
    subgraph "Processing"
        P1[Protocol Handler<br/>Auto-return]
        P2[Passive Dwell<br/>Visibility API]
        P3[Camera OCR<br/>Tesseract.js]
        P4[Sound Detect<br/>Web Audio API]
        P5[Color Pattern<br/>HMAC Sequence]
        P6[Stage Grammar<br/>FSM + Dwell]
        P7[Passive Dwell<br/>Heuristic]
    end
    
    subgraph "Fusion"
        F[Evidence Fusion<br/>7 Channels]
        D[Decision Engine<br/>Priority Logic]
    end
    
    subgraph "Output"
        O1[CONFIRMED<br/>PAID + Reserve]
        O2[PROBABLE<br/>Review Queue]
        O3[UNVERIFIED<br/>Retry]
        O4[FAILED/EXPIRED<br/>Reject]
    end
    
    subgraph "Persistence"
        S1[Orders Table<br/>Status + Timestamps]
        S2[Evidence Ledger<br/>SHA-256 Digests]
        S3[Settlement States<br/>Verdict + Evidence]
        S4[Challenges<br/>45s TTL]
    end
    
    I1 & I2 --> P1 & P2 & P3 & P4 & P5 & P6 & P7
    P1 & P2 & P3 & P4 & P5 & P6 & P7 --> F
    F --> D
    D --> O1 & O2 & O3 & O4
    O1 & O2 & O3 & O4 --> S1 & S2 & S3 & S4
```

---

## 8. Key Invariants

| Invariant | Enforcement |
|-----------|-------------|
| **120s Session Timeout** | Hard timeout in `UnifiedVerificationProtocol.start()` |
| **Paused Clock** | `visibilitychange` pauses timer during UPI app switch |
| **Challenge TTL** | 45 seconds, single-use, auto-cleanup |
| **Reference Dedup** | SHA-256(UTR) in `evidence_consumption` table |
| **No PII Capture** | Camera OCR filters PIN/OTP/balance/account# |
| **No PSP Dependency** | Zero external payment provider calls |
| **Auto-Termination** | All channels stopped on `finalize()` |
| **Consent Required** | Checkbox must be checked before arming |
| **Auto-Termination** | `stopAllChannels()` called on `finalize()` |
| **Consent Gate** | Checkbox `required` attribute, arms verification |

---

*End of Architecture Document*