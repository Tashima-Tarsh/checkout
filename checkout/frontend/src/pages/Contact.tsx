import React, { useState } from 'react';

export const Contact: React.FC = () => {
  const [submitted, setSubmitted] = useState(false);

  return (
    <section className="prism-glass-strong" style="padding: 4rem 1rem;">
      <div className="page-header">
        <h1 style="font-size:clamp(2rem,4vw,3.75rem);line-height:1.15;letter-spacing:-0.035em;color:var(--disha-ink);margin-bottom:1rem;">Contact Us</h2>
        <p style="font-size:clamp(1rem,1.2vw,1.125rem);line-height:1.75;color:var(--disha-muted);max-width:700px;">
          If you are reviewing your payment expenses, considering alternatives to your current provider or looking for a clearer way to manage your payment activities, we would welcome a conversation.
        </p>
      </div>
      <form className="field-group" onSubmit={(e) => { e.preventDefault(); setSubmitted(true); }}>
        <div className="field-group two">
          <div class="field">
            <label>Name</label>
            <input type="text" id="name" placeholder="Your name" required className="field input" />
          </div>
          <div class="field">
            <label>Company name</label>
            <input type="text" id="company" placeholder="Your company" required className="field input" />
          </div>
        </div>
        <div className="field-group two">
          <div class="field">
            <label>Business email</label>
            <input type="email" id="email" placeholder="you@company.com" required className="field input" />
          </div>
          <div class="field">
            <label>Country</label>
            <select id="country" className="field input" required>
              <option value="IN">India</option>
              <option value="AE">Dubai & UAE</option>
              <option value="BH">Bahrain</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
        </div>
        <div class="field">
          <label>Approximate monthly payment volume (₹)</label>
          <input type="number" id="volume" min="0" step="100000" placeholder="e.g. 1000000" className="field input" />
        </div>
        <div class="field">
          <label>Existing payment provider (optional)</label>
          <input type="text" id="provider" placeholder="e.g. Razorpay, PhonePe" className="field input" />
        </div>
        <div class="field">
          <label>Business requirements</label>
          <textarea id="message" rows="5" placeholder="Tell us about your payment needs…" className="field input"></textarea>
        </div>
        <div className="field">
          <div style={{display:'flex',alignItems:'flex-start',gap:'0.5rem'}}>
            <input type="checkbox" id="consent" required className="field input" style={{width:'auto',marginTop:'0.25rem'}} />
            <label style={{fontSize:'0.875rem',color:'var(--disha-muted)'}}>I consent to DISHA 8.2 contacting me about payment services.</label>
          </div>
        </div>
        <button className="btn-primary" type="submit" style="width:100%;padding:0.75rem 2rem;font-size:1.1rem;">
          Submit Inquiry
        </button>
      </form>
      {submitted && (
        <div className="alert alert-success" style="margin-top:1rem;">
          Thank you! Our team will review your inquiry and get in touch soon.
        </div>
      )}
    </section>
  );
}

export default Contact;
