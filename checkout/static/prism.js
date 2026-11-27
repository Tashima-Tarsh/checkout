/* ==========================================================================
   PRISM ENTERPRISE — JavaScript Utilities
   ========================================================================== */
'use strict';

const $ = id => document.getElementById(id);
const $$ = sel => document.querySelectorAll(sel);

const API_BASE = ''; // same-origin

async function api(path, { method = 'GET', body, token, headers = {} } = {}) {
  const h = { 'Content-Type': 'application/json', ...headers };
  if (token) h.Authorization = 'Bearer ' + token;
  const res = await fetch(API_BASE + path, {
    method, headers: h, cache: 'no-store',
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : {}; } catch (e) { data = { text }; }
  if (!res.ok) throw Error(data.detail || data.text || 'Request failed (' + res.status + ')');
  return data;
}

function inr(amount_paise) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR',
    minimumFractionDigits: 2, maximumFractionDigits: 2
  }).format(amount_paise / 100);
}

function formatTime(ts) {
  if (!ts) return '—';
  const d = new Date(ts * 1000);
  return d.toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

function badgeHtml(sev) {
  const map = {
    P2P: '<span class="badge badge-success">P2P</span>',
    P2M: '<span class="badge badge-info">P2M</span>',
    PAID: '<span class="badge badge-success">PAID</span>',
    PENDING: '<span class="badge badge-warning">PENDING</span>',
    EXPIRED: '<span class="badge badge-danger">EXPIRED</span>',
    REFUNDED: '<span class="badge badge-info">REFUNDED</span>',
    SETTLED: '<span class="badge badge-success">SETTLED</span>',
    ONLINE: '<span class="badge badge-success">ONLINE</span>',
    OFFLINE: '<span class="badge badge-danger">OFFLINE</span>',
    AUTH_REQUIRED: '<span class="badge badge-warning">AUTH REQ.</span>',
    ACTIVE: '<span class="badge badge-success">ACTIVE</span>',
    WARMUP: '<span class="badge badge-warning">WARMUP</span>',
    COOLING: '<span class="badge badge-warning">COOLING</span>',
    BLACKLISTED: '<span class="badge badge-danger">BLACKLISTED</span>'
  };
  return map[sev] || '<span class="badge badge-neutral">' + sev + '</span>';
}

function toast(msg, kind = 'info') {
  const el = document.createElement('div');
  el.className = 'alert alert-' + kind;
  el.textContent = msg;
  const container = document.getElementById('toast-container') || document.body;
  container.prepend(el);
  setTimeout(() => el.remove(), 5000);
  return el;
}

async function loadSession() {
  // placeholder for session check
  return null;
}

function showPage(pageId) {
  $$('.page').forEach(el => el.hidden = true);
  const target = document.getElementById(pageId);
  if (target) target.hidden = false;
  window.scrollTo(0, 0);
}

function navLinkActive() {
  const path = window.location.pathname.split('/').pop();
  $$('.nav-link').forEach(el => {
    const href = el.getAttribute('href');
    if (href && path.endsWith(href)) el.classList.add('active');
    else el.classList.remove('active');
  });
}

window.addEventListener('popstate', () => {
  const hash = window.location.hash || '#/';
  const page = hash.replace(/^#\/?/, '');
  if (page && document.getElementById(page)) showPage(page);
});

export { $, $$, api, inr, formatTime, badgeHtml, toast, loadSession, showPage, navLinkActive };
