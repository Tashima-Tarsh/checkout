import React from 'react'

export const OwnerDashboard: React.FC = () => {
  return (
    <section className="prism-glass-strong" style={{"padding":"4rem 1rem"}}>
      <div className="page-header">
        <h1 style={{"fontSize":"clamp(2rem,4vw,3.75rem)","lineHeight":"1.15","letterSpacing":"-0.035em","color":"var(--disha-ink)","marginBottom":"1rem"}}>Super Admin Control Center</h1>
        <p style={{"fontSize":"clamp(1rem,1.2vw,1.125rem)","lineHeight":"1.75","color":"var(--disha-muted)","maxWidth":"700px"}}>
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
        <div className="prism-glass" style={{"gridColumn":"1 / -1"}}>
          <div className="sectionheading">
            <span className="step">01</span>
            <div><h2>Merchant Management</h2><p>Assign merchants, audit activity, manage UPI accounts.</p></div></div>
            <div className="table-wrap" style={{"marginTop":"1rem"}}>
              <table className="table">
                <thead><tr><th>Merchant</th><th>Agent Device</th><th>UPI Accounts</th><th>Daily Collected</th><th>Status</th></tr></thead>
                <tbody><tr><td colSpan={5} style={{"textAlign":"center","color":"var(--prism-text-muted)"}}>No merchants registered.</td></tr></tbody>
              </table>
            </div>
          </div>
        </div>
      </section>
  )
}
