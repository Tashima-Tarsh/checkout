import React, { useState, useEffect } from 'react';

export const Checkout: React.FC = () => {
  const [session, setSession] = useState<any>(null);
  const [step, setStep] = useState<'create' | 'verify' | 'verified'>('create');
  const [secondsRemaining, setSecondsRemaining] = useState(0);
  const [orderExpiresAt, setOrderExpiresAt] = useState(0);
  const [pollTimer, setPollTimer] = useState<ReturnType<typeof setInterval> | null>(null);
  const [routedVpa, setRoutedVpa] = useState<string>('');

  const createCheckout = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'P2P',
          vpa: 'person@upi',
          name: 'Customer',
          amount_paise: 10000,
        }),
      });
      const data = await res.json();
      setSession(data);
      setStep('verify');
      setOrderExpiresAt(data.expires || Date.now() / 1000 + 120);
      setSecondsRemaining(120);
      startPolling(data);
    } catch (e) {
      console.error('Failed to create checkout:', e);
    }
  };

  const startPolling = (session: any) => {
    if (pollTimer) clearInterval(pollTimer);
    const timer = setInterval(async () => {
      if (!session || session.state === 'EXPIRED' || session.state === 'PAID') {
        clearInterval(pollTimer!);
        return;
      }
      const now = Date.now() / 1000;
      setSecondsRemaining(Math.max(0, orderExpiresAt - now));
      if (now >= orderExpiresAt) {
        setStep('verified');
        clearInterval(pollTimer!);
        return;
      }
      try {
        const res = await fetch(`/api/sessions/${session.token}`, {
          headers: { 'Authorization': 'Bearer ' + session.token },
        });
        const data = await res.json();
        setSession(data);
        if (data.state === 'PAID' || data.settlement?.satisfied) {
          setStep('verified');
          clearInterval(pollTimer!);
        }
      } catch (e) {
        // Silent retry
      }
    }, 5000);
    setPollTimer(timer);
  };

  useEffect(() => {
    return () => {
      if (pollTimer) clearInterval(pollTimer);
    };
  }, []);

  if (step === 'create') {
    return (
      <section className="prism-glass-strong" style="padding: 4rem 1rem; max-width: 600px; margin: 2rem auto;">
        <div className="section-eyebrow" style="font-size:0.875rem;font-weight:800;letter-spacing:0.16em;color:var(--disha-violet);text-transform:uppercase;display:block;margin-bottom:1rem;">Create Payment Link</div>
        <h2 style={{ fontSize: 'clamp(2rem,4vw,3.75rem)', lineHeight: '1.15', letterSpacing: '-0.035em', color: 'var(--disha-ink)', marginBottom: '1rem' }}>Create Payment Link</h2>
        <p style={{ fontSize: 'clamp(1rem,1.2vw,1.125rem)', lineHeight: '1.75', color: 'var(--disha-muted)', maxWidth: '570px' }}>
          Customer pays via UPI. Verification completes within 120 seconds.
        </p>
        <div className="stat-card" style={{ textAlign: 'center', padding: '2rem', background: 'var(--pdp-pearl-100)', borderRadius: 'var(--pdp-radius-lg)', border: '1px solid var(--pdp-border)' }}>
          <div className="stat-label" style={{ fontSize: '0.875rem', fontWeight: '700', color: 'var(--pdp-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Amount</div>
          <div className="stat-value" style={{ fontSize: '2rem', fontWeight: '800', color: 'var(--disha-ink)' }}>₹{((session?.amount_paise || 0) / 100).toFixed(2)}</div>
        </div>
        <div className="checkout-info" style={{ marginTop: '1.5rem', textAlign: 'center' }}>
          <div style={{ fontSize: '0.9375rem', color: 'var(--disha-muted)', marginBottom: '0.5rem' }}>Unique Order ID</div>
          <div style={{ fontSize: '0.875rem', color: 'var(--disha-adversarial-blue, var(--pdp-adversarial-blue))', fontFamily: 'monospace', fontWeight: '700' }}>{session?.id || '—'}</div>
          <div style={{ fontSize: '0.875rem', color: 'var(--disha-muted)', marginTop: '0.5rem' }}>Routing via: {routedVpa || 'Processing...'}</div>
        </div>
        <button className="btn-primary" type="button" onClick={createCheckout} style="width: '100%', padding: '0.75rem 2rem', fontSize: '1.1rem', marginTop: '1.5rem'}>
          Create Checkout
        </button>
        <p className="notice" style="margin-top: '1rem'">
          Share this link with the customer. The checkout is valid for 120 seconds. No debit is verified until the server confirms the match.
        </p>
      </section>
    );
  }

  if (step === 'verify') {
    return (
      <section className="prism-glass-strong" style="padding: 4rem 1rem; max-width: 600px; margin: 2rem auto;">
        <div className="verify-container" style="text-align: center;">
          <div className="verify-icon" style={{ fontSize: '3rem', marginBottom: '1rem' }}>⏳</div>
          <h2 style={{ fontSize: 'clamp(2rem,4vw,3.75rem)', color: 'var(--disha-ink)', marginBottom: '1rem' }}>Payment Verification</h2>
          <div className="verify-text">
            <div className="verify-title" style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--disha-ink)', marginBottom: '0.5rem' }}>Waiting for payment…</div>
            <div className="verify-sub" style={{ fontSize: '1rem', color: 'var(--disha-muted)' }}>Customer has not yet paid via UPI.</div>
          </div>
          <div className="timer-display" style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--disha-emerald-500)', marginTop: '1.5rem' }}>
            Time remaining: {Math.floor(secondsRemaining / 60)}:{String(secondsRemaining % 60).padStart(2, '0')}s
          </div>
          <div className="verify-actions" style={{ marginTop: '1.5rem', display: 'flex', gap: '0.5rem' }}>
            <button className="btn-secondary" style={{ padding: '0.75rem 1.5rem' }}>Refresh Status</button>
            <button className="btn-secondary" style={{ padding: '0.75rem 1.5rem' }}>Copy UPI ID Again</button>
          </div>
          <div className="verify-note" style={{ marginTop: '1rem', fontSize: '0.875rem', color: 'var(--disha-muted)' }}>
            <strong>Important:</strong> Returning to this page, copying the UPI ID, or waiting does not confirm payment. Funds are verified only when the server matches the debit.
          </div>
        </div>
      </section>
    );
  }

  if (step === 'verified') {
    return (
      <section className="prism-glass-strong" style="padding: 4rem 1rem; max-width: 600px; margin: 2rem auto; text-align: center;">
        <div className="success-animation" style={sessionPolling > 0 ? undefined : undefined}>
          <div className="rocket-orbit" style={{ position: 'relative', width: '200px', height: '200px', margin: '0 auto', position: 'relative' }}>
            <div className="rocket-track" style={{ position: 'absolute', width: '100%', height: '100%', border: '2px solid rgba(120, 81, 216, 0.2)', borderRadius: '50%' }}/>
            <div className="rocket" style={{ position: 'absolute', top: '50%', left: '0%', width: '60px', height: '60px', background: linear-gradient(135deg, #FFF5D9, #E6CA91, #B78D48), borderRadius: '50%', boxShadow: '0 0 30px rgba(169, 130, 69, 0.5)', animation: 'orbit 8s linear infinite', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', color: '#fff' }}>
              🚀
            </div>
          </div>
          <div className="hero-car" style={{ position: 'absolute', top: '50%', left: '0%', width: '80px', height: '60px', background: linear-gradient(135deg, #FFF5D9, #E6CA91, #B78D48), borderRadius: '50%', boxShadow: '0 0 30px rgba(169, 130, 69, 0.5)', animation: 'orbit 8s linear infinite', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', color: '#fff' }}>
            🚗
          </div>
        </div>
        <h2 style={{ fontSize: 'clamp(2rem,4vw,3.75rem)', color: 'var(--disha-ink)', marginBottom: '1rem' }}>Payment Verified</h2>
        <p style={{ fontSize: 'clamp(1rem,1.2vw,1.125rem)', lineHeight: '1.75', color: 'var(--disha-muted)', marginBottom: '1.5rem' }}>Debit confirmed by server. Receipt generated.</p>
        <div className="success-meta" style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
            <span>Order ID</span>
            <span style={{ fontWeight: '700', color: 'var(--disha-ink)' }}>{session?.id || '—'}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Amount</span>
            <span style={{ fontWeight: '700', color: 'var(--disha-ink)' }}>₹{((session?.amount_paise || 0) / 100).toFixed(2)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>UPI ID</span>
            <span style={{ fontWeight: '700', color: 'var(--disha-ink)' }}>{session?.vpa || '—'}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Mode</span>
            <span style={{ fontWeight: '700', color: 'var(--disha-ink)' }}>{session?.mode || 'P2P'}</span>
          </div>
        </div>
        <div className="success-actions" style={{ marginTop: '1.5rem', display: 'flex', gap: '0.5rem' }}>
          <button className="btn-primary" type="button" style="flex: 1;">View Receipt</button>
          <button className="btn-secondary" type="button" style="flex: 1;" onClick={() => { setSession(null); setStep('create'); setOrderExpiresAt(0); setSecondsRemaining(0); if (pollTimer) clearInterval(pollTimer); setRoutedVpa(''); } }}>New Checkout</button>
        </div>
      </section>
    );
  }

  return null;
};

export default Checkout;
