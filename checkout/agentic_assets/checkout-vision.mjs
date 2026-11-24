// Display only a server-returned, order-scoped receipt observation.
// This is not an acquisition API or a financial-status update.
export function receiptRecognized(observation, orderId) {
  return typeof orderId === 'string' && orderId.length > 0 &&
    observation?.order_id === orderId &&
    observation.decision === 'VISUAL_SUCCESS' &&
    observation.advance_research === true &&
    observation.financially_verified === false &&
    observation.checkout_changed === false;
}

export function renderReceiptObservation({host, orderId, observation, returned = false}) {
  if (!host) return;
  const previous = host.querySelector('#checkout-vision');
  const recognized = receiptRecognized(observation, orderId);
  const result = recognized ? 'recognized' : returned ? 'not-observed' : null;
  if (!result) { previous?.remove(); return; }
  if (previous?.dataset.result === result) return;
  previous?.remove();
  const section = document.createElement('section');
  section.id = 'checkout-vision';
  section.dataset.result = result;
  section.setAttribute('role','status');
  section.setAttribute('aria-live','polite');
  section.setAttribute('aria-label',recognized ? 'Vision recognized — visual receipt match' : 'Vision not observed');
  section.style.cssText = 'display:flex;align-items:center;justify-content:center;gap:8px;margin:12px 0;color:#74e6ad;font-weight:600;font-size:14px';
  if (!recognized) section.style.color = '#ff8996';
  section.innerHTML = recognized ? '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="m7 12 3 3 7-7"/></svg><span>Vision recognized</span>' : '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="m8 8 8 8m0-8-8 8"/></svg><span>Vision not observed</span>';
  host.querySelector('#stage')?.after(section);
}
