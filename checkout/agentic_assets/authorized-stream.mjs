// Explicit adapter for a pre-authorized first-party MediaStream or image source.
// It is intentionally not imported by customer checkout and never requests capture.
export async function startAuthorizedFrameProcessor({stream, orderId, authorization, endpoint = '/api/checkout', synthetic = false, intervalMs = 1000, timeoutMs = 60000, fetcher = fetch}) {
  if (!(stream instanceof MediaStream) || typeof orderId !== 'string' || !authorization) throw new TypeError('Authorized stream, order, and transport credential required');
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.srcObject = stream;
  await video.play();
  const canvas = document.createElement('canvas');
  const seen = new Set();
  let stopped = false;
  const stop = () => { stopped = true; video.pause(); video.srcObject = null; };
  const blob = () => new Promise(resolve => {
    canvas.width = Math.min(video.videoWidth || 0, 1280);
    canvas.height = Math.min(video.videoHeight || 0, 1280);
    if (!canvas.width || !canvas.height) return resolve(null);
    canvas.getContext('2d', {willReadFrequently: false}).drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(resolve, 'image/jpeg', 0.82);
  });
  const deadline = Date.now() + Math.max(1000, timeoutMs);
  while (!stopped && Date.now() < deadline) {
    const frame = await blob();
    if (frame) {
      const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256', await frame.arrayBuffer()))].map(value => value.toString(16).padStart(2, '0')).join('');
      if (!seen.has(digest)) {
        seen.add(digest);
        const response = await fetcher(`${endpoint}/${encodeURIComponent(orderId)}/receipt-observation${synthetic ? '?dry_run=1' : ''}`, {
          method: 'POST', headers: {'Authorization': authorization, 'Content-Type': frame.type, ...(synthetic ? {'X-Agentic-Synthetic':'1'} : {})}, body: frame,
        });
        if (response.ok && (await response.json()).recognized) { stop(); return {recognized:true, stopped:true}; }
      }
    }
    await new Promise(resolve => setTimeout(resolve, Math.max(250, intervalMs)));
  }
  stop();
  return {recognized:false, stopped:true};
}
