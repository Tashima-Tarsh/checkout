
import {makeNonceCarrier,analyzeRoundTrip} from './nonce_carrier.mjs';
import {LiveCaptureProbe} from './live_capture_probe.mjs';
let carrier=null, startMs=0, trace=[];
const storageKey='pdep-nonce-carrier-lab-v1';
function persist(){
  try { sessionStorage.setItem(storageKey, JSON.stringify({carrier,trace})); } catch {}
}
function restore(){
  try {
    const saved=JSON.parse(sessionStorage.getItem(storageKey)||'null');
    if(saved?.carrier?.marker && Array.isArray(saved.trace)) {
      carrier=saved.carrier; trace=saved.trace;
      $('challenge').textContent='Restored challenge: '+carrier.note;
      $('handoff').disabled=false;
      $('trace').textContent=JSON.stringify(trace,null,2);
    }
  } catch {}
}
const $=id=>document.getElementById(id);
const stamp=(kind,extra={})=>{
  trace.push({kind,atMs:Date.now(),elapsedMs:startMs?Math.round(performance.now()-startMs):null,...extra});
  $('trace').textContent=JSON.stringify(trace,null,2);
  persist();
};
function nonce(){
  const bytes=crypto.getRandomValues(new Uint8Array(24));
  return Array.from(bytes,x=>x.toString(16).padStart(2,'0')).join('');
}
$('prepare').onclick=()=>{
  try {
    carrier=makeNonceCarrier({vpa:$('vpa').value.trim(),payeeName:$('payee').value.trim(),
      amount:$('amount').value.trim(),nonce:nonce()});
    trace=[];startMs=performance.now();
    $('challenge').textContent='Challenge note: '+carrier.note;
    $('handoff').disabled=false;stamp('CHALLENGE_CREATED');
  } catch(e){$('challenge').textContent=e.message;}
};
$('handoff').onclick=()=>{
  if(!carrier)return;
  stamp('HANDOFF_ATTEMPTED');$('status').textContent='Handoff attempted — return to inspect.';
  location.href=carrier.uri;
};
document.addEventListener('visibilitychange',()=>{
  stamp(document.hidden?'BROWSER_HIDDEN':'BROWSER_VISIBLE');
});
window.addEventListener('pagehide',()=>stamp('PAGEHIDE'));
window.addEventListener('pageshow',()=>stamp('PAGESHOW'));
$('paste').onclick=async()=>{
  try{$('evidence').value=await navigator.clipboard.readText();stamp('USER_CLIPBOARD_READ',{length:$('evidence').value.length});}
  catch(e){stamp('CLIPBOARD_DENIED',{name:e.name});$('assessment').textContent='Clipboard not available. You can paste manually.';}
};
$('assess').onclick=()=>{
  if(!carrier)return;
  const out=analyzeRoundTrip({marker:carrier.marker,copiedReceipt:$('evidence').value});
  $('assessment').textContent=out.status+' — Financial debit NOT verified';
  stamp('CLAIM_ASSESSED',{markerPresent:out.observed,debitVerified:false});
};
const capture=new LiveCaptureProbe({mediaDevices:navigator.mediaDevices,onEvent:e=>stamp('SCREEN_'+e.kind,{trackState:e.trackState,trackMuted:e.trackMuted})});
$('captureStart').onclick=async()=>{const result=await capture.start();$('captureStatus').textContent='Capture: '+result.status;};
$('captureStop').onclick=()=>{capture.stop();$('captureStatus').textContent='Capture stopped';};
document.addEventListener('visibilitychange',()=>capture.onDocumentVisibility(document.hidden));
restore();
$('export').onclick=()=>{
  const doc={experiment:'PDEP-NONCE-CARRIER-V1',browser:navigator.userAgent,
    trace,captureContinuity:capture.report(),correlationOnly:true,debitVerified:false};
  const blob=new Blob([JSON.stringify(doc,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;a.download='pdep-lab-trace.json';a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
};
