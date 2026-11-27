'use strict';

const $ = id => document.getElementById(id);
let token = null;

function log(message) {
  const el = $('log');
  if (el) el.textContent = message;
}

async function adminJson(url, init = {}) {
  const headers = token ? {Authorization: 'Bearer ' + token} : {};
  if (init.body && !(init.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(init.body);
  }
  const response = await fetch(url, {
    ...init,
    cache: 'no-store',
    headers: {...headers, ...(init.headers || {})}
  });
  const data = await response.json();
  if (!response.ok) throw Error(data.detail || 'Request rejected');
  return data;
}

function money(n) {
  return new Intl.NumberFormat('en-IN', {style: 'currency', currency: 'INR'}).format(n / 100);
}

function statTile(label, value, note) {
  const tile = document.createElement('div');
  tile.className = 'stat-tile';
  tile.innerHTML = `
    <div class="stat-label">${label}</div>
    <div class="stat-value">${value}</div>
    <div class="stat-note">${note}</div>
  `;
  return tile;
}

async function loadDashboard() {
  if (!token) return;
  const target = $('overview');
  target.hidden = false;
  target.replaceChildren();
  try {
    const [data, appearance] = await Promise.all([
      adminJson('/api/admin/overview'),
      adminJson('/api/admin/appearance')
    ]);
    target.appendChild(statTile('Total checkouts', data.total_checkouts, 'All sessions'));
    target.appendChild(statTile('Active', data.active_checkouts, 'Not yet expired'));
    target.appendChild(statTile('Enabled routes', data.configured_recipient_routes, 'P2P / P2M'));
    target.appendChild(statTile('Callbacks', data.recorded_observations, 'Observations only'));
    target.appendChild(statTile('Real debits verified', '0', 'Never set true'));
    target.appendChild(statTile('States', JSON.stringify(data.states || {}), 'Session lifecycle'));

    $('brandName').value = appearance.brand_name;
    $('headline').value = appearance.headline;
    $('accent').value = appearance.accent;
    $('logoLetter').value = appearance.logo_letter;

    // Apply accent to live tokens
    document.documentElement.style.setProperty('--pdp-primary', appearance.accent);
    document.documentElement.style.setProperty('--pdp-primary-hover', shadeColor(appearance.accent, -15));
    document.documentElement.style.setProperty('--pdp-primary-soft', tintColor(appearance.accent, 90));
    log('Dashboard loaded. Financially verified: 0.');
  } catch (error) {
    target.textContent = error.message;
    log(error.message);
  }
}

$('loadDashboard').addEventListener('click', () => {
  token = $('adminToken').value.trim();
  if (!token) return;
  loadDashboard();
});

$('adminToken').addEventListener('input', () => {
  $('loadDashboard').disabled = !$('adminToken').value.trim();
});

$('adminTokenImport').addEventListener('input', () => {
  const btn = document.querySelector('#inventory button[type="submit"]');
  if (btn) btn.disabled = !$('adminTokenImport').value.trim() || !$('file').files[0];
});

$('file').addEventListener('change', () => {
  const btn = document.querySelector('#inventory button[type="submit"]');
  if (btn) btn.disabled = !$('adminTokenImport').value.trim() || !$('file').files[0];
});

$('appearanceForm').addEventListener('submit', async event => {
  event.preventDefault();
  const status = $('appearanceResult');
  const button = event.submitter;
  button.disabled = true;
  status.textContent = '';
  try {
    const payload = {
      brand_name: $('brandName').value.trim(),
      headline: $('headline').value.trim(),
      accent: $('accent').value,
      theme: 'light',
      logo_letter: $('logoLetter').value
    };
    const data = await adminJson('/api/admin/appearance', {method: 'PUT', body: payload});
    status.textContent = 'Appearance saved: ' + data.brand_name + '. Refresh the checkout page to see the theme.';
    document.documentElement.style.setProperty('--pdp-primary', data.accent);
    document.documentElement.style.setProperty('--pdp-primary-hover', shadeColor(data.accent, -15));
    document.documentElement.style.setProperty('--pdp-primary-soft', tintColor(data.accent, 90));
  } catch (error) {
    status.textContent = error.message;
  } finally {
    button.disabled = false;
  }
});

$('inventory').addEventListener('submit', async event => {
  event.preventDefault();
  const status = $('importResult');
  const button = event.submitter;
  const file = $('file').files[0];
  const t = $('adminTokenImport').value.trim();
  if (!file || !t) return;
  token = t;
  button.disabled = true;
  status.textContent = 'Validating inventory...';
  try {
    const form = new FormData();
    form.append('file', file);
    const response = await fetch('/api/admin/vpas/import', {
      method: 'POST',
      headers: {Authorization: 'Bearer ' + t},
      body: form,
      cache: 'no-store'
    });
    const result = await response.json();
    if (!response.ok) throw Error(result.detail || 'Import failed');
    status.textContent = 'Imported ' + result.imported + ' configured recipients. Inventory only — no debit verified.';
  } catch (error) {
    status.textContent = error.message;
  } finally {
    button.disabled = false;
  }
});

// Color helpers
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

// Android Workspace
$('openAndroidWorkspace').addEventListener('click', () => {
  if (!token) return;
  const result = $('androidWorkspaceResult');
  result.textContent = 'Opening Android Workspace...';
  fetch('/api/android/workspace/config', {
    headers: {'Authorization': 'Bearer ' + token, 'Cache-Control': 'no-store'}
  })
  .then(async r => {
    if (!r.ok) throw Error((await r.json()).detail || 'Failed to get workspace config');
    return r.json();
  })
  .then(cfg => {
    if (!cfg.host_connected) throw Error('Android host agent not connected');
    const wsUrl = window.location.origin.replace(/^http/, 'ws') + cfg.ws_url;
    const ws = new WebSocket(wsUrl, 'android-workspace');
    ws.onopen = () => {
      result.textContent = 'Android Workspace connected.';
      ws.close();
      window.location.href = '/android/workspace';
    };
    ws.onerror = () => {
      result.textContent = 'Unable to connect to Android Workspace. Host agent may be offline.';
    };
    ws.onmessage = (msg) => {
      try {
        const d = JSON.parse(msg.data);
        if (d.host_connected === false) {
          result.textContent = 'Android host agent is not connected.';
        }
      } catch {}
    };
  })
  .catch(error => {
    result.textContent = error.message;
  });
});
