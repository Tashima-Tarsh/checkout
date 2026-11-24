// Explicitly opt-in, local-only diagnostics. No storage, network, clipboard reads,
// app identifiers, screenshots, payment fields or financial decisions.
const kinds = new Set(['start','stop','visible','hidden','pagehide','pageshow',
  'freeze','resume','copy_ok','copy_failed','paid_click','verify_ok','verify_failed']);
export function createTrace(clock = () => performance.now()) {
  let started = null, active = false, events = [], dropped = 0;
  function record(kind) {
    if (!active || !kinds.has(kind)) return false;
    const elapsed = clock() - started;
    if (!Number.isFinite(elapsed) || elapsed < 0 || elapsed >= 300000) {
      active = false; return false;
    }
    if (events.length >= 64) { dropped++; active = false; return false; }
    events.push({kind, ms: Math.floor(elapsed / 100) * 100});
    return true;
  }
  return {
    start() { started = clock(); events = []; dropped = 0; active = true; record('start'); },
    stop() { record('stop'); active = false; },
    record,
    snapshot() { return {schema:1, active, dropped,
      events:events.map(e=>({...e})), financially_verified:false}; }
  };
}
export function mountDiagnostics({doc=document, win=window, host=doc.querySelector('main')} = {}) {
  const trace = createTrace(() => win.performance.now());
  const root = doc.createElement('section');
  root.setAttribute('aria-label','Local research diagnostics');
  const title = doc.createElement('h2');
  title.textContent = 'Local research diagnostics';
  const notice = doc.createElement('p');
  notice.textContent = 'Optional test only. Records checkout events for up to five minutes in this page, without sending data. Do not make a payment just to test. No screenshots or debit proof.';
  const start = doc.createElement('button'); start.type='button'; start.className='secondary'; start.textContent='Start local trace';
  const stop = doc.createElement('button'); stop.type='button'; stop.className='secondary'; stop.textContent='Stop trace';
  const output = doc.createElement('textarea'); output.readOnly=true; output.rows=8;
  output.setAttribute('aria-label','Redacted local trace'); output.style.width='100%';
  function refresh() {
    const snapshot=trace.snapshot();
    output.value=JSON.stringify(snapshot,null,2);
    start.disabled=snapshot.active; stop.disabled=!snapshot.active;
  }
  function record(kind) { trace.record(kind); refresh(); }
  start.addEventListener('click',()=>{trace.start();refresh();});
  stop.addEventListener('click',()=>{trace.stop();refresh();});
  const listeners = [
    [doc,'visibilitychange',()=>record(doc.hidden?'hidden':'visible')],
    [doc,'freeze',()=>record('freeze')],[doc,'resume',()=>record('resume')],
    [win,'pagehide',()=>record('pagehide')],[win,'pageshow',()=>record('pageshow')]
  ];
  for (const [target,name,fn] of listeners) target.addEventListener(name,fn);
  root.append(title,notice,start,stop,output); host.append(root); refresh();
  return {record, dispose(){ trace.stop(); for(const [target,name,fn] of listeners)
    target.removeEventListener(name,fn); root.remove(); }};
}
