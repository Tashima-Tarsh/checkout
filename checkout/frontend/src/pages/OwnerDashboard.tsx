import React from 'react';

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
          <div className="stat-trend neutral">All tenants</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Active Agents</div>
          <div className="stat-value">0</div>
          <div className="stat-trend neutral">Online devices</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Transactions</div>
          <div className="stat-value">0</div>
          <div className="stat-trend neutral">All-time sessions</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Platform Volume</div>
          <div className="stat-value">₹0.00</div>
          <div className="stat-trend neutral">All confirmed debits</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">AWS Resources</div>
          <div className="stat-value">0</div>
          <div className="stat-trend neutral">ap-southeast-2</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Monthly AWS Cost</div>
          <div className="stat-value">₹0.00</div>
          <div className="stat-trend neutral">Estimated</div>
        </div>
      </div>

      <div className="dashboard-grid">
        <div className="prism-glass" style="grid-column: 1 / -1;">
          <div className="sectionheading">
            <span class="step">01</span>
            <div><h2>Platform Health Overview</h2><p>Real-time health of all merchants and infrastructure.</p></div></div>
            <div className="field-group two" style="margin-top: 1rem;">
              <div class="field">
                <label>Merchant Health</label>
                <div class="health-pill"><span class="health-badge ok">Healthy</span></div>
              </div>
              <div class="field">
                <label>Agent Fleet</label>
                <div class="health-pill"><span class="health-badge ok">Online</span></div>
              </div>
              <div class="field">
                <label>Checkout API</label>
                <div class="health-pill"><span class="health-badge ok">Operational</span></div>
              </div>
              <div class="field">
                <label>Agentic Pay API</label>
                <div class="health-pill"><span class="health-badge ok">Operational</span></div>
              </div>
            </div>
          </div>
          <div className="prism-glass">
            <div className="sectionheading">
              <span class="step">02</span>
              <div><h2>Recent Activity</h2><p>Latest audit events across all merchants.</p></div></div>
              <div className="table-wrap" style="margin-top: 1rem;">
                <table className="table">
                  <thead><tr><th>Time</th><th>Event</th><th>Merchant</th><th>Detail</th></tr></thead>
                  <tbody id="checkout-admin-receipts-table">
                    <tr><td colspan="4" style="text-align:center;color:var(--prism-text-muted);">No merchant transactions.</td></tr>
                  </tbody>
                </table>
              </div>
            </div>
        </div>
      </section>
  );
}

export default OwnerDashboard;
