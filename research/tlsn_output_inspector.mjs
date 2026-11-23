// Research adapter for TLSNotary's documented verifier output.
// This processes public, controlled test data only. It is not a proof verifier,
// not a webhook endpoint and must never receive raw payment credentials.
// Call only from an independently authenticated, server-controlled verifier.
// No production financial state is modified.
import { timingSafeEqual } from 'node:crypto';
export function inspectVerifierOutput({output, expectedSessionId, expectedHost, expectedRequestLine}) {
  const fail = reason => ({accepted:false, reason, financialDebitVerified:false});
  if (!output || typeof expectedSessionId !== 'string' || !expectedSessionId ||
      typeof expectedHost !== 'string' || !expectedHost ||
      typeof expectedRequestLine !== 'string' || !expectedRequestLine)
    return fail('MISSING_CONTEXT');
  const eq = (a,b) => {
    if(typeof a !== 'string' || typeof b !== 'string') return false;
    const x=Buffer.from(a), y=Buffer.from(b);
    return x.length===y.length && timingSafeEqual(x,y);
  };
  if (!eq(output.sessionId,expectedSessionId)) return fail('SESSION_MISMATCH');
  if (!eq(output.server_name,expectedHost)) return fail('HOST_MISMATCH');
  const decode = v => {
    if(typeof v!=='string' || v.length>131072 || !/^[A-Za-z0-9+/]*={0,2}$/.test(v)) throw Error();
    const b=Buffer.from(v,'base64');
    if(b.toString('base64')!==v) throw Error();
    return b;
  };
  try {
    const sent=decode(output.redactedTranscript?.sent);
    const recv=decode(output.redactedTranscript?.recv);
    const sep=sent.indexOf('\r\n');
    if(sep<0 || !eq(sent.subarray(0,sep).toString('utf8'),expectedRequestLine))
      return fail('REQUEST_MISMATCH');
    if(!/^HTTP\/1\.[01] 200(?: |\r\n)/.test(recv.toString('utf8',0,64)))
      return fail('RESPONSE_STATUS_UNCONFIRMED');
    // Do not retain/disclose transcripts. Redacted data is not ordinary JSON;
    // semantic parsing requires verified reveal ranges and provider schema.
    return {accepted:true,status:'RESEARCH_TRANSCRIPT_SHAPE_MATCH',financialDebitVerified:false};
  } catch { return fail('INVALID_TRANSCRIPT'); }
}
