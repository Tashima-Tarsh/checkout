'use strict';

// Payment UI is an observation client, NOT an authentic debit witness.
const $ = id => document.getElementById(id);
let session;
let attempt;
let refreshPending = false;

function log(message) {
  $('log').textContent = message;
}
async function api(path, {method = 'GET', body, token, image = false} = {}) {
  const headers = {};
  if (token) headers.Authorization = 'Bearer ' + token;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await fetch(path, {
    method, headers, cache: 'no-store', body: body === undefined ? undefined : JSON.stringify(body)
  });
  if (image && response.ok) return response.blob();
  const result = await response.json();
  if (!response.ok) throw Error(typeof result.detail === 'string' ? result.detail : 'Request failed');
  return result;
}
function path(s) {
  return '/api/sessions/' + encodeURIComponent(s.session_id);
}
function updateTimer() {
  if (!session) return;
  const remaining = Math.max(0, Math.ceil(session.expires - Date.now() / 1000));
  $('timer').textContent = remaining ? 'Session expires in ' + remaining + 's' : 'Session expired';
  if (!remaining || session.state === 'EXPIRED') {
    $('copyUpid').disabled = true;
    $('claim').disabled = true;
    $('refresh').disabled = true;
    $('demo').disabled = true;
  }
}
function render(update, target) {
  if (session !== target) return;
  Object.assign(session, update);
  document.querySelector('.shell').classList.add('has-session');
  $('empty').hidden = true;
  $('pay').hidden = false;
  $('info').textContent = '₹' + (session.amount_paise / 100).toFixed(2) +
    ' · ' + session.vpa + ' · ' + session.mode +
    (session.mcc ? ' · MCC ' + session.mcc : '');
  $('state').textContent = session.state.replaceAll('_', ' ') + ' · Debit unverified';
  $('demo').hidden = !session.synthetic_enabled;
  updateTimer();
}
async function observe(event, target = session) {
  if (!target || target !== session) return;
  try {
    const value = await api(path(target) + '/observe', {
      method: 'POST', token: target.token, body: {event}
    });
    render(value, target);
    log(event + ' recorded; observation only — no debit verified');
  } catch (error) {
    log('Observation error: ' + error.message);
  }
}
async function refresh() {
  if (!session || refreshPending) return;
  const target = session;
  refreshPending = true;
  try {
    render(await api(path(target), {token: target.token}), target);
  } catch (error) {
    log(error.message);
  } finally {
    refreshPending = false;
  }
}
function syncPaymentFields() {
  const personal = $('mode').value === 'P2P';
  if (personal) $('destinationType').value = 'direct';
  $('destinationRow').hidden = personal;
  const routed = !personal && $('destinationType').value === 'route';
  $('vpaRow').hidden = routed;
  $('routeRow').hidden = !routed;
  $('vpa').required = !routed;
  $('routeKey').required = routed;
  $('mccRow').hidden = personal || routed;
  $('mcc').disabled = personal || routed;
}
$('mode').addEventListener('change', syncPaymentFields);
$('destinationType').addEventListener('change', syncPaymentFields);
syncPaymentFields();
$('form').addEventListener('submit', async event => {
  event.preventDefault();
  const submit = event.submitter || $('create');
  submit.disabled = true;
  try {
    const routed = $('destinationType').value === 'route';
    const amount = Number($('amount').value);
    const amount_paise = Math.round(amount * 100);
    if (!Number.isSafeInteger(amount_paise) || amount_paise < 100) throw Error('Invalid amount');
    const request = {
      mode: $('mode').value,
      vpa: routed ? null : $('vpa').value.trim(),
      route_key: routed ? $('routeKey').value.trim() : null,
      name: $('name').value.trim(),
      amount_paise,
      mcc: !routed && $('mode').value === 'P2M' ? ($('mcc').value.trim() || null) : null
    };
    const created = await api('/api/sessions', {method: 'POST', body: request});
    $('claim').disabled = false;
    $('copyUpid').disabled = false;
    $('refresh').disabled = false;
    $('copyUpid').textContent = 'Copy UPI ID';
    $('demo').disabled = false;
    session = created;
    attempt = undefined;
    render(created, created);
    updateTimer();
    log('Checkout ready. Copy UPI ID, pay from your UPI app, then return.');
  } catch (error) {
    log(error.message);
    alert(error.message);
  } finally {
    submit.disabled = false;
  }
});

// Browser return after copying is a lifecycle observation, never debit proof.
function markAway() {
  if (attempt && attempt.target === session) attempt.away = true;
}
function resume() {
  if (!attempt || !attempt.away || attempt.returned || attempt.target !== session) return;
  if (document.visibilityState !== 'visible') return;
  attempt.returned = true;
  observe('BROWSER_RESUMED', attempt.target);
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') markAway();
  else resume();
});
window.addEventListener('pagehide', markAway);
window.addEventListener('pageshow', resume);
window.addEventListener('focus', resume);

$('edit').addEventListener('click', () => document.querySelector('.shell').classList.remove('has-session'));
$('copyUpid').addEventListener('click', async () => {
  const target = session;
  if (!target || target.expires <= Date.now() / 1000) return;
  try {
    await navigator.clipboard.writeText(target.vpa);
    if (session !== target) return;
    attempt = {target, away: false, returned: false};
    await api(path(target) + '/copy', {method: 'POST', token: target.token});
    log('UPI ID copied. Debit remains unverified.');
    $('copyUpid').textContent = 'Copied UPI ID';
  } catch (error) {
    log('Copy unavailable: ' + error.message);
    alert('Copy unavailable. Select the UPI ID shown above and copy manually.');
  }
});
$('claim').addEventListener('click', () => observe('PAYER_CLAIMED_PAID'));
$('refresh').addEventListener('click', refresh);
$('demo').addEventListener('click', async () => {
  const target = session;
  if (!target?.synthetic_enabled) return;
  try {
    const options = {method: 'POST', token: target.token};
    const result = await api('/api/demo/sessions/' + encodeURIComponent(target.session_id) + '/issue-test-proof', options);
    const observation = await api(path(target) + '/proof', {...options, body: {receipt: result.receipt}});
    render(observation, target);
    log('Synthetic test receipt: REAL DEBIT UNVERIFIED');
  } catch (error) {
    log(error.message);
  }
});
setInterval(updateTimer, 1000);
setInterval(() => {
  if (session?.state !== 'EXPIRED' && document.visibilityState === 'visible') refresh();
}, 5000);

async function loadAppearance() {
  try {
    const data = await api('/api/appearance');
    const accent = /^#[0-9A-F]{6}$/i.test(data.accent || '') ? data.accent : '#4985FF';
    const theme = ['midnight', 'aurora', 'light'].includes(data.theme) ? data.theme : 'midnight';
    document.documentElement.style.setProperty('--accent', accent);
    document.documentElement.dataset.theme = theme;
    $('brandName').textContent = data.brand_name;
    $('brandIcon').textContent = data.logo_letter;
    $('checkoutHeadline').textContent = data.headline;
  } catch (error) {
    log('Appearance unavailable; using defaults.');
  }
}
loadAppearance();
