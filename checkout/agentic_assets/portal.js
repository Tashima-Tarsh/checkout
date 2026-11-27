const $ = (id) => document.getElementById(id);
const page = location.pathname.slice(1);
document.body.dataset.workspace=page;
let token;
async function call(path, options = {}) {
  const headers = token ? {Authorization: 'Bearer ' + token} : {};
  if (options.body) headers['Content-Type'] = options.csv ? 'text/csv' : 'application/json';
  const response = await fetch('/api' + path, {...options, headers});
  const result = response.status === 204 ? null : await response.json();
  if (!response.ok) throw new Error(result.detail || 'Request failed');
  return result;
}
let recentOrders=[];
const money=n=>new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR'}).format(n/100);
const date=n=>n?new Date(n*1000).toLocaleString('en-IN'):'—';
function table(id,rows,describe,empty,cols){
 const body=$(id);body.replaceChildren();
 for(const row of rows){const tr=document.createElement('tr');for(const v of describe(row)){const td=document.createElement('td');if(v instanceof Node)td.append(v);else td.textContent=String(v??'—');tr.append(td)}body.append(tr)}
 if(!rows.length){const tr=document.createElement('tr'),td=document.createElement('td');td.colSpan=cols;td.className='empty';td.textContent=empty;tr.append(td);body.append(tr)}
}
function orderLink(row){const a=document.createElement('a');a.href='/checkout/'+encodeURIComponent(row.id);a.textContent='Open checkout ↗';return a}
function filtered(){const q=$('order-search').value.toLowerCase(),s=$('order-filter').value;return recentOrders.filter(r=>r.id.toLowerCase().includes(q)&&(!s||(s==='EXPIRED'?r.status==='AWAITING_PAYMENT'&&r.expires<=Date.now()/1000:r.status===s&&(s!=='AWAITING_PAYMENT'||r.expires>Date.now()/1000))))}
function renderOrders(){table('orders',filtered(),r=>[r.id,date(r.created),money(r.amount_minor),r.status==='AWAITING_PAYMENT'&&r.expires<=Date.now()/1000?'EXPIRED':(r.settlement?.state||r.status),orderLink(r)],'No matching orders.',5)}
function view(name){const root=$(page);if(!root)return;const target=root.querySelector('[id="view-'+name+'"]');if(!target){if(page==='merchant'&&name==='agentmonitor')location.href='/agents';return}root.querySelectorAll('.view').forEach(v=>{v.hidden=v!==target;v.classList.toggle('active',v===target)});document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===name));document.body.dataset.currentView=name;const button=[...$(page+'-nav').querySelectorAll('[data-view]')].find(b=>b.dataset.view===name);if(button)$('heading').textContent=(button.querySelector('span')||button).textContent.trim();$('appSide').classList.remove('open');$('sideBackdrop').hidden=true;$('sideToggle').setAttribute('aria-expanded','false')}
async function refresh(){
 if(page==='owner'){const rows=await call('/owner/merchants');table('merchants',rows,r=>[r.name,r.id],'No merchants registered.',2);$('ownerCount').textContent=rows.length;await refreshOwnerTab(document.body.dataset.currentView||'overview')}
 else if(page==='agents'){const rows=await call('/agents');table('agent-list',rows,r=>[r.agent_id,r.vpa,r.bank,'•••• '+r.last4,r.state,date(r.expires)],'No agents registered.',6);$('agentCount').textContent=rows.length;$('agentAuth').textContent=rows.filter(r=>r.state==='AUTH_REQUIRED').length}
 else {const [accounts,orders]=await Promise.all([call('/accounts'),call('/orders')]);recentOrders=orders;table('accounts',accounts,r=>[r.vpa,r.holder,r.bank,'•••• '+r.last4,r.state],'No receiving accounts registered.',5);renderOrders();$('new-order').elements.account_id.replaceChildren(...accounts.map(r=>new Option(r.vpa,r.id)));$('metricAccounts').textContent=accounts.length;$('metricOrders').textContent=orders.length;$('metricPending').textContent=orders.filter(r=>r.status==='PENDING').length;$('metricVolume').textContent=money(orders.reduce((n,r)=>n+r.amount_minor,0));$('order-summary').textContent=orders.length?'Recent requests: '+orders.filter(r=>r.status==='PENDING').length+' pending · '+orders.filter(r=>r.status==='AWAITING_PAYMENT').length+' awaiting payment.':'No payment requests yet.';$('pending-bar').style.width=(orders.length?orders.filter(r=>r.status==='PENDING').length/orders.length*100:0)+'%';$('intelligence-summary').textContent=orders.length+' recent payment requests. Verification states come from the server ledger.'}
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
  $('login-panel').hidden = false;
  $('landing').hidden = true;
  async function openWorkspace() {
    await refresh();
    $('login-panel').hidden = true;
    $('top-brand').hidden=true; $('top-crumb').hidden=false;
    $('appSide').hidden=false; $('sideToggle').hidden=false; $('refresh').hidden=false;
    $(page+'-nav').hidden=false; $('workspace-name').textContent=page==='owner'?'Platform Owner':page==='agents'?'Agent Operations':'Merchant Workspace';
    $('workspace').hidden = false;
    $(page).hidden = false;
    view(page==='owner' && location.hash==='#androidworkspace'?'androidworkspace':page==='agents'?'agentmonitor':'overview');
    if(page==='owner') refreshAndroidRuntime();
  }
  submit('email-sign-in', async (data) => {
    token = undefined;
    await call('/auth/login', {method: 'POST', body: JSON.stringify(data)});
    await openWorkspace();
  }, 'Workspace opened.');
  submit('sign-in', async (data) => {
    token = data.token;
    try { await openWorkspace(); } catch (error) { token = undefined; throw error; }
  }, 'Workspace opened.');
  openWorkspace().catch(() => {});
  $('logout').onclick = async () => {
    try {
      await call('/auth/logout', {method: 'POST'});
      location.reload();
    } catch (error) {
      $('status').textContent = error.message;
    }
  };
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
  if (!Number.isSafeInteger(Number(amount)) || Number(amount) < 1) throw new Error('Enter a whole rupee amount.');
  const row = await call('/orders', {method: 'POST', body: JSON.stringify({amount_minor: Math.round(Number(amount) * 100), account_id, shared_amount: true})});
  const link = document.createElement('a');
  link.href = row.checkout_path;
  link.textContent = new URL(row.checkout_path, location.origin).href;
  $('checkout-link').replaceChildren(link);
  await refresh();
}, 'Checkout link created.');

document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>{view(b.dataset.view);if(page==='owner')refreshOwnerTab(b.dataset.view)}));
$('sideToggle').onclick=()=>{const open=$('appSide').classList.toggle('open');$('sideBackdrop').hidden=!open;$('sideToggle').setAttribute('aria-expanded',String(open))};
$('sideBackdrop').onclick=()=>{$('appSide').classList.remove('open');$('sideBackdrop').hidden=true;$('sideToggle').setAttribute('aria-expanded','false')};
$('refresh').onclick=async()=>{try{await refresh();$('status').textContent='Workspace refreshed.'}catch(e){$('status').textContent=e.message}};
$('order-search').oninput=renderOrders;$('order-filter').onchange=renderOrders;
function download(name,text){const url=URL.createObjectURL(new Blob([text],{type:'text/csv'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
$('download-template').onclick=()=>download('agentic-accounts.csv','upi_id,account_holder,bank_name,receiving_account_number,registered_mobile,account_type,mcc\n');
$('export-orders').onclick=()=>download('agentic-recent-orders.csv','order_id,amount_minor,status,created\n'+filtered().map(r=>[r.id,r.amount_minor,r.status,r.created].join(',')).join('\n'));
$('check-health').onclick=async()=>{try{const r=await fetch('/healthz');const x=await r.json();$('health-result').textContent=r.ok&&x.ok?'Application healthy. Financial verification: '+x.verification:'Health unavailable.'}catch{$('health-result').textContent='Health unavailable.'}};

async function refreshAndroidRuntime(){
 const el=$('android-runtime-status'); if(!el || page!=='owner') return;
 try { const link=$('android-provider-display');if(link){link.hidden=true;link.removeAttribute('href');} const res=await fetch('/api/android/workspace/status',{cache:'no-store'}); if(!res.ok){el.textContent='Sign in with your existing email and password to check device status.';return;} const data=await res.json();el.textContent=data.connected?'Genymotion device online':data.state.replaceAll('_',' ');if(link){link.hidden=!data.connected||!data.display_url;if(!link.hidden)link.href=data.display_url;else link.removeAttribute('href');} } catch {el.textContent='Device status unavailable';}
}
$('android-refresh').addEventListener('click',refreshAndroidRuntime);

async function refreshOwnerTab(name){
 const note=$('owner-note-'+name),body=$('owner-data-'+name),head=$('owner-head-'+name);
 if(name!=='overview'&&!note){if(name==='androidworkspace')await refreshAndroidRuntime();return;}
 try{
  const result=await call('/owner/dashboard/'+name);
  if(name==='overview'){const el=$('owner-summary');if(el)el.textContent=result.rows.reduce((n,r)=>n+r.count,0)+' payment requests · '+money(result.rows.reduce((n,r)=>n+(r.requested_minor||0),0))+' requested (not confirmed receipts)';return;}
  note.textContent=result.note;head.replaceChildren();body.replaceChildren();
  const keys=Object.keys(result.rows[0]||{});
  if(!keys.length){const tr=document.createElement('tr'),td=document.createElement('td');td.textContent='No matching records.';tr.append(td);body.append(tr);return;}
  const tr=document.createElement('tr');for(const key of keys){const th=document.createElement('th');th.textContent=key.replaceAll('_',' ');tr.append(th)}head.append(tr);
  table('owner-data-'+name,result.rows,r=>keys.map(k=>k.endsWith('_minor')&&r[k]!=null?money(r[k]):['created','updated','expires','retry_at'].includes(k)?date(r[k]):r[k]),'No matching records.',keys.length);
 }catch(e){if(note){note.textContent=e.message;body.replaceChildren();head.replaceChildren();}else if($('owner-summary'))$('owner-summary').textContent=e.message;}
}
