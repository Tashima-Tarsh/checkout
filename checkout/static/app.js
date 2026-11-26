'use strict';

// Payment UI is an observation client, NOT an authentic debit witness.
// Device (Android camera OCR / sound / color / barcode) reports evidence to
// the server; the server matches VPA+amount and sets financially_verified.
const $ = id => document.getElementById(id);
let session;
let refreshPending = false;
let copyDone = false;
let copyBtnTimeout = null;
const isAndroid = /Android/i.test(navigator.userAgent || '');

function log(message) {
  const el = $('log');
  if (el) el.textContent = message;
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

function sessionPath(sid) {
  return '/api/sessions/' + encodeURIComponent(sid);
}

function updateTimer() {
  if (!session) return;
  const remaining = Math.max(0, Math.ceil(session.expires - Date.now() / 1000));
  const timer = $('timer');
  if (timer) timer.textContent = remaining ? 'Session expires in ' + remaining + 's' : 'Session expired';
  if (!remaining || session.state === 'EXPIRED') {
    const refreshStatus = $('refreshStatus');
    if (refreshStatus) refreshStatus.disabled = true;
  }
}

function render(update, target) {
  if (session !== target) return;
  Object.assign(session, update);
  document.querySelector('.shell').classList.add('has-session');

  const detailPanel = document.querySelector('section[aria-label="Payment details"]');
  if (detailPanel) detailPanel.hidden = false;

  $('labelUpid').textContent = 'UPI ID (receive)';
  const upid = $('upid-display');
  if (upid) upid.textContent = session.vpa || '—';

  $('labelAmount').textContent = 'Amount (₹)';
  $('amount-display').textContent = (session.amount_paise / 100).toFixed(2);

  $('labelMode').textContent = 'Type';
  const modeDisplay = $('mode-display');
  if (modeDisplay) {
    modeDisplay.textContent = session.mode || '—';
    modeDisplay.className = 'mode-display';
    modeDisplay.style.background = 'rgba(255, 90, 42, 0.12)';
    modeDisplay.style.color = 'var(--pdp-primary)';
    modeDisplay.style.borderColor = 'rgba(255, 90, 42, 0.25)';
  }

  $('labelMcc').textContent = 'Merchant category (MCC)';
  $('mcc-display').textContent = session.mcc ? session.mcc + ' · optional metadata' : 'Not set';

  $('notice').textContent = 'Copy the UPI ID above, then pay from your own UPI app. Return here when done.';
  updateTimer();

  // Android native launch button
  const launchBtn = $('launchUpi');
  const launchField = document.querySelector('.android-launch');
  if (isAndroid && launchBtn && launchField) {
    launchField.hidden = false;
    launchBtn.disabled = !copyDone;
    launchBtn.textContent = copyDone ? 'Launch UPI Payment' : 'Copy UPI ID first';
  }
}

function updateState(update) {
  if (!session) return;
  Object.assign(session, update);
  const stateEl = $('state');
  if (stateEl) stateEl.textContent = (session.state || 'AWAITING_PAYMENT').replaceAll('_', ' ') + ' · Debit unverified';

  const detail = $('verificationStatus');
  if (detail) {
    if (session.financially_verified) {
      detail.innerHTML = '<strong style="color:var(--pdp-secondary)">Device evidence verified by server match.</strong>';
      detail.className = 'status-detail';
    } else if (session.state === 'BROWSER_RETURNED') {
      detail.innerHTML = '<strong style="color:var(--pdp-accent)">Returned from app — awaiting device evidence match.</strong>';
      detail.className = 'status-detail';
    } else {
      detail.innerHTML = 'Awaiting device verification evidence.';
      detail.className = 'status-detail muted';
    }
  }
  updateTimer();

  const receipt = $('receipt');
  if (receipt && session.financially_verified && !receipt.hidden) {
    receipt.hidden = false;
    $('receiptAmount').textContent = (session.amount_paise / 100).toFixed(2) + ' ₹';
    $('receiptPayee').textContent = session.vpa || '—';
    $('receiptTime').textContent = new Date().toLocaleString('en-IN');
  }
}

async function loadSession() {
  const sid = location.pathname.split('/').pop();
  if (!sid || sid === 'checkout') return;
  try {
    const created = await api(sessionPath(sid));
    session = created;
    render(created, created);
    updateState({});
    if (session.state !== 'EXPIRED') {
      setInterval(() => refresh(), 5000);
    }
  } catch (error) {
    log(error.message);
    const notice = $('notice');
    if (notice) notice.textContent = 'Checkout unavailable or expired.';
  }
}

async function copyUpiId() {
  if (!session) return;
  try {
    await navigator.clipboard.writeText(session.vpa);
    copyDone = true;
    const btn = $('copyUpid');
    if (btn) {
      btn.textContent = '✓ Copied';
      btn.style.background = 'var(--pdp-secondary)';
      btn.style.color = 'var(--pdp-surface)';
      btn.style.borderColor = 'rgba(0, 212, 170, 0.3)';
      btn.disabled = true;
    }
    log('UPI ID copied to clipboard');

    try {
      await api(sessionPath(session.session_id) + '/copy', {method: 'POST', token: session.token});
      log('Copy event recorded.');
    } catch (e) {
      log('Copy event recording failed: ' + e.message);
    }

    const launchBtn = $('launchUpi');
    if (launchBtn) {
      launchBtn.disabled = false;
      launchBtn.textContent = 'Launch UPI Payment';
    }

    if (copyBtnTimeout) clearTimeout(copyBtnTimeout);
    copyBtnTimeout = setTimeout(() => {
      if (btn) {
        btn.textContent = 'Copied';
        btn.style.background = 'var(--pdp-secondary)';
      }
    }, 1400);
  } catch (err) {
    log('Unable to copy. Please retry.');
    alert('Unable to copy to clipboard. Please copy the UPI ID manually.');
  }
}

async function launchUpiPayment() {
  if (!session || !copyDone) return;
  const tr = session.session_id;
  const pa = session.vpa;
  const am = (session.amount_paise / 100).toFixed(2);
  const pn = session.name || 'Payee';
  const serverUrl = window.location.origin;
  const upiUri = 'upi://pay?pa=' + encodeURIComponent(pa) +
    '&am=' + encodeURIComponent(am) +
    '&tr=' + encodeURIComponent(tr) +
    '&pn=' + encodeURIComponent(pn) +
    '&session_id=' + encodeURIComponent(session.session_id) +
    '&token=' + encodeURIComponent(session.token) +
    '&server_url=' + encodeURIComponent(serverUrl);
  window.location.href = upiUri;
}

async function refresh() {
  if (!session || refreshPending) return;
  const target = session;
  refreshPending = true;
  try {
    const value = await api(sessionPath(target.session_id), {token: target.token});
    render(value, target);
    updateState({});
    if (value.state === 'EXPIRED') {
      const refreshStatus = $('refreshStatus');
      if (refreshStatus) refreshStatus.disabled = true;
    }
  } catch (error) {
    log(error.message);
  } finally {
    refreshPending = false;
  }
}

async function checkDebitEvidence() {
  if (!session) return;
  try {
    const evidence = await api(sessionPath(session.session_id) + '/debit-evidence', {token: session.token});
    if (evidence.financially_verified) {
      render(evidence, session);
      updateState(evidence);
      refreshPending = true;
      log('Payment verified by server match.');
    } else {
      render(evidence, session);
      updateState(evidence);
    }
  } catch (error) {
    log(error.message);
  }
}

$('copyUpid').addEventListener('click', copyUpiId);
const launchBtn = $('launchUpi');
if (launchBtn) launchBtn.addEventListener('click', launchUpiPayment);

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    void checkDebitEvidence();
  }
});
window.addEventListener('pageshow', () => { void checkDebitEvidence(); });
window.addEventListener('focus', () => { void checkDebitEvidence(); });

loadSession();

async function loadAppearance() {
  try {
    const data = await api('/api/appearance');
    const accent = /^#[0-9A-F]{6}$/i.test(data.accent || '') ? data.accent : '#FF5A2A';
    document.documentElement.style.setProperty('--pdp-primary', accent);
    document.documentElement.style.setProperty('--pdp-primary-hover', shadeColor(accent, -15));
    document.documentElement.style.setProperty('--pdp-primary-soft', tintColor(accent, 90));
    if ($('brandName')) $('brandName').textContent = data.brand_name;
    if ($('checkoutHeadline')) $('checkoutHeadline').textContent = data.headline;
  } catch (error) {
    log('Appearance unavailable; using defaults.');
  }
}
loadAppearance();

function shadeColor(color, percent) {
  const f = parseInt(color.slice(1), 16), t = percent < 0 ? 0 : 255, p = percent < 0 ? -percent : percent;
  const R = f >> 16, G = f >> 8 & 0x00FF, B = f & 0x00FF;
  const toHex = n => n.toString(16).padStart(2, '0');
  return '#' + toHex(Math.round((t - R) * p / 100 + R)) + toHex(Math.round((t - G) * p / 100 + G)) + toHex(Math.round((t - B) * p / 100 + B));
}
function tintColor(color, percent) {
  const f = parseInt(color.slice(1), 16), R = f >> 16, G = f >> 8 & 0x00FF, B = f & 0x00FF;
  const toHex = n => n.toString(16).padStart(2, '0');
  return '#' + toHex(Math.round((255 - R) * percent / 100 + R)) + toHex(Math.round((255 - G) * percent / 100 + G)) + toHex(Math.round((255 - B) * percent / 100 + B));
}
