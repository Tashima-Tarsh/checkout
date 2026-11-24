const path = location.pathname.replace(/\/vision$/, '');
const endpoint = '/api' + path;
const file = document.querySelector('#receipt');
const button = document.querySelector('#analyze');
const result = document.querySelector('#result');
let ready = false;
document.querySelector('#back').href = path;
function update() { button.disabled = !ready || !file.files.length; }
file.addEventListener('change', () => { result.textContent = 'Waiting for analysis.'; update(); });
(async () => {
  try {
    const response = await fetch(endpoint, {cache:'no-store'});
    if (!response.ok) throw Error();
    const order = await response.json();
    document.querySelector('#amount').textContent = new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR'}).format(order.amount_minor / 100);
    ready = true; update();
  } catch { result.textContent = 'Checkout unavailable.'; }
})();
button.addEventListener('click', async () => {
  const image = file.files[0];
  if (!image || image.size > 4 * 1024 * 1024) { result.textContent = 'Choose an image under 4 MB.'; return; }
  button.disabled = file.disabled = true;
  result.textContent = 'Analyzing payment image…';
  try {
    const response = await fetch(endpoint + '/vision', {method:'POST',headers:{'Content-Type':image.type},body:image,cache:'no-store',signal:AbortSignal.timeout(20000)});
    if (!response.ok) throw Error();
    const value = await response.json();
    result.textContent = value.decision === 'VISUAL_SUCCESS' && value.advance_research === true
      ? 'Visual payment success recognized. Research gate passed. Financial verification pending.'
      : value.visual_status === 'SUCCESS_RECOGNIZED'
        ? 'Visual payment success recognized. Amount uncertain or mismatched; research gate blocked.'
        : 'Research gate blocked: payment success not established.';
  } catch { result.textContent = 'Vision analysis unavailable. Research gate blocked.'; }
  finally { file.disabled = false; update(); }
});
