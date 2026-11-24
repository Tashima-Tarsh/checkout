// First-party checkout return notification. No payment verdict, app data, or telemetry.
export function createReturnCallback(onReturn, clock = () => performance.now(), maxAgeMs = 300000) {
  let armedAt = null, awayAt = null, hiddenSeen = false;
  function disarm() { armedAt = null; awayAt = null; hiddenSeen = false; }
  function observe(type, { hidden = false, focused = false } = {}) {
    if (armedAt === null) return;
    const now = clock();
    if (!Number.isFinite(now) || now < armedAt || now - armedAt >= maxAgeMs) { disarm(); return; }
    if (hidden || type === 'pagehide' || type === 'freeze') {
      if (awayAt === null) awayAt = now;
      hiddenSeen = true;
      return;
    }
    if (type === 'blur') {
      if (awayAt === null) awayAt = now;
      return;
    }
    const returned = hiddenSeen
      ? ['visible','focus','pageshow','resume'].includes(type)
      : type === 'focus' && focused;
    if (awayAt === null || !returned) return;
    const result = {
      kind: 'checkout_return',
      mode: hiddenSeen ? 'visibility' : 'focus',
      away_ms: Math.round(now - awayAt),
      financially_verified: false
    };
    disarm();
    onReturn(result);
  }
  return { arm() { disarm(); armedAt = clock(); }, disarm, observe };
}

export function attachReturnCallback(onReturn, { doc = document, win = window } = {}) {
  const tracker = createReturnCallback(onReturn);
  const listeners = [];
  const listen = (target, event, handler) => {
    target.addEventListener(event, handler);
    listeners.push(() => target.removeEventListener(event, handler));
  };
  const observe = type => tracker.observe(type, {hidden:doc.hidden, focused:doc.hasFocus()});
  listen(doc, 'visibilitychange', () => observe(doc.hidden ? 'hidden' : 'visible'));
  for (const type of ['focus','blur','pagehide','pageshow']) listen(win,type,()=>observe(type));
  for (const type of ['freeze','resume']) listen(doc,type,()=>observe(type));
  return {arm:tracker.arm, disarm:tracker.disarm, dispose(){tracker.disarm();listeners.forEach(fn=>fn());}};
}
