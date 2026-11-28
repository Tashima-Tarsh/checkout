import React from 'react'

export const Terms: React.FC = () => {
  return (
    <section className="prism-glass-strong" style={{"padding":"4rem 1rem"}}>
      <h1 style={{"fontSize":"clamp(2rem,4vw,3.75rem)","lineHeight":"1.15","letterSpacing":"-0.035em","color":"var(--disha-ink)","marginBottom":"1rem"}}>Terms of Service</h1>
      <p style={{"fontSize":"clamp(1rem,1.2vw,1.125rem)","lineHeight":"1.75","color":"var(--disha-muted)","maxWidth":"700px"}}>
        Welcome to DISHA 8.2. These terms of service govern your use of our website and services. By accessing or using our website, you agree to these terms.
      </p>
      <h2 style={{"fontSize":"clamp(1.5rem,3vw,2.25rem)","lineHeight":"1.2","color":"var(--disha-ink)","margin":"1.5rem 0 0.75rem"}}>Use of the website</h2>
      <p style={{"fontSize":"clamp(1rem,1.2vw,1.125rem)","lineHeight":"1.75","color":"var(--disha-muted)","maxWidth":"700px"}}>
        You may use our website for lawful purposes only. You may not use our website to transmit any material that is unlawful, harmful, threatening, abusive, harassing, defamatory, vulgar, obscene or otherwise objectionable.
      </p>
      <h2 style={{"fontSize":"clamp(1.5rem,3vw,2.25rem)","lineHeight":"1.2","color":"var(--disha-ink)","margin":"1.5rem 0 0.75rem"}}>Intellectual property</h2>
      <p style={{"fontSize":"clamp(1rem,1.2vw,1.125rem)","lineHeight":"1.75","color":"var(--disha-muted)","maxWidth":"700px"}}>
        All content on this website, including text, graphics, logos, images and software, is the property of DISHA 8.2 and is protected by copyright and other intellectual property laws.
      </p>
      <h2 style={{"fontSize":"clamp(1.5rem,3vw,2.25rem)","lineHeight":"1.2","color":"var(--disha-ink)","margin":"1.5rem 0 0.75rem"}}>Disclaimer</h2>
      <p style={{"fontSize":"clamp(1rem,1.2vw,1.125rem)","lineHeight":"1.75","color":"var(--disha-muted)","maxWidth":"700px"}}>
        DISHA 8.2 is provided on an 'as is' basis without warranties of any kind. We do not warrant that the website will be error-free or uninterrupted.
      </p>
      <h2 style={{"fontSize":"clamp(1.5rem,3vw,2.25rem)","lineHeight":"1.2","color":"var(--disha-ink)","margin":"1.5rem 0 0.75rem"}}>Limitation of liability</h2>
      <p style={{"fontSize":"clamp(1rem,1.2vw,1.125rem)","lineHeight":"1.75","color":"var(--disha-muted)","maxWidth":"700px"}}>
        To the maximum extent permitted by law, DISHA 8.2 shall not be liable for any indirect, incidental, consequential, special or punitive damages arising out of or in connection with your use of our website.
      </p>
      <h2 style={{"fontSize":"clamp(1.5rem,3vw,2.25rem)","lineHeight":"1.2","color":"var(--disha-ink)","margin":"1.5rem 0 0.75rem"}}>Governing law</h2>
      <p style={{"fontSize":"clamp(1rem,1.2vw,1.125rem)","lineHeight":"1.75","color":"var(--disha-muted)","maxWidth":"700px"}}>
        These terms are governed by the laws of India.
      </p>
      <button className="btn-primary" style={{"marginTop":"1.5rem"}} onClick={() => window.location.href='/contact'}>Contact us</button>
    </section>
  )
}
