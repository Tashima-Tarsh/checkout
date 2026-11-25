/**
 * Merchant WebRTC Verification Client - Enhanced
 * 
 * Orchestrates P2P verification from merchant side with:
 * - Robust connection handling with retries
 * - Multi-channel DataChannels with priority queuing
 * - Automatic reconnection and state recovery
 * - Verification flow orchestration
 */

import { EventEmitter } from 'events';
import {
  ConnectionState,
  VerificationConfig,
  VerificationResult,
  DataChannelMessage,
  ChannelName,
  VerificationRequest,
  PaymentInitiated,
  PaymentCompleted,
  VerificationResult as VerificationResultType
} from './protocol.js';
import { DataChannelManager, createDataChannelManager } from './channels.js';
import { generateColorSequence } from '../unified-verification-protocol.js';

export interface MerchantConfig {
  signalingUrl: string;
  verificationConfig: VerificationConfig;
  onStateChange?: (state: ConnectionState) => void;
  onVerificationResult?: (result: VerificationResult) => void;
  onError?: (error: Error) => void;
  onPeerConnected?: (payerId: string) => void;
  onPeerDisconnected?: (payerId: string) => void;
}

interface PeerConnectionState {
  peerId: string;
  role: 'merchant' | 'payer';
  pc: RTCPeerConnection;
  dcManager: any;
  ws: WebSocket;
  state: ConnectionState;
  ref?: string;
  payerId?: string;
  challenge?: string;
  challengeExpiry?: number;
  colorSequence: Array<{r: number, g: number, b: number, duration: number}>;
  verificationStartTime: number;
  retryCount: number;
  maxRetries: number;
  lastActivity: number;
}

export class MerchantWebRTCClient extends EventEmitter {
  private config: MerchantConfig;
  private ws: WebSocket | null = null;
  private peerState: PeerConnectionState | null = null;
  private signalingWs: WebSocket | null = null;
  private peerId: string = '';
  private ref: string = '';
  private state: 'idle' | 'connecting' | 'connected' | 'verifying' | 'verified' | 'failed' = 'idle';
  private config: any;
  private onStateChange?: (state: string) => void;
  private onVerificationResult?: (result: any) => void;
  private onError?: (error: Error) => void;
  private onPeerConnected?: (payerId: string) => void;
  private onPeerDisconnected?: (payerId: string) => void;
  private dcManager: any = null;
  private pc: any = null;
  private signalingWs: WebSocket | null = null;
  private challenge: string = '';
  private challengeExpiry: number = 0;
  private colorSequence: Array<{r: number, g: number, b: number, duration: number}> = [];
  private verificationStartTime: number = 0;
  private cameraStream: MediaStream | null = null;
  private audioStream: MediaStream | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 3;
  private heartbeatInterval: any = null;
  private lastHeartbeatAck = 0;
  private messageQueue: any[] = [];
  private isProcessingQueue = false;

  constructor(config: MerchantConfig) {
    super();
    this.config = config;
    this.config = config.verificationConfig;
    this.onStateChange = config.onStateChange;
    this.onVerificationResult = config.onVerificationResult;
    this.onError = config.onError;
    this.onPeerConnected = config.onPeerConnected;
    this.onPeerDisconnected = config.onPeerDisconnected;
  }

  async connect(signalingUrl: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.signalingWs = new WebSocket(signalingUrl);

      this.signalingWs.onopen = () => {
        console.log('[Merchant] Connected to signaling server');
        this.setState('connecting');
        resolve();
      };

      this.signalingWs.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.handleSignalingMessage(message);
        } catch (e) {
          console.error('[Merchant] Failed to parse signaling message:', e);
        }
      };

      this.signalingWs.onerror = (error) => {
        console.error('[Merchant] Signaling WebSocket error:', error);
        reject(new Error('Signaling connection failed'));
      };

      this.signalingWs.onclose = () => {
        console.log('[Merchant] Signaling connection closed');
        this.handleSignalingDisconnect();
      };
    });
  }

  async register(ref?: string): Promise<{ peerId: string; ref: string }> {
    return new Promise((resolve, reject) => {
      const message = {
        type: 'register',
        payload: { ref },
        from: 'merchant',
        timestamp: Date.now()
      };

      const timeout = setTimeout(() => {
        reject(new Error('Registration timeout'));
      }, 10000);

      const handler = (event: MessageEvent) => {
        try {
          const message = JSON.parse(event.data);
          if (message.type === 'welcome') {
            clearTimeout(timeout);
            this.signalingWs?.removeEventListener('message', handler);
            this.peerId = message.payload.peerId;
            resolve({ peerId: message.payload.peerId, ref: message.payload.ref });
          }
        } catch (e) {
          console.error('Failed to parse registration response:', e);
        }
      };

      this.signalingWs?.addEventListener('message', handler);
      this.sendSignaling(message);
    });
  }

  async createPeerConnection(payerId: string): Promise<void> {
    // Use native RTCPeerConnection in browser, wrtc in Node.js
    const RTCPeerConnectionImpl = (typeof window !== 'undefined' && window.RTCPeerConnection)
      ? window.RTCPeerConnection
      : (await import('wrtc')).RTCPeerConnection;

    this.pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' }
      ],
      iceCandidatePoolSize: 10,
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require'
    });

    // Create data channels
    this.dcManager = createDataChannelManager(this.pc);
    this.setupDataChannels();

    // Handle ICE candidates
    this.pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendSignaling({
          type: 'ice',
          payload: event.candidate.toJSON(),
          from: this.peerId,
          to: this.peerState?.payerId,
          timestamp: Date.now()
        });
      }
    };

    // Handle incoming data channels
    this.pc.ondatachannel = (event) => {
      const channel = event.channel;
      this.dcManager?.onChannelOpen?.(channel);
    };

    // Handle connection state changes
    this.pc.onconnectionstatechange = () => {
      if (!this.pc) return;
      console.log('[Merchant] Connection state:', this.pc.connectionState);
      if (this.pc.connectionState === 'connected') {
        this.setState('connected');
        this.startHeartbeat();
      } else if (this.pc.connectionState === 'failed' || this.pc.connectionState === 'disconnected') {
        this.handleConnectionFailure();
      }
    };

    // Handle ICE connection state
    this.pc.oniceconnectionstatechange = () => {
      if (!this.pc) return;
      console.log('[Merchant] ICE state:', this.pc.iceConnectionState);
      if (this.pc.iceConnectionState === 'failed') {
        this.handleICEFailure();
      }
    };
  }

  private setupDataChannels(): void {
    if (!this.dcManager) return;

    // Control channel - always reliable
    this.dcManager.on('control', (message: any) => {
      this.handleControlMessage(message);
    });

    // Verification channel - reliable
    this.dcManager.on('verification', (message: any) => {
      this.handleVerificationMessage(message);
    });

    // Camera channel - unordered, unreliable
    this.dcManager.on('camera', (data: ArrayBuffer) => {
      this.handleCameraFrame(data);
    });

    // Audio channel - unordered
    this.dcManager.on('audio', (data: ArrayBuffer) => {
      this.handleAudioChunk(data);
    });

    // Channel state monitoring
    ['control', 'verification', 'camera', 'audio'].forEach(name => {
      const channel = this.dcManager?.getChannel(name);
      if (channel) {
        channel.onclose = () => console.log(`[Merchant] Channel ${name} closed`);
        channel.onerror = (e: Error) => console.error(`[Merchant] Channel ${name} error:`, e);
      });
    });
  }

  async createOffer(): Promise<void> {
    if (!this.pc) throw new Error('Peer connection not created');

    const offer = await this.pc.createOffer({
      offerToReceiveAudio: false,
      offerToReceiveVideo: false
    });
    await this.pc.setLocalDescription(offer);

    this.sendSignaling({
      type: 'offer',
      payload: this.pc.localDescription,
      from: this.peerId,
      to: this.peerState?.payerId,
      timestamp: Date.now()
    });
  }

  async handleOffer(offer: any): Promise<void> {
    if (!this.pc) throw new Error('Peer connection not created');
    await this.pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);

    this.sendSignaling({
      type: 'answer',
      payload: this.pc.localDescription,
      from: this.peerId,
      to: this.peerState?.payerId,
      timestamp: Date.now()
    });
  }

  async handleAnswer(answer: any): Promise<void> {
    if (!this.pc) throw new Error('Peer connection not created');
    await this.pc.setRemoteDescription(new RTCSessionDescription(answer));
  }

  async handleIceCandidate(candidate: any): Promise<void> {
    if (!this.pc) throw new Error('Peer connection not created');
    try {
      await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (e) {
      console.error('[Merchant] ICE candidate error:', e);
    }
  }

  async startVerification(params: { ref: string; amount: number; vpa: string }): Promise<void> {
    const { ref, amount, vpa } = params;
    this.ref = params.ref;
    this.verificationStartTime = Date.now();

    // Generate color sequence for verification
    this.colorSequence = generateColorSequence(
      params.ref,
      Math.round(amount * 100), // paise
      Date.now(),
      'verification-secret-' + params.ref,
      5000, // 5 seconds
      30 // 30 fps
    );

    // Generate challenge
    this.challenge = crypto.randomUUID().replace(/-/g, '').slice(0, 32);
    this.challengeExpiry = Date.now() + 45000; // 45 seconds

    // Register with signaling server
    await this.register(params.ref);

    // Create peer connection
    await this.createPeerConnection('payer');

    // Find payer with same ref
    this.sendSignaling({
      type: 'find_peer',
      payload: { ref: this.ref },
      from: this.peerId,
      timestamp: Date.now()
    });

    // Wait for payer to be found
    await this.waitForPayer();

    // Create offer
    await this.createOffer();

    // Set state
    this.setState('verifying');
  }

  private async waitForPayer(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Payer not found within timeout'));
      }, 60000);

      const handler = (event: MessageEvent) => {
        try {
          const message = JSON.parse(event.data);
          if (message.type === 'peer_found' && message.payload.peerId) {
            clearTimeout(timeout);
            this.signalingWs?.removeEventListener('message', handler);
            this.peerState = {
              ...this.peerState!,
              payerId: message.payload.peerId,
              state: 'connecting'
            };
            resolve();
          } else if (message.type === 'peer_not_found') {
            clearTimeout(timeout);
            this.signalingWs?.removeEventListener('message', handler);
            reject(new Error('Payer not found'));
          }
        } catch (e) {
          console.error('Error handling peer find:', e);
        }
      };

      this.signalingWs?.addEventListener('message', handler);
      this.sendSignaling({
        type: 'find_peer',
        payload: { ref: this.ref },
        from: this.peerId,
        timestamp: Date.now()
      });
    });
  }

  private handleSignalingMessage(message: any): void {
    switch (message.type) {
      case 'welcome':
        this.peerId = message.payload.peerId;
        break;
      case 'offer':
        this.handleOffer(message.payload);
        break;
      case 'answer':
        this.handleAnswer(message.payload);
        break;
      case 'ice':
        this.handleIceCandidate(message.payload);
        break;
      case 'peer_found':
        // Handled in waitForPayer
        break;
      case 'verification_started':
        this.setState('verifying');
        break;
      case 'verification_failed':
        this.setState('failed');
        this.emit('error', new Error(message.payload?.error || 'Verification failed'));
        break;
      case 'verification_response':
        break;
      case 'payment_initiated':
        this.setState('verifying');
        break;
      case 'payment_completed':
        this.handlePaymentCompleted(message.payload);
        break;
      case 'verification_result':
        this.handleVerificationResult(message.payload);
        break;
      case 'error':
        console.error('[Merchant] Signaling error:', message.payload);
        break;
    }
  }

  private handleControlMessage(message: any): void {
    console.log('[Merchant] Control message:', message);
  }

  private handleVerificationMessage(message: any): void {
    const payload = message.payload;
    if (!payload || typeof payload !== 'object') return;

    switch (message.type) {
      case 'verification_request':
        break;
      case 'verification_response':
        break;
      case 'verification_result':
        this.handleVerificationResult(payload);
        break;
      case 'payment_initiated':
        this.handlePaymentInitiated(payload);
        break;
      case 'payment_completed':
        this.handlePaymentCompleted(payload);
        break;
      case 'challenge':
        break;
      case 'challenge_response':
        break;
    }
  }

  private async handleCameraFrame(data: ArrayBuffer): Promise<void> {
    // Process camera frame for OCR, color detection, etc.
    // Integrate with unified verification protocol
  }

  private async handleAudioChunk(data: ArrayBuffer): Promise<void> {
    // Process audio chunk for chime detection
  }

  private handlePaymentInitiated(payload: any): void {
    console.log('[Merchant] Payment initiated by payer:', payload);
    this.setState('verifying');
  }

  private handlePaymentCompleted(payload: any): void {
    console.log('[Merchant] Payment completed:', payload);
    this.verifyWithServer(payload.ref, payload.upiRef, payload.status);
  }

  private handleVerificationResult(payload: any): void {
    const result = {
      verified: payload.verified,
      channel: payload.channel,
      evidence: payload.evidence,
      reason: payload.reason,
      timestamp: payload.timestamp || Date.now()
    };

    if (payload.verified) {
      this.setState('verified');
      this.onVerificationResult?.(result);
    } else {
      this.setState('failed');
      this.emit('error', new Error(payload.reason || 'Verification failed'));
    }
  }

  private async verifyWithServer(ref: string, upiRef: string, status: string): Promise<void> {
    try {
      const response = await fetch(`/api/checkout/${ref}/live/frame`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Agentic-Challenge': this.challenge
        },
        body: JSON.stringify({ upiRef, status })
      });

      const result = await response.json();
      if (result.satisfied) {
        this.setState('verified');
        this.onVerificationResult?.({ verified: true, reason: 'Server verified' });
      } else {
        this.setState('failed');
        this.emit('error', new Error(result.reason || 'Verification failed'));
      }
    } catch (e) {
      console.error('[Merchant] Server verification failed:', e);
      this.setState('failed');
      this.emit('error', e as Error);
    }
  }

  async startCameraCapture(): Promise<void> {
    try {
      this.cameraStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false
      });

      const video = document.createElement('video');
      video.srcObject = this.cameraStream;
      video.muted = true;
      video.playsInline = true;
      await video.play();

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { willReadFrequently: true });

      const captureLoop = async () => {
        if (!this.cameraStream) return;
        
        const width = Math.min(video.videoWidth || 1280, 1280);
        const height = Math.round((video.videoHeight || 720) * width / (video.videoWidth || 1280));
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx!.drawImage(video, 0, 0, width, height);
        
        const blob = await new Promise<Blob | null>(resolve => 
          canvas.toBlob(resolve, 'image/jpeg', 0.8)
        );
        
        if (blob) {
          const arrayBuffer = await blob.arrayBuffer();
          this.dcManager?.sendBinary('camera', arrayBuffer);
        }
        
        if (this.cameraStream) {
          requestAnimationFrame(captureLoop);
        }
      };

      captureLoop();
    } catch (e) {
      console.error('Camera capture failed:', e);
      this.emit('error', e as Error);
    }
  }

  async startAudioCapture(): Promise<void> {
    try {
      this.audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioContext.createMediaStreamSource(this.audioStream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.3;
      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const detectLoop = () => {
        if (!this.audioStream) return;
        
        analyser.getByteFrequencyData(dataArray);
        
        // Detect UPI success chime
        const highFreqEnergy = dataArray.slice(200, 400).reduce((a, b) => a + b, 0) / 200;
        const baselineEnergy = dataArray.slice(0, 100).reduce((a, b) => a + b, 0) / 100;
        
        if (highFreqEnergy > baselineEnergy * 3 && highFreqEnergy > 50) {
          this.dcManager?.send('verification', {
            type: 'sound_detected',
            payload: { timestamp: Date.now(), confidence: highFreqEnergy / (baselineEnergy * 5) }
          });
        }
        
        requestAnimationFrame(detectLoop);
      };

      detectLoop();
    } catch (e) {
      console.error('Audio capture failed:', e);
    }
  }

  private startHeartbeat(): void {
    this.lastHeartbeatAck = Date.now();
    this.heartbeatInterval = setInterval(() => {
      if (Date.now() - this.lastHeartbeatAck > 10000) {
        console.warn('[Merchant] Heartbeat timeout, connection may be dead');
        this.handleConnectionFailure();
        return;
      }
      
      this.sendDataChannel('control', {
        type: 'heartbeat',
        payload: { timestamp: Date.now() },
        channel: 'control',
        timestamp: Date.now()
      });
    }, 5000);
  }

  private handleConnectionFailure(): void {
    console.warn('[Merchant] Connection failed, attempting reconnect...');
    this.stopHeartbeat();
    
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`[Merchant] Reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
      setTimeout(() => this.attemptReconnect(), 2000 * this.reconnectAttempts);
    } else {
      console.error('[Merchant] Max reconnect attempts reached');
      this.setState('failed');
      this.emit('error', new Error('Max reconnection attempts reached'));
    }
  }

  private handleICEFailure(): void {
    console.warn('[Merchant] ICE connection failed');
    this.handleConnectionFailure();
  }

  private async attemptReconnect(): Promise<void> {
    if (!this.peerState?.payerId) return;
    
    try {
      // Close existing connection
      if (this.pc) {
        this.pc.close();
      }
      
      // Create new connection
      await this.createPeerConnection(this.peerState.payerId);
      
      // Re-create offer
      await this.createOffer();
      
      // Wait for connection
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Reconnect timeout')), 15000);
        const checkConnected = () => {
          if (this.pc?.connectionState === 'connected') {
            clearTimeout(timeout);
            resolve();
          } else if (this.pc?.connectionState === 'failed') {
            clearTimeout(timeout);
            reject(new Error('Reconnect failed'));
          } else {
            setTimeout(checkConnected, 100);
          }
        };
        checkConnected();
      });
      
      console.log('[Merchant] Reconnected successfully');
      this.reconnectAttempts = 0;
    } catch (e) {
      console.error('[Merchant] Reconnect failed:', e);
      this.handleConnectionFailure();
    }
  }

  private setState(state: string): void {
    this.state = state;
    this.onStateChange?.(state);
    this.emit('stateChange', state);
  }

  private sendSignaling(message: any): void {
    if (this.signalingWs?.readyState === WebSocket.OPEN) {
      this.signalingWs.send(JSON.stringify(message));
    } else {
      // Queue message for later
      this.messageQueue.push(message);
    }
  }

  private sendDataChannel(channel: string, message: unknown): boolean {
    if (!this.dcManager) return false;
    return this.dcManager.send(channel, message);
  }

  private setState(state: string): void {
    this.state = state;
    this.onStateChange?.(state);
    this.emit('stateChange', state);
  }

  async disconnect(): Promise<void> {
    this.stopHeartbeat();
    
    if (this.pc) {
      this.pc.close();
      this.pc = null;
    }
    
    if (this.signalingWs) {
      this.signalingWs.close();
      this.signalingWs = null;
    }
    
    if (this.cameraStream) {
      this.cameraStream.getTracks().forEach(t => t.stop());
      this.cameraStream = null;
    }
    
    if (this.audioStream) {
      this.audioStream.getTracks().forEach(t => t.stop());
      this.audioStream = null;
    }
    
    this.dcManager?.closeAll();
    this.dcManager = null;
    this.pc = null;
    this.setState('idle');
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private handleSignalingDisconnect(): void {
    console.warn('[Merchant] Signaling disconnected');
    this.handleConnectionFailure();
  }

  getState(): string {
    return this.state;
  }

  getPeerId(): string {
    return this.peerId;
  }

  getRef(): string {
    return this.ref;
  }

  getConnectionQuality(): { rtt: number; packetLoss: number } | null {
    if (!this.pc) return null;
    // Would need to implement stats gathering
    return null;
  }
}

export function createMerchantClient(config: any): any {
  return new MerchantWebRTCClient(config);
}