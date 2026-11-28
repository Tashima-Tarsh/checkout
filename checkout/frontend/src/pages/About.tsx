import React from 'react'
import { Link } from 'react-router-dom'

export const About: React.FC = () => {
  return (
    <section className="prism-glass-strong" style="padding: 4rem 1rem;">
      <div className="section-eyebrow" style="font-size:0.875rem;font-weight:800;letter-spacing:0.16em;color:var(--disha-violet);text-transform:uppercase;display:block;margin-bottom:1rem;">About DISHA 8.2</div>
      <h2 style="font-size:clamp(2rem,4vw,3.75rem);line-height:1.15;letter-spacing:-0.035em;color:var(--disha-ink);margin-bottom:1rem;">A software-led approach to business payments</h2>
      <p style="font-size:clamp(1rem,1.2vw,1.125rem);line-height:1.75;color:var(--disha-muted);max-width:700px;margin-bottom:1.5rem;">
        DISHA 8.2 is a payment software product developed with the commercial realities of Indian businesses in mind. It helps businesses manage supported payment activities, transaction visibility and customer payment experiences without taking custody of merchant funds.
      </p>
      <div className="field-group two" style="margin-top: 2rem;">
        <div className="field">
          <label style="font-weight:700;color:var(--disha-violet);text-transform:uppercase;font-size:0.875rem;letter-spacing:0.08em;display:block;margin-bottom:0.5rem;">Our belief</label>
          <div className="card" style="padding:1rem;">
            <p style="font-size:0.9375rem;color:var(--prism-text-secondary);margin:0;">
              Payments should move a business forward, not become a burden. DISHA 8.2 focuses on the software surrounding payment activities rather than taking possession of the money being transferred.
            </p>
          </div>
        </div>
        <div className="field">
          <label style="font-weight:700;color:var(--disha-violet);text-transform:uppercase;font-size:0.875rem;letter-spacing:0.08em;display:block;margin-bottom:0.5rem;">What we do</label>
          <div className="card" style="padding:1rem;">
            <p style="font-size:0.9375rem;color:var(--prism-text-secondary);margin:0;">
              We help businesses understand their payment expenses, manage supported payment activities and access clearer transaction information through a software service.
            </p>
          </div>
        </div>
      </div>
      <div className="field-group two" style="margin-top: 2rem;">
        <div className="field">
          <label style="font-weight:700;color:var(--disha-violet);text-transform:uppercase;font-size:0.875rem;letter-spacing:0.08em;display:block;margin-bottom:0.5rem;">What we do not do</label>
          <div className="card" style="padding:1rem;">
            <p style="font-size:0.9375rem;color:var(--prism-text-secondary);margin:0;">
              DISHA 8.2 does not operate as a payment gateway, wallet or escrow service. It does not collect merchant funds into a DISHA 8.2 settlement account or retain those funds before releasing them to the business.
            </p>
          </div>
        </div>
        <div className="field">
          <label style="font-weight:700;color:var(--disha-violet);text-transform:uppercase;font-size:0.875rem;letter-spacing:0.08em;display:block;margin-bottom:0.5rem;">Who it is for</label>
          <div className="card" style="padding:1rem;">
            <p style="font-size:0.9375rem;color:var(--prism-text-secondary);margin:0;">
              Businesses, merchants and growing enterprises that process digital payments and want a clearer way to manage payment expenses and transaction records.
            </p>
          </div>
        </div>
      </div>
      <div className="field-group" style="margin-top: 2rem;">
        <label style="font-weight:700;color:var(--disha-violet);text-transform:uppercase;font-size:0.875rem;letter-spacing:0.08em;display:block;margin-bottom:0.5rem;">International outlook</label>
        <div className="card" style="padding:1rem;">
          <p style="font-size:0.9375rem;color:var(--prism-text-secondary);margin:0;">
            DISHA 8.2 welcomes business inquiries from India, Dubai, the wider United Arab Emirates and Bahrain.
            Country-specific services depend on actual product availability, applicable requirements and supported financial infrastructure.
          </p>
        </div>
      </div>
      <button className="btn-primary" style="margin-top: 1.5rem;" onClick={() => window.location.href='/contact'}>Request a commercial proposal</button>
    </section>
  )
}
