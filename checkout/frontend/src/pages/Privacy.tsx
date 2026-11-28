import React from 'react'

export const Privacy: React.FC = () => {
  return (
    <section className="prism-glass-strong" style="padding: 4rem 1rem;">
      <h1 style="font-size:clamp(2rem,4vw,3.75rem);line-height:1.15;letter-spacing:-0.035em;color:var(--disha-ink);margin-bottom:1rem;">Privacy Policy</h2>
      <p style="font-size:clamp(1rem,1.2vw,1.125rem);line-height:1.75;color:var(--disha-muted);max-width:700px;">
        DISHA 8.2 is committed to protecting your privacy. This privacy policy explains how we collect, use and protect your personal information when you visit our website or use our services.
      </p>
      <h2 style="font-size:clamp(1.5rem,3vw,2.25rem);line-height:1.2;color:var(--disha-ink);margin:1.5rem 0 0.75rem;">Information we collect</h2>
      <p style="font-size:clamp(1rem,1.2vw,1.125rem);line-height:1.75;color:var(--disha-muted);max-width:700px;">
        We collect information you provide directly to us, such as your name, company name, email address, telephone number, country and payment volume when you submit an inquiry or register for our services.
      </p>
      <h2 style="font-size:clamp(1.5rem,3vw,2.25rem);line-height:1.2;color:var(--disha-ink);margin:1.5rem 0 0.75rem;">How we use your information</h2>
      <p style="font-size:clamp(1rem,1.2vw,1.125rem);line-height:1.75;color:var(--disha-muted);max-width:700px;">
        We use your information to respond to your inquiries, provide our services, communicate with you and improve our website and services.
      </p>
      <h2 style="font-size:clamp(1.5rem,3vw,2.25rem);line-height:1.2;color:var(--disha-ink);margin:1.5rem 0 0.75rem;">Data sharing</h2>
      <p style="font-size:clamp(1rem,1.2vw,1.125rem);line-height:1.75;color:var(--disha-muted);max-width:700px;">
        We do not sell your personal information. We may share information with service providers who help us operate our website and conduct our business, subject to confidentiality obligations.
      </p>
      <h2 style="font-size:clamp(1.5rem,3vw,2.25rem);line-height:1.2;color:var(--disha-ink);margin:1.5rem 0 0.75rem;">Your rights</h2>
      <p style="font-size:clamp(1rem,1.2vw,1.125rem);line-height:1.75;color:var(--disha-muted);max-width:700px;">
        You may request access to, correction of or deletion of your personal information by contacting us.
      </p>
      <button className="btn-primary" style="margin-top: 1.5rem;" onClick={() => window.location.href='/contact'}>Contact us</button>
    </section>
  )
}
