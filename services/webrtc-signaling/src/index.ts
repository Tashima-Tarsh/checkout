/**
 * WebRTC Signaling Server for P2P Verification Network
 * 
 * Handles WebSocket signaling for WebRTC peer connections
 * between merchant and payer browsers with authentication and transaction isolation.
 */
import Fastify from 'fastify';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { randomUUID } from 'crypto';
import { createHash } from 'crypto';

interface PeerInfo {
  id: string;
  role: 'merchant' | 'payer';
  ws: WebSocket;
  peerId?: string; // Connected peer ID
  ref?: string; // Transaction reference
  state: 'idle' | 'connecting' | 'connected' | 'verifying' | 'verified';
  metadata: Record<string, unknown>;
  transactionId?: string; // Unique transaction ID for isolation
  authToken?: string; // Authentication token for verification
}

interface SignalingMessage {
  type: 'offer' | 'answer' | 'ice' | 'register' | 'find_peer' | 'verification_request' | 'verification_response' | 'verification_result' | 'payment_initiated' | 'payment_completed' | 'verification_request' | 'verification_result' | 'auth_challenge' | 'auth_response';
  payload: unknown;
  from: string;
  to?: string;
  timestamp: number;
  transactionId?: string; // Transaction isolation
}

const peers = new Map<string, PeerInfo>();
const waitingMerchants = new Map<string, PeerInfo>(); // ref -> merchant
const waitingPayers = new Map<string, PeerInfo>(); // ref -> payer
const transactionStates = new Map<string, { merchant: PeerInfo; payer: PeerInfo; status: string; createdAt: number }>(); // Transaction isolation

function generatePeerId(): string {
  return randomUUID().replace(/-/g, '').slice(0, 16);
}

function generateRef(): string {
  return randomUUID().replace(/-/g, '').slice(0, 32);
}

function generateTransactionId(): string {
  return randomUUID().replace(/-/g, '').slice(0, 32);
}

function generateAuthToken(): string {
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
  app.get('/health', async () => ({ status: 'ok', peers: peers.size, transactions: transactionStates.size }));
  
  // REST endpoint for merchants to register with authentication
  app.post<{ Body: { role: 'merchant' | 'payer'; ref?: string; metadata?: Record<string, unknown>; authToken?: string } }>('/api/peer/register', async (request, reply) => {
    const { role, ref, metadata, authToken } = request.body;
    
    if (!role || !['merchant', 'payer'].includes(role)) {
      return reply.code(400).send({ error: 'Invalid role' });
    }
    
    // Verify auth token if provided
    if (authToken) {
      // Verify auth token against known merchants/payers
      const isValid = await verifyAuthToken(authToken, role);
      if (!isValid) {
        return reply.code(401).send({ error: 'Invalid authentication token' });
      }
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
      metadata: metadata || {},
      authToken: authToken
    };
    
    registerPeer(peer);
    
    return { peerId, ref, signalingUrl: `ws://${request.headers.host}/ws`, authToken: generateAuthToken() };
  });
  
  // WebSocket upgrade handler
  const server = createServer(app.server);
  const wss = new WebSocketServer({ server, path: '/ws' });
  
  wss.on('connection', (ws, req) => {
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    const peerId = url.searchParams.get('peerId');
    const authToken = url.searchParams.get('authToken');
    const transactionId = url.searchParams.get('transactionId');
    
    if (!peerId) {
      ws.close(4001, 'peerId required');
      return;
    }
    
    const peer = peers.get(peerId);
    if (!peer) {
      ws.close(4004, 'Peer not registered');
      return;
    }
    
    // Verify auth token if provided
    if (authToken && peer.authToken !== authToken) {
      ws.close(4003, 'Invalid authentication token');
      return;
    }
    
    // Verify transaction isolation
    if (transactionId) {
      const transaction = transactionStates.get(transactionId);
      if (!transaction || (transaction.merchant.id !== peer.id && transaction.payer.id !== peer.id)) {
        ws.close(4005, 'Invalid transaction');
        return;
      }
      peer.transactionId = transactionId;
    }
    
    if (peer.ws) {
      ws.close(4002, 'Already connected');
      return;
    }
    
    peer.ws = ws;
    peer.state = 'connecting';
    peer.authToken = authToken;
    
    console.log(`Peer connected: ${peer.id} (${peer.role})`);
    
    ws.on('message', (data) => {
      try {
        const message: SignalingMessage = JSON.parse(data.toString());
        message.from = peer.id;
        message.timestamp = Date.now();
        message.transactionId = peer.transactionId;
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
    
    // Send welcome message with auth challenge
    const authChallenge = generateAuthToken();
    send(ws, {
      type: 'welcome',
      payload: { peerId: peer.id, ref: peer.ref, authChallenge },
      from: 'server',
      timestamp: Date.now()
    });
  });
  
  async function verifyAuthToken(authToken: string, role: 'merchant' | 'payer'): Promise<boolean> {
    // In production, verify against a secure token store
    // For now, accept any non-empty token for demo purposes
    return authToken && authToken.length > 0;
  }
  
  function handleMessage(peer: PeerInfo, message: SignalingMessage) {
    switch (message.type) {
      case 'offer':
      case 'answer':
      case 'ice':
        // Forward to target peer with transaction isolation
        if (message.to) {
          const target = peers.get(message.to);
          if (target?.ws?.readyState === 1 && (!message.transactionId || target.transactionId === message.transactionId)) {
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
        // Merchant requests verification with authentication
        if (peer.role === 'merchant' && message.payload && typeof message.payload === 'object') {
          const { ref, amount, vpa, authToken } = message.payload as any;
          
          // Verify merchant auth token
          if (peer.authToken && authToken !== peer.authToken) {
            send(peer.ws, {
              type: 'verification_failed',
              payload: { error: 'Invalid authentication token' },
              from: 'server',
              timestamp: Date.now()
            });
            return;
          }
          
          // Find payer with same ref
          const payer = waitingPayers.get(ref);
          if (payer) {
            // Create transaction for isolation
            const transactionId = generateTransactionId();
            transactionStates.set(transactionId, {
              merchant: peer,
              payer,
              status: 'pending',
              createdAt: Date.now()
            });
            
            // Forward to payer with transaction isolation
            send(payer.ws, {
              type: 'verification_request',
              payload: { ref, amount, vpa, merchantId: peer.id, transactionId },
              from: peer.id,
              to: payer.id,
              timestamp: Date.now(),
              transactionId
            });
            
            // Update states
            peer.state = 'verifying';
            payer.state = 'verifying';
            peer.ref = ref;
            peer.transactionId = transactionId;
            payer.transactionId = transactionId;
            
            // Confirm to merchant
            send(peer.ws, {
              type: 'verification_started',
              payload: { ref, payerId: payer.id, transactionId },
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
        // Payer responds to verification request with auth
        if (peer.role === 'payer' && message.payload && typeof message.payload === 'object') {
          const { ref, accepted, merchantId, authToken } = message.payload as any;
          const merchant = peers.get(merchantId);
          
          if (merchant) {
            // Verify payer auth token
            if (peer.authToken && authToken !== peer.authToken) {
              send(merchant.ws, {
                type: 'verification_failed',
                payload: { error: 'Invalid payer authentication' },
                from: 'server',
                timestamp: Date.now()
              });
              return;
            }
            
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
        // Final verification result with transaction isolation
        if (message.payload && typeof message.payload === 'object' && 'to' in message.payload) {
          const target = peers.get((message.payload as any).to);
          if (target?.ws?.readyState === 1 && (!message.transactionId || target.transactionId === message.transactionId)) {
            send(target.ws, message);
          }
        }
        break;
        
      case 'auth_challenge':
        // Client responds to auth challenge
        if (message.payload && typeof message.payload === 'object' && 'authToken' in message.payload) {
          const authToken = (message.payload as any).authToken;
          peer.authToken = authToken;
          send(peer.ws, {
            type: 'auth_success',
            payload: { authenticated: true },
            from: 'server',
            timestamp: Date.now()
          });
        }
        break;
        
      case 'auth_response':
        // Auth response from peer
        break;
    }
  }
  
  function handleDisconnect(peer: PeerInfo) {
    peer.state = 'idle';
    peer.ws = null;
    
    // Clean up transaction state
    if (peer.transactionId) {
      transactionStates.delete(peer.transactionId);
    }
    
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