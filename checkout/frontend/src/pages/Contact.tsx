import React, { useState } from 'react'

export const Contact: React.FC = () => {
  const [submitted, setSubmitted] = useState(false)

  return (
    <section className="prism-glass-strong" style={{"padding":"4rem 1rem","maxWidth":"800px","margin":"0 auto"}}>
      <div className="page-header">
        <h1 style={{"fontSize":"clamp(2rem,4vw,3.75rem)","lineHeight":"1.15","letterSpacing":"-0.035em","color":"var(--disha-ink)","marginBottom":"1rem"}}>Contact Us</h1>
        <p style={{"fontSize":"clamp(1rem,1.2vw,1.125rem)","lineHeight":"1.75","color":"var(--disha-muted)","maxWidth":"700px"}}>
          If you are reviewing your payment expenses, considering alternatives to your current provider or looking for a clearer way to manage your payment activities, we would welcome a conversation.
        </p>
      </div>
      <form className="field-group" onSubmit={(e) => { e.preventDefault(); setSubmitted(true) }}>
        <div className="field-group two">
          <div className="field">
            <label>Name</label>
            <input type="text" placeholder="Your name" className="field input" required />
          </div>
          <div className="field">
            <label>Company name</label>
            <input type="text" placeholder="Your company" className="field input" required />
          </div>
        </div>
        <div className="field-group two">
          <div className="field">
            <label>Business email</label>
            <input type="email" placeholder="you@company.com" className="field input" required />
          </div>
          <div className="field">
            <label>Country</label>
            <select className="field input">
              <option value="IN">India</option>
              <option value="AE">Dubai & UAE</option>
              <option value="BH">Bahrain</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
        </div>
        <div className="field">
          <label>Approximate monthly payment volume (₹)</label>
          <input type="number" min="0" step="100000" placeholder="e.g. 1000000" className="field input" />
        </div>
        <div className="field">
          <label>Existing payment provider (optional)</label>
          <input type="text" placeholder="e.g. Razorpay, PhonePe" className="field input" />
        </div>
        <div className="field">
          <label>Business requirements</label>
          <textarea rows="4" placeholder="Tell us about your payment needs…" className="field input"></textarea>
        </div>
        <div className="field">
          <div style={{"display":"flex","alignItems":"flex-start","gap":"0.5rem"}}>
            <input type="checkbox" id="consent" className="field input" style={{width: 'auto'}} required />
            <label style={{fontSize: '0.875rem', color: 'var(--prism-text-secondary)'}}>I consent to DISHA 8.2 contacting me about payment services.</label>
          </div>
        </div>
        <button className="btn-primary" type="submit" style={{"width":"100%","padding":"0.75rem 2rem","fontSize":"1.1rem"}}>
          Submit Inquiry
        </button>
      </form>
      {submitted && (
        <div className="alert" style={{"marginTop":"1.5rem"}}>
          Inquiry not sent: online submission is not connected yet. Please use the published contact channels.
        </div>
      )}
    </section>
  )
}
