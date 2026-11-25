# Interface Design Document (IDD)

**Project:** UPI Checkout — Zero-Installation Payment Verification  
**Version:** 1.0  
**Status:** Production Ready

---

## 1. Overview

This document defines all external and internal interfaces for the UPI Checkout verification system. All interfaces are designed for zero-installation, zero-PSP-dependency operation with privacy-first principles.

---

## 2. External Interfaces

### 2.1 Customer-Facing Interfaces

#### 2.1.1 Checkout Page (`GET /checkout/:orderId`)

**Purpose:** Render the payment checkout page for the customer.

| Aspect | Specification |
|--------|---------------|
| **Method** | `GET` |
| **Path** | `/checkout/:orderId` |
| **Authentication** | None (public) |
| **Response** | HTML page with UPI ID, amount, copy button, consent checkbox |
| **Caching** | `Cache-Control: no-store, no-cache, must-revalidate` |
| **Security Headers** | CSP, HSTS, X-Frame-Options: DENY |

**Request:**
```
GET /checkout/abc123def456
```

**Response (HTML):**
- UPI ID display (copyable)
- Exact amount (₹ format)
- Copy button (copies UPI ID to clipboard)
- Consent checkbox (mandatory, required)
- Privacy notice
- Verification status area (updates via polling)

**Client Behavior:**
1. Page loads → shows checkout
2. User checks consent checkbox → arms verification
3. User clicks "Copy UPI ID" → clipboard write, verification armed
3. User opens UPI app → pays → returns to browser
4. Auto-detection → verification runs → status updates

---

#### 2.1.2 Copy UPI ID Endpoint

**Purpose:** Record copy event, arm verification, return success.

| Aspect | Specification |
|--------|---------------|
| **Method** | `POST` |
| **Path** | `/api/checkout/:orderId/copy` |
| **Authentication** | None (session via cookie) |
| **Response** | `{ "status": "copied", "verificationArmed": true }` |

---

#### 2.1.3 Checkout Status Polling

**Purpose:** Client polls for verification status.

| Aspect | Specification |
|--------|---------------|
| **Method** | `GET` |
| **Path** | `/api/checkout/:orderId` |
| **Response** | `CheckoutStatusResponse` |

**Response Schema:**
```typescript
interface CheckoutStatusResponse {
  orderId: string;
  status: 'AWAITING_PAYMENT' | 'PENDING' | 'PAID' | 'EXPIRED';
  amountMinor: number;
  upiId: string;
  expires: number;              // Unix ms
  settlement?: SettlementStatus; // Present when status !== 'AWAITING_PAYMENT'
  liveVerification?: LiveVerificationStatus; // Present when verification active
}

interface SettlementStatus {
  satisfied: boolean;
  state: 'SETTLED' | 'WRONG_AMOUNT' | 'WRONG_PAYEE' | 'AMOUNT_UNCONFIRMED' |
         'INVALID_REFERENCE' | 'ORDER_NOT_ELIGIBLE' | 'EXPIRED' |
         'CHALLENGE_EXPIRED' | 'SENSITIVE_CONTENT_REJECTED' | 'VERIFICATION_UNAVAILABLE' |
         'AMBIGUOUS' | 'NOT_YET';
  reason: string;
  seen?: {
    amountMinor?: number;
    payeeOk?: boolean;
  };
}
```

---

#### 2.1.4 UPI Return Handler (Protocol Handler)

**Purpose:** Receives return from UPI app after payment.

| Aspect | Specification |
|--------|---------------|
| **Method** | `GET` |
| **Path** | `/upi-return` |
| **Query Parameters** | `tr` (ref), `upi_ref` (UTR), `status` (success/failure), `am` (amount), `pa` (VPA) |
| **Behavior** | Validates ref, attempts settlement if success, redirects to checkout page |

**Query Parameters:**
| Param | Required | Description |
|-------|----------|-------------|
| `tr` | Yes | Transaction reference (matches order) |
| `upi_ref` | Yes | UPI transaction reference (UTR) |
| `status` | Yes | `success` \| `failure` \| `pending` |
| `am` | No | Amount in rupees (e.g., "100.37") |
| `pa` | No | Payee VPA |

**Redirect:** `302 → /checkout/:orderId`

---

### 2.2 Verification API (Internal)

#### 2.2.1 Live Session Management

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `POST /api/checkout/:id/live/session` | `POST` | Issue 45s challenge |
| `POST /api/checkout/:id/live/frame` | `POST` | Submit camera frame (multipart) |
| `POST /api/checkout/:id/live/chime` | `POST` | Trigger verification check |
| `GET /api/checkout/:id/live/session` | `GET` | Get session challenge |
| `GET /api/checkout/:id/live/frame` | `GET` | Submit frame (GET fallback) |

#### 2.1.1 Live Session Request

```http
POST /api/checkout/:orderId/live/session
Content-Type: application/json
Origin: https://disha8-2.thenitishkr.in

// No body required
```

**Response:**
```json
{
  "challenge": "a1b2c3d4e5f6...",  // 32-char URL-safe string
  "expires": 1700000045000,       // Unix ms (now + 45s)
  "mediaRetained": false
}
```

#### 2.2.2 Live Frame Submission

```http
POST /api/checkout/:orderId/live/frame
Content-Type: multipart/form-data
X-Agentic-Challenge: <challenge-from-session>

Form Data:
- frame: <image/jpeg> (max 4MB)
```

**Response:**
```typescript
interface LiveFrameResponse {
  satisfied: boolean;
  state: 'SETTLED' | 'WRONG_AMOUNT' | 'WRONG_PAYEE' | 'AMOUNT_UNCONFIRMED' | 
         'INVALID_REFERENCE' | 'ORDER_NOT_ELIGIBLE' | 'EXPIRED' | 
         'CHALLENGE_EXPIRED' | 'SENSITIVE_CONTENT_REJECTED' | 
         'VERIFICATION_UNAVAILABLE' | 'AMBIGUOUS' | 'NOT_YET';
  reason: string;
  seen: {
    amountMinor?: number;    // Extracted amount (paise)
    payeeOk?: boolean;       // VPA match boolean
  };
}
```

#### 2.2.3 Chime Endpoint

```http
POST /api/checkout/:orderId/live/chime
Content-Type: application/json

// Triggers verification check, returns immediately
```

**Response:**
```json
{
  "satisfied": false,
  "state": "CHECK_REQUESTED",
  "mediaRetained": false
}
```

---

### 2.3 WebRTC Signaling API

#### 2.3.1 REST Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `POST /api/peer/register` | `POST` | Register peer (merchant/payer) |
| `WS /ws?peerId=...&authToken=...&transactionId=...` | WS | Signaling WebSocket |

#### 2.1.1 Peer Registration

```http
POST /api/peer/register
Content-Type: application/json

{
  "role": "merchant" | "payer",
  "ref": "optional-transaction-ref",
  "metadata": {}
}
```

**Response:**
```json
{
  "peerId": "a1b2c3d4e5f6...",
  "ref": "transaction-ref",
  "signalingUrl": "wss://signaling.example.com/ws"
}
```

#### 2.3.2 WebSocket Signaling Protocol

**Connection:** `wss://signaling.example.com/ws?peerId=xxx&authToken=xxx&transactionId=xxx`

**Message Format:**
```typescript
interface SignalingMessage {
  type: 'offer' | 'answer' | 'ice' | 'register' | 'find_peer' | 
        'verification_request' | 'verification_response' | 
        'verification_result' | 'payment_initiated' | 'payment_completed' | 
        'auth_challenge' | 'auth_response';
  payload: unknown;
  from: string;
  to?: string;
  timestamp: number;
  transactionId?: string;
}
```

**Message Types:**

| Type | Direction | Purpose |
|------|-----------|---------|
| `offer` | P2P | WebRTC offer |
| `answer` | P2P | WebRTC answer |
| `ice` | P2P | ICE candidate |
| `register` | Client→Server | Register ref |
| `find_peer` | Client→Server | Find peer by ref |
| `verification_request` | Merchant→Payer | Request verification |
| `verification_response` | Payer→Merchant | Accept/decline |
| `verification_result` | P2P | Final verdict |
| `payment_initiated` | Payer→Merchant | Payment started |
| `payment_completed` | Payer→Merchant | Payment done |
| `verification_result` | Server→Peer | Final verdict |
| `auth_challenge` | Server→Client | Auth challenge |
| `auth_response` | Client→Server | Auth response |

---

### 2.3 Merchant Dashboard API

#### 2.3.1 Orders List

```http
GET /api/orders
Authorization: Bearer <merchant_token>
```

**Response:**
```typescript
interface OrderListResponse {
  orders: OrderSummary[];
  pagination: { total: number; page: number; limit: number };
}

interface OrderSummary {
  id: string;
  amountMinor: number;
  created: number;
  expires: number;
  status: 'AWAITING_PAYMENT' | 'PENDING' | 'PAID' | 'EXPIRED';
  settlement?: {
    satisfied: boolean;
    state: string;
    reason: string;
  };
  liveVerification?: {
    enabled: boolean;
    tier: 'high' | 'medium' | 'low' | 'declaration-only';
  };
}
```

---

### 2.4 WebRTC Data Channel Protocol

#### Channel Configurations

| Channel | Label | Ordered | Reliable | Max Retransmits | Use Case |
|---------|-------|---------|----------|-----------------|----------|
| `control` | `control` | ✅ | ✅ | - | Signaling, heartbeats |
| `verification` | `verification` | ✅ | ✅ | - | Verification signals |
| `camera` | `camera` | ❌ | ❌ | 0 | Camera frames (JPEG) |
| `audio` | `audio` | ❌ | ❌ | 0 | Audio chunks |

#### Data Channel Message Format

```typescript
interface DataChannelMessage {
  type: 'verification_request' | 'verification_response' | 
        'verification_result' | 'payment_initiated' | 
        'payment_completed' | 'challenge' | 'challenge_response' | 
        'camera_frame' | 'audio_chunk' | 'control_signal';
  payload: unknown;
  channel: 'control' | 'verification' | 'camera' | 'audio';
  timestamp: number;
}
```

---

### 2.5 UPI Intent Format

**Standard UPI Intent URI:**
```
upi://pay?pa=merchant@okhdfcbank&pn=Merchant Name&am=100.37&tr=REF123456&tn=Order 123&url=https://merchant.com/upi-return?tr=REF123
```

**Parameters:**
| Param | Name | Required | Description |
|-------|------|----------|-------------|
| `pa` | Payee Address | Yes | Merchant VPA |
| `pn` | Payee Name | Yes | Display name |
| `am` | Amount | Yes | Amount in rupees (2 decimal) |
| `tr` | Transaction Ref | Yes | Unique reference (max 35 chars) |
| `tn` | Transaction Note | No | Description |
| `mc` | Merchant Category | No | 4-digit MCC |
| `mode` | Mode | No | `01`=intent, `02`=signed, `03`=QR |
| `orgid` | Org ID | Conditional | For signed intent |
| `sign` | Signature | Conditional | Base64 HMAC-SHA256 |
| `url` | Return URL | **Required** | Auto-return URL |
| `tn` | Note | No | Transaction note |

---

### 2.6 UPI Return Callback

**URL:** `https://merchant.com/upi-return?tr=REF123&upi_ref=UTR123&status=success&am=100.37`

| Parameter | Required | Description |
|-----------|----------|-------------|
| `tr` | Yes | Transaction reference |
| `upi_ref` | Yes | UPI Transaction Reference (UTR) |
| `status` | Yes | `success` \| `failure` \| `pending` |
| `am` | No | Amount paid (rupees) |
| `pa` | No | Payee VPA |

**Redirect:** `302 /checkout/:orderId`

---

### 2.7 Error Response Format

**All endpoints return consistent error format:**

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable description",
    "details": {}
  }
}
```

| HTTP Code | Error Code | Meaning |
|-----------|------------|---------|
| 400 | `INVALID_REQUEST` | Malformed request |
| 401 | `UNAUTHORIZED` | Missing/invalid auth |
| 403 | `FORBIDDEN` | Insufficient permissions |
| 404 | `NOT_FOUND` | Resource not found |
| 409 | `CONFLICT` | Duplicate/conflict |
| 410 | `GONE` | Expired/closed |
| 422 | `VALIDATION_ERROR` | Schema validation failed |
| 429 | `RATE_LIMITED` | Too many requests |
| 500 | `INTERNAL_ERROR` | Server error |
| 503 | `UNAVAILABLE` | Service unavailable |

---

## 3. Data Schemas

### 3.1 Core Types

```typescript
// Core types shared across all interfaces

type UpiRef = string;                    // 12-digit UTR
type UpiVpa = string;                    // user@bank
type AmountMinor = number;               // Paise (integer)
type OrderId = string;                   // 48-char hex
type MerchantId = string;                // 32-char hex
type PeerId = string;                    // 16-char alphanumeric
type TransactionId = string;             // 32-char alphanumeric
type Challenge = string;                 // 32-char URL-safe
type AuthToken = string;                 // 32-char URL-safe
type Sha256Digest = string;              // 64-char hex
type UnixTimestampMs = number;           // Epoch ms

type SessionState = 
  | 'idle' | 'armed' | 'launched' | 'returned' 
  | 'verifying' | 'settled' | 'expired' | 'failed';

type Verdict = 'confirmed' | 'probable' | 'unverified' | 'failed' | 'expired';

type EvidenceKind = 
  | 'webhook' 
  | 'psp_status' 
  | 'ocr' 
  | 'return' 
  | 'no_return_signal';

type SessionState = 
  | 'idle' | 'armed' | 'launched' | 'returned' 
  | 'verifying' | 'settled' | 'expired' | 'failed';
```

---

## 4. Error Codes Reference

| Code | HTTP | Description | Client Action |
|------|------|-------------|---------------|
| `INVALID_REQUEST` | 400 | Malformed request | Fix request format |
| `UNAUTHORIZED` | 401 | Missing/invalid auth | Re-authenticate |
| `FORBIDDEN` | 403 | Insufficient permissions | Check permissions |
| `NOT_FOUND` | 404 | Resource not found | Verify resource ID |
| `CHALLENGE_EXPIRED` | 410 | Challenge expired | Request new challenge |
| `CHALLENGE_CONSUMED` | 410 | Challenge already used | Request new challenge |
| `VERIFICATION_FAILED` | 422 | Verification failed | Show error, allow retry |
| `SENSITIVE_CONTENT_REJECTED` | 422 | Sensitive data detected | Retry with clean frame |
| `CHALLENGE_EXPIRED` | 410 | Challenge TTL exceeded | Request new challenge |
| `VERIFICATION_UNAVAILABLE` | 503 | Service temporarily down | Retry with backoff |

---

## 5. Versioning & Compatibility

| Interface | Version | Deprecation Policy |
|-----------|---------|-------------------|
| Checkout API | v1 | 12-month deprecation notice |
| Verification API | v1 | 12-month deprecation notice |
| WebRTC Signaling | v1 | 12-month deprecation notice |
| UPI Intent | NPCI v1 | NPCI governs |
| WebRTC Protocol | v1 | 12-month deprecation notice |

**Versioning Strategy:**
- URL versioning: `/api/v1/...`
- Header: `Accept: application/vnd.upi.checkout.v1+json`
- Breaking changes → new version, 12-month overlap

---

## 7. Security Requirements

### 7.1 Authentication

| Interface | Method | Details |
|-----------|--------|---------|
| Checkout API | Cookie + CSRF | HttpOnly, SameSite=Strict |
| Verification API | HMAC-SHA256 | Body + timestamp |
| WebRTC Signaling | Bearer token + challenge | Per-session |
| Merchant Dashboard | JWT (RS256) | 15min access, 7d refresh |

### 7.2 Rate Limits

| Endpoint | Limit | Window |
|----------|-------|--------|
| `/checkout/:id/copy` | 10/min | Per IP |
| `/api/checkout/:id/live/frame` | 30/min | Per session |
| `/api/checkout/:id/live/chime` | 10/min | Per session |
| `/api/peer/register` | 5/min | Per IP |
| WebSocket connections | 10 concurrent | Per IP |

---

*End of Interface Design Document*