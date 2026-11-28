import React from 'react'

export const CookiePreferences: React.FC = () => {
  return (
    <section className="prism-glass-strong" style={{"padding":"4rem 1rem"}}>
      <h1 style={{"fontSize":"clamp(2rem,4vw,3.75rem)","lineHeight":"1.15","letterSpacing":"-0.035em","color":"var(--disha-ink)","marginBottom":"1rem"}}>Cookie Preferences</h1>
      <p style={{"fontSize":"clamp(1rem,1.2vw,1.125rem)","lineHeight":"1.75","color":"var(--disha-muted)","maxWidth":"700px"}}>
        We use cookies to improve your experience on our website. You can manage your cookie preferences below.
      </p>
      <div className="field-group" style={{"marginTop":"1.5rem"}}>
        <div className="field">
          <div style={{"display":"flex","alignItems":"flex-start","gap":"0.5rem"}}>
            <input type="checkbox" id="essential-cookies" checked disabled className="field input" style={{width:'auto',marginTop:'0.25rem'}} />
            <label style={{fontSize: '0.875rem',color:'var(--prism-text-secondary)'}}>Essential cookies - Required for the website to function properly.</label>
          </div>
        </div>
        <div className="field">
          <div style={{"display":"flex","alignItems":"flex-start","gap":"0.5rem"}}>
            <input type="checkbox" id="analytics-cookies" className="field input" style={{width:'auto',marginTop:'0.25rem'}} />
            <label style={{fontSize: '0.875rem',color:'var(--prism-text-secondary)'}}>Analytics cookies - Help us understand how visitors interact with our website.</label>
          </div>
        </div>
        <div className="field">
          <div style={{"display":"flex","alignItems":"flex-start","gap":"0.5rem"}}>
            <input type="checkbox" id="marketing-cookies" className="field input" style={{width:'auto',marginTop:'0.25rem'}} />
            <label style={{fontSize: '0.875rem',color:'var(--prism-text-secondary)'}}>Marketing cookies - Used to deliver relevant advertisements and measure campaign effectiveness.</label>
          </div>
        </div>
      </div>
      <button className="btn-primary" style={{"marginTop":"1.5rem"}}>Save preferences</button>
    </section>
  )
}
