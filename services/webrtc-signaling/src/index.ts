/**
 * WebRTC Signaling Server for P2P Verification Network
 * 
 * Handles WebSocket signaling for WebRTC peer connections
 * between merchant and payer browsers.
 */
import Fastify from 'fastify';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { randomUUID } from 'crypto';

interface PeerInfo {
  id: string;
  role: 'merchant' | 'payer';
  ws: WebSocket;
  peerId?: string; // Connected peer ID
  ref?: string; // Transaction reference
  state: 'idle' | 'connecting' | 'connected' | 'verifying' | 'verified';
  metadata: Record<string, unknown>;
}

interface SignalingMessage {
  type: 'offer' | 'answer' | 'ice' | 'register' | 'find_peer' | 'verification_request' | 'verification_response' | 'verification_result' | 'payment_initiated' | 'payment_completed' | 'verification_request' | 'verification_result';
  payload: unknown;
  from: string;
  to?: string;
  timestamp: number;
}

const peers = new Map<string, PeerInfo>();
const waitingMerchants = new Map<string, PeerInfo>(); // ref -> merchant
const waitingPayers = new Map<string, PeerInfo>(); // ref -> payer

function generatePeerId(): string {
  return randomUUID().replace(/-/g, '').slice(0, 16);
}

function generateRef(): string {
  return randomUUID().replace(/-/g, '').slice(0, 32);
}

function send(ws: WebSocket, message: SignalingMessage) {
  if (ws.readyState === 1) { // OPEN
    ws.send(JSON.stringify(message));
  }
}

function broadcast(message: SignalingMessage, exclude?: string) {
  for (const [id, peer] of peers) {
    if (id !== exclude && peer.ws.readyState === 1) {
      send(peer.ws, message);
    }
  }
}

function findPeerByRef(ref: string, role: 'merchant' | 'payer'): PeerInfo | undefined {
  const map = role === 'merchant' ? waitingMerchants : waitingPayers;
  return map.get(ref);
}

function registerPeer(peer: PeerInfo) {
  peers.set(peer.id, peer);
  if (peer.role === 'merchant' && peer.ref) {
    waitingMerchants.set(peer.ref, peer);
  } else if (peer.role === 'payer' && peer.ref) {
    waitingPayers.set(peer.ref, peer);
  }
}

function unregisterPeer(id: string) {
  const peer = peers.get(id);
  if (peer) {
    if (peer.role === 'merchant' && peer.ref) {
      waitingMerchants.delete(peer.ref);
    } else if (peer.role === 'payer' && peer.ref) {
      waitingPayers.delete(peer.ref);
    }
    peers.delete(id);
  }
}

async function startServer() {
  const app = Fastify({ logger: true });
  
  // HTTP server for health checks
  app.get('/health', async () => ({ status: 'ok', peers: peers.size }));
  
  // REST endpoint for merchants to register
  app.post<{ Body: { role: 'merchant' | 'payer'; ref?: string; metadata?: Record<string, unknown> } }>('/api/peer/register', async (request, reply) => {
    const { role, ref, metadata } = request.body;
    
    if (!role || !['merchant', 'payer'].includes(role)) {
      return reply.code(400).send({ error: 'Invalid role' });
    }
    
    const peerId = generatePeerId();
    const ref = ref || generateRef();
    
    // We'll associate WebSocket later when they connect
    const peer: PeerInfo = {
      id: peerId,
      role,
      ref,
      ws: null as any,
      state: 'idle',
      metadata: metadata || {}
    };
    
    registerPeer(peer);
    
    return { peerId, ref, signalingUrl: `ws://${request.headers.host}/ws` };
  });
  
  // WebSocket upgrade handler
  const server = createServer(app.server);
  const wss = new WebSocketServer({ server, path: '/ws' });
  
  wss.on('connection', (ws, req) => {
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    const peerId = url.searchParams.get('peerId');
    
    if (!peerId) {
      ws.close(4001, 'peerId required');
      return;
    }
    
    const peer = peers.get(peerId);
    if (!peer) {
      ws.close(4004, 'Peer not registered');
      return;
    }
    
    if (peer.ws) {
      ws.close(4002, 'Already connected');
      return;
    }
    
    peer.ws = ws;
    peer.state = 'connecting';
    
    console.log(`Peer connected: ${peer.id} (${peer.role})`);
    
    ws.on('message', (data) => {
      try {
        const message: SignalingMessage = JSON.parse(data.toString());
        message.from = peer.id;
        message.timestamp = Date.now();
        handleMessage(peer, message);
      } catch (e) {
        console.error('Invalid message:', e);
        send(peer.ws, { type: 'error', payload: { error: 'Invalid message format' }, from: 'server', timestamp: Date.now() });
      }
    });
    
    ws.on('close', () => {
      console.log(`Peer disconnected: ${peer.id} (${peer.role})`);
      handleDisconnect(peer);
    });
    
    ws.on('error', (err) => {
      console.error(`WebSocket error for ${peer.id}:`, err);
    });
    
    // Send welcome message
    send(ws, {
      type: 'welcome',
      payload: { peerId: peer.id, ref: peer.ref },
      from: 'server',
      timestamp: Date.now()
    });
  });
  
  function handleMessage(peer: PeerInfo, message: SignalingMessage) {
    switch (message.type) {
      case 'offer':
      case 'answer':
      case 'ice':
        // Forward to target peer
        if (message.to) {
          const target = peers.get(message.to);
          if (target?.ws?.readyState === 1) {
            send(target.ws, message);
          }
        }
        break;
        
      case 'register':
        // Peer re-registers with ref
        if (message.payload && typeof message.payload === 'object' && 'ref' in message.payload) {
          const newRef = (message.payload as any).ref;
          if (peer.ref) {
            if (peer.role === 'merchant') waitingMerchants.delete(peer.ref);
            else waitingPayers.delete(peer.ref);
          }
          peer.ref = newRef;
          registerPeer(peer);
        }
        break;
        
      case 'find_peer':
        // Merchant looking for payer or vice versa
        if (message.payload && typeof message.payload === 'object' && 'ref' in message.payload) {
          const ref = (message.payload as any).ref;
          const targetRole = peer.role === 'merchant' ? 'payer' : 'merchant';
          const target = findPeerByRef(ref, targetRole);
          
          if (target) {
            send(peer.ws, {
              type: 'peer_found',
              payload: { peerId: target.id, ref: target.ref },
              from: 'server',
              timestamp: Date.now()
            });
          } else {
            send(peer.ws, {
              type: 'peer_not_found',
              payload: { ref },
              from: 'server',
              timestamp: Date.now()
            });
          }
        }
        break;
        
      case 'verification_request':
        // Merchant requests verification
        if (peer.role === 'merchant' && message.payload && typeof message.payload === 'object') {
          const { ref, amount, vpa } = message.payload as any;
          
          // Find payer with same ref
          const payer = waitingPayers.get(ref);
          if (payer) {
            // Forward to payer
            send(payer.ws, {
              type: 'verification_request',
              payload: { ref, amount, vpa, merchantId: peer.id },
              from: peer.id,
              to: payer.id,
              timestamp: Date.now()
            });
            
            // Update states
            peer.state = 'verifying';
            payer.state = 'verifying';
            peer.ref = ref;
            
            // Confirm to merchant
            send(peer.ws, {
              type: 'verification_started',
              payload: { ref, payerId: payer.id },
              from: 'server',
              timestamp: Date.now()
            });
          } else {
            send(peer.ws, {
              type: 'verification_failed',
              payload: { error: 'No payer found for this ref' },
              from: 'server',
              timestamp: Date.now()
            });
          }
        }
        break;
        
      case 'verification_response':
        // Payer responds to verification request
        if (peer.role === 'payer' && message.payload && typeof message.payload === 'object') {
          const { ref, accepted, merchantId } = message.payload as any;
          const merchant = peers.get(merchantId);
          
          if (merchant) {
            send(merchant.ws, {
              type: 'verification_response',
              payload: { ref, accepted, payerId: peer.id },
              from: peer.id,
              to: merchantId,
              timestamp: Date.now()
            });
            
            if (accepted) {
              peer.state = 'verifying';
              // Start verification process
            }
          }
        }
        break;
        
      case 'payment_initiated':
        // Payer initiated payment
        if (peer.role === 'payer' && message.payload && typeof message.payload === 'object') {
          const { ref } = message.payload as any;
          const merchant = waitingMerchants.get(ref);
          
          if (merchant) {
            send(merchant.ws, {
              type: 'payment_initiated',
              payload: { ref, payerId: peer.id },
              from: peer.id,
              to: merchant.id,
              timestamp: Date.now()
            });
            
            merchant.state = 'verifying';
            peer.state = 'verifying';
          }
        }
        break;
        
      case 'payment_completed':
        // Payer completed payment
        if (peer.role === 'payer' && message.payload && typeof message.payload === 'object') {
          const { ref, upiRef, status } = message.payload as any;
          const merchant = waitingMerchants.get(ref);
          
          if (merchant) {
            send(merchant.ws, {
              type: 'payment_completed',
              payload: { ref, upiRef, status, payerId: peer.id },
              from: peer.id,
              to: merchant.id,
              timestamp: Date.now()
            });
          }
        }
        break;
        
      case 'verification_result':
        // Final verification result
        if (message.payload && typeof message.payload === 'object' && 'to' in message.payload) {
          const target = peers.get((message.payload as any).to);
          if (target?.ws?.readyState === 1) {
            send(target.ws, message);
          }
        }
        break;
    }
  }
  
  function handleDisconnect(peer: PeerInfo) {
    peer.state = 'idle';
    peer.ws = null;
    
    // Clean up peer associations
    if (peer.ref) {
      if (peer.role === 'merchant') waitingMerchants.delete(peer.ref);
      else waitingPayers.delete(peer.ref);
    }
  }
  
  const port = process.env.PORT ? parseInt(process.env.PORT) : 8080;
  await new Promise<void>((resolve, reject) => {
    server.listen(port, '0.0.0.0', (err) => {
      if (err) reject(err);
      else {
        console.log(`WebRTC Signaling Server listening on port ${port}`);
        resolve();
      }
    });
  });
  
  // Graceful shutdown
  process.on('SIGTERM', async () => {
    console.log('Shutting down...');
    for (const [id, peer] of peers) {
      if (peer.ws?.readyState === 1) {
        peer.ws.close(1001, 'Server shutting down');
      }
    }
    await app.close();
    process.exit(0);
  });
}

startServer().catch(console.error);