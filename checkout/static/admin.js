'use strict';
const $=id=>document.getElementById(id);
const sectionTitles={
 dashboard:['Overview','Your direct UPI operations at a glance.'],
 transactions:['Checkouts','Session activity and payer-side observations.'],
 routing:['VPA routing','Approved recipients and routing inventory.'],
 appearance:['Checkout Studio','Publish your brand experience.'],
 security:['Security','Access policies and mobile evidence handling.']
};
function showSection(view){
 if(!sectionTitles[view])return;
 document.querySelectorAll('.admin-nav button[data-view]').forEach(el=>el.classList.toggle('active',el.dataset.view===view));
 document.querySelectorAll('.admin-view').forEach(el=>el.classList.toggle('active',el.id==='view-'+view));
 $('workspaceTitle').textContent=sectionTitles[view][0];
 $('workspaceSubtitle').textContent=sectionTitles[view][1];
}
document.querySelectorAll('[data-view]').forEach(el=>el.addEventListener('click',()=>showSection(el.dataset.view)));
const authHeader=()=>({Authorization:'Bearer '+$('token').value});
async function adminJson(url,init={}){
 if(!$('token').value.trim())throw Error('Enter an admin access key.');
 const response=await fetch(url,{
  ...init,cache:'no-store',headers:{...authHeader(),...(init.headers||{})}
 });
 const data=await response.json();
 if(!response.ok)throw Error(typeof data.detail==='string'?data.detail:'Request failed');
 return data;
}
const setText=(id,text)=>{ $(id).textContent=String(text); };
const formatAmount=paise=>'₹'+(paise/100).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2});
function tableCell(row,value){
 const cell=document.createElement('td');
 cell.textContent=String(value??'—');
 row.appendChild(cell);return cell;
}
function renderSessions(target,items,append=false){
 const table=$(target);
 if(!append)table.replaceChildren();
 if(!items.length&&!append){
  const tr=document.createElement('tr');const td=document.createElement('td');td.colSpan=6;td.textContent='No checkout sessions yet';tr.appendChild(td);table.appendChild(tr);return;
 }
 for(const s of items){
  const tr=document.createElement('tr');
  tableCell(tr,s.session_id);
  tableCell(tr,s.mode);
  tableCell(tr,s.vpa);
  tableCell(tr,formatAmount(s.amount_paise));
  const td=tableCell(tr,s.state.replaceAll('_',' '));
  td.className='status-tag';
  tableCell(tr,new Date(s.expires*1000).toLocaleString());
  table.appendChild(tr);
 }
}
function renderRoutes(rows){
 const table=$('routeRows');table.replaceChildren();
 for(const r of rows){
  const tr=document.createElement('tr');
  [r.route_key,r.mode,r.vpa,r.mcc||'—',r.priority,r.enabled?'Enabled':'Disabled'].forEach(v=>tableCell(tr,v));
  table.appendChild(tr);
 }
 if(!rows.length){
  const tr=document.createElement('tr'),td=document.createElement('td');td.colSpan=6;td.textContent='No configured routes yet';tr.appendChild(td);table.appendChild(tr);
 }
}
let transactionOffset=0;
async function loadTransactions(append=false){
 const response=await adminJson('/api/admin/checkouts?limit=25&offset='+(append?transactionOffset:0));
 renderSessions('transactionRows',response.items,append);
 transactionOffset=append?transactionOffset+response.items.length:response.items.length;
 $('moreTransactions').hidden=response.items.length<25;
 return response.items;
}
async function connect(){
 const btn=$('loadDashboard');btn.disabled=true;setText('workspaceMessage','Connecting to your protected workspace…');
 try{
  const [data,appearance,sessions,routes]=await Promise.all([
   adminJson('/api/admin/overview'),
   adminJson('/api/admin/appearance'),
   adminJson('/api/admin/checkouts?limit=10&offset=0'),
   adminJson('/api/admin/vpas'),
  ]);
  setText('kpiTotal',data.total_checkouts);
  setText('kpiActive',data.active_checkouts);
  setText('kpiRoutes',data.configured_recipient_routes);
  setText('kpiEvents',data.recorded_observations);
  setText('overview','Checkout activity recorded on your existing PostgreSQL database.');
  setText('statusChart',Object.entries(data.states).map(([k,v])=>k.replaceAll('_',' ')+': '+v).join(' · ')||'No activity yet.');
  renderSessions('recentRows',sessions.items);
  renderSessions('transactionRows',sessions.items);
  transactionOffset=sessions.items.length;
  renderRoutes(routes);
  ['brand_name','headline','accent','theme','logo_letter'].forEach((name,i)=>{
   $( ['brandName','headline','accent','theme','logoLetter'][i]).value=appearance[name];
  });
  setText('workspaceMessage','Connected · Checkout and callback counts are not financial confirmation.');
 }catch(e){setText('workspaceMessage',e.message);}
 finally{btn.disabled=false;}
}
$('loadDashboard').addEventListener('click',connect);
$('moreTransactions').addEventListener('click',async()=>{
 try{await loadTransactions(true);}catch(e){setText('workspaceMessage',e.message);}
});
$('inventory').addEventListener('submit',async event=>{
 event.preventDefault();
 const file=$('file').files[0],btn=event.submitter;
 if(!file)return;
 const form=new FormData();form.append('file',file);
 btn.disabled=true;setText('result','Validating approved inventory…');
 try{
  const response=await fetch('/api/admin/vpas/import',{
   method:'POST',headers:authHeader(),body:form,cache:'no-store'
  });
  const data=await response.json();
  if(!response.ok)throw Error(data.detail||'Import failed');
  setText('result','Imported '+data.imported+' recipients; no payment is financially verified.');
  renderRoutes(await adminJson('/api/admin/vpas'));
 }catch(e){setText('result',e.message);}
 finally{btn.disabled=false;}
});
$('appearanceForm').addEventListener('submit',async event=>{
 event.preventDefault();
 const btn=event.submitter;btn.disabled=true;
 const data={
  brand_name:$('brandName').value.trim(),
  headline:$('headline').value.trim(),
  accent:$('accent').value,theme:$('theme').value,
  logo_letter:$('logoLetter').value
 };
 try{
  const result=await adminJson('/api/admin/appearance',{
   method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)
  });
  setText('appearanceResult','Published '+result.brand_name+' appearance. Refresh checkout to see the update.');
 }catch(e){setText('appearanceResult',e.message);}
 finally{btn.disabled=false;}
});
