/**
 * Payer WebRTC Verification Client - Enhanced
 * 
 * Handles payer side of P2P verification with:
 * - Robust connection handling
 * - Automatic UPI app launch with return URL
 * - Camera/audio capture for verification
 * - Automatic reconnection
 * - Graceful error handling
 */

import { EventEmitter } from 'events';
import {
  ConnectionState,
  VerificationConfig,
  DataChannelMessage,
  DataChannelMessageType,
  ChannelName
} from './protocol.js';
import { DataChannelManager, createDataChannelManager } from './channels.js';

export interface PayerConfig {
  signalingUrl: string;
  verificationConfig: VerificationConfig;
  onStateChange?: (state: string) => void;
  onVerificationRequest?: (request: any) => Promise<{ accepted: boolean }>;
  onUpiLaunch?: (intent: string) => void;
  onError?: (error: Error) => void;
  onPeerConnected?: (merchantId: string) => void;
  onPeerDisconnected?: (merchantId: string) => void;
}

interface PeerConnectionState {
  peerId: string;
  role: 'merchant' | 'payer';
  pc: RTCPeerConnection;
  dcManager: any;
  ws: WebSocket;
  state: ConnectionState;
  ref?: string;
  merchantId?: string;
  challenge?: string;
  challengeExpiry?: number;
}

export class PayerWebRTCClient extends EventEmitter {
  private config: PayerConfig;
  private signalingWs: WebSocket | null = null;
  private pc: any = null;
  private dcManager: any = null;
  private peerId: string = '';
  private ref: string = '';
  private state: 'idle' | 'connecting' | 'connected' | 'verifying' | 'verified' | 'failed' = 'idle';
  private config: any;
  private onStateChange?: (state: string) => void;
  private onVerificationRequest?: (request: any) => Promise<{ accepted: boolean }>;
  private onUpiLaunch?: (intent: string) => void;
  private onError?: (error: Error) => void;
  private onPeerConnected?: (merchantId: string) => void;
  private onPeerDisconnected?: (merchantId: string) => void;
  private dcManager: any = null;
  private pc: any = null;
  private signalingWs: WebSocket | null = null;
  private merchantId: string = '';
  private ref: string = '';
  private challenge: string = '';
  private challengeExpiry: number = 0;
  private cameraStream: MediaStream | null = null;
  private audioStream: MediaStream | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 3;
  private heartbeatInterval: any = null;
  private lastHeartbeatAck = 0;
  private messageQueue: any[] = [];
  private isProcessingQueue = false;

  constructor(config: PayerConfig) {
    super();
    this.config = config;
    this.config = config.verificationConfig;
    this.onStateChange = config.onStateChange;
    this.onVerificationRequest = config.onVerificationRequest;
    this.onUpiLaunch = config.onUpiLaunch;
    this.onError = config.onError;
    this.onPeerConnected = config.onPeerConnected;
    this.onPeerDisconnected = config.onPeerDisconnected;
  }

  async connect(signalingUrl: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.signalingWs = new WebSocket(signalingUrl);

      this.signalingWs.onopen = () => {
        console.log('[Payer] Connected to signaling server');
        this.setState('connecting');
        resolve();
      };

      this.signalingWs.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.handleSignalingMessage(message);
        } catch (e) {
          console.error('[Payer] Failed to parse signaling message:', e);
        }
      };

      this.signalingWs.onerror = (error) => {
        console.error('[Payer] Signaling WebSocket error:', error);
        reject(new Error('Signaling connection failed'));
      };

      this.signalingWs.onclose = () => {
        console.log('[Payer] Signaling connection closed');
        this.handleSignalingDisconnect();
      };
    });
  }

  async register(ref?: string): Promise<{ peerId: string; ref: string }> {
    return new Promise((resolve, reject) => {
      const message = {
        type: 'register',
        payload: { ref },
        from: 'payer',
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

  async createPeerConnection(merchantId: string): Promise<void> {
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

    this.dcManager = createDataChannelManager(this.pc);
    this.setupDataChannels();

    this.pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendSignaling({
          type: 'ice',
          payload: event.candidate.toJSON(),
          from: this.peerId,
          to: this.merchantId,
          timestamp: Date.now()
        });
      }
    };

    this.pc.ondatachannel = (event) => {
      const channel = event.channel;
      this.dcManager?.onChannelOpen?.(channel);
    };

    this.pc.onconnectionstatechange = () => {
      if (!this.pc) return;
      console.log('[Payer] Connection state:', this.pc.connectionState);
      if (this.pc.connectionState === 'connected') {
        this.setState('connected');
        this.startHeartbeat();
      } else if (this.pc.connectionState === 'failed' || this.pc.connectionState === 'disconnected') {
        this.handleConnectionFailure();
      }
    };

    this.pc.oniceconnectionstatechange = () => {
      if (!this.pc) return;
      console.log('[Payer] ICE state:', this.pc.iceConnectionState);
      if (this.pc.iceConnectionState === 'failed') {
        this.handleICEFailure();
      }
    };
  }

  private setupDataChannels(): void {
    if (!this.dcManager) return;

    this.dcManager.on('control', (message: any) => {
      this.handleControlMessage(message);
    });

    this.dcManager.on('verification', (message: any) => {
      this.handleVerificationMessage(message);
    });

    this.dcManager.on('camera', (data: ArrayBuffer) => {
      // Payer receives camera frames from merchant (if needed)
    });

    this.dcManager.on('audio', (data: ArrayBuffer) => {
      // Payer receives audio from merchant (if needed)
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
      to: this.merchantId,
      timestamp: Date.now()
    });
  }

  async handleAnswer(answer: any): Promise<void> {
    if (!this.pc) throw new Error('Peer connection not created');
    await this.pc.setRemoteDescription(new RTCSessionDescription(answer));
  }

  async handleIceCandidate(candidate: any): Promise<void> {
    if (!this.pc) throw new Error('Peer connection not created');
    await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
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
      case 'verification_request':
        this.handleVerificationRequest(message);
        break;
      case 'payment_initiated':
        break;
      case 'payment_completed':
        break;
      case 'verification_result':
        break;
      case 'error':
        console.error('[Payer] Signaling error:', message.payload);
        break;
    }
  }

  private async handleVerificationRequest(message: any): Promise<void> {
    const payload = message.payload;
    if (!payload) return;

    const { ref, amount, vpa, merchantId } = payload;
    this.ref = ref;
    this.merchantId = merchantId;

    // Notify UI of verification request
    const accepted = await this.onVerificationRequest?.({
      ref,
      amount,
      vpa,
      merchantId
    }) || { accepted: true };

    // Send response
    this.sendSignaling({
      type: 'verification_response',
      payload: { ref, accepted: accepted.accepted, merchantId },
      from: this.peerId,
      to: merchantId,
      timestamp: Date.now()
    });

    if (accepted.accepted) {
      // Launch UPI app
      await this.launchUpiApp(ref, amount, vpa);
      
      // Start camera/audio if configured
      if (this.config.useCamera) await this.startCameraCapture();
      if (this.config.useAudio) await this.startAudioCapture();
    }
  }

  private async launchUpiApp(ref: string, amount: number, vpa: string): Promise<void> {
    const returnUrl = `${location.origin}/upi-return?tr=${ref}&peer=${this.peerId}`;
    const intent = `upi://pay?pa=${encodeURIComponent(vpa)}&am=${amount}&tr=${ref}&url=${encodeURIComponent(returnUrl)}`;
    
    this.onUpiLaunch?.(intent);
    
    // Launch UPI app
    window.location.href = intent;

    // Signal payment initiated
    this.dcManager?.send('verification', {
      type: 'payment_initiated',
      payload: { ref, payerId: this.peerId },
      channel: 'verification',
      timestamp: Date.now()
    });
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
          // Send to merchant via camera channel
          // Note: Need to add camera channel sending capability
        }
        
        if (this.cameraStream) {
          requestAnimationFrame(captureLoop);
        }
      };

      captureLoop();
    } catch (e) {
      console.error('Camera capture failed:', e);
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

  private handleVerificationMessage(message: any): void {
    const payload = message.payload;
    if (!payload) return;

    switch (message.type) {
      case 'verification_request':
        break;
      case 'verification_result':
        break;
      case 'challenge':
        break;
      case 'challenge_response':
        break;
    }
  }

  private handleControlMessage(message: any): void {
    // Handle control messages
  }

  private sendSignaling(message: any): void {
    if (this.signalingWs?.readyState === WebSocket.OPEN) {
      this.signalingWs.send(JSON.stringify(message));
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

  private startHeartbeat(): void {
    this.lastHeartbeatAck = Date.now();
    this.heartbeatInterval = setInterval(() => {
      if (Date.now() - this.lastHeartbeatAck > 10000) {
        console.warn('[Payer] Heartbeat timeout, connection may be dead');
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

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private handleConnectionFailure(): void {
    console.warn('[Payer] Connection failed, attempting reconnect...');
    this.stopHeartbeat();
    
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`[Payer] Reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
      setTimeout(() => this.attemptReconnect(), 2000 * this.reconnectAttempts);
    } else {
      console.error('[Payer] Max reconnect attempts reached');
      this.setState('failed');
      this.emit('error', new Error('Max reconnection attempts reached'));
    }
  }

  private handleICEFailure(): void {
    console.warn('[Payer] ICE connection failed');
    this.handleConnectionFailure();
  }

  private async attemptReconnect(): Promise<void> {
    if (!this.merchantId) return;
    
    try {
      if (this.pc) {
        this.pc.close();
      }
      
      await this.createPeerConnection(this.merchantId);
      console.log('[Payer] Reconnected successfully');
      this.reconnectAttempts = 0;
    } catch (e) {
      console.error('[Payer] Reconnect failed:', e);
      this.handleConnectionFailure();
    }
  }

  private handleSignalingDisconnect(): void {
    console.warn('[Payer] Signaling disconnected');
    this.handleConnectionFailure();
  }

  private sendSignaling(message: any): void {
    if (this.signalingWs?.readyState === WebSocket.OPEN) {
      this.signalingWs.send(JSON.stringify(message));
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
    console.warn('[Payer] Signaling disconnected');
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
}

export function createPayerClient(config: any) {
  return new PayerWebRTCClient(config);
}