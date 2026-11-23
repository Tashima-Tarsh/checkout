// Controlled, public data only. No payment or login pages.
const button = document.getElementById('run');
const status = document.getElementById('status');
const plugin = `
function main() {
  return div({}, [
    'Public HTTPS connectivity test: example.com only.',
    button({onclick: 'run'}, ['Generate public proof'])
  ]);
}
async function run() {
  try {
    const result = await prove({
      url: 'https://example.com/',
      method: 'GET',
      headers: { Host: 'example.com', 'Accept-Encoding': 'identity', Connection: 'close' }
    }, {
      verifierUrl: 'ws://localhost:7047',
      proxyUrl: 'ws://localhost:7047/proxy?token=example.com',
      maxSentData: 4096,
      maxRecvData: 16384,
      handlers: [
        {type:'SENT',part:'START_LINE',action:'REVEAL'},
        {type:'RECV',part:'STATUS_CODE',action:'REVEAL'}
      ]
    });
    await done({completed:true});
  } catch (_) {
    await done({completed:false});
  }
}
export default {main, run, config:{name:'Public HTTPS proof',description:'No financial or private data'}};
`;
button.addEventListener('click', async () => {
  if (typeof window.tlsn?.execCode !== 'function') {
    status.textContent = 'Official TLSNotary desktop extension unavailable.'; return;
  }
  button.disabled = true;
  const start = performance.now();
  status.textContent = 'Waiting for user-approved public proof experiment.';
  let timer;
  try {
    const result = await Promise.race([
      window.tlsn.execCode(plugin, {requestId: crypto.randomUUID()}),
      new Promise((_,reject) => { timer=setTimeout(() => reject(Error('deadline')),90000); })
    ]);
    const seconds = (performance.now()-start)/1000;
    status.textContent = seconds >= 90 ? 'Deadline exceeded.' :
      'Extension returned after ' + seconds.toFixed(1) + 's. Inspect the local verifier separately. No payment verified.';
  } catch (_) { status.textContent = 'Experiment did not complete within the 90-second budget or was rejected. No payment verified.'; }
  finally { clearTimeout(timer); button.disabled = false; }
});