const colors=['#ff7085','#aa8afb','#54d6a6','#efb460','#6baaff'];function network(id,nodes,paths){document.getElementById(id).innerHTML=paths.map((d,i)=>`<path class="wire" d="${d}"/><path class="signal" stroke="${colors[i%5]}" style="animation-delay:-${i%5}s" d="${d}"/>`).join('')+nodes.map(([x,y,label,mark],i)=>`<g transform="translate(${x} ${y})"><rect class="node" width="84" height="70" rx="10"/><rect x="27" y="10" width="30" height="30" rx="7" fill="${colors[i%5]}22"/><text x="42" y="32" fill="${colors[i%5]}" font-size="19" text-anchor="middle">${mark}</text><text x="42" y="56" fill="#aaa9b5" font-size="10" text-anchor="middle">${label}</text><circle cx="0" cy="35" r="3" fill="#9995a4"/><circle cx="84" cy="35" r="3" fill="#9995a4"/></g>`).join('')}
network('network',[[80,115,'Trigger','↯'],[270,40,'Session','▤'],[80,440,'Data store','▱'],[836,115,'Lookup','⌕'],[836,440,'Verify','✓'],[458,550,'Process','▤']],['M164 150H220Q240 150 240 170V280H400','M164 150H200V75H270','M354 75H740V150H836','M164 475H240V370H400','M600 280H760V150H836','M600 370H760V475H836','M164 475H220V585H458','M542 585H780V475H836','M878 185V440']);network('mobileNetwork',[[18,55,'Trigger','↯'],[285,100,'Session','▤'],[18,710,'Lookup','⌕'],[285,755,'Verify','✓']],['M102 90H220V135H285','M60 125V360H180','M327 170V420H220','M60 710V530H180','M102 745H220V790H285','M327 755V530H220']);

const panel = document.querySelector('#stage');
const endpoint = '/api' + location.pathname;
let order;
let diagnostic;
if (new URLSearchParams(location.search).get('diagnostics') === '1') {
  import('/assets/checkout-diagnostics.mjs').then(({mountDiagnostics}) => {
    diagnostic = mountDiagnostics({host:document.querySelector('main.panel')});
  }).catch(() => {});
}
// Opt-in research only; no payment state mutation on return.
let tracker;
if (new URLSearchParams(location.search).get('return_lab') === '1') {
  import('/assets/return-tracker.mjs').then(({attachReturnTracker}) => {
    tracker = attachReturnTracker(async trace => {
      console.info('PDEP return research', trace);
      try { const response = await fetch(endpoint, {cache:'no-store'}); if (response.ok) console.info('PDEP status', (await response.json()).status); } catch { /* observational only */ }
    });
  }).catch(() => {});
}
function formatAmount(amountMinor) {
  return new Intl.NumberFormat('en-IN', {style: 'currency', currency: 'INR'}).format(amountMinor / 100);
}
function pending() {
  panel.innerHTML = '<h2></h2><p role="status">Verification pending. Payment confirmation awaits authorized evidence.</p>';
  panel.querySelector('h2').textContent = formatAmount(order.amount_minor);
}
function showOrder() {
  if (order.status === 'PENDING') return pending();
  panel.innerHTML = '<h2></h2><p id="discount"></p><p>Copy the receiving address and pay the exact displayed amount using your UPI app.</p><button class="primary" id="copy">Copy UPI ID</button><button class="secondary" id="paid">I Paid</button><p role="status"></p>';
  panel.querySelector('h2').textContent = formatAmount(order.amount_minor);
  if (order.discount_minor > 0) panel.querySelector('#discount').textContent =
    'Merchant discount: ' + formatAmount(order.discount_minor);
  panel.querySelector('#copy').onclick = async () => {
    const status = panel.querySelector('[role=status]');
    try {
      await navigator.clipboard.writeText(order.upi_id);
      tracker?.arm();
      diagnostic?.record('copy-ok');
      status.textContent = 'UPI ID copied.';
    } catch {
      diagnostic?.record('copy-failed');
      status.textContent = 'Unable to copy. Please retry.';
    }
  };
  panel.querySelector('#paid').onclick = confirmPayment;
}
async function confirmPayment() {
  const button = panel.querySelector('#paid');
  const status = panel.querySelector('[role=status]');
  diagnostic?.record('paid-click');
  button.disabled = true;
  status.textContent = 'Submitting verification request';
  try {
    const response = await fetch(endpoint + '/verify', {method:'POST', signal:AbortSignal.timeout(10000)});
    if (!response.ok) throw new Error();
    diagnostic?.record('request-ok');
    pending();
  } catch {
    diagnostic?.record('request-failed');
    status.textContent = 'Unable to submit or checkout expired. Please retry.';
    button.disabled = false;
  }
}
(async () => {
  try {
    const response = await fetch(endpoint);
    if (!response.ok) throw new Error();
    order = await response.json();
    showOrder();
  } catch {
    panel.textContent = 'Checkout unavailable or expired.';
  }
})();
