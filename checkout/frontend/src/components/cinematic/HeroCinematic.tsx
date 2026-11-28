import React, { useEffect, useRef, useState } from 'react'
import {
  SignIn,
  SignedIn,
  SignedOut,
  UserButton,
  useUser,
  useClerk,
} from '@clerk/clerk-react'
import {
  ArrowRight,
  Play,
  Pause,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
  Lock,
  Building2,
  Send,
  Zap,
  KeyRound,
  ExternalLink,
} from 'lucide-react'

// Import the official high-resolution photograph background
import heroImage from '../../assets/disha8-2-hero.jpg'

interface HeroCinematicProps {
  isAudioPlaying: boolean
  onToggleAudio: () => void
}

export const HeroCinematic: React.FC<HeroCinematicProps> = ({
  isAudioPlaying,
  onToggleAudio,
}) => {
  const { user } = useUser()
  const clerk = useClerk()
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Tab State in the Right Glass Container: 'login' | 'request'
  const [authTab, setAuthTab] = useState<'login' | 'request'>('login')

  // Request Access form state
  const [reqBusinessName, setReqBusinessName] = useState('')
  const [reqContact, setReqContact] = useState('')
  const [reqVolume, setReqVolume] = useState('₹50 Lakhs – ₹1 Crore')
  const [reqSubmitted, setReqSubmitted] = useState(false)

  // -------------------------------------------------------------
  // Photorealistic Motion Layer: Floating Clouds & Energy Pulse
  // -------------------------------------------------------------
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return
    }

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animId = 0
    let width = (canvas.width = canvas.parentElement?.clientWidth || window.innerWidth)
    let height = (canvas.height = canvas.parentElement?.clientHeight || window.innerHeight)

    const handleResize = () => {
      if (!canvas.parentElement) return
      width = canvas.width = canvas.parentElement.clientWidth
      height = canvas.height = canvas.parentElement.clientHeight
    }
    window.addEventListener('resize', handleResize)

    // Cloud Puffs for realistic volumetric cloud flow
    const clouds: Array<{
      x: number
      y: number
      radius: number
      speed: number
      alpha: number
      alphaSpeed: number
    }> = []

    for (let i = 0; i < 28; i++) {
      clouds.push({
        x: Math.random() * width,
        y: height * 0.45 + (Math.random() - 0.2) * (height * 0.45),
        radius: 120 + Math.random() * 180,
        speed: 0.15 + Math.random() * 0.35,
        alpha: 0.08 + Math.random() * 0.14,
        alphaSpeed: 0.003 + Math.random() * 0.004,
      })
    }

    // Shimmering Golden Dust Motes
    const particles: Array<{
      x: number
      y: number
      size: number
      speedY: number
      speedX: number
      opacity: number
      hue: string
    }> = []

    for (let i = 0; i < 45; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        size: 1 + Math.random() * 2.5,
        speedY: -0.15 - Math.random() * 0.35,
        speedX: 0.1 + Math.random() * 0.25,
        opacity: 0.2 + Math.random() * 0.7,
        hue: Math.random() > 0.4 ? '#D7B77B' : '#B5F5D8',
      })
    }

    let pulseOffset = 0

    const render = () => {
      animId = requestAnimationFrame(render)
      ctx.clearRect(0, 0, width, height)

      // 1. Drifting Soft Cloud Fog Layers (Right-side billowing clouds)
      for (const cloud of clouds) {
        cloud.x -= cloud.speed
        if (cloud.x < -cloud.radius * 2) {
          cloud.x = width + cloud.radius
          cloud.y = height * 0.45 + (Math.random() - 0.2) * (height * 0.45)
        }

        // Breathing cloud alpha
        cloud.alpha += Math.sin(pulseOffset * 0.5) * 0.0003

        const gradient = ctx.createRadialGradient(
          cloud.x,
          cloud.y,
          cloud.radius * 0.1,
          cloud.x,
          cloud.y,
          cloud.radius
        )
        gradient.addColorStop(0, `rgba(255, 248, 235, ${cloud.alpha})`)
        gradient.addColorStop(0.5, `rgba(245, 230, 210, ${cloud.alpha * 0.5})`)
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)')

        ctx.fillStyle = gradient
        ctx.beginPath()
        ctx.arc(cloud.x, cloud.y, cloud.radius, 0, Math.PI * 2)
        ctx.fill()
      }

      // 2. High-Speed Luminous Rail Pulse along the Viaduct
      pulseOffset += 0.025
      const railStartX = width * 0.18
      const railStartY = height * 0.85
      const railEndX = width * 0.46
      const railEndY = height * 0.58

      const pulseProgress = (Math.sin(pulseOffset * 1.5) + 1) / 2
      const currentPulseX = railStartX + (railEndX - railStartX) * (1 - pulseProgress)
      const currentPulseY = railStartY + (railEndY - railStartY) * (1 - pulseProgress)

      const railBeam = ctx.createRadialGradient(
        currentPulseX,
        currentPulseY,
        4,
        currentPulseX,
        currentPulseY,
        60
      )
      railBeam.addColorStop(0, 'rgba(181, 245, 216, 0.75)')
      railBeam.addColorStop(0.4, 'rgba(7, 134, 92, 0.45)')
      railBeam.addColorStop(1, 'rgba(7, 134, 92, 0)')

      ctx.fillStyle = railBeam
      ctx.beginPath()
      ctx.arc(currentPulseX, currentPulseY, 60, 0, Math.PI * 2)
      ctx.fill()

      // 3. Golden Dust Particles
      for (const p of particles) {
        p.y += p.speedY
        p.x += p.speedX
        if (p.y < 0) {
          p.y = height + 10
          p.x = Math.random() * width
        }

        ctx.fillStyle = p.hue
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
    if (!reqBusinessName || !reqContact) return
    setReqSubmitted(true)
  }

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-24 pb-16">
      {/* ------------------------------------------------------------- */}
      {/* 1. CINEMATIC BACKGROUND IMAGE (Official DISHA 8.2 Artwork)     */}
      {/* ------------------------------------------------------------- */}
      <div
        className="absolute inset-0 bg-cover bg-center sm:bg-[center_top] transition-transform duration-1000 ease-out will-change-transform"
        style={{
          backgroundImage: `url(${heroImage})`,
          animation: 'subtleBreathe 14s ease-in-out infinite alternate',
        }}
        aria-hidden="true"
      />

      {/* Subtle atmospheric vignette & sunrise warmth gradient */}
      <div className="absolute inset-0 bg-gradient-to-r from-black/45 via-black/15 to-transparent pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/25 pointer-events-none" />

      {/* ------------------------------------------------------------- */}
      {/* 2. REALISTIC MOTION CANVAS (Clouds, Energy, Sunlight, Dust)   */}
      {/* ------------------------------------------------------------- */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 pointer-events-none z-10"
        aria-hidden="true"
      />

      {/* ------------------------------------------------------------- */}
      {/* 3. HERO CONTENT: 2-COLUMN LUXURY GLASS EXPERIENCE             */}
      {/* ------------------------------------------------------------- */}
      <div className="relative z-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full pt-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          {/* LEFT COLUMN: Narrative & Brand Identity */}
          <div className="lg:col-span-7 text-left text-white drop-shadow-md space-y-6">
            {/* Flagship Badge */}
            <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-white/20 backdrop-blur-xl border border-white/40 shadow-sm animate-fade-in">
              <span className="w-2.5 h-2.5 rounded-full bg-[#B5F5D8] animate-ping" />
              <span className="text-xs font-black tracking-wider uppercase text-white">
                Flagship: DISHA 8.2
              </span>
              <span className="text-white/40">|</span>
              <span className="text-xs font-bold tracking-wide text-[#B5F5D8]">
                Agentic Pay
              </span>
            </div>

            {/* Primary Headline */}
            <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight leading-[1.06] text-white">
              The Next Direction of{' '}
              <span className="bg-gradient-to-r from-[#B5F5D8] via-[#D7B77B] to-white bg-clip-text text-transparent">
                Indian Payments.
              </span>
            </h1>

            {/* Signature Tagline */}
            <p className="text-xl sm:text-2xl font-bold tracking-tight text-[#FAF8F3]">
              Your Business, Entirely in Your Control.
            </p>

            {/* Business Positioning Description */}
            <p className="text-sm sm:text-base text-white/90 max-w-xl font-normal leading-relaxed">
              Autonomous, zero-custody UPI payment orchestration that deposits customer funds directly
              into your commercial bank account. Zero intermediary escrow, zero gateway toll deductions,
              and immediate T+0 settlement.
            </p>

            {/* Quick Action Badges */}
            <div className="flex flex-wrap gap-2.5 pt-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/15 backdrop-blur-md border border-white/30 text-xs font-semibold text-white">
                <CheckCircle2 className="w-4 h-4 text-[#B5F5D8]" />
                <span>Direct Bank Credit</span>
              </div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/15 backdrop-blur-md border border-white/30 text-xs font-semibold text-white">
                <ShieldCheck className="w-4 h-4 text-[#D7B77B]" />
                <span>Zero Escrow Float</span>
              </div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/15 backdrop-blur-md border border-white/30 text-xs font-semibold text-white">
                <Zap className="w-4 h-4 text-[#B5F5D8]" />
                <span>Instant Settlement (T+0)</span>
              </div>
            </div>

            {/* Action Buttons & Audio Narration */}
            <div className="flex flex-wrap items-center gap-4 pt-4">
              <a
                href="#calculator"
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl text-xs sm:text-sm font-bold text-[#1a1a1a] bg-gradient-to-r from-[#D7B77B] via-[#eed9ab] to-[#D7B77B] hover:brightness-105 shadow-xl transition-all"
              >
                <span>Calculate Merchant Savings</span>
                <ArrowRight className="w-4 h-4" />
              </a>

              {/* Audio Narration Toggle */}
              <button
                onClick={onToggleAudio}
                className={`inline-flex items-center gap-2 px-5 py-3.5 rounded-2xl text-xs font-bold border backdrop-blur-xl transition-all ${
                  isAudioPlaying
                    ? 'bg-[#07865C]/80 border-[#B5F5D8] text-white shadow-lg shadow-[#07865C]/40'
                    : 'bg-white/20 border-white/40 text-white hover:bg-white/30'
                }`}
              >
                {isAudioPlaying ? (
                  <>
                    <Pause className="w-4 h-4 text-[#B5F5D8] animate-pulse" />
                    <span>Narration Playing (Pause)</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 text-[#D7B77B]" />
                    <span>Listen to Story (15s)</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* --------------------------------------------------------- */}
          {/* RIGHT COLUMN: SEAMLESS LIQUID GLASS CLERK AUTH & ACCESS    */}
          {/* Positioned inside the glowing aura on the right of artwork*/}
          {/* --------------------------------------------------------- */}
          <div className="lg:col-span-5 relative">
            {/* Seamless, Borderless Frosted Glass Panel ("no box") */}
            <div className="relative rounded-[32px] p-6 sm:p-8 backdrop-blur-2xl bg-white/25 border border-white/45 shadow-[0_25px_60px_rgba(0,0,0,0.2)] transition-all">
              {/* Subtle Golden Edge Highlight */}
              <div className="absolute inset-0 rounded-[32px] bg-gradient-to-tr from-white/20 via-transparent to-[#D7B77B]/25 pointer-events-none" />

              {/* Tabs Switcher: Merchant Login (Clerk) vs Request Access */}
              <div className="relative z-10 flex items-center justify-between p-1 rounded-2xl bg-black/20 backdrop-blur-md border border-white/20 mb-6">
                <button
                  onClick={() => setAuthTab('login')}
                  className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                    authTab === 'login'
                      ? 'bg-white text-[#262626] shadow-md'
                      : 'text-white/80 hover:text-white'
                  }`}
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Merchant Login</span>
                </button>

                <button
                  onClick={() => setAuthTab('request')}
                  className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                    authTab === 'request'
                      ? 'bg-white text-[#262626] shadow-md'
                      : 'text-white/80 hover:text-white'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Request Access</span>
                </button>
              </div>

              {/* TAB 1: CLERK MERCHANT AUTHENTICATION */}
              {authTab === 'login' && (
                <div className="relative z-10 animate-fade-in space-y-4">
                  {/* Signed In State */}
                  <SignedIn>
                    <div className="text-center py-4 space-y-4">
                      <div className="flex justify-center">
                        <div className="p-1 rounded-full bg-white/40 border border-white/60">
                          <UserButton afterSignOutUrl="/" />
                        </div>
                      </div>

                      <div>
                        <div className="text-sm font-extrabold text-white">
                          Welcome, {user?.firstName || user?.username || 'Merchant'}
                        </div>
                        <div className="text-xs text-[#B5F5D8] font-medium mt-0.5">
                          {user?.primaryEmailAddress?.emailAddress || 'Verified Merchant Session'}
                        </div>
                      </div>

                      <div className="pt-2">
                        <a
                          href="https://merchant.disha8-2.thenitishkr.in/"
                          className="w-full py-3 px-4 rounded-xl text-xs font-bold uppercase tracking-wider text-white bg-gradient-to-r from-[#07865C] to-[#0a9b6b] hover:from-[#065440] hover:to-[#08785c] shadow-lg shadow-[#07865C]/30 flex items-center justify-center gap-2 transition-all"
                        >
                          <span>Open Merchant Terminal</span>
                          <ArrowRight className="w-4 h-4" />
                        </a>
                      </div>

                      <div className="text-[11px] text-white/70">
                        Direct connection to DISHA 8.2 Payment Rails
                      </div>
                    </div>
                  </SignedIn>

                  {/* Signed Out State — Clerk Form */}
                  <SignedOut>
                    <div className="clerk-glass-container">
                      <div className="text-center mb-4">
                        <h3 className="text-lg font-black text-white tracking-tight">
                          Sign In with Clerk
                        </h3>
                        <p className="text-xs text-white/80 mt-0.5">
                          Authenticate your registered Indian merchant portal
                        </p>
                      </div>

                      {/* Embedded Clerk Component with transparent theme */}
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

                      {/* Fallback Direct Clerk Trigger Button if iframe hasn't loaded */}
                      <div className="mt-3 text-center">
                        <button
                          type="button"
                          onClick={() => clerk.openSignIn({})}
                          className="text-xs font-bold text-white hover:text-[#B5F5D8] underline transition-colors"
                        >
                          Having trouble? Open Clerk Modal
                        </button>
                      </div>
                    </div>
                  </SignedOut>

                  {/* Super Admin Access Footnote */}
                  <div className="pt-3 border-t border-white/20 flex items-center justify-between text-[11px] text-white/75">
                    <span>Administrative Authority?</span>
                    <a
                      href="https://superadmin.disha8-2.thenitishkr.in/"
                      className="font-bold text-[#D7B77B] hover:text-white flex items-center gap-1 transition-colors"
                    >
                      <span>Super Admin</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              )}

              {/* TAB 2: REQUEST ACCESS FOR NEW ENTERPRISE MERCHANTS */}
              {authTab === 'request' && (
                <div className="relative z-10 animate-fade-in">
                  {!reqSubmitted ? (
                    <form onSubmit={handleRequestSubmit} className="space-y-3.5 text-left">
                      <div>
                        <label className="block text-xs font-bold text-white mb-1">
                          Business / Legal Entity Name
                        </label>
                        <input
                          type="text"
                          required
                          value={reqBusinessName}
                          onChange={(e) => setReqBusinessName(e.target.value)}
                          placeholder="e.g. Royal Fresh Mart Pvt Ltd"
                          className="w-full px-3.5 py-2.5 rounded-xl bg-white/90 border border-white/50 text-xs text-[#262626] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#07865C]"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-white mb-1">
                          Email or WhatsApp Contact
                        </label>
                        <input
                          type="text"
                          required
                          value={reqContact}
                          onChange={(e) => setReqContact(e.target.value)}
                          placeholder="nitish@yourcompany.in or +91..."
                          className="w-full px-3.5 py-2.5 rounded-xl bg-white/90 border border-white/50 text-xs text-[#262626] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#07865C]"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-white mb-1">
                          Estimated Monthly UPI Volume
                        </label>
                        <select
                          value={reqVolume}
                          onChange={(e) => setReqVolume(e.target.value)}
                          className="w-full px-3.5 py-2.5 rounded-xl bg-white/90 border border-white/50 text-xs text-[#262626] focus:outline-none focus:ring-2 focus:ring-[#07865C]"
                        >
                          <option value="₹10 Lakhs – ₹50 Lakhs">₹10 Lakhs – ₹50 Lakhs / mo</option>
                          <option value="₹50 Lakhs – ₹1 Crore">₹50 Lakhs – ₹1 Crore / mo</option>
                          <option value="₹1 Crore – ₹5 Crores">₹1 Crore – ₹5 Crores / mo</option>
                          <option value="₹5 Crores+">₹5 Crores+ / mo (Enterprise Tier)</option>
                        </select>
                      </div>

                      <button
                        type="submit"
                        className="w-full py-3 px-4 rounded-xl text-xs font-bold uppercase tracking-wider text-white bg-gradient-to-r from-[#07865C] to-[#0a9b6b] hover:from-[#065440] hover:to-[#08785c] shadow-lg shadow-[#07865C]/30 flex items-center justify-center gap-2 transition-all mt-4"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Submit Access Request</span>
                      </button>

                      <p className="text-[10px] text-white/70 text-center mt-2">
                        Zero setup fees. Qualified merchants receive credential provisioning within 24 hours.
                      </p>
                    </form>
                  ) : (
                    <div className="py-6 text-center space-y-3">
                      <div className="w-12 h-12 rounded-full bg-[#B5F5D8] text-[#07865C] flex items-center justify-center mx-auto shadow-lg">
                        <CheckCircle2 className="w-6 h-6" />
                      </div>
                      <h4 className="text-base font-extrabold text-white">
                        Access Request Received
                      </h4>
                      <p className="text-xs text-white/85 max-w-xs mx-auto leading-relaxed">
                        Thank you, <span className="font-bold">{reqBusinessName}</span>. Our deployment team is reviewing your volume tier ({reqVolume}) and will contact {reqContact}.
                      </p>
                      <button
                        onClick={() => setReqSubmitted(false)}
                        className="text-xs text-[#B5F5D8] underline hover:text-white pt-2 font-semibold"
                      >
                        Submit another request
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
