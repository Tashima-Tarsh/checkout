import React from 'react'

export const AgentPortal: React.FC = () => {
  return (
    <section className="prism-glass-strong" style="padding: 4rem 1rem;">
      <div className="page-header">
        <h1 style="font-size:clamp(2rem,4vw,3.75rem);line-height:1.15;letter-spacing:-0.035em;color:var(--disha-ink);margin-bottom:1rem;">Agent Portal</h2>
        <p style="font-size:clamp(1rem,1.2vw,1.125rem);line-height:1.75;color:var(--disha-muted);max-width:700px;">
          Agent mobile dashboard - active checkouts, refunds, history, device management, and UPI app switcher.
        </p>
      </div>

      <div className="stat-grid">
        <div className="stat-card primary">
          <div className="stat-label">Active Checkouts</div>
          <div className="stat-value">0</div>
          <div className="stat-trend neutral">Waiting for payment</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Daily Collected</div>
          <div className="stat-value">₹0.00</div>
          <div className="stat-trend neutral">₹70,000 daily cap</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Device Status</div>
          <div className="stat-value">Online</div>
          <div className="stat-trend neutral">Heartbeat active</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Registered UPIs</div>
          <div className="stat-value">0</div>
          <div className="stat-trend neutral">Max 15 per device</div>
        </div>
      </div>

      <div className="dashboard-grid">
        <div className="prism-glass" style="grid-column: 1 / -1;">
          <div className="sectionheading">
            <span class="step">01</span>
            <div><h2>Active Checkouts</h2><p>Orders awaiting customer payment.</p></div></div>
            <div className="table-wrap" style="margin-top: 1rem;">
              <table class="table">
                <thead><tr><th>Order ID</th><th>Amount</th><th>UPI ID</th><th>Status</th><th>Time Left</th></tr></thead>
                <tbody>
                  <tr><td colspan="5" style="text-align:center;color:var(--prism-text-muted);">No active checkouts.</td></tr>
                </tbody>
              </table>
            </div>
          </div>
          <div className="prism-glass">
            <div className="sectionheading"><span class="step">02</span><div><h2>Quick Actions</h2><p>Create checkout, verify payment, issue refund.</p></div></div>
            <div className="field-group two" style="margin-top: 1rem;">
              <div class="field">
                <button className="btn-primary" type="button" style="width:100%;">Create Checkout</button>
              </div>
              <div class="field">
                <button className="btn-secondary" type="button" style="width:100%;">Verify Payment</button>
              </div>
              <div class="field">
                <button className="btn-secondary" type="button" style="width:100%;">Issue Refund</button>
              </div>
            </div>
          </div>
        </div>
      </section>
  )
}
