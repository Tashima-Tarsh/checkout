import React from 'react';

export const Home: React.FC = () => {
  return (
    <div className="hero-section">
      <div className="hero-canvas" id="hero-canvas"></div>
      <div className="hero-content">
        <div className="hero-eyebrow">Introducing a new direction for Indian commerce</div>
        <h1 className="hero-h1">DISHA 8.2</h1>
        <p className="hero-p">
          DISHA 8.2 brings a software-led approach to payments, helping businesses manage their payment operations without DISHA 8.2 holding their money.
        </p>
        <div className="hero-actions">
          <button className="btn-primary" onClick={() => window.location.href='/checkout/'}>
            Discover DISHA 8.2
          </button>
          <button className="btn-secondary" onClick={() => window.location.href='/payment-cost-calculator/'}>
            Calculate your payment costs
          </button>
        </div>
        <div className="rupee-badge">
          <span className="rupee-symbol">₹</span>
          <span className="rupee-label">Verified payment software</span>
        </div>
      </div>
    </section>
  );
}

export default Home;
