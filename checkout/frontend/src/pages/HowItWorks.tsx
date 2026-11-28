import React from 'react'

export const HowItWorks: React.FC = () => {
  const steps = [
    {
      step: '01',
      title: 'Create Checkout',
      description: 'Merchant creates a payment link with a 120-second verification window. Each checkout gets a unique order ID.'
    },
    {
      step: '02',
      title: 'Customer Pays',
      description: 'Customer pays via any UPI app. DISHA 8.2 observes the payment through protocol handlers, camera OCR and sound chime detection.'
    },
    {
      step: '03',
      title: 'Server Verification',
      description: 'Server-side debit match confirms the payment. Financially verified stays false until server match. No client-submitted proof accepted.'
    },
    {
      step: '04',
      title: 'Receipt Issued',
      description: 'Transaction receipt with SHA-256 audit trail generated. UTR/RRN recorded. Receipt download available.'
    }
  ]

  return (
    <section className="prism-glass-strong" style="padding: 4rem 1rem;">
      <div className="section-eyebrow" style="font-size:0.875rem;font-weight:800;letter-spacing:0.16em;color:var(--disha-violet);text-transform:uppercase;display:block;margin-bottom:1rem;">How it works</div>
      <h2 style="font-size:clamp(2rem,4vw,3.75rem);line-height:1.15;letter-spacing:-0.035em;color:var(--disha-ink);margin-bottom:1rem;">Four-step agentic verification</h2>
      <div className="field-group two" style="margin-top: 2rem;">
        {steps.map((step) => (
          <div className="field" key={step.step}>
            <label style="font-weight:700;color:var(--disha-violet);text-transform:uppercase;font-size:0.875rem;letter-spacing:0.08em;display:block;margin-bottom:0.5rem;">Step {step.step}</label>
            <div className="card" style="padding:1.5rem;">
              <div style="font-weight:700;color:var(--disha-ink);margin-bottom:0.5rem;">{step.title}</div>
              <div style="font-size:0.9375rem;color:var(--prism-text-secondary);">{step.description}</div>
            </div>
          </div>
        ))}
      </div>
      <button className="btn-primary" style="margin-top: 1.5rem;" onClick={() => window.location.href='/checkout'}>Create Your First Checkout</button>
    </section>
  )
}
