import React from 'react'

export const CookiePreferences: React.FC = () => {
  return (
    <section className="prism-glass-strong" style="padding: 4rem 1rem;">
      <h1 style="font-size:clamp(2rem,4vw,3.75rem);line-height:1.15;letter-spacing:-0.035em;color:var(--disha-ink);margin-bottom:1rem;">Cookie Preferences</h2>
      <p style="font-size:clamp(1rem,1.2vw,1.125rem);line-height:1.75;color:var(--disha-muted);max-width:700px;">
        We use cookies to improve your experience on our website. You can manage your cookie preferences below.
      </p>
      <div className="field-group" style="margin-top: 1.5rem;">
        <div class="field">
          <div style="display:flex;align-items:flex-start;gap:0.5rem;">
            <input type="checkbox" id="essential-cookies" checked disabled className="field input" style={{width:'auto',marginTop:'0.25rem'}} />
            <label style={{fontSize: '0.875rem',color:var(--prism-text-secondary)}}>Essential cookies - Required for the website to function properly.</label>
          </div>
        </div>
        <div class="field">
          <div style="display:flex;align-items:flex-start;gap:0.5rem;">
            <input type="checkbox" id="analytics-cookies" className="field input" style={{width:'auto',marginTop:'0.25rem'}} />
            <label style={{fontSize: '0.875rem',color:var(--prism-text-secondary)}}>Analytics cookies - Help us understand how visitors interact with our website.</label>
          </div>
        </div>
        <div class="field">
          <div style="display:flex;align-items:flex-start;gap:0.5rem;">
            <input type="checkbox" id="marketing-cookies" className="field input" style={{width:'auto',marginTop:'0.25rem'}} />
            <label style={{fontSize: '0.875rem',color:var(--prism-text-secondary)}}>Marketing cookies - Used to deliver relevant advertisements and measure campaign effectiveness.</label>
          </div>
        </div>
      </div>
      <button className="btn-primary" style="margin-top: 1.5rem;">Save preferences</button>
    </section>
  )
}
