import React, { useState, useEffect } from 'react'

export const Receipt: React.FC = () => {
  const [session, setSession] = useState<any>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const orderId = params.get('order')
    if (orderId) {
      fetch(`/api/sessions/${orderId}`)
        .then(r => { if (!r.ok) throw new Error('Receipt unavailable'); return r.json() })
        .then(data => setSession(data)).catch(() => setSession(null))
    }
  }, [])

  if (!session || session.financially_verified !== true) {
    return (
      <section className="prism-glass-strong" style={{"padding":"4rem 1rem","maxWidth":"600px","margin":"2rem auto","textAlign":"center"}}>
        <div className="empty-state" style={{"textAlign":"center","padding":"3rem 1rem"}}>
          <div className="empty-icon">🧾</div>
          <h3>Receipt Not Found</h3>
          <p>The requested transaction receipt could not be found.</p>
          <button className="btn-primary" onClick={() => window.location.href='/'}>Return to Checkout</button>
        </div>
      </section>
    )
  }

  return (
    <section className="prism-glass-strong" style={{"padding":"4rem 1rem","maxWidth":"900px","margin":"2rem auto"}}>
      <div className="receipt-paper" style={{"background":"linear-gradient(135deg,#fffef5 0%,#fdf8f0 100%)","border":"1px solid #dcd7ca","borderRadius":"24px","padding":"40px","boxShadow":"0 20px 60px rgba(0,0,0,0.1)","position":"relative"}}>
        <div className="receipt-header" style={{"display":"flex","justifyContent":"space-between","alignItems":"center","marginBottom":"32px","borderBottom":"1px solid #e8e0d0","paddingBottom":"24px"}}>
          <div style={{"display":"flex","alignItems":"center","gap":"12px"}}>
            <div style={{"width":"40px","height":"40px","borderRadius":"10px","background":"var(--gradient-emerald)","display":"flex","alignItems":"center","justifyContent":"center","color":"#fff","fontWeight":"800","fontSize":"0.85rem"}}>D</div>
            <div>
              <div style={{"fontWeight":"800","color":"var(--disha-ink)","fontSize":"1.1rem"}}>DISHA 8.2</div>
              <div style={{"fontSize":"0.8125rem","color":"var(--prism-text-secondary)"}}>Transaction Receipt</div>
            </div>
          </div>
          <div className="receipt-meta-top" style={{"display":"flex","gap":"24px"}}>
            <div style={{"textAlign":"right"}}>
              <div className="meta-small" style={{"fontSize":"0.75rem","color":"var(--disha-muted)"}}>Receipt ID</div>
              <div className="meta-value" style={{"fontSize":"0.875rem","color":"var(--disha-ink)","fontFamily":"monospace","fontWeight":"700"}}>INV-{session.id?.slice(-8).toUpperCase() || '——'}</div>
            </div>
            <div style={{"textAlign":"right"}}>
              <div className="meta-small" style={{"fontSize":"0.75rem","color":"var(--disha-muted)"}}>Order ID</div>
              <div className="meta-value" style={{"fontSize":"0.875rem","color":"var(--disha-ink)","fontFamily":"monospace","fontWeight":"700"}}>{session.id || '—'}</div>
            </div>
            <div style={{"textAlign":"right"}}>
              <div className="meta-small" style={{"fontSize":"0.75rem","color":"var(--disha-muted)"}}>Date</div>
              <div className="meta-value" style={{"fontSize":"0.875rem","color":"var(--disha-ink)","fontFamily":"monospace","fontWeight":"700"}}>{new Date((session.created || 0)*1000).toLocaleDateString('en-IN')} {new Date((session.created || 0)*1000).toLocaleTimeString('en-IN')}</div>
            </div>
          </div>
        </div>

        <div className="receipt-divider" style={{"height":"1px","background":"var(--pdp-border)","margin":"24px 0"}}></div>

        <div className="receipt-amount" style={{"textAlign":"center","marginBottom":"24px"}}>
          <div className="amount-currency" style={{"fontSize":"1.5rem","color":"var(--disha-emerald-500)"}}>₹</div>
          <div className="amount-value" style={{"fontSize":"3rem","fontWeight":"800","color":"var(--disha-ink)"}}>{((session.amount_paise || 0)/100).toFixed(2)}</div>
        </div>

        <div className="receipt-details">
          <div className="detail-row" style={{"display":"flex","justifyContent":"space-between","padding":"0.75rem 0","borderBottom":"1px solid rgba(25,61,48,0.06)"}}>
            <div className="detail-label" style={{"color":"var(--disha-muted)","fontSize":"0.875rem"}}>Order status</div>
            <div className="detail-value" style={{"fontWeight":"700","color":"var(--disha-ink)"}}><span className="badge badge-success">Verified</span></div>
          </div>
          <div className="detail-row" style={{"display":"flex","justifyContent":"space-between","padding":"0.75rem 0","borderBottom":"1px solid rgba(25,61,48,0.06)"}}>
            <div className="detail-label" style={{"color":"var(--disha-muted)","fontSize":"0.875rem"}}>Transaction mode</div>
            <div className="detail-value" style={{"fontWeight":"700","color":"var(--disha-ink)"}}>{session.mode || 'P2P'}</div>
          </div>
          <div className="detail-row" style={{"display":"flex","justifyContent":"space-between","padding":"0.75rem 0","borderBottom":"1px solid rgba(25,61,48,0.06)"}}>
            <div className="detail-label" style={{"color":"var(--disha-muted)","fontSize":"0.875rem"}}>Transaction reference (UTR)</div>
            <div className="detail-value" style={{"fontWeight":"700","color":"var(--disha-ink)","fontFamily":"monospace"}}>{session.utr || 'Unavailable'}</div>
          </div>
          <div className="detail-row" style={{"display":"flex","justifyContent":"space-between","padding":"0.75rem 0","borderBottom":"1px solid rgba(25,61,48,0.06)"}}>
            <div className="detail-label" style={{"color":"var(--disha-muted)","fontSize":"0.875rem"}}>Bank reference (RRN)</div>
            <div className="detail-value" style={{"fontWeight":"700","color":"var(--disha-ink)","fontFamily":"monospace"}}>{session.rrn || 'Unavailable'}</div>
          </div>
          <div className="detail-row" style={{"display":"flex","justifyContent":"space-between","padding":"0.75rem 0","borderBottom":"1px solid rgba(25,61,48,0.06)"}}>
            <div className="detail-label" style={{"color":"var(--disha-muted)","fontSize":"0.875rem"}}>Internal transaction ID</div>
            <div className="detail-value" style={{"fontWeight":"700","color":"var(--disha-ink)","fontFamily":"monospace"}}>{session.id || '—'}</div>
          </div>
          <div className="detail-row" style={{"display":"flex","justifyContent":"space-between","padding":"0.75rem 0"}}>
            <div className="detail-label" style={{"color":"var(--disha-muted)","fontSize":"0.875rem"}}>Verification time</div>
            <div className="detail-value" style={{"fontWeight":"700","color":"var(--disha-emerald-500)","fontFamily":"monospace"}}>{new Date((session.created || 0)*1000).toLocaleTimeString('en-IN')}</div>
          </div>
        </div>

        <div className="receipt-divider" style={{"height":"1px","background":"var(--pdp-border)","margin":"24px 0"}}></div>

        <div className="receipt-footer">
          <div className="footer-text">
            <div style={{"fontWeight":"700","color":"var(--disha-ink)"}}>This receipt confirms that a debit of ₹{((session.amount_paise || 0)/100).toFixed(2)} was observed and verified by the DISHA agentic payment protocol.</div>
            <div style={{"fontSize":"0.8125rem","color":"var(--disha-muted)","marginTop":"0.5rem"}}>Screenshots and UTR entry are not accepted as debit evidence. Verification is confirmed only when the server matches the payment.</div>
          </div>
          <div className="footer-seal">
            <div style={{"width":"36px","height":"36px","borderRadius":"50%","background":"#08785C","display":"flex","placeItems":"center","color":"#fff","fontWeight":"800","fontSize":"0.9rem"}}>✓</div>
            <div style={{"fontSize":"0.75rem","color":"var(--disha-emerald-500)","textAlign":"center"}}>VERIFIED</div>
          </div>
        </div>

        <div className="receipt-actions" style={{"marginTop":"24px","display":"flex","gap":"1rem"}}>
          <button className="btn-primary" onClick={() => {
            const element = document.querySelector('.receipt-paper');
            if (element) {
              window.print();
            }
          }}>Download PDF</button>
          <button className="btn-secondary" onClick={() => {
            const utr = session.utr;
            if (!utr) return;
            navigator.clipboard.writeText(utr).then(() => alert('UTR copied to clipboard'));
          }} style={{"flex":"1"}}>Copy UTR</button>
          <button className="btn-secondary" style={{"flex":"1"}} onClick={() => window.location.href='/'}>New Checkout</button>
        </div>
      </div>
    </section>
  )
}
