/**
 * Multi-channel DataChannel Manager
 * 
 * Manages multiple RTCDataChannels for different verification purposes:
 * - control: Control signals (offer/answer/ice)
 * - verification: Verification requests/responses
 * - camera: Camera frames (unordered, unreliable)
 * - audio: Audio chunks (unordered, unreliable)
 * - verification: Verification signals
 */

import { CHANNEL_CONFIGS, DataChannelMessage, ChannelName } from './protocol.js';

export interface DataChannelHandler {
  (message: unknown, channel: RTCDataChannel): void;
}

export class DataChannelManager {
  private channels = new Map<string, RTCDataChannel>();
  private handlers = new Map<string, DataChannelHandler[]>();
  private peerConnection: RTCPeerConnection;
  private onChannelOpen?: (channel: RTCDataChannel) => void;
  private onChannelClose?: (channel: RTCDataChannel) => void;
  private onChannelError?: (channel: RTCDataChannel, error: Error) => void;

  constructor(peerConnection: RTCPeerConnection) {
    this.peerConnection = peerConnection;
  }

  setOnChannelOpen(handler: (channel: RTCDataChannel) => void) {
    this.onChannelOpen = handler;
  }

  setOnChannelClose(handler: (channel: RTCDataChannel) => void) {
    this.onChannelClose = handler;
  }

  setOnChannelError(handler: (channel: RTCDataChannel, error: Error) => void) {
    this.onChannelError = handler;
  }

  createDataChannels(): RTCDataChannel[] {
    const channels: RTCDataChannel[] = [];

    for (const [name, config] of Object.entries(CHANNEL_CONFIGS)) {
      const channel = this.createChannel(name, config);
      channels.push(channel);
    }

    return channels;
  }

  private createChannel(name: string, config: { ordered: boolean; reliable: boolean; maxRetransmits?: number }): RTCDataChannel {
    const channel = this.peerConnection.createDataChannel(name, {
      ordered: config.ordered,
      maxRetransmits: config.maxRetransmits
    });

    this.channels.set(name, channel);

    channel.onopen = () => {
      console.log(`DataChannel "${name}" opened`);
      this.onChannelOpen?.(channel);
    };

    channel.onclose = () => {
      console.log(`DataChannel "${name}" closed`);
      this.onChannelClose?.(channel);
      this.channels.delete(name);
    };

    channel.onerror = (error) => {
      console.error(`DataChannel "${name}" error:`, error);
      this.onChannelError?.(channel, error as Error);
    };

    channel.onmessage = (event) => {
      this.handleMessage(name, event.data);
    };

    return channel;
  }

  private handleMessage(channelName: string, data: unknown) {
    const handlers = this.handlers.get(channelName) || [];
    for (const handler of handlers) {
      try {
        let parsed: unknown = data;
        
        // Try to parse JSON for text messages
        if (typeof data === 'string') {
          try {
            parsed = JSON.parse(data);
          } catch {
            // Not JSON, keep as string
          }
        } else if (data instanceof ArrayBuffer || data instanceof Blob) {
          // Binary data, pass as-is
        }

        handler(parsed, this.channels.get(channelName)!);
      } catch (e) {
        console.error(`Error handling message on channel "${channelName}":`, e);
      }
    }
  }

  on(channelName: string, handler: DataChannelHandler): () => void {
    if (!this.handlers.has(channelName)) {
      this.handlers.set(channelName, []);
    }
    this.handlers.get(channelName)!.push(handler);
    
    // Return unsubscribe function
    return () => {
      const handlers = this.handlers.get(channelName);
      if (handlers) {
        const index = handlers.indexOf(handler);
        if (index !== -1) handlers.splice(index, 1);
      }
    };
  }

  send(channelName: string, message: unknown): boolean {
    const channel = this.channels.get(channelName);
    if (!channel || channel.readyState !== 'open') {
      console.warn(`Channel "${channelName}" not open, cannot send`);
      return false;
    }

    try {
      const data = typeof message === 'string' || message instanceof ArrayBuffer || message instanceof Blob
        ? message
        : JSON.stringify(message);
      
      channel.send(data);
      return true;
    } catch (e) {
      console.error(`Failed to send on channel "${channelName}":`, e);
      return false;
    }
  }

  sendBinary(channelName: string, data: ArrayBuffer | Blob): boolean {
    const channel = this.channels.get(channelName);
    if (!channel || channel.readyState !== 'open') {
      console.warn(`Channel "${channelName}" not open, cannot send binary`);
      return false;
    }

    try {
      channel.send(data);
      return true;
    } catch (e) {
      console.error(`Failed to send binary on channel "${channelName}":`, e);
      return false;
    }
  }

  getChannel(name: string): RTCDataChannel | undefined {
    return this.channels.get(name);
  }

  isOpen(channelName: string): boolean {
    const channel = this.channels.get(channelName);
    return channel?.readyState === 'open';
  }

  closeAll() {
    for (const [name, channel] of this.channels) {
      if (channel.readyState === 'open' || channel.readyState === 'connecting') {
        channel.close();
      }
    }
    this.channels.clear();
    this.handlers.clear();
  }
}

export function createDataChannelManager(peerConnection: RTCPeerConnection): DataChannelManager {
  return new DataChannelManager(peerConnection);
}