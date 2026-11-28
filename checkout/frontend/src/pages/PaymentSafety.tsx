import React from 'react'

export const PaymentSafety: React.FC = () => {
  const safeguards = [
    {
      title: 'Payer device treated as hostile',
      description: 'No screenshot, UTR entry, browser resume, or synthetic local signing may set financially_verified=true. The payer device is treated as hostile by design.'
    },
    {
      title: 'Server-confirmed debit match',
      description: 'Financially verified remains 0 until server-confirmed debit match. Client-side proofs are observational only.'
    },
    {
      title: 'MCC is optional metadata',
      description: 'MCC (Merchant Category Code) is optional P2M metadata, not debit evidence. It does not influence financial verification.'
    },
    {
      title: 'Server match required',
      description: 'Debit evidence must be confirmed by server-side match. Browser-side observations alone cannot trigger verified status.'
    }
  ]

  return (
    <section className="prism-glass-strong" style="padding: 4rem 1rem;">
      <div className="section-eyebrow" style="font-size:0.875rem;font-weight:800;letter-spacing:0.16em;color:var(--disha-violet);text-transform:uppercase;display:block;margin-bottom:1rem;">Zero fraud evidence protocol</div>
      <h1 style="font-size:clamp(2rem,4vw,3.75rem);line-height:1.15;letter-spacing:-0.035em;color:var(--disha-ink);margin-bottom:1rem;">Payment safety and verification</h2>
      <p style="font-size:clamp(1rem,1.2vw,1.125rem);line-height:1.75;color:var(--disha-muted);max-width:700px;margin-bottom:1.5rem;">
        Businesses depend on accurate payment information. An unclear transaction status can create uncertainty for the customer, delay fulfilment and increase the amount of work required to resolve a payment.
      </p>
      <div className="field-group two" style="margin-top: 2rem;">
        {safeguards.map((s) => (
          <div className="field" key={s.title}>
            <label style="font-weight:700;color:var(--disha-violet);text-transform:uppercase;font-size:0.875rem;letter-spacing:0.08em;display:block;margin-bottom:0.5rem;">{s.title}</label>
            <div className="card" style="padding:1rem;">
              <p style="font-size:0.9375rem;color:var(--prism-text-secondary);margin:0;">{s.description}</p>
            </div>
          </div>
        ))}
      </div>
      <button className="btn-primary" style="margin-top: 1.5rem;" onClick={() => window.location.href='/checkout'}>Create Verified Checkout</button>
    </section>
  )
}
