export function mountLiveVerification({button, endpoint, onResult}) {
  let stream;
  let timer;
  let running = false;
  let generation = 0;

  function resetButton() {
    button.disabled = false;
    button.textContent = 'Start live verification';
  }
  function stop() {
    running = false;
    generation++;
    clearTimeout(timer);
    stream?.getTracks().forEach(track => track.stop());
    stream = undefined;
    resetButton();
  }
  function fail() {
    onResult({satisfied:false, state:'VERIFICATION_UNAVAILABLE',
      reason:'Live verification is temporarily unavailable. Please retry.'});
  }
  async function post(path, options={}) {
    const response = await fetch(endpoint + path, {
      method:'POST', cache:'no-store', signal:AbortSignal.timeout(20000), ...options,
    });
    if (!response.ok) throw new Error('Live verification unavailable');
    return response.json();
  }

  async function capture(video, canvas) {
    if (!running) return;
    const current = generation;
    try {
      // A chime is only an accelerator. No microphone or audio recording is used.
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
    if (running && current === generation) timer = setTimeout(() => capture(video, canvas), 2500);
  }

  button.addEventListener('click', async () => {
    if (running) {
      stop();
      return;
    }
    if (!navigator.mediaDevices?.getDisplayMedia) {
      fail();
      return;
    }
    running = true;
    const current = ++generation;
    button.disabled = true;
    button.textContent = 'Starting live verification…';
    try {
      // Display capture is user-initiated and time-bound. No camera, microphone,
      // file upload, recording, or persistent media object is created.
      stream = await navigator.mediaDevices.getDisplayMedia({
        video:{frameRate:{ideal:2, max:2}}, audio:false,
      });
      if (!running || current !== generation) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      const video = document.createElement('video');
      video.muted = true;
      video.srcObject = stream;
      await video.play();
      const canvas = document.createElement('canvas');
      stream.getVideoTracks().forEach(track => track.addEventListener('ended', stop, {once:true}));
      button.textContent = 'Stop live verification';
      button.disabled = false;
      capture(video, canvas);
    } catch {
      if (current === generation) {
        stop();
        fail();
      }
    }
  });

  return {stop, get active() { return running; }};
}
