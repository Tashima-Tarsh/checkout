const $ = (id) => document.getElementById(id);
const page = location.pathname.slice(1);
let token;
async function call(path, options = {}) {
  const headers = {Authorization: 'Bearer ' + token};
  if (options.body) headers['Content-Type'] = options.csv ? 'text/csv' : 'application/json';
  const response = await fetch('/api' + path, {...options, headers});
  const result = await response.json();
  if (!response.ok) throw new Error(result.detail || 'Request failed');
  return result;
}
function list(id, rows, describe, empty) {
  $(id).replaceChildren(...(rows.length ? rows.map(describe) : [empty]).map((value) => {
    const item = document.createElement('li');
    item.textContent = value;
    return item;
  }));
}
async function refresh() {
  if (page === 'owner') {
    list('merchants', await call('/owner/merchants'), (row) => row.name, 'No merchants registered.');
  } else if (page === 'agents') {
    list('agent-list', await call('/agents'), (row) => row.agent_id + ' · ' + row.state, 'No agents registered.');
  } else {
    const [accounts, orders] = await Promise.all([call('/accounts'), call('/orders')]);
    list('accounts', accounts, (row) => row.vpa + ' · ' + row.bank + ' · •••• ' + row.last4, 'No receiving accounts registered.');
    list('orders', orders, (row) => row.id + ' · ₹' + (row.amount_minor / 100).toFixed(2) + ' · ' + row.status, 'No checkout links created.');
    $('new-order').elements.account_id.replaceChildren(...accounts.map((row) => new Option(row.vpa, row.id)));
  }
}
function submit(id, action, success) {
  $(id).addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('button');
    button.disabled = true;
    $('status').textContent = '';
    try {
      await action(Object.fromEntries(new FormData(form)));
      form.reset();
      $('status').textContent = success;
    } catch (error) {
      $('status').textContent = error.message;
    } finally {
      button.disabled = false;
    }
  });
}
if (['owner', 'merchant', 'agents'].includes(page)) {
  $('heading').textContent = {owner: 'Platform owner', merchant: 'Merchant workspace', agents: 'Agent management'}[page];
  $('intro').hidden = true;
  $('sign-in').hidden = false;
  submit('sign-in', async (data) => {
    token = data.token;
    try { await refresh(); } catch (error) { token = undefined; throw error; }
    $('sign-in').hidden = true;
    $('workspace').hidden = false;
    $(page).hidden = false;
  }, 'Workspace opened.');
  $('logout').onclick = () => location.reload();
}
submit('new-merchant', async (data) => {
  const row = await call('/owner/merchants', {method: 'POST', body: JSON.stringify(data)});
  $('new-token').textContent = 'Copy this merchant token now. It is shown once. ' + row.token;
  await refresh();
}, 'Merchant created.');
submit('account', async (data) => {
  await call('/accounts', {method: 'POST', body: JSON.stringify([data])});
  await refresh();
}, 'Account registered.');
submit('import', async ({file}) => {
  await call('/accounts/import', {method: 'POST', body: file, csv: true});
  await refresh();
}, 'Accounts imported.');
submit('new-order', async ({amount, account_id}) => {
  const row = await call('/orders', {method: 'POST', body: JSON.stringify({amount_minor: Math.round(Number(amount) * 100), account_id})});
  const link = document.createElement('a');
  link.href = row.checkout_path;
  link.textContent = new URL(row.checkout_path, location.origin).href;
  $('checkout-link').replaceChildren(link);
  await refresh();
}, 'Checkout link created.');
