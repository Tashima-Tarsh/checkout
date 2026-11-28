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
    <section className="prism-glass-strong" style={{"padding":"4rem 1rem"}}>
      <div className="section-eyebrow" style={{"fontSize":"0.875rem","fontWeight":"800","letterSpacing":"0.16em","color":"var(--disha-violet)","textTransform":"uppercase","display":"block","marginBottom":"1rem"}}>How it works</div>
      <h2 style={{"fontSize":"clamp(2rem,4vw,3.75rem)","lineHeight":"1.15","letterSpacing":"-0.035em","color":"var(--disha-ink)","marginBottom":"1rem"}}>Four-step agentic verification</h2>
      <div className="field-group two" style={{"marginTop":"2rem"}}>
        {steps.map((step) => (
          <div className="field" key={step.step}>
            <label style={{"fontWeight":"700","color":"var(--disha-violet)","textTransform":"uppercase","fontSize":"0.875rem","letterSpacing":"0.08em","display":"block","marginBottom":"0.5rem"}}>Step {step.step}</label>
            <div className="card" style={{"padding":"1.5rem"}}>
              <div style={{"fontWeight":"700","color":"var(--disha-ink)","marginBottom":"0.5rem"}}>{step.title}</div>
              <div style={{"fontSize":"0.9375rem","color":"var(--prism-text-secondary)"}}>{step.description}</div>
            </div>
          </div>
        ))}
      </div>
      <button className="btn-primary" style={{"marginTop":"1.5rem"}} onClick={() => window.location.href='/checkout'}>Create Your First Checkout</button>
    </section>
  )
}
