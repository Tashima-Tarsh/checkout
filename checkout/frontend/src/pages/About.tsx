import React from 'react';

export const About: React.FC = () => {
  return (
    <section className="prism-glass-strong" style={{ padding: '4rem 1rem', maxWidth: '900px', margin: '0 auto' }}>
      <div className="section-eyebrow" style={{ fontSize: '0.875rem', fontWeight: '800', letterSpacing: '0.16em', color: 'var(--disha-violet)', textTransform: 'uppercase', display: 'block', marginBottom: '1rem' }}>About DISHA 8.2</div>
      <h1 style={{ fontSize: 'clamp(2rem,4vw,3.75rem)', lineHeight: '1.15', letterSpacing: '-0.035em', color: 'var(--disha-ink)', marginBottom: '1rem' }}>A software-led approach to business payments</h2>
      <p style={{ fontSize: 'clamp(1rem,1.2vw,1.125rem)', lineHeight: '1.75', color: 'var(--disha-muted)', maxWidth: '700px', marginBottom: '1.5rem' }}>
        DISHA 8.2 is a payment software product developed with the commercial realities of Indian businesses in mind. It helps businesses manage supported payment activities, transaction visibility and customer payment experiences without taking custody of merchant funds.
      </p>
      <div className="field-group two" style={{ marginTop: '2rem' }}>
        <div className="field">
          <label style={{ fontWeight: '700', color: 'var(--disha-violet)', textTransform: 'uppercase', fontSize: '0.875rem', letterSpacing: '0.08em', display: 'block', marginBottom: '0.5rem' }}>Our belief</label>
          <div className="card" style={{ padding: '1rem' }}>
            <p style={{ fontSize: '0.9375rem', color: 'var(--prism-text-secondary)', margin: '0' }}>
              Payments should move a business forward, not become a burden. DISHA 8.2 focuses on the software surrounding payment activities rather than taking possession of the money being transferred.
            </p>
          </div>
        </div>
        <div className="field">
          <label style={{ fontWeight: '700', color: 'var(--disha-violet)', textTransform: 'uppercase', fontSize: '0.875rem', letterSpacing: '0.08em', display: 'block', marginBottom: '0.5rem' }}>What we do</label>
          <div className="card" style={{ padding: '1rem' }}>
            <p style={{ fontSize: '0.9375rem', color: 'var(--prism-text-secondary)', margin: '0' }}>
              We help businesses understand their payment expenses, manage supported payment activities and access clearer transaction information through a software service.
            </p>
          </div>
        </div>
      </div>
      <div className="field-group two" style={{ marginTop: '2rem' }}>
        <div className="field">
          <label style={{ fontWeight: '700', color: 'var(--disha-violet)', textTransform: 'uppercase', fontSize: '0.875rem', letterSpacing: '0.08em', display: 'block', marginBottom: '0.5rem' }}>What we do not do</label>
          <div className="card" style={{ padding: '1rem' }}>
            <p style={{ fontSize: '0.9375rem', color: 'var(--prism-text-secondary)', margin: '0' }}>
              DISHA 8.2 does not operate as a payment gateway, wallet or escrow service. It does not collect merchant funds into a DISHA 8.2 settlement account or retain those funds before releasing them to the business.
            </p>
          </div>
        </div>
        <div className="field">
          <label style={{ fontWeight: '700', color: 'var(--disha-violet)', textTransform: 'uppercase', fontSize: '0.875rem', letterSpacing: '0.08em', display: 'block', marginBottom: '0.5rem' }}>Who it is for</label>
          <div className="card" style={{ padding: '1rem' }}>
            <p style={{ fontSize: '0.9375rem', color: 'var(--prism-text-secondary)', margin: '0' }}>
              Businesses, merchants and growing enterprises that process digital payments and want a clearer way to manage payment expenses and transaction records.
            </p>
          </div>
        </div>
      </div>
      <div className="field-group" style={{ marginTop: '2rem' }}>
        <label style={{ fontWeight: '700', color: 'var(--disha-violet)', textTransform: 'uppercase', fontSize: '0.875rem', letterSpacing: '0.08em', display: 'block', marginBottom: '0.5rem' }}>International outlook</label>
        <div className="card" style={{ padding: '1rem' }}>
          <p style={{ fontSize: '0.9375rem', color: 'var(--prism-text-secondary)', margin: '0' }}>
            DISHA 8.2 welcomes business inquiries from India, Dubai, the wider United Arab Emirates and Bahrain. Country-specific services depend on actual product availability, applicable requirements and supported financial infrastructure.
          </p>
        </div>
      </div>
      <button className="btn-primary" style={{ marginTop: '1.5rem' }} onClick={() => window.location.href='/contact/'}>Request a commercial proposal</button>
    </section>
  );
};

export default About;
