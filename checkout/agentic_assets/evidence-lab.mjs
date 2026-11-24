// Research-only SDK. No device identifiers, private app data or financial verdicts.
export function createSession({id, nonce, now = Date.now(), ttl = 90000}) {
 if (!id || !nonce || !Number.isFinite(now) || !Number.isFinite(ttl) || ttl <= 0 || ttl > 90000) throw new Error('invalid session');
 return Object.freeze({id, nonce, start:now, expires:now+ttl});
}
export function correlate(session, events, now = Date.now()) {
 const accepted = [], seen = new Set();
 if (!Number.isFinite(now) || now < session.start || now > session.expires) return {accepted, financially_verified:false};
 for (const e of events.slice(0,128)) {
  if (!e || e.session !== session.id || e.nonce !== session.nonce || !Number.isFinite(e.at) || e.at < session.start || e.at > now || typeof e.id !== 'string' || seen.has(e.id) || !['depart','return','synthetic-receipt'].includes(e.kind)) continue;
  seen.add(e.id); accepted.push(e.kind);
 }
 return {accepted, returned:accepted.indexOf('depart') >= 0 && accepted.lastIndexOf('return') > accepted.indexOf('depart'), financially_verified:false};
}
