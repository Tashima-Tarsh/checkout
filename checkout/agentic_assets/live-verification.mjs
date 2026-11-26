export function mountLiveVerification({button, endpoint, onResult, onRequested = () => {}, onGranted = () => {}, onDenied = () => {}}) {
  let stream;
  let timer;
  let running = false;
  let generation = 0;
  let inFlight = false;
  let video, canvas;
  let readyPromise = null;
  let readyResolve = null;

  // Browser capability diagnostics
  const hasGetDisplayMedia = typeof navigator !== 'undefined'
    && !!navigator.mediaDevices
    && typeof navigator.mediaDevices.getDisplayMedia === 'function';
  const isSecureContext = typeof window !== 'undefined' && !!window.isSecureContext;
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : '';

  console.log('[live-verification] capability check:', {
    hasGetDisplayMedia,
    isSecureContext,
    userAgent: ua,
  });

  function ready() {
    return new Promise((resolve) => { readyResolve = resolve; });
  }

  function resetButton() {
    button.disabled = false;
    button.checked = false;
  }
  function stop() {
    running = false;
    generation++;
    clearTimeout(timer);
    stream?.getTracks().forEach(track => track.stop());
    stream = undefined;
    readyPromise = null;
    readyResolve = null;
    resetButton();
  }
  function fail(reason) {
    onResult({satisfied:false, state:'VERIFICATION_UNAVAILABLE',
      reason: reason || 'Live verification is unavailable on this browser or sharing was stopped. Payment not verified.'});
  }
  async function post(path, options={}) {
    const response = await fetch(endpoint + path, {
      method:'POST', cache:'no-store', signal:AbortSignal.timeout(20000), ...options,
    });
    if (!response.ok) throw new Error('Live verification unavailable');
    return response.json();
  }

  async function capture(video, canvas) {
    if (!running || inFlight) return;
    inFlight = true;
    clearTimeout(timer);
    const current = generation;
    try {
      await post('/live/chime');
      const session = await post('/live/session');
      if (!running || current !== generation) return;
      const width = Math.min(video.videoWidth || 1280, 1280);
      const height = Math.round((video.videoHeight || 720) * width / (video.videoWidth || 1280));
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d', {alpha:false}).drawImage(video, 0, 0, width, height);
      const frame = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.8));
      if (!frame) throw new Error('Frame unavailable');
      canvas.width = canvas.height = 1;
      const result = await post('/live/frame', {
        headers:{'Content-Type':'image/jpeg', 'X-Agentic-Challenge':session.challenge}, body:frame,
      });
      if (!running || current !== generation) return;
      onResult(result);
      if (result.satisfied) {
        stop();
        return;
      }
    } catch {
      if (running && current === generation) fail();
    }
    finally { inFlight = false; }
    if (running && current === generation) timer = setTimeout(() => capture(video, canvas), 2500);
  }

  async function ensureReady() {
    if (running && video && canvas) return true;
    if (readyPromise) return readyPromise;
    readyPromise = new Promise((resolve) => { readyResolve = resolve; });
    try {
      await Promise.race([readyPromise, new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 10000))]);
      return running && video && canvas;
    } catch {
      return false;
    }
  }

  button.addEventListener('change', async () => {
    onRequested(button.checked);
    if (!button.checked) {
      stop();
      return;
    }

    // Pre-flight checks — report exactly why capture cannot start
    if (!hasGetDisplayMedia) {
      onDenied();
      fail('getDisplayMedia is not available in this browser. Use Chrome 125+ on Android or desktop Chrome/Edge/Firefox.');
      button.checked = false;
      return;
    }
    if (!isSecureContext) {
      onDenied();
      fail('getDisplayMedia requires a secure context (HTTPS). Payment not verified.');
      button.checked = false;
      return;
    }

    running = true;
    const current = ++generation;
    button.disabled = true;

    try {
      // Request entire screen capture, same prompt as Google Meet / Teams.
      // Chrome Android shows the system MediaProjection picker: "Entire screen" or "Chrome tab".
      stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio:false,
      });
      if (!running || current !== generation) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      video = document.createElement('video');
      video.muted = true;
      video.srcObject = stream;
      await video.play();
      canvas = document.createElement('canvas');
      stream.getVideoTracks().forEach(track => track.addEventListener('ended', () => {
        if (current === generation) { stop(); button.checked = true; fail(); }
      }, {once:true}));

      button.disabled = false;
      readyResolve?.(true);
      readyPromise = null;
      onGranted();
      // Wait for checkout return before sending frames; never capture while entering a PIN.
    } catch (err) {
      if (current === generation) {
        onDenied();
        stop();
        button.checked = true;
        const msg = err && err.message ? err.message : 'Screen sharing was denied or unavailable.';
        fail(msg);
      }
    }
  });

  return {
    stop, 
    async checkNow() { 
      const ready = await ensureReady();
      if (!ready) { fail(); return; }
      if (running && video && canvas) capture(video, canvas); 
      else fail(); 
    }, 
    get active() { return running; },
    get diagnostics() {
      return { hasGetDisplayMedia, isSecureContext, userAgent: ua };
    }
  };
}
