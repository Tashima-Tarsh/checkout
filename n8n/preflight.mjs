// Read-only configuration check; sends synthetic dispatch probes, not payments.
import { randomUUID } from 'node:crypto';
const canonical = process.env.AGENTIC_N8N_TOKEN;
const legacy = process.env.N8N_TOKEN;
const valid = /^[A-Za-z0-9_-]{43,128}$/.test(canonical ?? '');
console.log(JSON.stringify({canonicalTokenConfigured:valid, legacyTokenConfigured:Boolean(legacy), legacyMatchesCanonical:legacy && canonical ? legacy === canonical : null, regularMode:process.env.EXECUTIONS_MODE === 'regular'}));
if (!valid) throw new Error('Canonical AGENTIC_N8N_TOKEN missing or invalid');
const endpoint = 'http://127.0.0.1:5678/webhook/agentic-pay-dispatch';
const order_id = 'uat-probe-' + randomUUID();
async function probe(auth) {
  const start = performance.now();
  const response = await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json',...(auth?{Authorization:'Bearer '+canonical}:{})},body:JSON.stringify({order_id,account_id:'uat-probe'}),signal:AbortSignal.timeout(10000),redirect:'error'});
  const elapsedMs = Math.round(performance.now()-start);
  if (!auth) {
    console.log(JSON.stringify({probe:'unauthenticated',status:response.status,elapsedMs}));
    if (![401,403].includes(response.status)) throw new Error('Unauthenticated dispatch not rejected');
    return;
  }
  const result = response.ok ? await response.json() : null;
  const correlatedPending = result?.order_id === order_id && result?.status === 'PENDING';
  console.log(JSON.stringify({probe:'authenticated',status:response.status,elapsedMs,correlatedPending}));
  if (!response.ok || !correlatedPending) throw new Error('Canonical credential or dispatch contract check failed');
}
await probe(false);
await probe(true);
