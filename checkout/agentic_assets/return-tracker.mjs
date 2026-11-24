// Research telemetry only: never a financial verdict.
export function returnTracker(onReturn, clock = () => performance.now()) {
  let armed = false, away = false, events = [];
  return {
    arm() { armed = true; away = false; events = []; },
    observe(type, hidden = false) {
      if (!armed) return;
      if (events.length < 128) events.push({type, ms: clock(), hidden});
      if (hidden || ['blur','freeze','pagehide'].includes(type)) away = true;
      if (away && !hidden && ['focus','visible','resume','pageshow'].includes(type)) {
        armed = false;
        onReturn({events: events.slice(), financially_verified: false});
      }
    }
  };
}
export function attachReturnTracker(onReturn) {
  const tracker = returnTracker(onReturn);
  for (const type of ['focus','blur','pagehide','pageshow'])
    window.addEventListener(type, () => tracker.observe(type, document.hidden));
  for (const type of ['freeze','resume'])
    document.addEventListener(type, () => tracker.observe(type, document.hidden));
  document.addEventListener('visibilitychange', () => tracker.observe(document.hidden ? 'hidden' : 'visible', document.hidden));
  return tracker;
}
