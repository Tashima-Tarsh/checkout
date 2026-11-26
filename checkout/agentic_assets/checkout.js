const colors=['#ff7085','#aa8afb','#54d6a6','#efb460','#6baaff'];function network(id,nodes,paths){document.getElementById(id).innerHTML=paths.map((d,i)=>`<path class="wire" d="${d}"/><path class="signal" stroke="${colors[i%5]}" style="animation-delay:-${i%5}s" d="${d}"/>`).join('')+nodes.map(([x,y,label,mark],i)=>`<g transform="translate(${x} ${y})"><rect class="node" width="84" height="70" rx="10"/><rect x="27" y="10" width="30" height="30" rx="7" fill="${colors[i%5]}22"/><text x="42" y="32" fill="${colors[i%5]}" font-size="19" text-anchor="middle">${mark}</text><text x="42" y="56" fill="${colors[i%5]}" font-size="10" text-anchor="middle">${label}</text><circle cx="0" cy="35" r="3" fill="${colors[i%5]}"/><circle cx="84" cy="35" r="3" fill="${colors[i%5]}"/></g>`).join('')}
network('network',[[80,115,'Trigger','↯'],[270,40,'Session','▤'],[80,440,'Data store','▱'],[836,115,'Lookup','⌕'],[836,440,'Verify','✓'],[458,550,'Process','▤']],['M164 150H220Q240 150 240 170V280H400','M164 150H200V75H270','M354 75H740V150H836','M164 475H240V370H400','M600 280H760V150H836','M600 370H760V475H836','M164 475H220V585H458','M542 585H780V475H836','M878 185V440']);network('mobileNetwork',[[18,55,'Trigger','↯'],[285,100,'Session','▤'],[18,710,'Lookup','⌕'],[285,755,'Verify','✓']],['M102 90H220V135H285','M60 125V360H180','M327 170V420H220','M60 710V530H180','M102 745H220V790H285','M327 755V530H220']);

const panel = document.querySelector('#stage');
const diagnosticPage = location.pathname.endsWith('/diagnostics');
const endpoint = '/api' + location.pathname.replace(/\/diagnostics$/, '');
let order;
let returnCallback;
let checkoutRevision = 0;
let observationTimer;
let expiryTimer;
let returned = false;
const isAndroid = /Android/i.test(navigator.userAgent || '');
const serverUrl = window.location.origin;
let liveVerification;
let liveResult;
let verificationRequested = false;
let mountLiveVerification;

async function postTxnEvent(event, detail) {
  try {
    await fetch(endpoint + '/txn-event', {
      method: 'POST', cache: 'no-store',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({event, detail}),
    });
  } catch { /* diagnostic best-effort; never blocks checkout flow */ }
}
const liveVerificationReady = import('/assets/live-verification.mjs?v=2').then(module => {
  mountLiveVerification = module.mountLiveVerification;
}).catch(err => {
  console.error('[checkout] live-verification import failed:', err);
  const status = panel.querySelector('[role=status]');
  if (status) status.textContent = 'Verification module failed to load. Reload the page.';
});
function closeCheckout(message) {
  liveVerification?.stop();
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
  observationTimer = setTimeout(poll, 1000);
}
let renderReceiptObservation;
const receiptReady = diagnosticPage ? Promise.resolve() : import('/assets/checkout-vision.mjs?v=6').then(module => {
  renderReceiptObservation = module.renderReceiptObservation;
}).catch(() => {});
function updateReceipt(current) {
  if (current?.settlement) { document.querySelector('#checkout-vision')?.remove(); return; }
  renderReceiptObservation?.({host:document.querySelector('main.panel'), orderId:location.pathname.split('/').pop(), observation:current?.receipt_observation, returned:returned && current != null});
}
const returnReady = import('/assets/return-callback.mjs?v=1').then(({attachReturnCallback}) => {
  returnCallback = attachReturnCallback(refreshAfterReturn);
}).catch(() => {});

// Record server-side departure when the payer leaves to pay.
addEventListener('pagehide', () => {
  postTxnEvent('browser_departed');
});
let diagnostics;
let diagnostic;
const diagnosticParams = diagnosticPage ? new URLSearchParams(location.search) : new URLSearchParams();
const diagnosticsReady = diagnosticParams.get('diagnostic_lab') === '1'
  ? import('/assets/local-diagnostics.mjs').then(({mountDiagnostics}) => {
      diagnostics = mountDiagnostics();
    }).catch(() => {})
  : diagnosticParams.get('diagnostics') === '1'
    ? import('/assets/checkout-diagnostics.mjs').then(({mountDiagnostics}) => {
        diagnostic = mountDiagnostics({host:document.querySelector('main.panel')});
      }).catch(() => {})
    : Promise.resolve();
let tracker;
if (diagnosticParams.get('return_lab') === '1') {
  import('/assets/return-tracker.mjs').then(({attachReturnTracker}) => {
    tracker = attachReturnTracker(async trace => {
      console.info('PDEP return research', trace);
      try { const response = await fetch(endpoint, {cache:'no-store'}); if (response.ok) console.info('PDEP status', (await response.json()).status); } catch { /* observational only */ }
    });
  }).catch(() => {});
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
    updateSettlement(current);
    await postTxnEvent('browser_returned');
    if (verificationRequested && !current.settlement?.satisfied) liveVerification?.checkNow();
    startObservationPolling();
  } catch {
    if (revision === checkoutRevision) {
      if (diagnosticPage) status.textContent = 'Unable to check status. Please retry.';
      else startObservationPolling();
    }
  }
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
  liveVerification?.stop();
  stopObservationPolling();
  clearTimeout(expiryTimer);
  returnCallback?.disarm();
  panel.innerHTML = '<h2>✓ Payment verified</h2><p role="status"></p>';
  panel.querySelector('h2').style.color = '#54d6a6';
  say(message || 'Payment verified.', '#54d6a6');
}
function updateSettlement(current) {
  const result = current?.settlement;
  if (!result?.satisfied && liveResult?.state === 'VERIFICATION_UNAVAILABLE' && verificationRequested) {
    say(liveResult.reason, '#ff7085'); return;
  }
  if (!result) return;
  if (!returned && !liveResult && !result.satisfied && ['NOT_YET','ORDER_NOT_ELIGIBLE'].includes(result.state)) return;
  if (result.satisfied) finish(true, result.reason || 'Payment verified.');
  else if (['WRONG_AMOUNT', 'WRONG_PAYEE', 'AMOUNT_UNCONFIRMED', 'REPLAY_OR_ORDER_CONFLICT', 'INVALID_REFERENCE', 'ORDER_NOT_ELIGIBLE', 'EXPIRED', 'CHALLENGE_EXPIRED', 'SENSITIVE_CONTENT_REJECTED', 'VERIFICATION_UNAVAILABLE'].includes(result.state)) finish(false, result.reason);
  else if (result.state === 'AMBIGUOUS') say('Two matching payments — confirming', '#8a6d00');
  else say(result.reason || 'Checking…', '#8a6d00');
}
function pending() {
  liveVerification?.stop();
  liveVerification = undefined;
  panel.innerHTML = '<h2></h2><p role="status">Verification pending.</p>';
  panel.querySelector('h2').textContent = formatAmount(order.amount_minor);
  updateSettlement(order);
}
function showOrder() {
  if (order.settlement?.satisfied) return updateSettlement(order);
  if (order.status === 'PENDING') return pending();
  panel.innerHTML = '<h2></h2><p id="discount" hidden></p>' + (diagnosticPage ? '' : '<label class="verification-control"><input type="checkbox" id="live-verify"> Verification</label>') + '<p>Copy the receiving address, pay the exact displayed amount using your UPI app and return.</p><button class="primary" id="copy">Copy UPI ID</button>' + (diagnosticPage ? '<button class="secondary" id="paid">I Paid</button>' : '<p>Copy the UPI ID, pay from your UPI app, then return here. Your payment is observed only — verification is confirmed only when the server matches it.</p>') + '<p role="status" aria-live="polite"></p><p id="session-reference" hidden></p>';
  panel.querySelector('h2').textContent = formatAmount(order.amount_minor);
  if (order.discount_minor > 0) {
    const discount = panel.querySelector('#discount');
    discount.hidden = false;
    discount.textContent = 'Merchant discount: ' + formatAmount(order.discount_minor);
  }
  if (order.session_reference) {
    const reference = panel.querySelector('#session-reference');
    reference.hidden = false;
    reference.textContent = 'Checkout reference: ' + order.session_reference;
    reference.style.overflowWrap = 'anywhere';
  }
  const copy = panel.querySelector('#copy');
  const verification = panel.querySelector('#live-verify');
  if (verification && order.settlement) copy.disabled = true;
  if (verification && !order.shared_amount && !mountLiveVerification) {
    verification.disabled = true;
    say('Verification unavailable. Reload to retry.', '#ff7085');
  }
  copy.onclick = async () => {
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
      if (!diagnosticPage) startObservationPolling();
      await postTxnEvent('copy_ok');
    } catch {
      if (revision !== checkoutRevision) return;
      diagnostics?.record('copy_failed');
      diagnostic?.record('copy-failed');
      status.textContent = 'Unable to copy. Please retry.';
    }
  };
  const paid = panel.querySelector('#paid');
  if (paid) paid.onclick = confirmPayment;
  if (!diagnosticPage && order.shared_amount) {
    verification.addEventListener('change', () => {
      verificationRequested = verification.checked;
      copy.disabled = !verificationRequested;
      say(verificationRequested ? 'Verification requested. Pay and return.' : 'Enable verification before copying.', '#b0afbd');
    });
  } else if (!diagnosticPage && mountLiveVerification) {
    liveVerification = mountLiveVerification({
      button:verification, endpoint,
      onRequested: async requested => {
        verificationRequested = requested;
        liveResult = undefined;
        copy.disabled = !requested;
        if (!requested) {
          await postTxnEvent('verification_requested', 'revoked');
        }
      },
      onGranted: async () => {
        verificationRequested = true;
        await postTxnEvent('verification_requested', 'granted');
      },
      onDenied: async () => {
        verificationRequested = false;
        await postTxnEvent('verification_requested', 'denied');
      },
      onResult:async result => {
        liveResult = result;
        await postTxnEvent(result.satisfied ? 'verdict' : 'evidence_rejected', result.state);
        order = {...order, status:result.satisfied ? 'PAID' : order.status, settlement:result};
        updateSettlement(order);
      },
    });
    // Show browser capability diagnostics so the user can see why capture
    // may or may not start (getDisplayMedia availability, secure context).
    const diag = liveVerification?.diagnostics;
    if (diag && !diagnosticPage) {
      const d = document.createElement('p');
      d.style.fontSize = '10px';
      d.style.color = '#98abc8';
      d.style.margin = '6px 0 0';
      d.textContent = 'Diagnostics: getDisplayMedia=' + diag.hasGetDisplayMedia +
        ' · secure=' + diag.isSecureContext +
        ' · ' + (diag.userAgent || '').slice(0, 60);
      panel.appendChild(d);
    }
  }
  updateSettlement(order);
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
(async () => {
  try {
    await Promise.all([diagnosticsReady, returnReady, receiptReady, liveVerificationReady]);
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
})();
