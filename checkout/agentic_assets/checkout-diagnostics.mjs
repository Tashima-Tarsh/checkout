// Explicitly enabled, first-party diagnostic. No network, storage, screen,
// clipboard reads, app enumeration, identifiers or financial assertions.
const allowed = new Set(['start','copy-ok','copy-failed','hidden','visible',
  'blur','focus','pagehide','pageshow','freeze','resume','paid-click',
  'request-ok','request-failed','stop']);
export function createTrace(clock = () => performance.now()) {
  let start = null, events = [], active = false;
  return {
    start() { start = clock(); events = [{event:'start',ms:0}]; active = true; },
    record(event) {
      if (!active || !allowed.has(event) || event === 'start') return;
      const ms = Math.round(clock()-start);
      if (!Number.isFinite(ms) || ms < 0 || ms >= 90000 || events.length >= 127) {
        active = false; return;
      }
      events.push({event,ms});
      if (event === 'stop') active = false;
    },
    snapshot() {
      return {active, events:events.map(e=>({...e})), financially_verified:false,
        scope:'FIRST_PARTY_BROWSER_ONLY'};
    }
  };
}
export function mountDiagnostics({doc=document,win=window,host,trace=createTrace()}={}) {
  const section=doc.createElement('section');
  const label=doc.createElement('p');
  label.textContent='Research diagnostics: local browser events only. No other app data, payment proof or automatic upload.';
  const start=doc.createElement('button'), stop=doc.createElement('button');
  start.textContent='Start 90-second diagnostic'; stop.textContent='Stop diagnostic';
  start.type=stop.type='button'; start.className=stop.className='secondary';
  const output=doc.createElement('pre'); output.style.whiteSpace='pre-wrap';
  output.style.overflowWrap='anywhere'; output.style.maxHeight='220px'; output.style.overflow='auto';
  const render=()=>{output.textContent=JSON.stringify(trace.snapshot(),null,2);};
  const record=event=>{trace.record(event);render();};
  const listeners=[];
  const listen=(target,event,fn)=>{target.addEventListener(event,fn);listeners.push(()=>target.removeEventListener(event,fn));};
  let timer=null;
  const finish=()=>{if(timer!==null){win.clearTimeout(timer);timer=null;}record('stop');};
  listen(start,'click',()=>{finish();trace.start();render();timer=win.setTimeout(finish,90000);});
  listen(stop,'click',finish);
  listen(doc,'visibilitychange',()=>record(doc.visibilityState==='hidden'?'hidden':'visible'));
  for(const event of ['freeze','resume']) listen(doc,event,()=>record(event));
  for(const event of ['blur','focus','pagehide','pageshow']) listen(win,event,()=>record(event));
  section.append(label,start,stop,output);host.append(section);render();
  return {record,dispose(){finish();listeners.forEach(fn=>fn());section.remove();}};
}
