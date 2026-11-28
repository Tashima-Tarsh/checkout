import React from 'react';

export const PaymentSafety: React.FC = () => {
  const safeguards = [
    { title: 'Payer device treated as hostile', description: 'No screenshot, UTR entry, browser resume, or synthetic local signing may set financially_verified=true. The payer device is treated as hostile by design.' },
    { title: 'Server-confirmed debit match', description: 'Financially verified remains false until server-confirmed debit match. Client-side proofs are observational only.' },
    { title: 'MCC is optional metadata', description: 'MCC (Merchant Category Code) is optional P2M metadata, not debit evidence. It does not influence financial verification.' },
    { title: 'Server match required', description: 'Debit evidence must be confirmed by server-side match. Browser-side observations alone cannot trigger verified status.' },
  ]

  return (
    <section className="prism-glass-strong" style="padding: 4rem 1rem;">
      <div className="section-eyebrow" style={{ fontSize: '0.875rem', fontWeight: '800', letterSpacing: '0.16em', color: 'var(--disha-violet)', textTransform: 'uppercase', display: 'block', marginBottom: '1rem' }}>Zero fraud evidence protocol</div>
      <h2 style={{ fontSize: 'clamp(2rem,4vw,3.75rem)', lineHeight: '1.15', letterSpacing: '-0.035em', color: 'var(--disha-ink)', marginBottom: '1rem' }}>Payment safety and verification</h2>
      <p style={{ fontSize: 'clamp(1rem,1.2vw,1.125rem)', lineHeight: '1.75', color: 'var(--disha-muted)', maxWidth: '700px', marginBottom: '1.5rem' }}>
        Businesses depend on accurate payment information. An unclear transaction status can create uncertainty for the customer, delay fulfilment and increase the amount of work required to resolve a payment.
      </p>
      <p style={fontSize: 'clamp(1rem,1.2vw,1.125rem)', lineHeight: '1.75', color: 'var(--disha-muted)', maxWidth: '570px'}>DISHA 8.2 is designed around a Zero Fraud objective, with an emphasis on responsible transaction checks and clearly communicated payment outcomes.</p>
      <div className="field-group two" style={{ marginTop: '2rem' }}>
        {safeguards.map((s) => (
          <div className="field" key={step.step}>
            <label style={{ fontWeight: '700', color: 'var(--disha-violet)', textTransform: 'uppercase', fontSize: '0.875rem', letterSpacing: '0.08em', display: 'block', marginBottom: '0.5rem' }}>{s.title}</label>
            <div className="card" style={{ padding: '1rem' }}>
              <p style={{ fontSize: '0.9375rem', color: 'var(--prism-text-secondary)', margin: '0' }}>{s.description}</p>
            </div>
          </div>
        ))}
      </div>
      <button className="btn-primary" style={{ marginTop: '1.5rem' }} onClick={() => window.location.href='/checkout/'}>Create Verified Checkout</button>
    </section>
  );
}

export default PaymentSafety;
