(()=>{'use strict';let s=null,launched=false;
const $=id=>document.getElementById(id),log=m=>$('log').textContent+='\n'+m;
const base=()=>'/api/sessions/'+encodeURIComponent(s.session_id);
const query=()=>'?token='+encodeURIComponent(s.token);
async function api(url,method='GET',body){const r=await fetch(url,{method,headers:{'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});const v=await r.json();if(!r.ok)throw Error(v.detail||'Failed');return v;}
function show(v){s={...s,...v};$('pay').hidden=false;$('info').textContent='₹'+(v.amount_paise/100).toFixed(2)+' to '+v.vpa+' ('+v.mode+')';$('qr').src=base()+'/qr.png'+query();$('launch').href=v.payment_uri;$('state').textContent=v.state+' · financially_verified=false';}
async function observe(event){if(!s)return;try{show(await api(base()+'/observe'+query(),'POST',{event}));log(event);}catch(e){log(e.message);}}
$('mode').onchange=()=>$('mccRow').hidden=$('mode').value!=='P2M';
$('form').onsubmit=async e=>{e.preventDefault();try{const amount_paise=Math.round(Number($('amount').value)*100);s=await api('/api/sessions','POST',{mode:$('mode').value,vpa:$('vpa').value.trim(),name:$('name').value.trim(),amount_paise,mcc:$('mode').value==='P2M'?($('mcc').value||null):null});show(s);$('log').textContent='Session started';}catch(e){log(e.message);}};
$('launch').onclick=()=>{launched=true;observe('UPI_LAUNCH_ATTEMPTED');};
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&launched){launched=false;observe('BROWSER_RESUMED');}});
window.addEventListener('pageshow',e=>{if(e.persisted&&launched){launched=false;observe('BROWSER_RESUMED');}});
$('claim').onclick=()=>observe('PAYER_CLAIMED_PAID');
$('refresh').onclick=async()=>{try{show(await api(base()+query()));}catch(e){log(e.message);}};
$('demo').onclick=async()=>{try{const p=await api('/api/demo/sessions/'+s.session_id+'/issue-test-proof'+query(),'POST');const v=await api(base()+'/proof'+query(),'POST',{receipt:p.receipt});show(v);log('Synthetic proof '+v.result+'; real debit NOT verified');}catch(e){log(e.message);}};
})();