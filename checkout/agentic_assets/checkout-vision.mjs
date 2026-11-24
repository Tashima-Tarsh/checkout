// Explicitly authorized receipt input. Research UI only; no payment writes.
export function visionMessage(value) {
  if (value?.financially_verified !== false || value?.checkout_changed !== false)
    return 'Vision analysis unavailable.';
  if (value.decision === 'VISUAL_SUCCESS' && value.advance_research === true)
    return 'Visual payment success recognized. Research analysis complete.';
  if (value.visual_status === 'SUCCESS_RECOGNIZED')
    return 'Visual payment success recognized. Amount uncertain or mismatched.';
  return 'Payment success not recognized.';
}

export async function mountCheckoutVision({endpoint, host}) {
  if (!host || host.querySelector('#checkout-vision')) return;
  const response = await fetch(endpoint + '/vision', {cache:'no-store', signal:AbortSignal.timeout(5000)});
  if (!response.ok) return;
  const capability = await response.json();
  if (capability.enabled !== true || capability.research_only !== true) return;
  if (host.querySelector('#checkout-vision')) return;
  const section = document.createElement('section');
  section.id = 'checkout-vision';
  section.setAttribute('aria-label','Agentic Vision research');
  section.innerHTML = '<h3>Agentic Vision · Research</h3><p>Choose your own receipt for backend image analysis. This analyzes the image, not the debit.</p><label for="vision-receipt">Payment image</label><input id="vision-receipt" type="file" accept="image/png,image/jpeg,image/webp"><button class="secondary" type="button" id="vision-analyze" disabled>Analyze payment image</button><p role="status" aria-live="polite" id="vision-result">Awaiting authorized image.</p>';
  host.append(section);
  const file = section.querySelector('#vision-receipt');
  const button = section.querySelector('#vision-analyze');
  const result = section.querySelector('#vision-result');
  let busy = false;
  file.addEventListener('change', () => {
    if (busy) return;
    button.disabled = !file.files.length;
    result.textContent = 'Image ready for analysis.';
  });
  button.addEventListener('click', async () => {
    if (busy) return;
    const image = file.files[0];
    if (!image || !['image/png','image/jpeg','image/webp'].includes(image.type) || image.size > 4*1024*1024) {
      result.textContent = 'Choose a supported image under 4 MB.';
      return;
    }
    busy = true;
    file.disabled = button.disabled = true;
    result.textContent = 'Analyzing payment image…';
    try {
      const r = await fetch(endpoint + '/vision', {method:'POST', headers:{'Content-Type':image.type},
        body:image, cache:'no-store', signal:AbortSignal.timeout(20000)});
      if (!r.ok) throw Error();
      result.textContent = visionMessage(await r.json());
    } catch { result.textContent = 'Vision analysis unavailable or timed out.'; }
    finally {
      busy = false; file.disabled = false; button.disabled = !file.files.length;
    }
  });
}
