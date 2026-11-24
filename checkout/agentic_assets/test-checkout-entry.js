// GET is read-only. A visible navigation starts an idempotent allocation.
let started = false;
async function openCheckout() {
  if (started || document.visibilityState !== 'visible' || document.prerendering) return;
  started = true;
  const status = document.querySelector('[role=status]');
  try {
    const response = await fetch('/api/agenticcheckouttest', {method:'POST',cache:'no-store',signal:AbortSignal.timeout(10000)});
    if (!response.ok) {
      status.textContent = response.status === 429 ? 'Please retry shortly.' : 'Checkout unavailable.';
      return;
    }
    const data = await response.json();
    if (!/^\/checkout\/[0-9a-f]{48}$/.test(data.checkout_path)) throw Error();
    location.replace(data.checkout_path);
  } catch { status.textContent = 'Unable to open checkout. Please refresh.'; }
}
document.addEventListener('visibilitychange', openCheckout);
document.addEventListener('prerenderingchange', openCheckout);
openCheckout();
