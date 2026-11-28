import React from 'react'

export const OwnerDashboard: React.FC = () => {
  return (
    <section className="prism-glass-strong" style="padding: 4rem 1rem;">
      <div className="page-header">
        <h1 style="font-size:clamp(2rem,4vw,3.75rem);line-height:1.15;letter-spacing:-0.035em;color:var(--disha-ink);margin-bottom:1rem;">Super Admin Control Center</h2>
        <p style="font-size:clamp(1rem,1.2vw,1.125rem);line-height:1.75;color:var(--disha-muted);max-width:700px;">
          Merchant, agent, transaction, and receipt management across all tenants.
        </p>
      </div>

      <div className="stat-grid">
        <div className="stat-card primary">
          <div className="stat-label">Total Merchants</div>
          <div className="stat-value">0</div>
          <div className="stat-trend neutral">Registered merchants</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Active Agents</div>
          <div className="stat-value">0</div>
          <div className="stat-trend neutral">Online devices</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Checkouts</div>
          <div className="stat-value">0</div>
          <div className="stat-trend neutral">All-time sessions</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Platform Volume</div>
          <div className="stat-value">₹0.00</div>
          <div className="stat-trend neutral">All confirmed debits</div>
        </div>
      </div>

      <div className="dashboard-grid">
        <div className="prism-glass" style="grid-column: 1 / -1;">
          <div className="sectionheading">
            <span class="step">01</span>
            <div><h2>Merchant Management</h2><p>Assign merchants, audit activity, manage UPI accounts.</p></div></div>
            <div className="table-wrap" style="margin-top: 1rem;">
              <table class="table">
                <thead><tr><th>Merchant</th><th>Agent Device</th><th>UPI Accounts</th><th>Daily Collected</th><th>Status</th></tr></thead>
                <tbody><tr><td colspan="5" style="text-align:center;color:var(--prism-text-muted);">No merchants registered.</td></tr></tbody>
              </table>
            </div>
          </div>
        </div>
      </section>
  )
}
