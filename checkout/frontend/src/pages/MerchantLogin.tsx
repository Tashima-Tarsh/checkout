import React, { useState, useEffect, useRef } from 'react'
import {
  SignIn,
  SignedIn,
  SignedOut,
  UserButton,
  useUser,
  useClerk,
} from '@clerk/clerk-react'
import {
  ArrowLeft,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Lock,
  Sparkles,
  Send,
  ExternalLink,
  Zap,
} from 'lucide-react'

// Import official Himalayan sunrise artwork
import himalayaBg from '../assets/disha-himalaya-login.jpg'

export const MerchantLogin: React.FC = () => {
  const { user } = useUser()
  const clerk = useClerk()
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const [activeTab, setActiveTab] = useState<'login' | 'request'>('login')

  // Request Access form fields
  const [businessName, setBusinessName] = useState('')
  const [contact, setContact] = useState('')
  const [volume, setVolume] = useState('₹50 Lakhs – ₹1 Crore')
  const [submitted, setSubmitted] = useState(false)

  // -------------------------------------------------------------
  // Atmospheric Motion Canvas: Himalayan Cloud Fog & Radiant Beams
  // -------------------------------------------------------------
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return
    }

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animId = 0
    let width = (canvas.width = window.innerWidth)
    let height = (canvas.height = window.innerHeight)

    const handleResize = () => {
      width = canvas.width = window.innerWidth
      height = canvas.height = window.innerHeight
    }
    window.addEventListener('resize', handleResize)

    // Valley Clouds drifting through the mountain passes
    const clouds: Array<{
      x: number
      y: number
      radius: number
      speed: number
      alpha: number
    }> = []

    for (let i = 0; i < 24; i++) {
      clouds.push({
        x: Math.random() * width,
        y: height * 0.45 + (Math.random() - 0.2) * (height * 0.45),
        radius: 120 + Math.random() * 180,
        speed: 0.12 + Math.random() * 0.28,
        alpha: 0.08 + Math.random() * 0.12,
      })
    }

    // Light Shimmer Particles
    const particles: Array<{
      x: number
      y: number
      size: number
      speedY: number
      opacity: number
      color: string
    }> = []

    for (let i = 0; i < 36; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        size: 1 + Math.random() * 2.2,
        speedY: -0.2 - Math.random() * 0.3,
        opacity: 0.25 + Math.random() * 0.65,
        color: Math.random() > 0.5 ? '#D7B77B' : '#B5F5D8',
      })
    }

    const render = () => {
      animId = requestAnimationFrame(render)
      ctx.clearRect(0, 0, width, height)

      // Valley clouds drift
      for (const cloud of clouds) {
        cloud.x -= cloud.speed
        if (cloud.x < -cloud.radius * 2) {
          cloud.x = width + cloud.radius
          cloud.y = height * 0.45 + (Math.random() - 0.2) * (height * 0.45)
        }

        const gradient = ctx.createRadialGradient(
          cloud.x,
          cloud.y,
          cloud.radius * 0.1,
          cloud.x,
          cloud.y,
          cloud.radius
        )
        gradient.addColorStop(0, `rgba(255, 248, 235, ${cloud.alpha})`)
        gradient.addColorStop(0.5, `rgba(240, 225, 205, ${cloud.alpha * 0.45})`)
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)')

        ctx.fillStyle = gradient
        ctx.beginPath()
        ctx.arc(cloud.x, cloud.y, cloud.radius, 0, Math.PI * 2)
        ctx.fill()
      }

      // Golden Dust Motes
      for (const p of particles) {
        p.y += p.speedY
        if (p.y < 0) {
          p.y = height + 10
          p.x = Math.random() * width
        }

        ctx.fillStyle = p.color
        ctx.globalAlpha = p.opacity
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx.fill()
        ctx.globalAlpha = 1.0
      }
    }

    render()

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  const handleRequestSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!businessName || !contact) return
    setSubmitted(true)
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-x-hidden p-4 sm:p-6 lg:p-8">
      {/* ------------------------------------------------------------- */}
      {/* BREATHTAKING HIMALAYAN SUNRISE BACKGROUND IMAGE               */}
      {/* ------------------------------------------------------------- */}
      <div
        className="absolute inset-0 bg-cover bg-center transition-transform duration-1000 ease-out will-change-transform"
        style={{
          backgroundImage: `url(${himalayaBg})`,
          animation: 'subtleBreathe 16s ease-in-out infinite alternate',
        }}
        aria-hidden="true"
      />

      {/* Atmospheric lighting overlay */}
      <div className="absolute inset-0 bg-gradient-to-r from-black/65 via-black/35 to-black/55 pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/40 pointer-events-none" />

      {/* Realistic Motion Canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 pointer-events-none z-10"
        aria-hidden="true"
      />

      {/* Top Left Navigation Back to Home */}
      <div className="absolute top-6 left-6 z-30">
        <a
          href="/"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-white/20 backdrop-blur-xl border border-white/40 text-xs font-bold text-white hover:bg-white/30 transition-all shadow-md group"
        >
          <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
          <span>Back to DISHA 8.2</span>
        </a>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* TWO-COLUMN LUXURY EXPERIENCE: LEFT HERO STORY, RIGHT GLASS    */}
      {/* ------------------------------------------------------------- */}
      <div className="relative z-20 w-full max-w-7xl mx-auto my-12 pt-14 lg:pt-0 px-2 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-14 items-center">
          
          {/* LEFT COLUMN: BRAND STORY & SOVEREIGN FINTECH ADVANTAGES */}
          <div className="lg:col-span-6 text-white space-y-6 text-left">
            <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-white/15 backdrop-blur-xl border border-white/25 shadow-sm">
              <span className="w-2.5 h-2.5 rounded-full bg-[#B5F5D8] animate-ping" />
              <span className="text-xs font-black tracking-wider uppercase text-white">
                Flagship: DISHA 8.2
              </span>
              <span className="text-white/40">|</span>
              <span className="text-xs font-bold tracking-wide text-[#B5F5D8]">
                Agentic Pay
              </span>
            </div>

            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-[1.08]">
              Your Business,{' '}
              <span className="bg-gradient-to-r from-[#B5F5D8] via-[#D7B77B] to-white bg-clip-text text-transparent">
                Entirely in Your Control.
              </span>
            </h1>

            <p className="text-sm sm:text-base text-white/90 leading-relaxed font-normal max-w-xl">
              Sign in to your sovereign merchant terminal. Direct bank-to-bank UPI payment orchestration, zero-custody settlement, and automated transaction reconciliation with your regulated bank accounts.
            </p>

            {/* Value Indicators */}
            <div className="grid grid-cols-3 gap-3 pt-2">
              <div className="p-3.5 rounded-2xl bg-white/[0.08] backdrop-blur-xl border border-white/[0.14] text-left">
                <div className="text-xl sm:text-2xl font-black text-[#B5F5D8]">0%</div>
                <div className="text-[11px] font-semibold text-white/80 mt-0.5">Escrow Custody</div>
              </div>

              <div className="p-3.5 rounded-2xl bg-white/[0.08] backdrop-blur-xl border border-white/[0.14] text-left">
                <div className="text-xl sm:text-2xl font-black text-[#D7B77B]">T+0</div>
                <div className="text-[11px] font-semibold text-white/80 mt-0.5">Instant Deposit</div>
              </div>

              <div className="p-3.5 rounded-2xl bg-white/[0.08] backdrop-blur-xl border border-white/[0.14] text-left">
                <div className="text-xl sm:text-2xl font-black text-white">10K+</div>
                <div className="text-[11px] font-semibold text-white/80 mt-0.5">Peak TPS</div>
              </div>
            </div>

            {/* Banking Rail Status */}
            <div className="p-4 rounded-2xl bg-white/[0.06] backdrop-blur-xl border border-white/[0.14] flex flex-wrap items-center justify-between gap-2 text-xs text-white/85">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#B5F5D8] animate-pulse" />
                <span className="font-semibold">Direct Bank Switches</span>
              </div>
              <div className="font-mono text-[11px] text-[#B5F5D8]">
                HDFC &bull; ICICI &bull; SBI &bull; AXIS &bull; NPCI
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: CLERK LOGIN & ACCESS REQUEST ("NO BOX" GLASS LOOK) */}
          <div className="lg:col-span-6 w-full max-w-md mx-auto lg:ml-auto">
            <div className="relative rounded-[36px] p-6 sm:p-9 backdrop-blur-3xl bg-white/[0.14] hover:bg-white/[0.18] transition-all border border-white/[0.25] shadow-[0_30px_90px_rgba(0,0,0,0.45)] text-white before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-white/60 before:to-transparent">
              
              {/* Header inside glass */}
              <div className="text-center mb-6">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur-md border border-white/30 text-[11px] font-black uppercase tracking-wider text-white mb-2">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#B5F5D8]" />
                  <span>Verified Merchant Authentication</span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                  Merchant Portal
                </h2>
                <p className="text-xs text-white/80 mt-1 max-w-xs mx-auto">
                  Access your private payment terminal, API keys, and real-time settlement telemetry.
                </p>
              </div>

              {/* Liquid Glass Tabs Switcher */}
              <div className="flex items-center justify-between p-1.5 rounded-2xl bg-black/30 backdrop-blur-md border border-white/20 mb-6">
                <button
                  onClick={() => setActiveTab('login')}
                  className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                    activeTab === 'login'
                      ? 'bg-white text-[#262626] shadow-md'
                      : 'text-white/80 hover:text-white'
                  }`}
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Merchant Sign In</span>
                </button>

                <button
                  onClick={() => setActiveTab('request')}
                  className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                    activeTab === 'request'
                      ? 'bg-white text-[#262626] shadow-md'
                      : 'text-white/80 hover:text-white'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Request Access</span>
                </button>
              </div>

              {/* TAB 1: CLERK MERCHANT SIGN IN */}
              {activeTab === 'login' && (
                <div className="space-y-4 animate-fade-in">
                  {/* Authenticated State */}
                  <SignedIn>
                    <div className="text-center py-6 space-y-4">
                      <div className="flex justify-center">
                        <div className="p-1 rounded-full bg-white/40 border border-white/60">
                          <UserButton afterSignOutUrl="/merchant-login" />
                        </div>
                      </div>

                      <div>
                        <div className="text-base font-black text-white">
                          Welcome, {user?.firstName || user?.username || 'Merchant'}
                        </div>
                        <div className="text-xs text-[#B5F5D8] font-medium mt-0.5">
                          {user?.primaryEmailAddress?.emailAddress || 'Verified Merchant Session'}
                        </div>
                      </div>

                      <div className="pt-2">
                        <a
                          href="https://merchant.disha8-2.thenitishkr.in/"
                          className="w-full py-3.5 px-4 rounded-xl text-xs font-bold uppercase tracking-wider text-white bg-gradient-to-r from-[#07865C] to-[#0a9b6b] hover:from-[#065440] hover:to-[#08785c] shadow-lg shadow-[#07865C]/40 flex items-center justify-center gap-2 transition-all"
                        >
                          <span>Enter Merchant Terminal</span>
                          <ArrowRight className="w-4 h-4" />
                        </a>
                      </div>

                      <div className="text-[11px] text-white/70">
                        Sovereign Non-Custodial Architecture
                      </div>
                    </div>
                  </SignedIn>

                  {/* Unauthenticated State: Clerk Sign In Component */}
                  <SignedOut>
                    <div className="clerk-glass-container">
                      <SignIn
                        routing="hash"
                        fallbackRedirectUrl="https://merchant.disha8-2.thenitishkr.in/"
                        appearance={{
                          elements: {
                            rootBox: 'w-full',
                            card: 'bg-transparent shadow-none border-none p-0',
                            header: 'hidden',
                            footer: 'text-white/80 text-xs',
                            socialButtonsBlockButton:
                              'bg-white/90 hover:bg-white text-[#262626] font-bold text-xs rounded-xl shadow-sm border border-white/50 transition-all',
                            formButtonPrimary:
                              'bg-gradient-to-r from-[#07865C] to-[#0a9b6b] hover:from-[#065440] hover:to-[#08785c] text-white text-xs font-bold uppercase tracking-wider rounded-xl shadow-lg transition-all py-3',
                            formFieldInput:
                              'bg-white/90 border border-white/60 focus:border-[#07865C] text-xs rounded-xl text-[#262626]',
                            formFieldLabel: 'text-xs font-bold text-white',
                            footerActionLink: 'text-[#B5F5D8] font-bold hover:underline',
                            dividerText: 'text-[11px] text-white/70 font-semibold',
                            dividerLine: 'bg-white/30',
                          },
                        }}
                      />

                      <div className="mt-3 text-center">
                        <button
                          type="button"
                          onClick={() => clerk.openSignIn({})}
                          className="text-xs font-bold text-white hover:text-[#B5F5D8] underline transition-colors"
                        >
                          Use Clerk Fast Login Modal
                        </button>
                      </div>
                    </div>
                  </SignedOut>

                  <div className="pt-2 text-center">
                    <p className="text-[11px] text-white/75">
                      Need instant support or API integration assistance?{' '}
                      <button
                        onClick={() => setActiveTab('request')}
                        className="text-[#B5F5D8] font-bold hover:underline"
                      >
                        Request onboarding key
                      </button>
                    </p>
                  </div>
                </div>
              )}

              {/* TAB 2: REQUEST ACCESS FOR NEW MERCHANTS */}
              {activeTab === 'request' && (
                <div className="space-y-4 animate-fade-in">
                  {submitted ? (
                    <div className="py-8 text-center space-y-3">
                      <div className="w-12 h-12 rounded-full bg-[#07865C]/40 border border-[#B5F5D8] flex items-center justify-center mx-auto text-[#B5F5D8]">
                        <CheckCircle2 className="w-6 h-6" />
                      </div>
                      <h3 className="text-lg font-bold text-white">Access Request Received</h3>
                      <p className="text-xs text-white/85 max-w-sm mx-auto">
                        Our engineering team will provision your direct bank rail endpoint within 2 business hours.
                      </p>
                      <button
                        onClick={() => {
                          setSubmitted(false)
                          setActiveTab('login')
                        }}
                        className="mt-4 px-4 py-2 rounded-xl text-xs font-bold text-white bg-white/20 hover:bg-white/30 border border-white/30 transition-all"
                      >
                        Return to Sign In
                      </button>
                    </div>
                  ) : (
                    <form onSubmit={handleRequestSubmit} className="space-y-3 text-left">
                      <div>
                        <label className="block text-xs font-bold text-white mb-1">
                          Enterprise / Merchant Name
                        </label>
                        <input
                          type="text"
                          required
                          value={businessName}
                          onChange={(e) => setBusinessName(e.target.value)}
                          placeholder="e.g. Reliance Retail / Swiggy / BharatMart"
                          className="w-full px-3.5 py-2.5 rounded-xl bg-white/90 border border-white/60 text-[#262626] text-xs placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#07865C]"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-white mb-1">
                          Work Email or Mobile Number
                        </label>
                        <input
                          type="text"
                          required
                          value={contact}
                          onChange={(e) => setContact(e.target.value)}
                          placeholder="founder@company.in or +91 98765 43210"
                          className="w-full px-3.5 py-2.5 rounded-xl bg-white/90 border border-white/60 text-[#262626] text-xs placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#07865C]"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-white mb-1">
                          Estimated Monthly UPI Volume
                        </label>
                        <select
                          value={volume}
                          onChange={(e) => setVolume(e.target.value)}
                          className="w-full px-3.5 py-2.5 rounded-xl bg-white/90 border border-white/60 text-[#262626] text-xs focus:outline-none focus:ring-2 focus:ring-[#07865C]"
                        >
                          <option value="₹10 Lakhs – ₹50 Lakhs">₹10 Lakhs – ₹50 Lakhs / month</option>
                          <option value="₹50 Lakhs – ₹1 Crore">₹50 Lakhs – ₹1 Crore / month</option>
                          <option value="₹1 Crore – ₹5 Crores">₹1 Crore – ₹5 Crores / month</option>
                          <option value="₹5 Crores+">₹5 Crores+ / month (Enterprise Custom)</option>
                        </select>
                      </div>

                      <button
                        type="submit"
                        className="w-full mt-4 py-3 px-4 rounded-xl text-xs font-bold uppercase tracking-wider text-white bg-gradient-to-r from-[#07865C] to-[#0a9b6b] hover:from-[#065440] hover:to-[#08785c] shadow-lg shadow-[#07865C]/40 flex items-center justify-center gap-2 transition-all"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Submit Access Request</span>
                      </button>
                    </form>
                  )}
                </div>
              )}

              {/* Direct Link to Super Admin Console (Discrete) */}
              <div className="pt-4 border-t border-white/15 text-center">
                <a
                  href="/superadmin-login"
                  className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-white/65 hover:text-white transition-colors"
                >
                  <Lock className="w-3 h-3" />
                  <span>Super Admin Gateway</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
