const colors=['#ff7085','#aa8afb','#54d6a6','#efb460','#6baaff'];function network(id,nodes,paths){document.getElementById(id).innerHTML=paths.map((d,i)=>`<path class="wire" d="${d}"/><path class="signal" stroke="${colors[i%5]}" style="animation-delay:-${i%5}s" d="${d}"/>`).join('')+nodes.map(([x,y,label,mark],i)=>`<g transform="translate(${x} ${y})"><rect class="node" width="84" height="70" rx="10"/><rect x="27" y="10" width="30" height="30" rx="7" fill="${colors[i%5]}22"/><text x="42" y="32" fill="${colors[i%5]}" font-size="19" text-anchor="middle">${mark}</text><text x="42" y="56" fill="#aaa9b5" font-size="10" text-anchor="middle">${label}</text><circle cx="0" cy="35" r="3" fill="#9995a4"/><circle cx="84" cy="35" r="3" fill="#9995a4"/></g>`).join('')}
network('network',[[80,115,'Trigger','↯'],[270,40,'Session','▤'],[80,440,'Data store','▱'],[836,115,'Lookup','⌕'],[836,440,'Verify','✓'],[458,550,'Process','▤']],['M164 150H220Q240 150 240 170V280H400','M164 150H200V75H270','M354 75H740V150H836','M164 475H240V370H400','M600 280H760V150H836','M600 370H760V475H836','M164 475H220V585H458','M542 585H780V475H836','M878 185V440']);network('mobileNetwork',[[18,55,'Trigger','↯'],[285,100,'Session','▤'],[18,710,'Lookup','⌕'],[285,755,'Verify','✓']],['M102 90H220V135H285','M60 125V360H180','M327 170V420H220','M60 710V530H180','M102 745H220V790H285','M327 755V530H220']);

const panel = document.querySelector('#stage');
const diagnosticPage = location.pathname.endsWith('/diagnostics');
const endpoint = '/api' + location.pathname.replace(/\/diagnostics$/, '');
let order;
let returnCallback;
let checkoutRevision = 0;
let observationTimer;
let expiryTimer;
function closeCheckout(message) {
  checkoutRevision++;
  stopObservationPolling();
  clearTimeout(expiryTimer);
  returnCallback?.disarm();
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
  if (diagnosticPage || document.querySelector('#checkout-vision')) return;
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
          if (current.status === 'PENDING' && order.status !== 'PENDING') {
            order = current;
            pending();
          }
          updateReceipt(current);
          if (document.querySelector('#checkout-vision')) return;
        }
      } catch { /* A temporary network failure is not a result. */ }
    }
    if (valid() && Date.now() < deadline) observationTimer = setTimeout(poll, 5000);
  }
  observationTimer = setTimeout(poll, 1000);
}
let renderReceiptObservation;
const receiptReady = diagnosticPage ? Promise.resolve() : import('/assets/checkout-vision.mjs?v=5').then(module => {
  renderReceiptObservation = module.renderReceiptObservation;
}).catch(() => {});
function updateReceipt(current) {
  renderReceiptObservation?.({host:document.querySelector('main.panel'), orderId:location.pathname.split('/').pop(), observation:current?.receipt_observation});
  if (!diagnosticPage && document.querySelector('#checkout-vision')) {
    const status = panel.querySelector('[role=status]');
    if (status) status.textContent = '';
  }
}
const returnReady = import('/assets/return-callback.mjs?v=1').then(({attachReturnCallback}) => {
  returnCallback = attachReturnCallback(refreshAfterReturn);
}).catch(() => {});
let diagnostics;
let diagnostic;
const diagnosticParams = diagnosticPage ? new URLSearchParams(location.search) : new URLSearchParams();
// Preserve the existing diagnostics flag; activate only one panel per page.
const diagnosticsReady = diagnosticParams.get('diagnostic_lab') === '1'
  ? import('/assets/local-diagnostics.mjs').then(({mountDiagnostics}) => {
      diagnostics = mountDiagnostics();
    }).catch(() => {})
  : diagnosticParams.get('diagnostics') === '1'
    ? import('/assets/checkout-diagnostics.mjs').then(({mountDiagnostics}) => {
        diagnostic = mountDiagnostics({host:document.querySelector('main.panel')});
      }).catch(() => {})
    : Promise.resolve();
// Opt-in research only; no payment state mutation on return.
let tracker;
if (diagnosticParams.get('return_lab') === '1') {
  import('/assets/return-tracker.mjs').then(({attachReturnTracker}) => {
    tracker = attachReturnTracker(async trace => {
      console.info('PDEP return research', trace);
      try { const response = await fetch(endpoint, {cache:'no-store'}); if (response.ok) console.info('PDEP status', (await response.json()).status); } catch { /* observational only */ }
    });
  }).catch(() => {});
}
// A return is a browser lifecycle callback, NOT a payment provider callback.
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
    if (current.status === 'PENDING') {
      order = current;
      pending();
    }
    const message = panel.querySelector('[role=status]');
    if (message && current.status !== 'PENDING') message.textContent = diagnosticPage
      ? 'If you paid, select I Paid.' : '';
    updateReceipt(current);
    startObservationPolling();
  } catch {
    if (revision === checkoutRevision) {
      if (diagnosticPage) status.textContent = 'Unable to check status. Please retry.';
      else startObservationPolling();
    }
  }
}
function formatAmount(amountMinor) {
  return new Intl.NumberFormat('en-IN', {style: 'currency', currency: 'INR'}).format(amountMinor / 100);
}
function pending() {
  panel.innerHTML = '<h2></h2><p role="status">Verification pending.</p>';
  panel.querySelector('h2').textContent = formatAmount(order.amount_minor);
}
function showOrder() {
  if (order.status === 'PENDING') return pending();
  panel.innerHTML = '<h2></h2><p id="discount"></p><p>Copy the receiving address and pay the exact displayed amount using your UPI app.</p><button class="primary" id="copy">Copy UPI ID</button>'+ (diagnosticPage ? '<button class="secondary" id="paid">I Paid</button>' : '') + '<p role="status"></p>';
  panel.querySelector('h2').textContent = formatAmount(order.amount_minor);
  if (order.discount_minor > 0) panel.querySelector('#discount').textContent =
    'Merchant discount: ' + formatAmount(order.discount_minor);
  panel.querySelector('#copy').onclick = async () => {
    const status = panel.querySelector('[role=status]');
    const revision = checkoutRevision;
    try {
      await navigator.clipboard.writeText(order.upi_id);
      if (revision !== checkoutRevision) return;
      checkoutRevision++;
      stopObservationPolling();
      returnCallback?.arm();
      tracker?.arm();
      diagnostics?.record('copy_ok');
    diagnostic?.record('copy-ok');
      status.textContent = 'UPI ID copied.';
      if (!diagnosticPage) startObservationPolling();
    } catch {
      if (revision !== checkoutRevision) return;
      diagnostics?.record('copy_failed');
    diagnostic?.record('copy-failed');
      status.textContent = 'Unable to copy. Please retry.';
    }
  };
  const paid = panel.querySelector('#paid');
  if (paid) paid.onclick = confirmPayment;
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
    await Promise.all([diagnosticsReady, returnReady, receiptReady]);
    const response = await fetch(endpoint);
    if (response.status === 410) { closeCheckout('Checkout expired or closed.'); return; }
    if (!response.ok) throw new Error();
    order = await response.json();
    showOrder();
    updateReceipt(order);
    if (!diagnosticPage) startObservationPolling();
    scheduleExpiry();
  } catch {
    panel.textContent = 'Checkout unavailable or expired.';
  }
})();

