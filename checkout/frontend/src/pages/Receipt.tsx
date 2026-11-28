import React from 'react';

export const Receipt: React.FC = () => {
  const [session, setSession] = useState<any>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const orderId = params.get('order');
    if (orderId) {
      fetch(`/api/sessions/${orderId}`)
        .then(async (r) => {
          const data = await r.json();
          setSession(data);
        })
        .catch(() => {});
      }
    }, []);

    return (
      <section className="prism-glass-strong" style="padding: 4rem 1rem; max-width: 700px; margin: 2rem auto;">
        <div className="receipt-paper" style="background: linear-gradient(135deg,#fffef5 0%,#fdf8f0 100%);border:1px solid #dcd7ca;border-radius:24px;padding:2rem;">
          <div className="receipt-header" style="display:flex;align-items:center;gap:12px;margin-bottom:2rem;">
            <div className="receipt-logo" style="font-size:40px;color:#08785C;font-weight:800;">D</div>
            <div className="receipt-title" style="font-size:1.25rem;color:#4a4a44;margin-bottom:0.5rem;">Transaction Receipt</div>
          </div>
          <div className="receipt-meta-top" style="display:flex;justify-content:space-between;">
            <div class="receipt-field"><div class="receipt-label">Order ID</div><div class="receipt-value" id="receipt-order-id">{session?.id || '—'}</div></div>
            <div class="receipt-field"><div class="receipt-label">Date</div><div class="receipt-value" id="receipt-date">{session?.created ? new Date(session.created).toLocaleDateString('en-IN') : '—'}</div></div>
          </div>
          <div class="receipt-amount" style="margin-top:2rem;text-align:center;">
            <div class="amount-currency">₹</div>
            <div class="amount-value" id="receipt-amount">{(session?.amount_paise || 0) / 100}</div>
          </div>
          <div class="receipt-details">
            <div class="receipt-detail-row">
              <span class="detail-label">Transaction Mode</div>
              <div class="detail-value" id="receipt-mode">{session?.mode || '—'}</div>
            </div>
            <div class="detail-row" style="margin-top:1rem;">
              <div class="detail-label">Recipient Route</div>
              <div class="detail-value" id="receipt-vpa">{session?.vpa || '—'}</div>
            </div>
            <div class="detail-row" style="margin-top:1rem;">
              <div class="detail-label">Transaction ID</div>
              <div class="detail-value" id="receipt-txn-id">{session?.id || '—'}</div>
            </div>
            <div class="detail-row" style="margin-top:1rem;">
              <div class="detail-label">Verification Status</div>
              <div class="detail-value" id="receipt-status" style="color:#065440;font-weight:700;">Verified</div>
            </div>
            <div class="detail-row" style="margin-top:1rem;">
              <div class="detail-label">Financially Verified</div>
              <div class="detail-value" id="receipt-verified" style="color:var(--disha-emerald);font-weight:700;">Yes</div>
            </div>
          </div>
          <div class="receipt-footer" style="margin-top:2rem;padding-top:1rem;border-top:1px solid #dcd7ca;">
            <div class="receipt-footer-text" style="font-size:0.875rem;color:var(--disha-muted);">
              <p style="margin-bottom:0.5rem;">This receipt confirms that a debit of <span id="receipt-footer-amt" style="font-weight:700;">₹{(session?.amount_paise || 0) / 100}</span> was observed and verified by the DISHA agentic payment protocol.</div>
              <div style="font-size:0.8125rem;color:var(--disha-muted);margin-top:0.5rem;">Screenshots and UTR entry are not accepted as debit evidence. Verification is confirmed only when the server matches the payment.</div>
            </div>
            <div class="receipt-footer-seal" style="margin-top:2rem;display:flex;align-items:center;gap:1rem;">
              <div style="width:36px;height:36px;border-radius:50%;background:#08785C;display:flex;place-items:center;color:#fff;font-weight:800;font-size:0.9rem;">✓</div>
              <div style="font-size:0.75rem;color:var(--disha-emerald);text-align:center;">VERIFIED</div>
            </div>
          </div>
          <div class="receipt-actions" style="margin-top:2rem;display:flex;gap:1rem;">
            <button className="btn-primary" onclick={() => { window.print(); }}>
              Download PDF
            </button>
            <button className="btn-secondary" id="copy-utr" onclick={() => {
              const utr = document.getElementById('receipt-utr')?.textContent;
              if (utr) {
                navigator.clipboard.writeText(utr).then(() => alert('UTR copied to clipboard'));
              }
            }}
            Copy UTR
          </button>
          <button className="btn-secondary" onclick={() => window.location.href='/'}>
            New Checkout
          </button>
        </div>
      </div>
    </section>
  );
}

export default Receipt;
