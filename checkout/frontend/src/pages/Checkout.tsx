import React, { useState, useEffect, useRef } from 'react'

export const Checkout: React.FC = () => {
  const [session, setSession] = useState<any>(null)
  const [step, setStep] = useState<'create' | 'verify' | 'verified'>('create')
  const [secondsRemaining, setSecondsRemaining] = useState(0)
  const [orderExpiresAt, setOrderExpiresAt] = useState(0)
  const [pollTimer, setPollTimer] = useState<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const orderId = params.get('order')
    if (orderId) {
      loadSession(orderId)
    }
  }, [])

  const loadSession = async (orderId: string) => {
    try {
      const res = await fetch(`http://localhost:8000/api/sessions/${orderId}`)
      const data = await res.json()
      setSession(data)
      setStep(data.state === 'PAID' || data.settlement?.satisfied ? 'verified' : 'verify')
      setOrderExpiresAt(data.expires || Date.now() / 1000 + 120)
      startPolling(data)
    } catch (e) {
      console.error('Failed to load checkout:', e)
    }
  }

  const createCheckout = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'P2P',
          vpa: 'person@upi',
          name: 'Customer',
          amount_paise: 10000
        })
      })
      const data = await res.json()
      setSession(data)
      setStep('verify')
      setOrderExpiresAt(data.expires || Date.now() / 1000 + 120)
      startPolling(data)
    } catch (e) {
      console.error('Failed to create checkout:', e)
    }
  }

  const startPolling = (session: any) => {
    if (pollTimer) clearInterval(pollTimer)
    const timer = setInterval(async () => {
      if (session.state === 'PAID' || session.state === 'EXPIRED') {
        clearInterval(pollTimer!)
        return
      }
      try {
        const res = await fetch(`http://localhost:8000/api/sessions/${session.token}`, {
          headers: { 'Authorization': 'Bearer ' + session.token }
        })
        const data = await res.json()
        setSession(data)
        if (data.state === 'PAID' || data.settlement?.satisfied) {
          setStep('verified')
          clearInterval(pollTimer!)
        }
      } catch (e) {
        // Silent retry
      }
    }, 5000)
    setPollTimer(timer)
  }

  const secondsLeft = Math.max(0, orderExpiresAt - Date.now() / 1000)

  useEffect(() => {
    if (step === 'verify' && secondsRemaining > 0) {
      const t = setInterval(() => setSecondsRemaining((prev) => Math.max(0, prev - 1)), 1000)
      return () => clearInterval(t)
    }
  }, [session, secondsRemaining])

  if (step === 'create') {
    return (
      <section className="prism-glass-strong" style="padding: 4rem 1rem; max-width: 600px; margin: 2rem auto;">
        <div className="section-eyebrow" style="font-size:0.875rem;font-weight:800;letter-spacing:0.16em;color:var(--disha-violet);text-transform:uppercase;display:block;margin-bottom:1rem;">Create Payment Link</div>
        <h2 style="font-size:clamp(2rem,4vw,3.75rem);line-height:1.15;letter-spacing:-0.035em;color:var(--disha-ink);margin-bottom:1rem;">Create Payment Link</h2>
        <p style="font-size:clamp(1rem,1.2vw,1.125rem);line-height:1.75;color:var(--disha-muted);max-width:570px;margin-bottom:1.5rem;">
          Customer pays via UPI. Verification completes within 120 seconds.
        </p>
        <button className="btn-primary" type="button" onClick={createCheckout} style="width:100%;padding:1rem 2rem;font-size:1.1rem;">
          Create Payment Link
        </button>
        <p className="notice" style="margin-top: 1rem;">
          No client-submitted proof sets financially_verified=true. Fail-closed: verified remains 0 until server match.
        </p>
      </section>
    )
  }

  if (step === 'verify') {
    return (
      <section className="prism-glass-strong" style="padding: 4rem 1rem; max-width: 600px; margin: 2rem auto;">
        <div className="verify-container" style="text-align:center;">
          <div className="verify-icon" style="font-size:3rem;margin-bottom:1rem;">⏳</div>
          <h2 style="font-size:clamp(1.5rem,3vw,2.5rem);color:var(--disha-ink);margin-bottom:0.5rem;">Payment Verification</h2>
          <div className="verify-text">
            <div className="verify-title" style="font-weight:700;color:var(--disha-ink);margin-bottom:0.5rem;">Waiting for payment…</div>
            <div className="verify-sub" style="font-size:0.9375rem;color:var(--disha-muted);">Customer has not yet paid via UPI.</div>
          </div>
          <div className="timer-display" style="margin-top:1.5rem;font-weight:bold;color:var(--disha-emerald-500);font-size:1.5rem;">
            Time remaining: {Math.floor(secondsRemaining / 60)}:{String(secondsRemaining % 60).padStart(2,'0')}s
          </div>
          <div className="verify-actions" style="margin-top:1.5rem;display:flex;gap:0.5rem;">
            <button className="btn-secondary" style="padding:0.75rem 1.5rem;">Refresh Status</button>
            <button className="btn-secondary" style="padding:0.75rem 1.5rem;">Copy UPI ID Again</button>
          </div>
          <div className="verify-note" style="margin-top:1rem;font-size:0.875rem;color:var(--disha-muted);">
            <strong>Important:</strong> Returning to this page, copying the UPI ID, or waiting does not confirm payment. Funds are verified only when the server matches the debit.
          </div>
        </div>
      </section>
    )
  }

  if (step === 'verified') {
    return (
      <section className="prism-glass-strong" style="padding: 4rem 1rem; max-width: 600px; margin: 2rem auto; text-align:center;">
        <div className="success-animation" style="margin-bottom:1rem;">
          <div className="rupee-coin" style="font-size:3rem;display:flex;align-items:center;justify-content:center;">₹</div>
          <div className="verify-seal" style="display:flex;align-items:center;gap:0.5rem;">
            <span className="seal-check" style="color:var(--disha-emerald-500);font-size:2rem;">✓</span>
            <span className="seal-text" style="font-weight:700;color:var(--disha-emerald-500);">Verified</span>
          </div>
        </div>
        <h2 style="font-size:clamp(2rem,4vw,3.75rem);color:var(--disha-ink);margin-bottom:1rem;">Payment Verified</h2>
        <p style="font-size:clamp(1rem,1.2vw,1.125rem);color:var(--disha-muted);margin-bottom:1.5rem;">Debit confirmed by server. Receipt generated.</p>
        <div className="success-meta" style="margin-bottom:1.5rem;">
          <div style="display:flex;justify-content:space-between;">
            <span style="font-size:0.875rem;color:var(--disha-muted);">Order ID</span>
            <span style="font-weight:700;color:var(--disha-ink);">{session?.id || '—'}</span>
          </div>
          <div style="display:flex;justify-content:space-between;">
            <span style="font-size:0.875rem;color:var(--disha-muted);">Amount</span>
            <span style="font-weight:700;color:var(--disha-ink);">₹{session?.amount_paise ? (session.amount_paise/100).toFixed(2) : '0.00'}</span>
          </div>
          <div style="display:flex;justify-content:space-between;">
            <span style="font-size:0.875rem;color:var(--disha-muted);">UPI ID</span>
            <span style="font-weight:700;color:var(--disha-ink);">{session?.vpa || '—'}</span>
          </div>
        </div>
        <div className="success-actions" style="display:flex;gap:0.5rem;">
          <button className="btn-primary" type="button" style="flex:1;">View Receipt</button>
          <button className="btn-secondary" type="button" style="flex:1;" onClick={() => {setSession(null);setStep('create');setOrderExpiresAt(0);setSecondsRemaining(0);if(pollTimer)clearInterval(pollTimer);}}>New Checkout</button>
        </div>
      </section>
    )
  }

  return null
}
