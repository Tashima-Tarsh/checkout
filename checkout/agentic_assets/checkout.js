const colors=['#ff7085','#aa8afb','#54d6a6','#efb460','#6baaff'];function network(id,nodes,paths){document.getElementById(id).innerHTML=paths.map((d,i)=>`<path class="wire" d="${d}"/><path class="signal" stroke="${colors[i%5]}" style="animation-delay:-${i%5}s" d="${d}"/>`).join('')+nodes.map(([x,y,label,mark],i)=>`<g transform="translate(${x} ${y})"><rect class="node" width="84" height="70" rx="10"/><rect x="27" y="10" width="30" height="30" rx="7" fill="${colors[i%5]}22"/><text x="42" y="32" fill="${colors[i%5]}" font-size="19" text-anchor="middle">${mark}</text><text x="42" y="56" fill="#aaa9b5" font-size="10" text-anchor="middle">${label}</text><circle cx="0" cy="35" r="3" fill="#9995a4"/><circle cx="84" cy="35" r="3" fill="#9995a4"/></g>`).join('')}
network('mobileNetwork',[[18,55,'Trigger','↯'],[285,100,'Session','▤'],[18,710,'Lookup','⌕'],[285,755,'Verify','✓']],['M102 90H220V135H285','M60 125V360H180','M327 170V420H220','M60 710V530H180','M102 745H220V790H285','M327 755V530H220']);

const panel = document.querySelector('#stage');
const diagnosticPage = location.pathname.endsWith('/diagnostics');
const endpoint = '/api' + location.pathname.replace(/\/diagnostics$/, '');
let order;
let returnCallback;
let checkoutRevision = 0;
let observationTimer;
let expiryTimer;
let returned = false;
let unifiedProtocol;
let webrtcMerchant;
let verificationArmed = false;
const unifiedProtocolReady = import('/assets/unified-verification-protocol.js?v=1').then(module => {
  window.UnifiedVerificationProtocol = module.UnifiedVerificationProtocol;
}).catch(() => {});
const webrtcReady = import('/assets/webrtc-verification.js?v=1').then(module => {
  window.MerchantWebRTCClient = module.MerchantWebRTCClient;
  window.PayerWebRTCClient = module.PayerWebRTCClient;
}).catch(() => {});

async function armVerification() {
  if (verificationArmed) return;
  verificationArmed = true;
  
  // Initialize unified verification protocol (arms passive dwell, sound, etc.)
  const { UnifiedVerificationProtocol } = await unifiedProtocolReady;
  unifiedProtocol = new UnifiedVerificationProtocol({
    vpa: order.upi_id,
    amount: order.amount_minor / 100,
    ref: order.id,
    colorSeq: order.color_seq || [],
    onResult: (result) => {
      liveResult = result;
      order = {...order, status: result.verified ? 'PAID' : order.status, settlement: result};
      updateSettlement(order);
      if (result.verified) {
        finish(true, result.reason || 'Payment verified.');
      } else if (result.requireManualReview) {
        say(result.reason, '#ff7085');
      }
    }
  });
  unifiedProtocol.initialize();
  
  // Initialize WebRTC P2P verification if available
  try {
    const { MerchantWebRTCClient } = await webrtcReady;
    webrtcMerchant = new MerchantWebRTCClient({
      signalingUrl: '/webrtc/ws',
      verificationConfig: {
        useCamera: true,
        useAudio: true,
        useColorPattern: true,
        usePassiveDwell: true,
        useProtocolHandler: true,
        challengeTtlMs: 45000,
        dwellThresholdMs: 1200
      },
      onStateChange: (state) => {
        console.log('WebRTC state:', state);
      },
      onVerificationResult: (result) => {
        liveResult = result;
        order = {...order, status: result.verified ? 'PAID' : order.status, settlement: result};
        updateSettlement(order);
        if (result.verified) {
          finish(true, result.reason || 'Payment verified via WebRTC.');
        } else if (result.requireManualReview) {
          say(result.reason, '#ff7085');
        }
      },
      onError: (error) => {
        console.error('WebRTC error:', error);
        say(error.message, '#ff7085');
      }
    });
    webrtcMerchant.connect('/webrtc/ws');
    webrtcMerchant.register(order.id);
    webrtcMerchant.startVerification({
      ref: order.id,
      amount: order.amount_minor / 100,
      vpa: order.upi_id
    });
  } catch (e) {
    console.warn('WebRTC not available, falling back to unified protocol:', e);
  }
}

function closeCheckout(message) {
  unifiedProtocol?.stopAllChannels?.();
  checkoutRevision++;
  stopObservationPolling();
  clearTimeout(expiryTimer);
  returnCallback?.disarm();
  returned = false;
  updateReceipt(null);
  panel.textContent = message;
}
function scheduleExpiry() {
  clearTimeout(expiryTimer);
  if (!Number.isFinite(order?.expires)) return;
  const check = () => {
    const remaining = order.expires * 1000 - Date.now();
    if (remaining <= 0) closeCheckout('Checkout expired.');
    else expiryTimer = setTimeout(check, Math.min(remaining, 60000));
  };
  check();
}

let observationGeneration = 0;
function stopObservationPolling() {
  clearTimeout(observationTimer);
  observationGeneration++;
}
function startObservationPolling() {
  stopObservationPolling();
  if (order?.settlement?.satisfied) return;
  if (diagnosticPage) return;
  const generation = observationGeneration;
  const revision = checkoutRevision;
  const deadline = Number.isFinite(order?.expires) ? order.expires * 1000 : Date.now() + 120000;
  const valid = () => generation === observationGeneration && revision === checkoutRevision;
  async function poll() {
    if (!valid() || Date.now() >= deadline) return;
    if (!document.hidden) {
      try {
        const response = await fetch(endpoint, {cache:'no-store',signal:AbortSignal.timeout(8000)});
        if (!valid()) return;
        if ([404,410].includes(response.status)) {
          closeCheckout('Checkout expired or closed.');
          return;
        }
        if (response.ok) {
          const current = await response.json();
          if (!valid()) return;
          const previousStatus = order?.status;
          order = current;
          if (current.status === 'PENDING' && previousStatus !== 'PENDING') pending();
          updateReceipt(current);
          if (!liveResult?.state || liveResult.state === 'VERIFICATION_UNAVAILABLE') {
            updateSettlement(current);
          } else if (!current.settlement?.satisfied) {
            updateSettlement({...current, settlement: {satisfied: false, state: liveResult.state, reason: liveResult.reason}});
          }
          if (!current.settlement && document.querySelector('#checkout-vision[data-result=recognized]')) return;
        }
      } catch { /* A temporary network failure is not a result. */ }
    }
    if (valid() && Date.now() < deadline) observationTimer = setTimeout(poll, 5000);
  }
  poll();
}
function formatAmount(amountMinor) {
  return new Intl.NumberFormat('en-IN', {style: 'currency', currency: 'INR', minimumFractionDigits: amountMinor % 100 === 0 ? 0 : 2, maximumFractionDigits: 2}).format(amountMinor / 100);
}
function say(message, color) {
  const status = panel.querySelector('[role=status]');
  if (status) {
    status.textContent = message;
    status.style.color = color;
  }
}
function finish(success, message) {
  if (!success) {
    say(message, '#ff7085');
    return;
  }
  unifiedProtocol?.stopAllChannels?.();
  stopObservationPolling();
  clearTimeout(expiryTimer);
  returnCallback?.disarm();
  panel.innerHTML = '<h2>✓ Payment verified</h2><p role="status"></p>';
  panel.querySelector('h2').style.color = '#54d6a6';
  say(message || 'Payment verified.', '#54d6a6');
}
function updateSettlement(current) {
  const result = current?.settlement;
  if (!result) return;
  if (result.satisfied) finish(true, result.reason || 'Payment verified.');
  else if (['WRONG_AMOUNT', 'WRONG_PAYEE', 'AMOUNT_UNCONFIRMED', 'REPLAY_OR_ORDER_CONFLICT', 'INVALID_REFERENCE', 'ORDER_NOT_ELIGIBLE', 'EXPIRED', 'CHALLENGE_EXPIRED', 'SENSITIVE_CONTENT_REJECTED', 'VERIFICATION_UNAVAILABLE'].includes(result.state)) finish(false, result.reason);
  else if (result.state === 'AMBIGUOUS') say('Two matching payments — confirming', '#8a6d00');
  else say(result.reason || 'Checking…', '#8a6d00');
}
function pending() {
  panel.innerHTML = '<h2></h2><p role="status">Verification pending.</p>';
  panel.querySelector('h2').textContent = formatAmount(order.amount_minor);
}
function showOrder() {
  if (order.settlement?.satisfied) return updateSettlement(order);
  if (order.status === 'PENDING') return pending();
  panel.innerHTML = '<h2></h2><p id="discount"></p><p>Copy the receiving address and pay the exact displayed amount using your UPI app.</p><button class="primary" id="copy">Copy UPI ID</button>'+ (diagnosticPage ? '<button class="secondary" id="paid">I Paid</button>' : '<label class="consent-control"><input type="checkbox" id="consent" required> I authorize the checkout system to temporarily observe my payment-related screen activity for a maximum of 120 seconds using AI Vision technology, exclusively for verifying my UPI payment. This permission shall automatically terminate upon successful verification, cancellation, withdrawal of consent or expiration of the authorized time.</label><p class="privacy">Share only the UPI payment result. Hide PIN, OTP, balances and account details. Live frames are analyzed in memory and never stored.</p>') + '<p role="status"></p>';
  const copy = panel.querySelector('#copy');
  const paid = panel.querySelector('#paid');
  const consent = panel.querySelector('#consent');
  if (copy) copy.onclick = async () => {
    await copyUpiId();
    if (consent.checked && !verificationArmed) {
      await armVerification();
    }
  };
  if (paid) paid.onclick = confirmPayment;
  if (consent) {
    consent.addEventListener('change', async (e) => {
      if (e.target.checked && !verificationArmed) {
        await armVerification();
      }
    });
  }
  updateSettlement(order);
}

async function copyUpiId() {
  const status = panel.querySelector('[role=status]');
  const revision = checkoutRevision;
  try {
    await navigator.clipboard.writeText(order.upi_id);
    if (revision !== checkoutRevision) return;
    checkoutRevision++;
    returned = false;
    document.querySelector('#checkout-vision[data-result=not-observed]')?.remove();
    stopObservationPolling();
    returnCallback?.arm();
    tracker?.arm();
    diagnostics?.record('copy_ok');
    diagnostic?.record('copy-ok');
    status.textContent = diagnosticPage || !order.settlement ? '✓ UPI ID copied. Live verification ready.' : '✓ UPI ID copied. Pay and return to checkout.';
    copy.textContent = diagnosticPage || !order.settlement ? '✓ Copied — Verification ready' : '✓ UPI ID copied';
    setTimeout(() => {
      if (revision + 1 === checkoutRevision && copy.isConnected) copy.textContent = 'Copy UPI ID';
    }, 2500);
  } catch {
    if (revision !== checkoutRevision) return;
    diagnostics?.record('copy_failed');
    diagnostic?.record('copy-failed');
    status.textContent = 'Unable to copy. Please retry.';
  }
}

async function confirmPayment() {
  checkoutRevision++;
  const revision = checkoutRevision;
  stopObservationPolling();
  returnCallback?.disarm();
  const button = panel.querySelector('#paid');
  const status = panel.querySelector('[role=status]');
  const copy = panel.querySelector('#copy');
  button.disabled = true;
  if (copy) copy.disabled = true;
  diagnostics?.record('paid_click');
  diagnostic?.record('paid-click');
  status.textContent = 'Submitting verification request';
  try {
    const response = await fetch(endpoint + '/verify', {method:'POST', signal:AbortSignal.timeout(10000)});
    if (revision !== checkoutRevision) return;
    if (response.status === 410) { closeCheckout('Checkout expired or closed.'); return; }
    if (!response.ok) throw new Error();
    diagnostics?.record('verify_ok');
    diagnostic?.record('request-ok');
    order = {...order, status:'PENDING'};
    pending();
    startObservationPolling();
  } catch {
    if (revision !== checkoutRevision) return;
    diagnostics?.record('verify_failed');
    diagnostic?.record('request-failed');
    status.textContent = 'Unable to submit or checkout expired. Please retry.';
    button.disabled = false;
    if (copy) copy.disabled = false;
  }
}

async function refreshAfterReturn(event) {
  const revision = checkoutRevision;
  const status = panel.querySelector('[role=status]');
  if (!status || panel.querySelector('#paid')?.disabled) return;
  if (diagnosticPage) status.textContent = 'Checking status…';
  else status.textContent = '';
  try {
    const response = await fetch(endpoint, {cache:'no-store', signal:AbortSignal.timeout(10000)});
    if (revision !== checkoutRevision) return;
    if (response.status === 410 || response.status === 404) {
      closeCheckout('Checkout expired or closed.');
      return;
    }
    if (!response.ok) throw new Error();
    const current = await response.json();
    if (revision !== checkoutRevision) return;
    const previousStatus = order?.status;
    order = current;
    if (current.status === 'PENDING' && previousStatus !== 'PENDING') pending();
    const message = panel.querySelector('[role=status]');
    if (!current.settlement && message && current.status !== 'PENDING') message.textContent = diagnosticPage
      ? 'If you paid, select I Paid.' : '';
    if (!diagnosticPage) returned = true;
    updateReceipt(current);
    // On return from UPI app, trigger unified protocol verification
    if (unifiedProtocol) {
      await unifiedProtocol.onUserReturn();
    }
    updateSettlement(current);
    startObservationPolling();
  } catch {
    if (revision === checkoutRevision) {
      if (diagnosticPage) status.textContent = 'Unable to check status. Please retry.';
      else startObservationPolling();
    }
  }
}
function updateReceipt(current) {
  if (current?.settlement) { document.querySelector('#checkout-vision')?.remove(); return; }
  renderReceiptObservation?.({host:document.querySelector('main.panel'), orderId:location.pathname.split('/').pop(), observation:current?.receipt_observation, returned:returned && current != null});
}
function renderReceiptObservation({host, orderId, observation, returned}) {
  if (!host || !observation) return;
  const container = host.querySelector('#checkout-vision') || document.createElement('div');
  container.id = 'checkout-vision';
  if (observation.decision === 'VISUAL_SUCCESS') {
    container.dataset.result = 'recognized';
    container.innerHTML = '<div class="vision-success"><span class="tick">✓</span> Receipt recognized</div>';
  } else if (observation.decision === 'AMOUNT_UNCONFIRMED') {
    container.dataset.result = 'amount-unconfirmed';
    container.innerHTML = '<div class="vision-warning">⚠ Amount not clear</div>';
  } else if (observation.decision === 'RECIPIENT_UNCONFIRMED') {
    container.dataset.result = 'recipient-unconfirmed';
    container.innerHTML = '<div class="vision-warning">⚠ Recipient not confirmed</div>';
  } else if (observation.decision === 'REFERENCE_UNCONFIRMED') {
    container.dataset.result = 'reference-unconfirmed';
    container.innerHTML = '<div class="vision-warning">⚠ Reference not found</div>';
  } else if (observation.decision === 'NOT_SUCCESS') {
    container.dataset.result = 'not-success';
    container.innerHTML = '<div class="vision-error">✗ Payment not successful</div>';
  } else {
    container.dataset.result = 'not-observed';
    container.innerHTML = '<div class="vision-pending">🔍 Looking for receipt…</div>';
  }
  if (!host.contains(container)) host.appendChild(container);
}

async function init() {
  try {
    await Promise.all([diagnosticsReady, returnReady, receiptReady, unifiedProtocolReady]);
    const response = await fetch(endpoint);
    if (response.status === 410) { closeCheckout('Checkout expired or closed.'); return; }
    if (!response.ok) throw new Error();
    order = await response.json();
    showOrder();
    updateReceipt(order);
    if (!order.settlement?.satisfied) {
      if (!diagnosticPage) startObservationPolling();
      scheduleExpiry();
    }
  } catch {
    panel.textContent = 'Checkout unavailable or expired.';
  }
}

init();