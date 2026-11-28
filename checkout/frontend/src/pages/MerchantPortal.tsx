import React, { useState, useEffect } from 'react'

export const MerchantPortal: React.FC = () => {
  const [sessions, setSessions] = useState<any[]>([])
  const [dailyLimit, setDailyLimit] = useState<any>(null)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [sessionsRes, limitRes] = await Promise.all([
        fetch('http://localhost:8000/api/sessions'),
        fetch('http://localhost:8000/api/admin/daily-limit')
      ])
      const sessionsData = await sessionsRes.json()
      const limitData = await limitRes.json()
      setSessions(sessionsData.sessions || [])
      setDailyLimit(limitData)
    } catch (e) {
      console.error('Failed to load merchant data:', e)
    }
  }

  return (
    <section className="prism-glass-strong" style="padding: 4rem 1rem;">
      <div className="page-header">
        <h1 style="font-size:clamp(2rem,4vw,3.75rem);line-height:1.15;letter-spacing:-0.035em;color:var(--disha-ink);margin-bottom:1rem;">Merchant Dashboard</h1>
        <p style="font-size:clamp(1rem,1.2vw,1.125rem);line-height:1.75;color:var(--disha-muted);max-width:700px;">
          Your business dashboard - manage checkouts, verify payments, and track daily collection.
        </p>
      </div>

      <div className="stat-grid">
        <div className="stat-card primary">
          <div className="stat-label">Total Checkouts</div>
          <div className="stat-value">{sessions.length}</div>
          <div className="stat-trend neutral">Sessions created</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Daily Collected</div>
          <div className="stat-value">₹{(dailyLimit?.collected_today_paise || 0)/100}.toFixed(2)</div>
          <div className="stat-trend neutral">₹{((dailyLimit?.daily_limit_paise || 7000000) - (dailyLimit?.collected_today_paise || 0))/100}.toFixed(2) remaining</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Active Checkouts</div>
          <div className="stat-value">{sessions.filter((s: any) => s.state === 'PENDING_OCR' || s.state === 'PENDING').length}</div>
          <div className="stat-trend neutral">Awaiting payment</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Daily Limit</div>
          <div className="stat-value">₹{(dailyLimit?.daily_limit_paise || 7000000)/100}.toFixed(2)</div>
          <div className="stat-trend neutral">P2P cap per device</div>
        </div>
      </div>

      <div className="table-wrap" style="margin-top: 2rem;">
        <div className="table">
          <thead>
            <tr>
              <th>Order ID</th><th>Amount</th><th>Mode</th><th>Status</th><th>Time</th><th>Action</th>
            </tr>
          </thead>
          <tbody>
            {sessions.slice(0, 10).map((s: any) => (
              <tr key={s.id}>
                <td>{s.id || '—'}</td>
                <td>₹{((s.amount_paise || 0)/100).toFixed(2)}</td>
                <td>{s.mode || 'P2P'}</td>
                <td><span className="badge badge-success">{s.state || 'PENDING'}</span></td>
                <td>{s.created ? new Date((s.created || Date.now()/1000)*1000).toLocaleTimeString('en-IN') : '—'}</td>
                <td><button className="btn-secondary" style="padding:0.4rem 0.8rem;font-size:0.875rem;">View</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
