// Local-only synthetic UAT; no API calls, clipboard reads or private device access.
import {classify} from './check.mjs';
const panel=document.querySelector('#stage');
panel.innerHTML='<h2>₹49.00 — simulated</h2><p>Research only. No valid payment address. Do not send money.</p><button class="primary" id="copy">Copy test identifier</button><button class="secondary" id="paid">I Have Paid (simulation)</button><button class="secondary" id="start">Start fresh observation</button><p role="status"></p><button class="secondary" id="save">Export local log</button><details><summary>Positive control only</summary><label>Synthetic canary <input id="canary" maxlength="36" autocomplete="off"></label><button class="secondary" id="control">Record explicit disclosure</button></details><pre id="log" style="white-space:pre-wrap;text-align:left;overflow-wrap:anywhere"></pre>';
let start=null,events=[];
const status=panel.querySelector('[role=status]');
function record(type,extra={}){
 if(start===null||performance.now()-start>120000||events.length>=1000)return false;
 events.push({type,elapsed_ms:Math.round(performance.now()-start),visibility:document.visibilityState,...extra});
 panel.querySelector('#log').textContent=JSON.stringify(events,null,2);return true;
}
panel.querySelector('#start').onclick=()=>{events=[];start=performance.now();record('start');status.textContent='120-second observation started.'};
document.addEventListener('visibilitychange',()=>record('visibility'));
window.addEventListener('focus',()=>record('focus'));
window.addEventListener('blur',()=>record('blur'));
panel.querySelector('#copy').onclick=async()=>{
 if(!record('copy_attempt')){status.textContent='Start a fresh observation first.';return}
 try{await navigator.clipboard.writeText('LAB-NOT-A-PAYMENT-ADDRESS');record('copy_success');status.textContent='Synthetic identifier copied.'}
 catch{record('copy_unavailable');status.textContent='Clipboard unavailable in this context.'}
};
panel.querySelector('#paid').onclick=()=>{status.textContent=record('simulated_paid')?'Simulated acknowledgment only — no financial verification.':'Observation expired or not started.'};
panel.querySelector('#control').onclick=()=>{const input=panel.querySelector('#canary');if(/^LAB-[a-f0-9]{32}$/.test(input.value))record('explicit_positive_control',{canary:input.value});input.value=''};
panel.querySelector('#save').onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify({version:3,events},null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='boundary-events.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};
