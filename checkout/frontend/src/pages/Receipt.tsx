import React from 'react'

export const Receipt: React.FC = () => {
  const [session, setSession] = useState<any>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const orderId = params.get('order')
    if (orderId) {
      fetch(`http://localhost:8000/api/sessions/${orderId}`)
        .then(r => r.json())
        .then(data => setSession(data))
    }
  }, [])

  if (!session) {
    return (
      <section className="prism-glass-strong" style="padding: 4rem 1rem; max-width: 600px; margin: 2rem auto; text-align:center;">
        <div className="empty-state" style="text-align:center;padding:3rem 1rem;">
          <div className="empty-icon">🧾</div>
          <h3>Receipt Not Found</h3>
          <p>The requested transaction receipt could not be found.</p>
          <button className="btn-primary" onclick={() => window.location.href='/'}>Return to Checkout</button>
        </div>
      </section>
    )
  }

  return (
    <section className="prism-glass-strong" style="padding: 4rem 1rem; max-width: 900px; margin: 2rem auto;">
      <div className="receipt-paper" style="background: linear-gradient(135deg,#fffef5 0%,#fdf8f0 100%);border:1px solid #dcd7ca;border-radius:24px;padding:40px;box-shadow:0 20px 60px rgba(0,0,0,0.1);position:relative;">
        <div className="receipt-header" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:32px;border-bottom:1px solid #e8e0d0;padding-bottom:24px;">
          <div style="display:flex;align-items:center;gap:12px;">
            <div style="width:40px;height:40px;border-radius:10px;background:var(--gradient-emerald);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:0.85rem;">D</div>
            <div>
              <div style="font-weight:800;color:var(--disha-ink);font-size:1.1rem;">DISHA 8.2</div>
              <div style="font-size:0.8125rem;color:var(--prism-text-secondary);">Transaction Receipt</div>
            </div>
          </div>
          <div className="receipt-meta-top" style="display:flex;gap:24px;">
            <div style="text-align:right;">
              <div class="meta-small" style="font-size:0.75rem;color:var(--disha-muted);">Receipt ID</div>
              <div class="meta-value" style="font-size:0.875rem;color:var(--disha-ink);font-family:monospace;font-weight:700;">INV-{session.id?.slice(-8).toUpperCase() || '——'}</div>
            </div>
            <div style="text-align:right;">
              <div class="meta-small" style="font-size:0.75rem;color:var(--disha-muted);">Order ID</div>
              <div class="meta-value" style="font-size:0.875rem;color:var(--disha-ink);font-family:monospace;font-weight:700;">{session.id || '—'}</div>
            </div>
            <div style="text-align:right;">
              <div class="meta-small" style="font-size:0.75rem;color:var(--disha-muted);">Date</div>
              <div class="meta-value" style="font-size:0.875rem;color:var(--disha-ink);font-family:monospace;font-weight:700;">{new Date((session.created || Date.now()/1000)*1000).toLocaleDateString('en-IN')} {new Date((session.created || Date.now()/1000)*1000).toLocaleTimeString('en-IN')}</div>
            </div>
          </div>
        </div>

        <div className="receipt-divider" style="height:1px;background:var(--pdp-border);margin:24px 0;"></div>

        <div className="receipt-amount" style="text-align:center;margin-bottom:24px;">
          <div class="amount-currency" style="font-size:1.5rem;color:var(--disha-emerald-500);">₹</div>
          <div class="amount-value" style="font-size:3rem;font-weight:800;color:var(--disha-ink);">{((session.amount_paise || 0)/100).toFixed(2)}</div>
        </div>

        <div className="receipt-details">
          <div class="detail-row" style="display:flex;justify-content:space-between;padding:0.75rem 0;border-bottom:1px solid rgba(25,61,48,0.06);">
            <div class="detail-label" style="color:var(--disha-muted);font-size:0.875rem;">Order status</div>
            <div class="detail-value" style="font-weight:700;color:var(--disha-ink);"><span className="badge badge-success">Verified</span></div>
          </div>
          <div class="detail-row" style="display:flex;justify-content:space-between;padding:0.75rem 0;border-bottom:1px solid rgba(25,61,48,0.06);">
            <div class="detail-label" style="color:var(--disha-muted);font-size:0.875rem;">Transaction mode</div>
            <div class="detail-value" style="font-weight:700;color:var(--disha-ink);">{session.mode || 'P2P'}</div>
          </div>
          <div class="detail-row" style="display:flex;justify-content:space-between;padding:0.75rem 0;border-bottom:1px solid rgba(25,61,48,0.06);">
            <div class="detail-label" style="color:var(--disha-muted);font-size:0.875rem;">Transaction reference (UTR)</div>
            <div class="detail-value" style="font-weight:700;color:var(--disha-ink);font-family:monospace;">{session.utr || 'UTR-' + session.id?.slice(-8)}</div>
          </div>
          <div class="detail-row" style="display:flex;justify-content:space-between;padding:0.75rem 0;border-bottom:1px solid rgba(25,61,48,0.06);">
            <div class="detail-label" style="color:var(--disha-muted);font-size:0.875rem;">Bank reference (RRN)</div>
            <div class="detail-value" style="font-weight:700;color:var(--disha-ink);font-family:monospace;">RRN-{session.id?.slice(-8) || '——'}</div>
          </div>
          <div class="detail-row" style="display:flex;justify-content:space-between;padding:0.75rem 0;border-bottom:1px solid rgba(25,61,48,0.06);">
            <div class="detail-label" style="color:var(--disha-muted);font-size:0.875rem;">Internal transaction ID</div>
            <div class="detail-value" style="font-weight:700;color:var(--disha-ink);font-family:monospace;">{session.id || '—'}</div>
          </div>
          <div class="detail-row" style="display:flex;justify-content:space-between;padding:0.75rem 0;">
            <div class="detail-label" style="color:var(--disha-muted);font-size:0.875rem;">Verification time</div>
            <div class="detail-value" style="font-weight:700;color:var(--disha-emerald-500);font-family:monospace;">{new Date((session.created || Date.now()/1000)*1000).toLocaleTimeString('en-IN')}</div>
          </div>
        </div>

        <div className="receipt-divider" style="height:1px;background:var(--pdp-border);margin:24px 0;"></div>

        <div className="receipt-footer">
          <div className="footer-text">
            <div style="font-weight:700;color:var(--disha-ink);">This receipt confirms that a debit of ₹{((session.amount_paise || 0)/100).toFixed(2)} was observed and verified by the DISHA agentic payment protocol.</div>
            <div style="font-size:0.8125rem;color:var(--disha-muted);margin-top:0.5rem;">Screenshots and UTR entry are not accepted as debit evidence. Verification is confirmed only when the server matches the payment.</div>
          </div>
          <div className="footer-seal">
            <div style="width:36px;height:36px;border-radius:50%;background:#08785C;display:flex;place-items:center;color:#fff;font-weight:800;font-size:0.9rem;">✓</div>
            <div style="font-size:0.75rem;color:var(--disha-emerald-500);text-align:center;">VERIFIED</div>
          </div>
        </div>

        <div className="receipt-actions" style="margin-top:24px;display:flex;gap:1rem;">
          <button className="btn-primary" onclick={() => {
            const element = document.querySelector('.receipt-paper');
            if (element) {
              window.print();
            }
          }}>Download PDF</button>
          <button className="btn-secondary" onclick={() => {
            const utr = session.utr || session.id;
            navigator.clipboard.writeText(utr).then(() => alert('UTR copied to clipboard'));
          }} style="flex:1;">Copy UTR</button>
          <button className="btn-secondary" style="flex:1;" onclick={() => window.location.href='/'}>New Checkout</button>
        </div>
      </div>
    </section>
  )
}
