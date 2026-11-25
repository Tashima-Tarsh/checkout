/**
 * WebRTC P2P Verification Protocol Types
 * 
 * Defines the message protocol for P2P verification between
 * merchant and payer browsers.
 */

export type PeerRole = 'merchant' | 'payer';
export type ConnectionState = 'idle' | 'connecting' | 'connected' | 'verifying' | 'verified' | 'failed';
export type ChannelName = 'control' | 'camera' | 'audio' | 'verification';

export interface PeerInfo {
  id: string;
  role: PeerRole;
  ref?: string;
  state: ConnectionState;
}

export interface SignalingMessage {
  type: SignalingMessageType;
  payload: unknown;
  from: string;
  to?: string;
  timestamp: number;
}

export type SignalingMessageType =
  | 'offer'
  | 'answer'
  | 'ice'
  | 'register'
  | 'find_peer'
  | 'verification_request'
  | 'verification_response'
  | 'verification_result'
  | 'payment_initiated'
  | 'payment_completed'
  | 'verification_request'
  | 'verification_result'
  | 'welcome'
  | 'peer_found'
  | 'peer_not_found'
  | 'verification_started'
  | 'verification_failed'
  | 'verification_response'
  | 'payment_initiated'
  | 'payment_completed'
  | 'error';

export interface DataChannelMessage {
  type: DataChannelMessageType;
  payload: unknown;
  channel: ChannelName;
  timestamp: number;
}

export type DataChannelMessageType =
  | 'verification_request'
  | 'verification_response'
  | 'verification_result'
  | 'payment_initiated'
  | 'payment_completed'
  | 'verification_request'
  | 'camera_frame'
  | 'audio_chunk'
  | 'control_signal'
  | 'verification_request'
  | 'verification_result'
  | 'challenge'
  | 'challenge_response';

export interface VerificationRequest {
  ref: string;
  amount: number;
  vpa: string;
  timestamp: number;
  challenge?: string;
}

export interface VerificationResponse {
  ref: string;
  accepted: boolean;
  merchantId?: string;
  payerId?: string;
  timestamp: number;
}

export interface VerificationResult {
  ref: string;
  verified: boolean;
  channel: string;
  evidence: Record<string, unknown>;
  reason: string;
  timestamp: number;
}

export interface PaymentInitiated {
  ref: string;
  payerId: string;
  timestamp: number;
}

export interface PaymentCompleted {
  ref: string;
  upiRef: string;
  status: 'success' | 'failure';
  payerId: string;
  timestamp: number;
}

export interface PeerInfo {
  id: string;
  role: 'merchant' | 'payer';
  ref?: string;
  state: 'idle' | 'connecting' | 'connected' | 'verifying' | 'verified' | 'failed';
}

export interface ChannelConfig {
  name: string;
  ordered: boolean;
  reliable: boolean;
  maxRetransmits?: number;
}

export const CHANNEL_CONFIGS: Record<string, ChannelConfig> = {
  control: { name: 'control', ordered: true, reliable: true },
  verification: { name: 'verification', ordered: true, reliable: true },
  camera: { name: 'camera', ordered: false, reliable: false, maxRetransmits: 0 },
  audio: { name: 'audio', ordered: false, reliable: false, maxRetransmits: 0 }
};

export interface VerificationConfig {
  useCamera: boolean;
  useAudio: boolean;
  useColorPattern: boolean;
  usePassiveDwell: boolean;
  useProtocolHandler: boolean;
  challengeTtlMs: number;
  dwellThresholdMs: number;
}