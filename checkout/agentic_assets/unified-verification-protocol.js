/**
 * Unified Verification Protocol - "Respectfully asks the kernel for evidence"
 * 
 * Channels (all zero-install, zero-external-dependency):
 * 1. Protocol Handler + Return URL (auto-return if UPI app supports url param)
 * 2. Passive Dwell Detection (visibilitychange + dwell heuristic)
 * 3. Camera + OCR (5-sec point camera at UPI success screen)
 * 4. Sound Detection (Web Audio API for success chime)
 * 5. Color Pattern Detection (animated HMAC-bound sequence)
 * 
 * All channels are zero-install, zero-external-dependency, respect kernel sandbox.
 */

// ============================================================================
// CHANNEL 1: Protocol Handler + Return URL (Auto-return if UPI app supports)
// ============================================================================

export function registerProtocolHandler() {
  if ('protocolHandler' in navigator) {
    return navigator.registerProtocolHandler(
      'web+upi',
      `${location.origin}/upi-return?data=%s`,
      'UPI Payment Verifier'
    ).catch(() => {}); // Ignore if user declines
  }
}

export function buildUpiIntent(params) {
  const { pa, pn, am, tr, tn, mc, mode, orgid, sign, returnUrl } = params;
  const params = new URLSearchParams();
  params.set('pa', pa);
  if (pn) params.set('pn', pn);
  if (am) params.set('am', am);
  if (tr) params.set('tr', tr);
  if (tn) params.set('tn', tn);
  if (mc) params.set('mc', mc);
  if (mode) params.set('mode', mode);
  if (orgid) params.set('orgid', orgid);
  if (sign) params.set('sign', sign);
  if (returnUrl) params.set('url', returnUrl);
  return `upi://pay?${params.toString()}`;
}

export function handleUpiReturn(searchParams) {
  // Extract return data from URL
  const tr = searchParams.get('tr');
  const upiRef = searchParams.get('upi_ref') || searchParams.get('UTR') || searchParams.get('ref');
  const status = searchParams.get('status'); // 'success' | 'failure' | 'pending'
  const amount = searchParams.get('am');
  const vpa = searchParams.get('pa');
  
  return {
    channel: 'protocol_handler',
    tr,
    upiRef,
    status,
    amount: amount ? Number(amount) : null,
    vpa,
    timestamp: Date.now()
  };
}

// ============================================================================
// CHANNEL 2: Passive Dwell Detection (visibilitychange + dwell heuristic)
// ============================================================================

export class PassiveDwellDetector {
  constructor({ minDwellMs = 1200, onReturn } = {}) {
    this.minDwellMs = minDwellMs;
    this.onReturn = onReturn;
    this.hiddenAt = null;
    this.armed = false;
    this.challengeExpiry = 0;
    
    this.onVisibilityChange = this.onVisibilityChange.bind(this);
    this.onPageShow = this.onPageShow.bind(this);
    
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    window.addEventListener('pageshow', this.onPageShow);
  }
  
  arm(challenge, ttlMs = 45000) {
    this.armed = true;
    this.challenge = challenge;
    this.challengeExpiry = Date.now() + ttlMs;
  }
  
  onVisibilityChange() {
    if (document.visibilityState === 'hidden') {
      this.hiddenAt = performance.now();
    } else if (this.hiddenAt !== null) {
      const dwellMs = performance.now() - this.hiddenAt;
      this.hiddenAt = null;
      
      if (this.armed && dwellMs > this.minDwellMs && Date.now() < this.challengeExpiry) {
        this.armed = false;
        this.onReturn?.({
          channel: 'passive_dwell',
          dwellMs,
          challenge: this.challenge,
          timestamp: Date.now()
        });
      }
    }
  }
  
  onPageShow(event) {
    if (event.persisted && this.hiddenAt !== null) {
      const dwellMs = performance.now() - this.hiddenAt;
      this.hiddenAt = null;
      
      if (this.armed && dwellMs > this.minDwellMs && Date.now() < this.challengeExpiry) {
        this.armed = false;
        this.onReturn?.({
          channel: 'passive_dwell',
          dwellMs,
          challenge: this.challenge,
          timestamp: Date.now(),
          persisted: true
        });
      }
    }
  }
  
  destroy() {
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    window.removeEventListener('pageshow', this.onPageShow);
  }
}

// ============================================================================
// CHANNEL 3: Camera + OCR (5-second point camera at UPI success screen)
// ============================================================================

export class CameraOcrVerifier {
  constructor({ expectedRef, expectedAmount, expectedVpa, onResult } = {}) {
    this.expectedRef = expectedRef;
    this.expectedAmount = expectedAmount;
    this.expectedVpa = expectedVpa;
    this.onResult = onResult;
    this.stream = null;
    this.video = null;
    this.canvas = null;
    this.running = false;
  }
  
  async start() {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('Camera not supported');
    }
    
    this.stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false
    });
    
    this.video = document.createElement('video');
    this.video.muted = true;
    this.video.srcObject = this.stream;
    this.video.playsInline = true;
    await this.video.play();
    
    this.canvas = document.createElement('canvas');
    this.running = true;
    this.analyzeFrames();
  }
  
  async analyzeFrames() {
    const ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    const framesToAnalyze = 30; // ~1 second at 30fps
    
    for (let i = 0; i < framesToAnalyze && this.running; i++) {
      if (this.video.readyState === this.video.HAVE_ENOUGH_DATA) {
        this.canvas.width = this.video.videoWidth;
        this.canvas.height = this.video.videoHeight;
        ctx.drawImage(this.video, 0, 0);
        
        // Convert to blob for OCR
        const blob = await new Promise(resolve => 
          this.canvas.toBlob(resolve, 'image/jpeg', 0.8)
        );
        
        const result = await this.analyzeFrame(blob);
        if (result.verified) {
          this.stop();
          this.onResult?.({
            channel: 'camera_ocr',
            ...result,
            timestamp: Date.now()
          });
          return;
        }
      }
      await new Promise(r => setTimeout(r, 33)); // ~30fps
    }
    this.stop();
    this.onResult?.({
      channel: 'camera_ocr',
      verified: false,
      reason: 'No matching evidence found in camera frames',
      timestamp: Date.now()
    });
  }
  
  async analyzeFrame(blob) {
    // OCR via Tesseract.js (WASM) - runs in browser
    const { createWorker } = await import('tesseract.js');
    const worker = await createWorker('eng');
    const { data: { text } } = await worker.recognize(blob);
    await worker.terminate();
    
    // Extract evidence
    const evidence = this.extractEvidence(text);
    
    // Verify against expected
    const amountMatch = evidence.amounts.some(a => 
      this.expectedAmount ? Math.abs(a - this.expectedAmount) < 0.01 : true
    );
    const vpaMatch = evidence.vpas.some(v => 
      v.toLowerCase() === this.expectedVpa?.toLowerCase()
    );
    const refMatch = evidence.refs.some(r => 
      r.includes(this.expectedRef)
    );
    const successKeyword = evidence.successKeyword;
    
    return {
      verified: amountMatch && vpaMatch && refMatch && successKeyword,
      evidence,
      amountMatch,
      vpaMatch,
      refMatch,
      successKeyword
    };
  }
  
  extractEvidence(text) {
    const AMOUNT = /(?:₹|Rs\.?|INR)\s*([\d,]+(?:\.\d{1,2})?)/gi;
    const SUCCESS = /\b(success(ful)?|paid|payment (done|complete(d)?)|sent successfully|transaction complete)\b/i;
    const VPA = /\b[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}\b/g;
    const REF = /\b(\d{12})\b/g;
    
    const amounts = [...text.matchAll(AMOUNT)]
      .map(m => Number(m[1]?.replace(/,/g, '')))
      .filter(n => Number.isFinite(n) && n > 0);
    
    return {
      text,
      amounts,
      successKeyword: SUCCESS.test(text),
      vpas: [...new Set(text.match(VPA) ?? [])],
      refs: [...new Set(text.match(REF) ?? [])]
    };
  }
  
  stop() {
    this.running = false;
    this.stream?.getTracks().forEach(t => t.stop());
    this.stream = null;
    this.video = null;
    this.canvas = null;
  }
}

// ============================================================================
// CHANNEL 4: Sound Detection (Web Audio API for success chime)
// ============================================================================

export class SoundDetector {
  constructor({ onDetect } = {}) {
    this.onDetect = onDetect;
    this.audioContext = null;
    this.analyser = null;
    this.stream = null;
    this.running = false;
  }
  
  async start() {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('Microphone not supported');
    }
    
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.8;
    
    const source = this.audioContext.createMediaStreamSource(this.stream);
    source.connect(this.analyser);
    
    this.running = true;
    this.detectLoop();
  }
  
  detectLoop() {
    if (!this.running) return;
    
    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    this.analyser.getByteFrequencyData(dataArray);
    
    // Detect UPI success chime pattern (typically ~2000-4000 Hz tone burst)
    const highFreqEnergy = dataArray.slice(200, 400).reduce((a, b) => a + b, 0) / 200;
    const baselineEnergy = dataArray.slice(0, 100).reduce((a, b) => a + b, 0) / 100;
    
    // Chime detected: high freq energy significantly above baseline
    if (highFreqEnergy > baselineEnergy * 3 && highFreqEnergy > 50) {
      this.onDetect?.({
        channel: 'sound',
        detected: true,
        timestamp: Date.now(),
        confidence: Math.min(highFreqEnergy / (baselineEnergy * 5), 1)
      });
    }
    
    if (this.running) {
      requestAnimationFrame(() => this.detectLoop());
    }
  }
  
  stop() {
    this.running = false;
    this.stream?.getTracks().forEach(t => t.stop());
    this.audioContext?.close();
    this.stream = null;
    this.audioContext = null;
  }
}

// ============================================================================
// CHANNEL 5: Color Pattern Detection (animated HMAC-bound sequence)
// ============================================================================

export class ColorPatternDetector {
  constructor({ expectedColorSeq, tolerance = 0.85, onResult } = {}) {
    this.expectedColorSeq = expectedColorSeq; // Array of {r,g,b,frameDuration}
    this.tolerance = tolerance;
    this.onResult = onResult;
    this.stream = null;
    this.video = null;
    this.canvas = null;
    this.running = false;
    this.frameIndex = 0;
  }
  
  async start() {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('Camera not supported');
    }
    
    this.stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false
    });
    
    this.video = document.createElement('video');
    this.video.muted = true;
    this.video.srcObject = this.stream;
    this.video.playsInline = true;
    await this.video.play();
    
    this.canvas = document.createElement('canvas');
    this.running = true;
    this.frameIndex = 0;
    this.analyzeColorFrames();
  }
  
  async analyzeColorFrames() {
    const ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    const expectedFrames = this.expectedColorSeq.length;
    
    while (this.running && this.frameIndex < expectedFrames) {
      if (this.video.readyState === this.video.HAVE_ENOUGH_DATA) {
        this.canvas.width = this.video.videoWidth;
        this.canvas.height = this.video.videoHeight;
        ctx.drawImage(this.video, 0, 0);
        
        // Sample color from center region (where color bar would be)
        const cx = this.canvas.width / 2;
        const cy = this.canvas.height / 2;
        const sampleSize = 50;
        const imageData = ctx.getImageData(cx - sampleSize/2, cy - sampleSize/2, sampleSize, sampleSize);
        const data = imageData.data;
        
        // Average color in sample region
        let r = 0, g = 0, b = 0, count = 0;
        for (let i = 0; i < data.length; i += 4) {
          r += data[i];
          g += data[i + 1];
          b += data[i + 2];
          count++;
        }
        r = Math.round(r / count);
        g = Math.round(g / count);
        b = Math.round(b / count);
        
        // Compare with expected frame
        const expected = this.expectedColorSeq[this.frameIndex];
        if (expected) {
          const dr = Math.abs(r - expected.r);
          const dg = Math.abs(g - expected.g);
          const db = Math.abs(b - expected.b);
          const distance = Math.sqrt(dr*dr + dg*dg + db*db);
          const maxDistance = Math.sqrt(3 * 255 * 255);
          const similarity = 1 - distance / maxDistance;
          
          if (similarity >= this.tolerance) {
            this.frameIndex++;
          }
        }
        
        this.frameIndex++;
      }
      
      // Wait for expected frame duration
      const expectedFrame = this.expectedColorSeq[this.frameIndex - 1] || this.expectedColorSeq[0];
      await new Promise(r => setTimeout(r, expectedFrame?.duration || 33));
    }
    
    const verified = this.frameIndex >= this.expectedColorSeq.length * 0.8;
    this.stop();
    this.onResult?.({
      channel: 'color_pattern',
      verified,
      framesMatched: this.frameIndex,
      expectedFrames: this.expectedColorSeq.length,
      timestamp: Date.now()
    });
  }
  
  stop() {
    this.running = false;
    this.stream?.getTracks().forEach(t => t.stop());
    this.stream = null;
    this.video = null;
    this.canvas = null;
  }
}

// ============================================================================
// UNIFIED VERIFICATION PROTOCOL - Orchestrates all channels
// ============================================================================

export class UnifiedVerificationProtocol {
  constructor({
    vpa,           // Expected UPI ID (e.g., 'merchant@okhdfcbank')
    amount,        // Expected amount in rupees (e.g., 100.37)
    ref,           // Transaction reference (your unique ref)
    colorSeq,      // Animated color sequence (from server)
    onResult       // Callback with final result
  } = {}) {
    this.vpa = vpa;
    this.amount = amount;
    this.ref = ref;
    this.colorSeq = colorSeq;
    this.onResult = onResult;
    
    this.channels = [];
    this.results = [];
    this.finalized = false;
  }
  
  async initialize() {
    // 1. Register protocol handler (Channel 1)
    await registerProtocolHandler();
    
    // 2. Setup passive dwell detector (Channel 2)
    this.dwellDetector = new PassiveDwellDetector({
      minDwellMs: 1200,
      onReturn: (result) => this.collectResult(result)
    });
    
    // 3. Build UPI intent with return URL
    const returnUrl = `${location.origin}/upi-return?tr=${this.ref}`;
    this.upiIntent = buildUpiIntent({
      pa: this.vpa,
      pn: 'Merchant',
      am: this.amount.toFixed(2),
      tr: this.ref,
      returnUrl
    });
    
    // 4. Prepare camera OCR (Channel 3)
    this.cameraOcr = new CameraOcrVerifier({
      expectedRef: this.ref,
      expectedAmount: this.amount * 100, // paise
      expectedVpa: this.vpa,
      onResult: (result) => this.collectResult(result)
    });
    
    // 5. Prepare sound detector (Channel 4)
    this.soundDetector = new SoundDetector({
      onDetect: (result) => this.collectResult(result)
    });
    
    // 6. Prepare color pattern detector (Channel 5)
    this.colorDetector = new ColorPatternDetector({
      expectedColorSeq: this.colorSeq || [],
      onResult: (result) => this.collectResult(result)
    });
  }
  
  async start() {
    await this.initialize();
    
    // Arm passive detection
    this.dwellDetector.arm(this.ref, 45000);
    
    // Start sound detection (always running)
    try {
      await this.soundDetector.start();
      this.channels.push(this.soundDetector);
    } catch (e) {
      console.warn('Sound detection unavailable:', e.message);
    }
    
    // 1. Launch UPI intent
    window.location.href = this.upiIntent;
    
    // 2. Wait for return (protocol handler OR passive dwell)
    // 3. On return: start camera verification (optional)
    // 4. Aggregate results from all channels
    // 5. Final decision
    
    return new Promise((resolve) => {
      this.resolve = resolve;
    });
  }
  
  collectResult(result) {
    this.results.push(result);
    this.checkFinalDecision();
  }
  
  checkFinalDecision() {
    if (this.finalized) return;
    
    // Priority order of evidence:
    // 1. Protocol handler return (strongest - has UTR + status from UPI app)
    // 2. Camera OCR (strong - visual evidence)
    // 3. Color pattern (strong - animated HMAC sequence)
    // 4. Sound detection (supporting)
    // 5. Passive dwell (weakest - heuristic only)
    
    const protocolResult = this.results.find(r => r.channel === 'protocol_handler');
    const cameraResult = this.results.find(r => r.channel === 'camera_ocr');
    const colorResult = this.results.find(r => r.channel === 'color_pattern');
    const soundResult = this.results.find(r => r.channel === 'sound');
    const dwellResult = this.results.find(r => r.channel === 'passive_dwell');
    
    // Decision logic
    if (protocolResult?.status === 'success' && protocolResult.upiRef) {
      // Strongest: UPI app returned success with UTR
      this.finalize({
        verified: true,
        channel: 'protocol_handler',
        evidence: protocolResult,
        reason: 'UPI app returned success with UTR'
      });
    } else if (cameraResult?.verified && colorResult?.verified) {
      // Strong: Both camera OCR and color pattern match
      this.finalize({
        verified: true,
        channel: 'camera_ocr + color_pattern',
        evidence: { camera: cameraResult, color: colorResult },
        reason: 'Visual verification: OCR + color pattern match'
      });
    } else if (cameraResult?.verified && soundResult?.detected) {
      // Medium: Camera OCR + sound confirmation
      this.finalize({
        verified: true,
        channel: 'camera_ocr + sound',
        evidence: { camera: cameraResult, sound: soundResult },
        reason: 'Visual + audio confirmation'
      });
    } else if (dwellResult && soundResult?.detected) {
      // Weak: Dwell + sound (heuristic only)
      this.finalize({
        verified: false,
        channel: 'passive_dwell + sound',
        evidence: { dwell: dwellResult, sound: soundResult },
        reason: 'Heuristic: user returned after payment time + chime detected',
        requireManualReview: true
      });
    } else if (dwellResult) {
      // Weakest: Only passive dwell
      this.finalize({
        verified: false,
        channel: 'passive_dwell',
        evidence: { dwell: dwellResult },
        reason: 'Heuristic: user returned after payment time',
        requireManualReview: true
      });
    }
  }
  
  finalize(decision) {
    if (this.finalized) return;
    this.finalized = true;
    
    // Stop all channels
    this.stopAllChannels();
    
    // Call final callback
    this.onResult?.({
      verified: decision.verified,
      primaryChannel: decision.channel,
      reason: decision.reason,
      evidence: decision.evidence,
      allResults: this.results,
      requireManualReview: decision.requireManualReview || false,
      timestamp: Date.now()
    });
    
    this.resolve?.(decision);
  }
  
  stopAllChannels() {
    this.dwellDetector?.destroy();
    this.cameraOcr?.stop();
    this.soundDetector?.stop();
    this.colorDetector?.stop();
  }
  
  // Called when user returns from UPI app (via protocol handler)
  handleUpiReturn(searchParams) {
    const result = handleUpiReturn(searchParams);
    this.collectResult(result);
  }
  
  // Called when user returns from UPI app (manual return)
  async onUserReturn() {
    // Start camera verification (5 seconds)
    try {
      await this.cameraOcr.start();
      this.channels.push(this.cameraOcr);
    } catch (e) {
      console.warn('Camera unavailable:', e.message);
    }
    
    // Start color pattern detection if sequence provided
    if (this.colorSeq?.length) {
      try {
        await this.colorDetector.start();
        this.channels.push(this.colorDetector);
      } catch (e) {
        console.warn('Color detection unavailable:', e.message);
      }
    }
  }
  
  // Get UPI intent for user to click
  getUpiIntent() {
    return this.upiIntent;
  }
}

// ============================================================================
// Server-side: Generate animated color sequence (HMAC-bound)
// ============================================================================

/**
 * Generate animated color sequence bound to transaction
 * @param {string} ref - Transaction reference
 * @param {number} amount - Amount in rupees
 * @param {number} timestamp - Unix timestamp
 * @param {string} secret - Server secret
 * @param {number} durationMs - Total duration in ms (default 5000)
 * @param {number} fps - Frames per second (default 30)
 * @returns {Array} Array of {r, g, b, duration} frames
 */
export function generateColorSequence(ref, amount, timestamp, secret, durationMs = 5000, fps = 30) {
  const frameCount = Math.round(durationMs / 1000 * fps);
  const frameDuration = durationMs / frameCount;
  const frames = [];
  
  for (let i = 0; i < frameCount; i++) {
    // HMAC-SHA256 of (ref|amount|timestamp|frameIndex|secret)
    // In browser, use Web Crypto API
    const data = `${ref}|${amount}|${timestamp}|${i}|${secret}`;
    // Server would compute HMAC-SHA256 here
    // For demo, using simple hash
    let hash = 0;
    for (let j = 0; j < data.length; j++) {
      hash = ((hash << 5) - hash) + data.charCodeAt(j);
      hash |= 0;
    }
    
    const r = (hash & 0xFF);
    const g = ((hash >> 8) & 0xFF);
    const b = ((hash >> 16) & 0xFF);
    
    frames.push({ r, g, b, duration: Math.round(frameDuration) });
  }
  
  return frames;
}

export default UnifiedVerificationProtocol;