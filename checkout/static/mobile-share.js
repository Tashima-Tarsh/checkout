'use strict';
const $e = id => document.getElementById(id);
async function sendEvidence(url, body) {
  if (!session || session.state === 'EXPIRED') throw Error('Start an active checkout first.');
  const response = await fetch(url,{
    method:'POST',headers:{Authorization:'Bearer '+session.token},body,cache:'no-store'
  });
  const result = await response.json();
  if (!response.ok) throw Error(result.detail || 'Unable to attach evidence');
  return result;
}
$e('submitEvidence').addEventListener('click',async()=>{
  const btn=$e('submitEvidence'),status=$e('evidenceStatus');
  const text=$e('evidenceText').value.trim();
  const file=$e('evidenceFile').files[0];
  if ((!text&&!file)||(text&&file)){
    status.textContent='Choose one: paste text OR select a file.';return;
  }
  const form=new FormData();
  form.set('source',file?'receipt_upload':$e('evidenceSource').value);
  if(file) form.set('file',file);
  else form.set('text',text);
  btn.disabled=true;
  try{
    const r=await sendEvidence('/api/sessions/'+encodeURIComponent(session.session_id)+'/evidence',form);
    status.textContent=r.duplicate?'Already attached to this session.':'Item attached — payer-submitted, debit still unverified.';
    $e('evidenceText').value='';$e('evidenceFile').value='';
  }catch(e){status.textContent=e.message;}finally{btn.disabled=false;}
});
