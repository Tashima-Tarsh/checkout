'use strict';

const $ = id => document.getElementById(id);
let session;
let launchSession;
let qrUrl;

function log(message) {
  $('log').textContent = message;
}

async function api(path, {method = 'GET', body, token, image = false} = {}) {
  const headers = {};
  if (token) headers.Authorization = 'Bearer ' + token;
  if (body) headers['Content-Type'] = 'application/json';
  const response = await fetch(path, {method, headers, body: body && JSON.stringify(body)});
  if (image && response.ok) return response.blob();
  const result = await response.json();
  if (!response.ok) throw Error(typeof result.detail === 'string' ? result.detail : 'Check the session details.');
  return result;
}

function path(s) {
  return '/api/sessions/' + encodeURIComponent(s.session_id);
}

function render(update, target) {
  if (session !== target) return;
  Object.assign(session, update);
  $('pay').hidden = false;
  $('info').textContent = '₹' + (session.amount_paise / 100).toFixed(2) + ' to ' + session.vpa;
  $('state').textContent = session.state.replaceAll('_', ' ') + ' · Debit unverified';
  $('demo').hidden = !session.synthetic_enabled;
  if (session.payment_uri) $('launch').href = session.payment_uri;
  updateTimer();
}

function updateTimer() {
  if (!session) return;
  const remaining = Math.max(0, Math.ceil(session.expires - Date.now() / 1000));
  $('timer').textContent = remaining ? 'Session expires in ' + remaining + 's' : 'Session expired';
  if (!remaining || session.state === 'EXPIRED') {
    $('launch').removeAttribute('href');
    $('qr').hidden = true;
    $('claim').disabled = true;
    $('demo').disabled = true;
  }
}

async function observe(event, target = session) {
  if (!target || target !== session) return;
  try {
    render(await api(path(target) + '/observe', {
      method: 'POST', token: target.token, body: {event}
    }), target);
  } catch (error) {
    log(error.message);
  }
}

async function refresh() {
  const target = session;
  if (!target) return;
  try {
    render(await api(path(target), {token: target.token}), target);
  } catch (error) {
    log(error.message);
  }
}

$('mode').onchange = () => { $('mccRow').hidden = $('mode').value !== 'P2M'; };
$('form').onsubmit = async event => {
  event.preventDefault();
  const submit = event.submitter || $('form').querySelector('button');
  submit.disabled = true;
  try {
    const request = {
      mode: $('mode').value,
      vpa: $('vpa').value.trim(),
      name: $('name').value.trim(),
      amount_paise: Math.round(Number($('amount').value) * 100),
      mcc: $('mode').value === 'P2M' ? $('mcc').value || null : null
    };
    const created = await api('/api/sessions', {method: 'POST', body: request});
    if (qrUrl) URL.revokeObjectURL(qrUrl);
    $('qr').removeAttribute('src');
    $('qr').hidden = true;
    $('claim').disabled = false;
    $('demo').disabled = false;
    session = created;
    launchSession = undefined;
    render(created, created);
    const image = await api(path(created) + '/qr.png', {token: created.token, image: true});
    qrUrl = URL.createObjectURL(image);
    $('qr').src = qrUrl;
    $('qr').hidden = false;
    updateTimer();
    log('Session started');
  } catch (error) {
    log(error.message);
  } finally {
    submit.disabled = false;
  }
};

$('launch').onclick = () => {
  if (!$('launch').hasAttribute('href')) return;
  launchSession = session;
  observe('UPI_LAUNCH_ATTEMPTED', launchSession);
};
function resume() {
  if (!launchSession) return;
  const target = launchSession;
  launchSession = undefined;
  observe('BROWSER_RESUMED', target);
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') resume();
});
window.addEventListener('pageshow', event => { if (event.persisted) resume(); });
$('claim').onclick = () => observe('PAYER_CLAIMED_PAID');
$('refresh').onclick = refresh;
$('demo').onclick = async () => {
  const target = session;
  if (!target?.synthetic_enabled) return;
  try {
    const options = {method: 'POST', token: target.token};
    const result = await api('/api/demo/sessions/' + encodeURIComponent(target.session_id) + '/issue-test-proof', options);
    const observation = await api(path(target) + '/proof', {...options, body: {receipt: result.receipt}});
    render(observation, target);
    log('Synthetic receipt: ' + observation.result);
  } catch (error) {
    log(error.message);
  }
};
setInterval(updateTimer, 1000);
setInterval(() => {
  if (session?.state !== 'EXPIRED' && document.visibilityState === 'visible') refresh();
}, 5000);
