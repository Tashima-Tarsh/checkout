// Standalone UI preview: synthetic records only, no network or persistence.
(()=>{'use strict';
const $=id=>document.getElementById(id), rows=new Map();
const status=message=>{if($('importVpaStatus'))$('importVpaStatus').textContent=message};
function view(name){document.querySelectorAll('.view').forEach(v=>{v.hidden=v.id!=='view-'+name;v.classList.toggle('active',!v.hidden)});document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===name));}
function render(){const table=$('vpaTable');if(!table)return;table.replaceChildren();for(const [key,a] of rows){const tr=document.createElement('tr');for(const value of [key,a.holderName,a.bankName+' / '+a.receivingLast4,'Not authenticated',a.agentId+' / Offline']){const td=document.createElement('td');td.textContent=value;tr.append(td)}const td=document.createElement('td'),b=document.createElement('button');b.type='button';b.className='btn small';b.textContent='Remove';b.onclick=()=>{rows.delete(key);render()};td.append(b);tr.append(td);table.append(tr)}if(!rows.size){const tr=document.createElement('tr'),td=document.createElement('td');td.colSpan=6;td.textContent='No synthetic accounts configured.';tr.append(td);table.append(tr)}}
let next=1;
function add(list){if(rows.size+list.length>1000||list.some(a=>rows.has(a.vpaAddress)))throw Error('Capacity or duplicate account');for(const a of list){rows.set(a.vpaAddress,{...a,registeredMobile:undefined,agentId:'AGENT-'+String(next++).padStart(4,'0')})}render();status(rows.size+' synthetic account configurations; no live agents connected.')}
document.querySelectorAll('[data-view],[data-switch]').forEach(b=>b.addEventListener('click',()=>view(b.dataset.view||b.dataset.switch)));
$('sideToggle')?.addEventListener('click',()=> $('appSide')?.classList.toggle('open'));
$('refreshVpas')?.addEventListener('click',render);
$('importVpaCsv')?.addEventListener('click',async()=>{try{const f=$('vpaCsvFile').files[0];if(!f)throw Error('Choose synthetic CSV');if(f.size>512*1024)throw Error('File too large');add(window.AgenticVpaImport.parseVpaCsv(await f.text()));$('vpaCsvFile').value=''}catch(e){status(e.message)}});
$('downloadVpaTemplate')?.addEventListener('click',()=>{const url=URL.createObjectURL(new Blob(['upi_id,account_holder,bank_name,account_type,mcc,registered_mobile,receiving_last4\nfixture@example,Test Account,Test Bank,PERSONAL,,0000000000,0123\n'],{type:'text/csv'}));const a=document.createElement('a');a.href=url;a.download='agentic-accounts-template.csv';a.click();URL.revokeObjectURL(url)});
document.querySelectorAll('form').forEach(f=>f.addEventListener('submit',e=>{e.preventDefault();status('Live backend not connected. Use synthetic CSV import for preview.');}));
view('vpas');render();
})();
