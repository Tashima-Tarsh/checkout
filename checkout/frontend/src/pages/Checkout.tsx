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
      const res = await fetch(`/api/sessions/${orderId}`)
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
      const res = await fetch('/api/sessions', {
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
        const res = await fetch(`/api/sessions/${session.token}`, {
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
      <section className="prism-glass-strong" style={{"padding":"4rem 1rem","maxWidth":"600px","margin":"2rem auto"}}>
        <div className="section-eyebrow" style={{"fontSize":"0.875rem","fontWeight":"800","letterSpacing":"0.16em","color":"var(--disha-violet)","textTransform":"uppercase","display":"block","marginBottom":"1rem"}}>Create Payment Link</div>
        <h2 style={{"fontSize":"clamp(2rem,4vw,3.75rem)","lineHeight":"1.15","letterSpacing":"-0.035em","color":"var(--disha-ink)","marginBottom":"1rem"}}>Create Payment Link</h2>
        <p style={{"fontSize":"clamp(1rem,1.2vw,1.125rem)","lineHeight":"1.75","color":"var(--disha-muted)","maxWidth":"570px","marginBottom":"1.5rem"}}>
          Customer pays via UPI. Verification completes within 120 seconds.
        </p>
        <button className="btn-primary" type="button" onClick={createCheckout} style={{"width":"100%","padding":"1rem 2rem","fontSize":"1.1rem"}}>
          Create Payment Link
        </button>
        <p className="notice" style={{"marginTop":"1rem"}}>
          No client-submitted proof sets financially_verified=true. Fail-closed: verified remains 0 until server match.
        </p>
      </section>
    )
  }

  if (step === 'verify') {
    return (
      <section className="prism-glass-strong" style={{"padding":"4rem 1rem","maxWidth":"600px","margin":"2rem auto"}}>
        <div className="verify-container" style={{"textAlign":"center"}}>
          <div className="verify-icon" style={{"fontSize":"3rem","marginBottom":"1rem"}}>⏳</div>
          <h2 style={{"fontSize":"clamp(1.5rem,3vw,2.5rem)","color":"var(--disha-ink)","marginBottom":"0.5rem"}}>Payment Verification</h2>
          <div className="verify-text">
            <div className="verify-title" style={{"fontWeight":"700","color":"var(--disha-ink)","marginBottom":"0.5rem"}}>Waiting for payment…</div>
            <div className="verify-sub" style={{"fontSize":"0.9375rem","color":"var(--disha-muted)"}}>Customer has not yet paid via UPI.</div>
          </div>
          <div className="timer-display" style={{"marginTop":"1.5rem","fontWeight":"bold","color":"var(--disha-emerald-500)","fontSize":"1.5rem"}}>
            Time remaining: {Math.floor(secondsRemaining / 60)}:{String(secondsRemaining % 60).padStart(2,'0')}s
          </div>
          <div className="verify-actions" style={{"marginTop":"1.5rem","display":"flex","gap":"0.5rem"}}>
            <button className="btn-secondary" style={{"padding":"0.75rem 1.5rem"}}>Refresh Status</button>
            <button className="btn-secondary" style={{"padding":"0.75rem 1.5rem"}}>Copy UPI ID Again</button>
          </div>
          <div className="verify-note" style={{"marginTop":"1rem","fontSize":"0.875rem","color":"var(--disha-muted)"}}>
            <strong>Important:</strong> Returning to this page, copying the UPI ID, or waiting does not confirm payment. Funds are verified only when the server matches the debit.
          </div>
        </div>
      </section>
    )
  }

  if (step === 'verified') {
    return (
      <section className="prism-glass-strong" style={{"padding":"4rem 1rem","maxWidth":"600px","margin":"2rem auto","textAlign":"center"}}>
        <div className="success-animation" style={{"marginBottom":"1rem"}}>
          <div className="rupee-coin" style={{"fontSize":"3rem","display":"flex","alignItems":"center","justifyContent":"center"}}>₹</div>
          <div className="verify-seal" style={{"display":"flex","alignItems":"center","gap":"0.5rem"}}>
            <span className="seal-check" style={{"color":"var(--disha-emerald-500)","fontSize":"2rem"}}>✓</span>
            <span className="seal-text" style={{"fontWeight":"700","color":"var(--disha-emerald-500)"}}>Verified</span>
          </div>
        </div>
        <h2 style={{"fontSize":"clamp(2rem,4vw,3.75rem)","color":"var(--disha-ink)","marginBottom":"1rem"}}>Payment Verified</h2>
        <p style={{"fontSize":"clamp(1rem,1.2vw,1.125rem)","color":"var(--disha-muted)","marginBottom":"1.5rem"}}>Debit confirmed by server. Receipt generated.</p>
        <div className="success-meta" style={{"marginBottom":"1.5rem"}}>
          <div style={{"display":"flex","justifyContent":"space-between"}}>
            <span style={{"fontSize":"0.875rem","color":"var(--disha-muted)"}}>Order ID</span>
            <span style={{"fontWeight":"700","color":"var(--disha-ink)"}}>{session?.id || '—'}</span>
          </div>
          <div style={{"display":"flex","justifyContent":"space-between"}}>
            <span style={{"fontSize":"0.875rem","color":"var(--disha-muted)"}}>Amount</span>
            <span style={{"fontWeight":"700","color":"var(--disha-ink)"}}>₹{session?.amount_paise ? (session.amount_paise/100).toFixed(2) : '0.00'}</span>
          </div>
          <div style={{"display":"flex","justifyContent":"space-between"}}>
            <span style={{"fontSize":"0.875rem","color":"var(--disha-muted)"}}>UPI ID</span>
            <span style={{"fontWeight":"700","color":"var(--disha-ink)"}}>{session?.vpa || '—'}</span>
          </div>
        </div>
        <div className="success-actions" style={{"display":"flex","gap":"0.5rem"}}>
          <button className="btn-primary" type="button" style={{"flex":"1"}}>View Receipt</button>
          <button className="btn-secondary" type="button" style={{"flex":"1"}} onClick={() => {setSession(null);setStep('create');setOrderExpiresAt(0);setSecondsRemaining(0);if(pollTimer)clearInterval(pollTimer);}}>New Checkout</button>
        </div>
      </section>
    )
  }

  return null
}
