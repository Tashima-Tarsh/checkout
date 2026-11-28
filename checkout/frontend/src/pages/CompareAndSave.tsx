import React from 'react'

export const CompareAndSave: React.FC = () => {
  const providers = [
    { name: 'DISHA 8.2', mdr: '0%', platform_fee: 'Negotiated', setup_fee: '₹0', annual_amc: '₹0', settlement: 'Server-verified' },
    { name: 'Razorpay', mdr: '~2.0%', platform_fee: 'Undisclosed', setup_fee: 'Undisclosed', annual_amc: 'Undisclosed', settlement: 'T+1 to T+2' },
    { name: 'Cashfree', mdr: '~1.99% - 2.0%', platform_fee: 'Undisclosed', setup_fee: 'Undisclosed', annual_amc: 'Undisclosed', settlement: 'T+1' },
    { name: 'PayU', mdr: '~2.0%', platform_fee: 'Undisclosed', setup_fee: 'Undisclosed', annual_amc: 'Undisclosed', settlement: 'T+1 to T+2' },
    { name: 'PhonePe', mdr: '~2.0%', platform_fee: 'Undisclosed', setup_fee: 'Undisclosed', annual_amc: 'Undisclosed', settlement: 'T+1' },
    { name: 'Paytm', mdr: '~2.0%', platform_fee: 'Undisclosed', setup_fee: 'Undisclosed', annual_amc: 'Undisclosed', settlement: 'T+1' }
  ]

  return (
    <section className="prism-glass-strong" style="padding: 4rem 1rem;">
      <div className="page-header">
        <h1 style="font-size:clamp(2rem,4vw,3.75rem);line-height:1.15;letter-spacing:-0.035em;color:var(--disha-ink);margin-bottom:1rem;">Compare Payment Providers</h2>
        <p style="font-size:clamp(1rem,1.2vw,1.125rem);line-height:1.75;color:var(--disha-muted);max-width:700px;margin-bottom:1.5rem;">
          Payment providers offer different services, commercial arrangements and payment options. Understanding those differences requires looking beyond a single published rate.
        </p>
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Provider</th><th>Payment Method</th><th>Published MDR</th><th>Platform Fee</th><th>Monthly / Annual</th><th>Settlement</th><th>Action</th>
            </tr>
          </thead>
          <tbody>
            {providers.map((p) => (
              <tr key={p.name}>
                <td><strong>{p.name}</strong></td>
                <td>UPI, Cards, Wallets, Net Banking</td>
                <td>{p.mdr}</td>
                <td>{p.platform_fee}</td>
                <td>{p.setup_fee} / {p.annual_amc}</td>
                <td>{p.settlement}</td>
                <td>{p.name === 'DISHA 8.2' ? (
                  <button className="btn-primary" style="padding:0.4rem 0.8rem;">Contact Us</button>
                ) : (
                  <button className="btn-secondary" style="padding:0.4rem 0.8rem;" onClick={() => window.location.href='/payment-cost-calculator/'>Use in Calculator</button>
                )}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p style="font-size:0.875rem;color:var(--prism-text-muted);margin-top:1rem;">
        Rates shown are MDR (Merchant Discount Rate) for UPI transactions where publicly disclosed. Platform fees, monthly charges and annual maintenance charges vary by provider and are typically negotiated. Taxes (GST) are additional. Promotional conditions and eligibility criteria apply. Contact providers directly for current rates.
      </p>
    </section>
  )
}
