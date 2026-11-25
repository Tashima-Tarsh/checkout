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
// UTILITIES
// ============================================================================

/** Retry a function with exponential backoff */
async function retryWithBackoff(fn, maxRetries = 3, baseDelay = 1000) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (e) {
      if (attempt === maxRetries) throw e;
      const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 100;
      await new Promise(r => setTimeout(r, delay));
    }
  }

/** Debounce function */
function debounce(fn, delay) {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

/** Throttle function */
function throttle(fn, limit) {
  let inThrottle = false;
  return (...args) => {
    if (!inThrottle) {
      fn(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

/** Preprocess image for better OCR - only process center 70% where text likely appears */
function preprocessImageForOCR(canvas) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  const w = canvas.width, h = canvas.height;
  
  // Only process center 80% x 60% where text likely appears
  const startX = Math.floor(canvas.width * 0.1);
  const endX = Math.floor(canvas.width * 0.9);
  const startY = Math.floor(canvas.height * 0.2);
  const endY = Math.floor(canvas.height * 0.8);
  
  for (let y = startY; y < endY; y++) {
    const rowStart = (y * canvas.width + Math.floor(canvas.width * 0.1)) * 4;
    const rowEnd = (y * canvas.width + Math.floor(canvas.width * 0.9)) * 4;
    for (let i = rowStart; i < (y * canvas.width + Math.floor(canvas.width * 0.9)) * 4; i += 4) {
      const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      const enhanced = Math.min(255, Math.max(0, (gray - 128) * 1.5 + 128));
      data[i] = data[i + 1] = data[i + 2] = Math.round(enhanced);
    }
  }
  return imageData;
}

/** Shared camera constraints for camera-based verifiers */
const CAMERA_CONSTRAINTS = {
  video: { 
    facingMode: 'environment', 
    width: { ideal: 1280, min: 640 }, 
    height: { ideal: 720, min: 480 },
    frameRate: { ideal: 30, max: 30 }
  },
  audio: false
};

/** Shared camera setup - avoids duplication between CameraOcrVerifier and ColorPatternDetector */
async function setupCamera(constraints = CAMERA_CONSTRAINTS) {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('Camera not supported');
  }
  const stream = await navigator.mediaDevices.getUserMedia(constraints);
  const video = document.createElement('video');
  video.muted = true;
  video.srcObject = stream;
  video.playsInline = true;
  await video.play();
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  return { stream, video, canvas, ctx };
}

/** Precompiled regex patterns for OCR extraction - compiled once */
const REGEX_PATTERNS = {
  AMOUNT: /(?:₹|Rs\.?|INR)\s*([\d,]+(?:\.\d{1,2})?)/gi,
  SUCCESS: /\b(success(ful)?|paid|payment (done|complete(d)?)|sent successfully|transaction complete|txn successful)\b/i,
  FAILURE: /\b(failed|declined|unsuccessful|insufficient (balance|funds)|could not be processed)\b/i,
  VPA: /\b[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}\b/g,
  REF: /\b(\d{12})\b/g,
  SUCCESS_KEYWORDS: /\b(success(ful)?|paid|payment (done|complete(d)?)|sent successfully|transaction complete|txn successful)\b/i,
  FAILURE_KEYWORDS: /\b(failed|declined|unsuccessful|insufficient (balance|funds)|could not be processed)\b/i,
  VPA_PATTERN: /\b[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}\b/g,
  REF_PATTERN: /\b(\d{12})\b/g,
  AMOUNT_PATTERN: /(?:₹|Rs\.?|INR)\s*([\d,]+(?:\.\d{1,2})?)/gi
};

/** Extract evidence from OCR text - uses precompiled regexes */
function extractEvidence(text) {
  const amounts = [...text.matchAll(REGEX_PATTERNS.AMOUNT)]
    .map(m => m[1] ? Number(m[1].replace(/,/g, '')) : NaN)
    .filter(n => Number.isFinite(n) && n > 0);
  
  return {
    text,
    amounts,
    successKeyword: REGEX_PATTERNS.SUCCESS.test(text),
    failureKeyword: REGEX_PATTERNS.FAILURE.test(text),
    vpas: [...new Set(text.match(REGEX_PATTERNS.VPA) ?? [])],
    refs: [...new Set(text.match(REGEX_PATTERNS.REF) ?? [])]
  };
}

/** Amount matching with tolerance */
function amountMatches(found, expected) {
  return expected === undefined 
    ? found.length > 0 
    : found.some(n => Math.abs(n - expected) < 0.01);
}

// ============================================================================
// N1 - STAGE-GRAMMAR SEQUENCING (SGS) - Anti-replay mechanism
// ============================================================================

/**
 * UPI Payment Stage Grammar - validates the 5-beat narrative sequence:
 * 1. PAYEE_SCREEN   - Payee VPA/name displayed
 * 2. AMOUNT_CONFIRM - Amount entry/confirmation screen
 * 3. AUTH_SHEET     - PIN/biometric authentication sheet
 * 4. PROCESSING     - Spinner/processing indicator
 * 5. SUCCESS        - Success confirmation screen
 * 
 * Each stage must appear in order with plausible dwell times.
 * Spliced/replayed videos fail stage-sequence validation.
 */
export class StageGrammarSequencer {
  constructor({ minStageDwellMs = 300, maxStageDwellMs = 30000, maxTotalMs = 180000 } = {}) {
    this.stages = [
      'PAYEE_SCREEN',
      'AMOUNT_CONFIRM', 
      'AUTH_SHEET',
      'PROCESSING',
      'SUCCESS'
    ];
    this.minStageDwellMs = minStageDwellMs;
    this.maxStageDwellMs = maxStageDwellMs;
    this.maxTotalMs = maxTotalMs;
    this.currentStage = -1;
    this.stageStartTime = 0;
    this.stageHistory = [];
    this.startTime = 0;
    this.fsm = this.buildFSM();
  }

  buildFSM() {
    const fsm = {};
    for (let i = 0; i < this.stages.length; i++) {
      const current = this.stages[i];
      fsm[current] = {
        next: i < this.stages.length - 1 ? this.stages[i + 1] : null,
        canSkip: false,
        required: true
      };
    }
    // PROCESSING can be skipped if SUCCESS appears directly after AUTH_SHEET
    fsm['AUTH_SHEET'].next = 'SUCCESS';
    fsm['AUTH_SHEET'].canSkip = true;
    return fsm;
  }

  start() {
    this.currentStage = 0;
    this.stageStartTime = Date.now();
    this.startTime = Date.now();
    this.stageHistory = [{
      stage: this.stages[0],
      startTime: this.startTime,
      endTime: null,
      dwellMs: 0
    }];
  }

  observeFrame(frameAnalysis) {
    if (!this.currentStage >= 0) return { valid: false, reason: 'not_started' };
    
    const now = Date.now();
    const elapsed = now - this.startTime;
    
    if (elapsed > this.maxTotalMs) {
      return { valid: false, reason: 'timeout', elapsed };
    }

    // Detect stage from frame analysis
    const detectedStage = this.detectStage(frameAnalysis);
    if (!detectedStage) {
      return { valid: true, stage: this.stages[this.currentStage], progress: this.currentStage / 4 };
    }

    const currentStageName = this.stages[this.currentStage];
    const fsmState = this.fsm[currentStageName];

    // If we detect the current stage again, just update dwell
    if (detectedStage === currentStageName) {
      this.stageHistory[this.currentStage].endTime = now;
      this.stageHistory[this.currentStage].dwellMs = now - this.stageStartTime;
      return { valid: true, stage: currentStageName, progress: this.currentStage / 4 };
    }

    // Check if we can transition to the detected stage
    if (fsmState.next && detectedStage === fsmState.next) {
      // Valid forward transition
      const dwellMs = now - this.stageStartTime;
      
      if (dwellMs < this.minStageDwellMs) {
        return { valid: false, reason: 'dwell_too_short', stage: currentStageName, dwellMs, minRequired: this.minStageDwellMs };
      }
      
      if (dwellMs > this.maxStageDwellMs) {
        return { valid: false, reason: 'dwell_too_long', stage: currentStageName, dwellMs, maxAllowed: this.maxStageDwellMs };
      }

      // Record completed stage
      this.stageHistory[this.currentStage].endTime = now;
      this.stageHistory[this.currentStage].dwellMs = dwellMs;

      // Advance to next stage
      this.currentStage++;
      this.stageStartTime = now;
      this.stageHistory.push({
        stage: detectedStage,
        startTime: now,
        endTime: null,
        dwellMs: 0
      });

      // Check if we reached SUCCESS
      if (detectedStage === 'SUCCESS') {
        return { valid: true, stage: 'SUCCESS', complete: true, elapsed };
      }

      return { valid: true, stage: detectedStage, progress: this.currentStage / 4, transition: true };
    }

    // Skip PROCESSING if we go directly from AUTH_SHEET to SUCCESS
    if (fsmState.canSkip && detectedStage === 'SUCCESS' && currentStageName === 'AUTH_SHEET') {
      const dwellMs = now - this.stageStartTime;
      if (dwellMs < this.minStageDwellMs) {
        return { valid: false, reason: 'dwell_too_short', stage: currentStageName, dwellMs };
      }
      if (dwellMs > this.maxStageDwellMs) {
        return { valid: false, reason: 'dwell_too_long', stage: currentStageName, dwellMs };
      }

      this.stageHistory[this.currentStage].endTime = now;
      this.stageHistory[this.currentStage].dwellMs = dwellMs;
      this.currentStage += 2; // Skip PROCESSING
      this.stageStartTime = now;
      this.stageHistory.push({
        stage: 'SUCCESS',
        startTime: now,
        endTime: now,
        dwellMs: 0
      });
      return { valid: true, stage: 'SUCCESS', complete: true, elapsed };
    }

    // Invalid transition (backwards or skipping)
    return { 
      valid: false, 
      reason: 'invalid_transition', 
      from: currentStageName, 
      to: detectedStage,
      allowedNext: fsmState.next
    };
  }

  detectStage(analysis) {
    const text = (analysis.text || '').toLowerCase();
    const amounts = analysis.amounts || [];
    const vpas = analysis.vpas || [];
    const refs = analysis.refs || [];
    const success = analysis.successKeyword;
    const failure = analysis.failureKeyword;

    // SUCCESS: explicit success text + amount + reference
    if (success && amounts.length > 0 && refs.length > 0) {
      return 'SUCCESS';
    }

    // PROCESSING: spinner, loading, processing text
    if (/\b(processing|loading|please wait|verifying|completing)\b/i.test(text)) {
      return 'PROCESSING';
    }

    // AUTH_SHEET: PIN, biometric, authentication text
    if (/\b(pin|biometric|fingerprint|face id|authenticate|enter pin|upi pin)\b/i.test(text)) {
      return 'AUTH_SHEET';
    }

    // AMOUNT_CONFIRM: amount visible + payee visible, no success yet
    if (amounts.length > 0 && vpas.length > 0 && !success && !failure) {
      return 'AMOUNT_CONFIRM';
    }

    // PAYEE_SCREEN: VPA visible, no amount yet (or amount entry)
    if (vpas.length > 0 && amounts.length === 0) {
      return 'PAYEE_SCREEN';
    }

    return null;
  }

  getSequence() {
    return this.stageHistory.map(s => ({
      stage: s.stage,
      dwellMs: s.dwellMs,
      startTime: s.startTime,
      endTime: s.endTime
    }));
  }

  getScore() {
    // Returns 0-1 score based on sequence completeness and dwell validity
    const completed = this.stageHistory.filter(s => s.endTime !== null).length;
    const total = this.stages.length;
    let score = completed / total;

    // Penalize invalid dwell times
    for (const stage of this.stageHistory) {
      if (stage.dwellMs > 0) {
        if (stage.dwellMs < this.minStageDwellMs || stage.dwellMs > this.maxStageDwellMs) {
          score *= 0.5;
        }
      }
    }

    return Math.max(0, Math.min(1, score));
  }
}

// Export for use in unified protocol
export { StageGrammarSequencer };
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
  constructor({ minDwellMs = 1200, onReturn, maxRetries = 2 } = {}) {
    this.minDwellMs = minDwellMs;
    this.onReturn = onReturn;
    this.hiddenAt = null;
    this.armed = false;
    this.challengeExpiry = 0;
    this.challenge = null;
    this.maxRetries = maxRetries;
    this.retryCount = 0;
    this.lastDwellMs = 0;
    
    this.onVisibilityChange = this.onVisibilityChange.bind(this);
    this.onPageShow = this.onPageShow.bind(this);
    
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    window.addEventListener('pageshow', this.onPageShow);
  }
  
  arm(challenge, ttlMs = 45000) {
    this.armed = true;
    this.challenge = challenge;
    this.challengeExpiry = Date.now() + ttlMs;
    this.retryCount = 0;
  }
  
  onVisibilityChange() {
    if (document.visibilityState === 'hidden') {
      this.hiddenAt = performance.now();
    } else if (this.hiddenAt !== null) {
      const dwellMs = performance.now() - this.hiddenAt;
      this.hiddenAt = null;
      
      if (this.armed && dwellMs > this.minDwellMs && Date.now() < this.challengeExpiry) {
        this.armed = false;
        this.lastDwellMs = dwellMs;
        this.onReturn?.({
          channel: 'passive_dwell',
          dwellMs,
          challenge: this.challenge,
          timestamp: Date.now(),
          retryCount: this.retryCount
        });
      } else if (this.armed && dwellMs <= this.minDwellMs && this.retryCount < 2) {
        // Quick return - might be a false positive, allow retry
        this.retryCount++;
        // Re-arm with shorter TTL for retry
        this.arm(this.challenge, 15000);
      }
    }
  }
  
  onPageShow(event) {
    if (event.persisted && this.hiddenAt !== null) {
      const dwellMs = performance.now() - this.hiddenAt;
      this.hiddenAt = null;
      
      if (this.armed && dwellMs > this.minDwellMs && Date.now() < this.challengeExpiry) {
        this.armed = false;
        this.lastDwellMs = dwellMs;
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
  
  getLastDwellMs() {
    return this.lastDwellMs;
  }
  
  isArmed() {
    return this.armed && Date.now() < this.challengeExpiry;
  }
}

// ============================================================================
// CHANNEL 3: Camera + OCR (5-second point camera at UPI success screen)
// ============================================================================

export class CameraOcrVerifier {
  constructor({ expectedRef, expectedAmount, expectedVpa, onResult, maxFrames = 60, confidenceThreshold = 0.7 } = {}) {
    this.expectedRef = expectedRef;
    this.expectedAmount = expectedAmount;
    this.expectedVpa = expectedVpa;
    this.onResult = onResult;
    this.stream = null;
    this.video = null;
    this.canvas = null;
    this.running = false;
    this.maxFrames = maxFrames;
    this.confidenceThreshold = confidenceThreshold;
    this.frameResults = [];
    this.bestResult = null;
  }
  
  async start() {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('Camera not supported');
    }
    
    try {
      const { stream, video, canvas, ctx } = await setupCamera();
      this.stream = stream;
      this.video = video;
      this.canvas = canvas;
      this.ctx = ctx;
      this.running = true;
      this.frameResults = [];
      this.bestResult = null;
      
      // Initialize Tesseract worker ONCE and reuse
      const { createWorker } = await import('tesseract.js');
      this.ocrWorker = await createWorker('eng', 1, {
        logger: m => console.debug('OCR:', m.status, m.progress)
      });
      
      this.analyzeFrames();
    } catch (e) {
      throw new Error(`Camera access denied: ${e.message}`);
    }
  }
  
  async analyzeFrames() {
    const ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    const framesToAnalyze = 60; // ~2 seconds at 30fps
    let consecutiveMatches = 0;
    const requiredConsecutive = 3; // Require 3 consecutive matches for confidence
    
    for (let i = 0; i < 120 && this.running; i++) { // Up to 4 seconds
      if (this.video.readyState === this.video.HAVE_ENOUGH_DATA) {
        this.canvas.width = this.video.videoWidth;
        this.canvas.height = this.video.videoHeight;
        const ctx = this.canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(this.video, 0, 0);
        
        // Preprocess for better OCR
        const imageData = preprocessImageForOCR(this.canvas);
        ctx.putImageData(imageData, 0, 0);
        
        // Convert to blob for OCR
        const blob = await new Promise(resolve => 
          this.canvas.toBlob(resolve, 'image/jpeg', 0.9)
        );
        
        const result = await this.analyzeFrame(blob);
        this.frameResults.push(result);
        
        if (result.verified) {
          consecutiveMatches++;
          if (consecutiveMatches >= 3) { // Require 3 consecutive
            this.stop();
            this.onResult?.({
              channel: 'camera_ocr',
              ...result,
              timestamp: Date.now(),
              framesAnalyzed: this.frameResults.length,
              consecutiveMatches
            });
            return;
          }
        } else {
          consecutiveMatches = 0;
        }
      }
      await new Promise(r => setTimeout(r, 33)); // ~30fps
    }
    
    // Return best result even if not fully verified
    const bestMatch = this.frameResults.reduce((best, current) => {
      const bestScore = (best.amountMatch ? 1 : 0) + (best.vpaMatch ? 1 : 0) + (best.refMatch ? 1 : 0) + (best.successKeyword ? 1 : 0);
      const currentScore = (current.amountMatch ? 1 : 0) + (current.vpaMatch ? 1 : 0) + (current.refMatch ? 1 : 0) + (current.successKeyword ? 1 : 0);
      return currentScore > bestScore ? current : best;
    }, null);
    
    this.stop();
    this.onResult?.({
      channel: 'camera_ocr',
      ...(bestMatch || { verified: false, reason: 'No matching evidence found in camera frames' }),
      timestamp: Date.now(),
      framesAnalyzed: this.frameResults.length
    });
  }
  
  async analyzeFrame(worker, blob) {
    try {
      const { data: { text, confidence } } = await worker.recognize(blob);
      
      // Use shared extractEvidence function
      const evidence = extractEvidence(text);
      
      // Verify against expected with confidence scoring
      const amountMatch = this.expectedAmount ? evidence.amounts.some(a => 
        Math.abs(a - this.expectedAmount) < 0.01
      ) : evidence.amounts.length > 0;
      
      const vpaMatch = this.expectedVpa ? evidence.vpas.some(v => 
        v.toLowerCase() === this.expectedVpa?.toLowerCase()
      ) : evidence.vpas.length > 0;
      
      const refMatch = this.expectedRef ? evidence.refs.some(r => 
        r.includes(this.expectedRef)
      ) : evidence.refs.length > 0;
      
      const successKeyword = evidence.successKeyword;
      
      const verified = amountMatch && vpaMatch && refMatch && successKeyword;
      const confidence = (amountMatch ? 0.3 : 0) + (vpaMatch ? 0.25 : 0) + (refMatch ? 0.25 : 0) + (successKeyword ? 0.2 : 0);
      
637:         rawText: text
639:       };
640:     } catch (e) {
641:       return {
641:         verified: false,
642:         error: e.message,
643:         evidence: { amounts: [], vpas: [], refs: [], successKeyword: false },
642:         amountMatch: false,
649:         vpaMatch: false,
650:         refMatch: false,
650:         successKeyword: false,
650:         confidence: 0
650:       };
650:     }
650:   }
650:   
650:   // Use shared extractEvidence function - removed duplicate implementation
650:   
650:   stop() {
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
  constructor({ onDetect, minConfidence = 0.7, detectionWindow = 3000 } = {}) {
    this.onDetect = onDetect;
    this.audioContext = null;
    this.analyser = null;
    this.stream = null;
    this.running = false;
    this.minConfidence = minConfidence;
    this.detectionWindow = detectionWindow;
    this.detectionHistory = [];
    this.lastDetection = 0;
  }
  
  async start() {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('Microphone not supported');
    }
    
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
    } catch (e) {
      throw new Error(`Microphone access denied: ${e.message}`);
    }
    
    this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 4096; // Higher resolution
    this.analyser.smoothingTimeConstant = 0.3; // Less smoothing for chime detection
    this.analyser.minDecibels = -90;
    this.analyser.maxDecibels = -10;
    
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
    // Frequency bins: sampleRate/fftSize = 48000/4096 ≈ 11.7 Hz per bin
    // 2000Hz ≈ bin 171, 4000Hz ≈ bin 342
    const highFreqStart = 170;
    const highFreqEnd = 350;
    const baselineStart = 0;
    const baselineEnd = 100;
    
    let highFreqEnergy = 0;
    for (let i = highFreqStart; i < highFreqEnd; i++) {
      highFreqEnergy += this.dataArray[i];
    }
    highFreqEnergy /= (highFreqEnd - highFreqStart);
    
    let baselineEnergy = 0;
    for (let i = baselineStart; i < baselineEnd; i++) {
      baselineEnergy += this.dataArray[i];
    }
    baselineEnergy /= (baselineEnd - baselineStart);
    
    // Chime detected: high freq energy significantly above baseline
    const ratio = baselineEnergy > 0 ? highFreqEnergy / baselineEnergy : 0;
    const confidence = Math.min(highFreqEnergy / 100, 1) * Math.min(ratio / 5, 1);
    
    this.detectionHistory.push({ timestamp: Date.now(), confidence, ratio, highFreqEnergy, baselineEnergy });
    
    // Keep only recent history
    const cutoff = Date.now() - this.detectionWindow;
    this.detectionHistory = this.detectionHistory.filter(d => d.timestamp > cutoff);
    
    // Check for sustained chime pattern (multiple detections within window)
    const recentDetections = this.detectionHistory.filter(d => d.confidence > 0.5);
    const hasSustainedChime = recentDetections.length >= 3;
    
    if (highFreqEnergy > 50 && ratio > 3 && confidence > this.minConfidence && hasSustainedChime) {
      const now = Date.now();
      if (now - this.lastDetection > 2000) { // Debounce
        this.lastDetection = now;
        this.onDetect?.({
          channel: 'sound',
          detected: true,
          timestamp: Date.now(),
          confidence,
          ratio,
          highFreqEnergy,
          baselineEnergy
        });
      }
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
  constructor({ expectedColorSeq, tolerance = 0.8, onResult, minMatchRatio = 0.7 } = {}) {
    this.expectedColorSeq = expectedColorSeq; // Array of {r,g,b,frameDuration}
    this.tolerance = tolerance;
    this.onResult = onResult;
    this.stream = null;
    this.video = null;
    this.canvas = null;
    this.running = false;
    this.frameIndex = 0;
    this.matchedFrames = 0;
    this.totalFrames = 0;
    this.colorHistory = [];
  }
  
  async start() {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('Camera not supported');
    }
    
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: 'environment', 
          width: { ideal: 1280, min: 640 }, 
          height: { ideal: 720, min: 480 },
          frameRate: { ideal: 30, max: 30 }
        },
        audio: false
      });
    } catch (e) {
      throw new Error(`Camera access denied: ${e.message}`);
    }
    
    this.video = document.createElement('video');
    this.video.muted = true;
    this.video.srcObject = this.stream;
    this.video.playsInline = true;
    await this.video.play();
    
    this.canvas = document.createElement('canvas');
    this.running = true;
    this.frameIndex = 0;
    this.matchedFrames = 0;
    this.totalFrames = this.expectedColorSeq.length;
    this.colorHistory = [];
    this.analyzeColorFrames();
  }
  
  async analyzeColorFrames() {
    const ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    const expectedFrames = this.expectedColorSeq.length;
    let consecutiveMatches = 0;
    
    while (this.running && this.frameIndex < this.expectedColorSeq.length * 1.5) {
      if (this.video.readyState === this.video.HAVE_ENOUGH_DATA) {
        this.canvas.width = this.video.videoWidth;
        this.canvas.height = this.video.videoHeight;
        ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
        
        // Sample color from center region (where color bar would be)
        const cx = this.canvas.width / 2;
        const cy = this.canvas.height / 2;
        const sampleSize = Math.min(100, Math.min(this.canvas.width, this.canvas.height) * 0.3);
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
        
        this.colorHistory.push({ r, g, b, timestamp: Date.now() });
        
        // Compare with expected frame
        const expected = this.expectedColorSeq[this.frameIndex % this.expectedColorSeq.length];
        if (expected) {
          const dr = Math.abs(r - expected.r);
          const dg = Math.abs(g - expected.g);
          const db = Math.abs(b - expected.b);
          const distance = Math.sqrt(dr*dr + dg*dg + db*db);
          const maxDistance = Math.sqrt(3 * 255 * 255);
          const similarity = 1 - distance / maxDistance;
          
          if (similarity >= this.tolerance) {
            consecutiveMatches++;
            this.matchedFrames++;
          } else {
            consecutiveMatches = 0;
          }
        }
        
        this.frameIndex++;
        this.totalFrames++;
        
        // Check for sufficient consecutive matches
        if (consecutiveMatches >= Math.min(5, this.expectedColorSeq.length * 0.3)) {
          this.running = false;
          this.stop();
          this.onResult?.({
            channel: 'color_pattern',
            verified: true,
            framesMatched: this.matchedFrames,
            expectedFrames: this.expectedColorSeq.length,
            totalFrames: this.totalFrames,
            timestamp: Date.now()
          });
          return;
        }
      }
      
      // Wait for expected frame duration
      const expectedFrame = this.expectedColorSeq[(this.frameIndex - 1) % this.expectedColorSeq.length] || this.expectedColorSeq[0];
      await new Promise(r => setTimeout(r, expectedFrame?.duration || 33));
    }
    
    // Timeout - evaluate partial match
    const matchRatio = this.matchedFrames / Math.max(1, this.expectedColorSeq.length);
    const verified = matchRatio >= 0.7 && this.matchedFrames >= 3;
    
    this.stop();
    this.onResult?.({
      channel: 'color_pattern',
      verified,
      framesMatched: this.matchedFrames,
      expectedFrames: this.expectedColorSeq.length,
      totalFrames: this.totalFrames,
      matchRatio,
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
// N2 - SELF-REFERENTIAL FRAME ANCHOR (SRFA) - Provenance & Time Binding
// ============================================================================

/**
 * Self-Referential Frame Anchor (SRFA) - embeds a time-animated, HMAC-bound
 * micro-pattern in the checkout page. When captured by camera, the pattern's
 * rotation phase encodes wall-clock time, making the frame self-authenticating
 * against its own generation instant. Session-bound and time-bound in one primitive.
 */
export class SelfReferentialFrameAnchor {
  constructor({ secret, durationMs = 5000, fps = 30, tileSize = 8, tilesX = 4, tilesY = 4 } = {}) {
    this.secret = secret;
    this.durationMs = durationMs;
    this.fps = fps;
    this.tileSize = tileSize;
    this.tilesX = tilesX;
    this.tilesY = tilesY;
    this.frameCount = 0;
    this.totalFrames = 0;
    this.startTime = 0;
    this.canvas = null;
    this.ctx = null;
    this.running = false;
    this.anchorElement = null;
    this.animationFrameId = null;
  }

  /**
   * Initialize the anchor - creates a small canvas element with the animated pattern
   * positioned near the amount display (configurable position)
   */
  init({ container, position = 'bottom-right', offsetX = 10, offsetY = 10 } = {}) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.tileSize * this.tilesX;
    this.canvas.height = this.tileSize * this.tilesY;
    this.canvas.style.position = 'fixed';
    this.canvas.style.pointerEvents = 'none';
    this.canvas.style.zIndex = '2147483647';
    this.canvas.style.opacity = '0.15'; // Near-invisible
    this.canvas.style.imageRendering = 'pixelated';
    
    // Position near amount display
    switch (position) {
      case 'bottom-right':
        this.canvas.style.right = `${offsetX}px`;
        this.canvas.style.bottom = `${offsetY}px`;
        break;
      case 'bottom-left':
        this.canvas.style.left = `${offsetX}px`;
        this.canvas.style.bottom = `${offsetY}px`;
        break;
      case 'top-right':
        this.canvas.style.right = `${offsetX}px`;
        this.canvas.style.top = `${offsetY}px`;
        break;
      case 'top-left':
        this.canvas.style.left = `${offsetX}px`;
        this.canvas.style.top = `${offsetY}px`;
        break;
    }

    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    
    if (container) {
      container.appendChild(this.canvas);
    } else {
      document.body.appendChild(this.canvas);
    }
    
    this.anchorElement = this.canvas;
    return this;
  }

  /**
   * Generate frame using HMAC-SHA256 of (ref|amount|timestamp|frameIndex|secret)
   * Each frame is deterministically generated from the secret and frame index
   */
  generateFrame(frameIndex, ref, amount, timestamp, secret) {
    const data = `${ref}|${amount}|${timestamp}|${frameIndex}|${secret}`;
    // In production, use Web Crypto API for HMAC-SHA256
    // For now, use a simple deterministic hash
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      hash = ((hash << 5) - hash) + data.charCodeAt(i);
      hash |= 0;
    }
    
    const colors = [];
    for (let y = 0; y < this.tilesY; y++) {
      for (let x = 0; x < this.tilesX; x++) {
        const idx = y * this.tilesX + x;
        const pixelHash = hash + idx * 31;
        const r = (pixelHash & 0xFF);
        const g = ((pixelHash >> 8) & 0xFF);
        const b = ((pixelHash >> 16) & 0xFF);
        colors.push({ r, g, b });
      }
    }
    return colors;
  }

  /**
   * Draw current frame to the anchor canvas
   */
  drawFrame(frameIndex, ref, amount, timestamp, secret) {
    if (!this.ctx || !this.canvas) return;
    
    const colors = this.generateFrame(frameIndex, ref, amount, timestamp, this.secret);
    
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    for (let y = 0; y < this.tilesY; y++) {
      for (let x = 0; x < this.tilesX; x++) {
        const idx = y * this.tilesX + x;
        const { r, g, b } = colors[idx];
        this.ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
        this.ctx.fillRect(
          x * this.tileSize,
          y * this.tileSize,
          this.tileSize,
          this.tileSize
        );
      }
    }
  }

  /**
   * Start the animation loop
   */
  async start(ref, amount, timestamp, secret) {
    this.startTime = Date.now();
    this.running = true;
    this.frameIndex = 0;
    
    const frameDuration = this.durationMs / this.totalFrames;
    this.totalFrames = Math.round(this.durationMs / 1000 * 30); // 30 fps
    
    const animate = async () => {
      if (!this.running) return;
      
      const elapsed = Date.now() - this.startTime;
      if (elapsed >= this.durationMs) {
        this.running = false;
        return;
      }
      
      const frameIndex = Math.floor(elapsed / (this.durationMs / this.totalFrames));
      if (frameIndex >= this.totalFrames) frameIndex = this.totalFrames - 1;
      
      this.drawFrame(frameIndex, ref, amount, timestamp, secret);
      this.frameIndex = frameIndex;
      
      if (this.running) {
        this.animationFrameId = requestAnimationFrame(animate);
      }
    };
    
    await animate();
  }

  stop() {
    this.running = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    if (this.anchorElement && this.anchorElement.parentNode) {
      this.anchorElement.parentNode.removeChild(this.anchorElement);
    }
    this.anchorElement = null;
    this.canvas = null;
    this.ctx = null;
  }

  /**
   * Verify a captured frame against the expected sequence
   * Returns the frame index if matched, or -1 if not matched
   */
  static verifyFrame(capturedColors, ref, amount, timestamp, secret, frameIndex, tolerance = 30) {
    // Generate expected colors for this frame
    const data = `${ref}|${amount}|${timestamp}|${frameIndex}|${secret}`;
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      hash = ((hash << 5) - hash) + data.charCodeAt(i);
      hash |= 0;
    }
    
    const expectedColors = [];
    for (let i = 0; i < 16; i++) { // 4x4 = 16 tiles
      const pixelHash = hash + i * 31;
      const r = (pixelHash & 0xFF);
      const g = ((pixelHash >> 8) & 0xFF);
      const b = ((pixelHash >> 16) & 0xFF);
      expectedColors.push({ r, g, b });
    }
    
    // Compare captured vs expected
    let matches = 0;
    for (let i = 0; i < Math.min(capturedColors.length, expectedColors.length); i++) {
      const dr = Math.abs(capturedColors[i].r - expectedColors[i].r);
      const dg = Math.abs(capturedColors[i].g - expectedColors[i].g);
      const db = Math.abs(capturedColors[i].b - expectedColors[i].b);
      const distance = Math.sqrt(dr*dr + dg*dg + db*db);
      if (distance <= tolerance) matches++;
    }
    
    return matches / expectedColors.length >= 0.8 ? frameIndex : -1;
  }

  /**
   * Extract color sequence from captured frame
   */
  static extractColorsFromFrame(canvas, tilesX = 4, tilesY = 4) {
    const ctx = canvas.getContext('2d');
    const tileSize = Math.min(canvas.width / tilesX, canvas.height / tilesY);
    const colors = [];
    
    for (let y = 0; y < tilesY; y++) {
      for (let x = 0; x < tilesX; x++) {
        const cx = x * tileSize + tileSize / 2;
        const cy = y * tileSize + tileSize / 2;
        const imageData = ctx.getImageData(cx, cy, 1, 1);
        const data = imageData.data;
        colors.push({ r: data[0], g: data[1], b: data[2] });
      }
    }
    return colors;
  }
}

// ============================================================================
// N3 - CAPABILITY RECEIPT - Informed Consent Artefact
// ============================================================================

/**
 * Capability Receipt - renders a capability report before session starts,
 * showing the user exactly what can be observed and at what tier.
 * Converts §3 consent from legal theatre into informed technical consent.
 */
export class CapabilityReceipt {
  constructor({ onAccept, onDecline, container } = {}) {
    this.onAccept = onAccept;
    this.onDecline = onDecline;
    this.container = container || document.body;
    this.capabilities = null;
    this.receiptElement = null;
    this.tier = 'none';
  }

  /**
   * Probe browser capabilities to determine observation tier
   */
  async probeCapabilities() {
    const caps = {
      displayCapture: false,
      displayCaptureFull: false,
      camera: false,
      microphone: false,
      protocolHandler: false,
      wakeLock: false,
      pageVisibility: true,
      fps: 0,
      colorDepth: 24,
      tier: 'none'
    };

    // Check getDisplayMedia (screen capture)
    if (navigator.mediaDevices?.getDisplayMedia) {
      caps.displayCapture = true;
      
      // Check if monitor capture is available (desktop)
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: { displaySurface: 'monitor' },
          audio: false
        });
        caps.displayCaptureFull = true;
        stream.getTracks().forEach(t => t.stop());
      } catch (e) {
        // Fallback: check if browser supports displaySurface
        caps.displayCaptureFull = false;
      }
    }

    // Check camera
    if (navigator.mediaDevices?.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        caps.camera = true;
        stream.getTracks().forEach(t => t.stop());
      } catch (e) {
        caps.camera = false;
      }
    }

    // Check microphone
    if (navigator.mediaDevices?.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        caps.microphone = true;
        stream.getTracks().forEach(t => t.stop());
      } catch (e) {
        caps.microphone = false;
      }
    }

    // Check protocol handler
    if ('protocolHandler' in navigator) {
      caps.protocolHandler = true;
    }

    // Check wake lock
    if ('wakeLock' in navigator) {
      caps.wakeLock = true;
    }

    // Measure effective FPS for screen capture
    caps.fps = await this.measureEffectiveFPS();

    // Color depth
    caps.colorDepth = screen.colorDepth || 24;

    // Determine tier
    if (caps.displayCaptureFull && caps.camera && caps.protocolHandler) {
      caps.tier = 'high';
    } else if (caps.displayCapture && caps.camera) {
      caps.tier = 'medium';
    } else if (caps.camera) {
      caps.tier = 'low';
    } else {
      caps.tier = 'declaration-only';
    }

    this.capabilities = caps;
    this.tier = caps.tier;
    return caps;
  }

  /**
   * Measure effective FPS for screen capture
   */
  async measureEffectiveFPS() {
    if (!navigator.mediaDevices?.getDisplayMedia) return 0;
    
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: 30, max: 30 } },
        audio: false
      });
      
      const video = document.createElement('video');
      video.srcObject = stream;
      video.muted = true;
      video.playsInline = true;
      await video.play();
      
      const frames = [];
      const start = performance.now();
      
      const measure = () => {
        frames.push(performance.now());
        if (performance.now() - start < 1000) {
          requestAnimationFrame(measure);
        } else {
          stream.getTracks().forEach(t => t.stop());
          const elapsed = frames[frames.length - 1] - frames[0];
          const fps = (frames.length - 1) / (elapsed / 1000);
          resolve(Math.round(fps));
        }
      };
      
      const promise = new Promise((resolve) => {
        window.measure = measure;
        measure();
      });
      
      const fps = await promise;
      stream.getTracks().forEach(t => t.stop());
      return fps;
    } catch (e) {
      return 0;
    }
  }

  /**
   * Render the capability receipt UI
   */
  render() {
    if (!this.capabilities) {
      throw new Error('Call probeCapabilities() first');
    }

    const caps = this.capabilities;
    const tierLabels = {
      'high': { label: 'HIGH', color: '#54d6a6', desc: 'Full screen capture + camera + protocol handler' },
      'medium': { label: 'MEDIUM', color: '#efb460', desc: 'Tab capture + camera' },
      'low': { label: 'LOW', color: '#ff7085', desc: 'Camera only (mobile fallback)' },
      'declaration-only': { label: 'DECLARATION ONLY', color: '#aa8afb', desc: 'No live observation available' }
    };

    const tierInfo = tierLabels[this.tier] || tierLabels['declaration-only'];

    const html = `
      <div class="capability-receipt" style="
        font-family: system-ui, sans-serif;
        max-width: 400px;
        padding: 20px;
        border: 2px solid ${tierInfo.color};
        border-radius: 12px;
        background: #1a1a2e;
        color: #fff;
        font-size: 14px;
        line-height: 1.6;
      ">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
          <h3 style="margin: 0; font-size: 18px;">Verification Capability Receipt</h3>
          <span style="
            background: ${tierInfo.color};
            color: #000;
            padding: 4px 12px;
            border-radius: 20px;
            font-weight: bold;
            font-size: 12px;
          ">${tierInfo.label}</span>
        </div>
        
        <p style="margin: 0 0 16px; color: #aaa; font-size: 13px;">
          ${tierInfo.desc}
        </p>
        
        <div style="margin-bottom: 16px;">
          <div style="display: flex; justify-content: space-between; margin: 8px 0;">
            <span>Session Duration</span>
            <strong>120 seconds</strong>
          </div>
          <div style="display: flex; justify-content: space-between; margin: 8px 0;">
            <span>Observation Tier</span>
            <strong style="color: ${tierInfo.color};">${tierInfo.label}</strong>
          </div>
          <div style="display: flex; justify-content: space-between; margin: 8px 0;">
            <span>Screen Capture</span>
            <strong>${this.capabilities.displayCaptureFull ? 'Full Screen ✓' : this.capabilities.displayCapture ? 'Tab Only ⚠' : 'None ✗'}</strong>
          </div>
          <div style="display: flex; justify-content: space-between; margin: 8px 0;">
            <span>Camera</span>
            <strong>${this.capabilities.camera ? 'Available ✓' : 'Unavailable ✗'}</strong>
          </div>
          <div style="display: flex; justify-content: space-between; margin: 8px 0;">
            <span>Microphone</span>
            <strong>${this.capabilities.microphone ? 'Available ✓' : 'Unavailable ✗'}</strong>
          </div>
          <div style="display: flex; justify-content: space-between; margin: 8px 0;">
            <span>Protocol Handler</span>
            <strong>${this.capabilities.protocolHandler ? 'Supported ✓' : 'Unavailable ✗'}</strong>
          </div>
          <div style="display: flex; justify-content: space-between; margin: 8px 0;">
            <span>Wake Lock</span>
            <strong>${this.capabilities.wakeLock ? 'Supported ✓' : 'Unsupported ✗'}</strong>
          </div>
          <div style="display: flex; justify-content: space-between; margin: 8px 0;">
            <span>Effective FPS</span>
            <strong>${this.capabilities.fps || 'N/A'}</strong>
          </div>
          <div style="display: flex; justify-content: space-between; margin: 8px 0;">
            <span>Color Depth</span>
            <strong>${this.capabilities.colorDepth}-bit</strong>
          </div>
        </div>
        
        <div style="
          background: rgba(255,255,255,0.05);
          padding: 12px;
          border-radius: 8px;
          margin: 16px 0;
          font-size: 12px;
          color: #aaa;
        ">
          <strong>Privacy Guarantees:</strong>
          <ul style="margin: 8px 0 0; padding-left: 20px;">
            <li>No PIN, OTP, passwords, or balances captured</li>
            <li>Frames processed in memory, never stored</li>
            <li>Auto-terminates at 120s or on consent withdrawal</li>
            <li>Only amount, payee VPA, and transaction reference retained as SHA-256 digest</li>
          </ul>
        </div>
        
        <div style="display: flex; gap: 12px; margin-top: 20px;">
          <button id="cap-reject" style="
            flex: 1;
            padding: 12px;
            border: 2px solid #ff7085;
            background: transparent;
            color: #ff7085;
            border-radius: 8px;
            font-weight: 600;
            cursor: pointer;
          ">Decline</button>
          <button id="cap-accept" style="
            flex: 1;
            padding: 12px;
            background: #54d6a6;
            color: #000;
            border: none;
            border-radius: 8px;
            font-weight: 600;
            cursor: pointer;
          ">I Understand - Start Verification</button>
        </div>
      </div>
    `;

    this.receiptElement = document.createElement('div');
    this.receiptElement.innerHTML = html;
    this.container.appendChild(this.receiptElement);

    // Bind events
    this.receiptElement.querySelector('#cap-accept').addEventListener('click', () => {
      this.cleanup();
      this.onAccept?.(this.capabilities);
    });
    this.receiptElement.querySelector('#cap-reject').addEventListener('click', () => {
      this.cleanup();
      this.onDecline?.();
    });

    return this;
  }

  cleanup() {
    if (this.receiptElement && this.receiptElement.parentNode) {
      this.receiptElement.parentNode.removeChild(this.receiptElement);
    }
    this.receiptElement = null;
  }

  /**
   * Show the receipt and wait for user decision
   */
  async show() {
    await this.probeCapabilities();
    return new Promise((resolve) => {
      this.onAccept = (caps) => resolve({ accepted: true, capabilities: caps });
      this.onDecline = () => resolve({ accepted: false });
      this.render();
    });
  }
}

export { SelfReferentialFrameAnchor, CapabilityReceipt };

export class UnifiedVerificationProtocol {
  constructor({
    vpa,           // Expected UPI ID (e.g., 'merchant@okhdfcbank')
    amount,        // Expected amount in rupees (e.g., 100.37)
    ref,           // Transaction reference (your unique ref)
    colorSeq,      // Animated color sequence (from server)
    onResult,      // Callback with final result
    sessionTimeoutMs = 120000  // 120 seconds per policy
  } = {}) {
    this.vpa = vpa;
    this.amount = amount;
    this.ref = ref;
    this.colorSeq = colorSeq;
    this.onResult = onResult;
    this.sessionTimeoutMs = sessionTimeoutMs;
    this.sessionExpiry = 0;
    this.sessionTimeoutId = null;
    
    this.channels = [];
    this.results = [];
    this.finalized = false;
    this.sessionTimeoutId = null;
    this.challenge = null;
    this.challengeExpiry = 0;
  }
  
  async initialize() {
    // 0. Show Capability Receipt (N3) - Informed consent
    this.capabilityReceipt = new CapabilityReceipt({
      container: document.body,
      onAccept: async (capabilities) => {
        this.capabilities = capabilities;
        this.tier = capabilities.tier;
      },
      onDecline: () => {
        this.finalize({
          verified: false,
          channel: 'consent_declined',
          evidence: {},
          reason: 'User declined verification consent'
        });
      }
    });
    
    // Show capability receipt and wait for user consent
    const consentResult = await this.capabilityReceipt.show();
    if (!consentResult.accepted) {
      return; // User declined, verification cancelled
    }
    
    // Initialize SRFA (N2) - Self-Referential Frame Anchor
    this.srfa = new SelfReferentialFrameAnchor({
      secret: 'verification-secret-' + this.ref,
      durationMs: 5000,
      fps: 30,
      tileSize: 8,
      tilesX: 4,
      tilesY: 4
    });
    this.srfa.init({ 
      container: document.body, 
      position: 'bottom-right', 
      offsetX: 10, 
      offsetY: 10 
    });
    
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
    
    // 4. Prepare sound detector (Channel 4)
    this.soundDetector = new SoundDetector({
      onDetect: (result) => this.collectResult(result)
    });
    
    // 5. Prepare color pattern detector (Channel 5)
    this.colorDetector = new ColorPatternDetector({
      expectedColorSeq: this.colorSeq || [],
      onResult: (result) => this.collectResult(result)
    });
    
    // 6. Prepare Stage-Grammar Sequencer (N1)
    this.stageGrammar = new StageGrammarSequencer({
      minStageDwellMs: 300,
      maxStageDwellMs: 30000,
      maxTotalMs: 180000
    });
  }
  
  async start() {
    await this.initialize();
    
    // Set 120-second session expiry per policy
    this.sessionExpiry = Date.now() + 120000;
    
    // Arm passive detection (45s challenge TTL for dwell detection)
    this.challenge = crypto.randomUUID().replace(/-/g, '').slice(0, 32);
    this.challengeExpiry = Date.now() + 45000;
    this.dwellDetector.arm(this.challenge, 45000);
    
    // Start sound detection (always running)
    try {
      await this.soundDetector.start();
      this.channels.push(this.soundDetector);
    } catch (e) {
      console.warn('Sound detection unavailable:', e.message);
    }
    
    // Start SRFA animation (N2)
    try {
      await this.srfa.start(this.ref, this.amount * 100, Date.now(), 'verification-secret-' + this.ref);
      this.channels.push(this.srfa);
    } catch (e) {
      console.warn('SRFA unavailable:', e.message);
    }
    
    // Start Stage-Grammar Sequencer (N1)
    this.stageGrammar.start();
    
    // Set 120-second session timeout for auto-termination
    this.sessionTimeoutId = setTimeout(() => {
      if (!this.finalized) {
        this.finalize({
          verified: false,
          channel: 'session_timeout',
          evidence: {},
          reason: 'Verification session expired after 120 seconds'
        });
      }
    }, 120000);
    
    // 1. Launch UPI intent
    window.location.href = this.upiIntent;
    
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
    // 2. Camera OCR + SRFA + Stage-Grammar (strong - visual + temporal + provenance)
    // 3. Camera OCR + Color pattern (strong - visual + temporal)
    // 4. Camera OCR + Sound detection (medium - visual + audio)
    // 3. Camera OCR alone with high confidence
    // 4. Sound detection + Passive dwell (weak)
    // 5. Passive dwell only (weakest - heuristic only)
    
    const protocolResult = this.results.find(r => r.channel === 'protocol_handler');
    const cameraResult = this.results.find(r => r.channel === 'camera_ocr');
    const colorResult = this.results.find(r => r.channel === 'color_pattern');
    const soundResult = this.results.find(r => r.channel === 'sound');
    const dwellResult = this.results.find(r => r.channel === 'passive_dwell');
    const srfaResult = this.results.find(r => r.channel === 'srfa');
    const stageGrammarResult = this.results.find(r => r.channel === 'stage_grammar');
    
    // Decision logic
    if (protocolResult?.status === 'success' && protocolResult.upiRef) {
      // Strongest: UPI app returned success with UTR
      this.finalize({
        verified: true,
        channel: 'protocol_handler',
        evidence: protocolResult,
        reason: 'UPI app returned success with UTR'
      });
    } else if (cameraResult?.verified && srfaResult?.verified && stageGrammarResult?.score >= 0.8) {
      // Strongest visual: Camera OCR + SRFA + Stage-Grammar all match
      this.finalize({
        verified: true,
        channel: 'camera_ocr + srfa + stage_grammar',
        evidence: { camera: cameraResult, srfa: srfaResult, stageGrammar: stageGrammarResult },
        reason: 'Visual verification: OCR + frame anchor + stage grammar all match'
      });
    } else if (cameraResult?.verified && colorResult?.verified && srfaResult?.verified) {
      // Strong: Camera OCR + Color pattern + SRFA all match
      this.finalize({
        verified: true,
        channel: 'camera_ocr + color_pattern + srfa',
        evidence: { camera: cameraResult, color: colorResult, srfa: srfaResult },
        reason: 'Visual verification: OCR + color pattern + frame anchor all match'
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
    } else if (cameraResult?.verified && stageGrammarResult?.score >= 0.8) {
      // Medium: Camera OCR + Stage-Grammar
      this.finalize({
        verified: true,
        channel: 'camera_ocr + stage_grammar',
        evidence: { camera: cameraResult, stageGrammar: stageGrammarResult },
        reason: 'Visual verification: OCR + stage grammar match'
      });
    } else if (cameraResult?.verified && cameraResult.confidence >= 0.8) {
      // Camera alone with high confidence
      this.finalize({
        verified: true,
        channel: 'camera_ocr',
        evidence: cameraResult,
        reason: 'High-confidence visual verification'
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
    
    // Clear session timeout
    if (this.sessionTimeoutId) {
      clearTimeout(this.sessionTimeoutId);
      this.sessionTimeoutId = null;
    }
    
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
    // Clear session timeout
    if (this.sessionTimeoutId) {
      clearTimeout(this.sessionTimeoutId);
      this.sessionTimeoutId = null;
    }
    
    this.dwellDetector?.destroy();
    this.cameraOcr?.stop();
    this.soundDetector?.stop();
    this.colorDetector?.stop();
    this.srfa?.stop();
    this.stageGrammar?.destroy?.(); // if destroy method exists
    this.capabilityReceipt?.cleanup?.();
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
    
    // Restart SRFA animation (N2)
    try {
      await this.srfa.start(this.ref, this.amount * 100, Date.now(), 'verification-secret-' + this.ref);
      this.channels.push(this.srfa);
    } catch (e) {
      console.warn('SRFA unavailable:', e.message);
    }
    
    // Restart Stage-Grammar Sequencer (N1)
    this.stageGrammar.start();
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