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
  ShieldAlert,
  KeyRound,
  Lock,
  ExternalLink,
  CheckCircle2,
  Server,
  Activity,
  Cpu,
} from 'lucide-react'

// Import official Himalayan background
import himalayaBg from '../assets/disha-himalaya-login.jpg'

export const SuperAdminLogin: React.FC = () => {
  const { user } = useUser()
  const clerk = useClerk()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [authMode, setAuthMode] = useState<'clerk' | 'credentials'>('clerk')

  // Direct credentials state
  const [adminEmail, setAdminEmail] = useState('nitish@thenitishkr.in')
  const [adminPassword, setAdminPassword] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  // Subtle canvas mist
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

    const particles: Array<{
      x: number
      y: number
      size: number
      speedY: number
      opacity: number
    }> = []

    for (let i = 0; i < 30; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        size: 1 + Math.random() * 2,
        speedY: -0.2 - Math.random() * 0.3,
        opacity: 0.2 + Math.random() * 0.5,
      })
    }

    const render = () => {
      animId = requestAnimationFrame(render)
      ctx.clearRect(0, 0, width, height)

      for (const p of particles) {
        p.y += p.speedY
        if (p.y < 0) {
          p.y = height + 10
          p.x = Math.random() * width
        }

        ctx.fillStyle = '#D7B77B'
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

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setErrorMsg('')

    try {
      if (adminEmail === 'nitish@thenitishkr.in' && adminPassword === 'Tashima@906099') {
        localStorage.setItem('disha_superadmin_auth', 'authenticated')
        window.location.href = 'https://superadmin.disha8-2.thenitishkr.in/'
      } else {
        setErrorMsg('Invalid Super Admin credentials. Please check your password.')
      }
    } catch (err) {
      setErrorMsg('Authentication service unavailable.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-x-hidden p-4 sm:p-6 lg:p-8">
      {/* Background Image */}
      <div
        className="absolute inset-0 bg-cover bg-center transition-transform duration-1000 ease-out will-change-transform"
        style={{
          backgroundImage: `url(${himalayaBg})`,
          animation: 'subtleBreathe 16s ease-in-out infinite alternate',
        }}
        aria-hidden="true"
      />

      {/* Atmospheric dark overlay for administrative security context */}
      <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/45 to-black/65 pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/50 pointer-events-none" />

      {/* Subtle particle canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 pointer-events-none z-10"
        aria-hidden="true"
      />

      {/* Back to Home Button */}
      <div className="absolute top-6 left-6 z-30">
        <a
          href="/"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-white/15 backdrop-blur-xl border border-white/30 text-xs font-bold text-white hover:bg-white/25 transition-all shadow-md group"
        >
          <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
          <span>Back to DISHA 8.2</span>
        </a>
      </div>

      {/* TWO-COLUMN LAYOUT: LEFT TELEMETRY NARRATIVE, RIGHT GLASS GATEWAY */}
      <div className="relative z-20 w-full max-w-7xl mx-auto my-12 pt-14 lg:pt-0 px-2 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-14 items-center">
          
          {/* LEFT COLUMN: SUPER ADMIN SOVEREIGN OVERVIEW */}
          <div className="lg:col-span-6 text-white space-y-6 text-left">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/20 backdrop-blur-md border border-amber-400/30 text-[11px] font-black uppercase tracking-wider text-[#FFB76B]">
              <ShieldAlert className="w-3.5 h-3.5 text-[#FFB76B]" />
              <span>Restricted &bull; Super Admin Console</span>
            </div>

            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-[1.08]">
              Platform Command &{' '}
              <span className="bg-gradient-to-r from-[#FFB76B] via-[#D7B77B] to-white bg-clip-text text-transparent">
                Sovereign Rails.
              </span>
            </h1>

            <p className="text-sm sm:text-base text-white/85 leading-relaxed font-normal max-w-xl">
              Centralized administrative interface for tenant orchestration, UPI switch telemetry, cryptographic device enrollment, and high-availability rail routing.
            </p>

            {/* Platform Health Matrix */}
            <div className="grid grid-cols-3 gap-3 pt-2">
              <div className="p-3.5 rounded-2xl bg-white/[0.08] backdrop-blur-xl border border-white/[0.14] text-left">
                <div className="flex items-center gap-1.5 text-xs text-white/70 mb-1">
                  <Activity className="w-3.5 h-3.5 text-[#B5F5D8]" />
                  <span>Rail Health</span>
                </div>
                <div className="text-lg sm:text-xl font-black text-[#B5F5D8]">100% OK</div>
              </div>

              <div className="p-3.5 rounded-2xl bg-white/[0.08] backdrop-blur-xl border border-white/[0.14] text-left">
                <div className="flex items-center gap-1.5 text-xs text-white/70 mb-1">
                  <Server className="w-3.5 h-3.5 text-[#D7B77B]" />
                  <span>ECS Clusters</span>
                </div>
                <div className="text-lg sm:text-xl font-black text-[#D7B77B]">Active</div>
              </div>

              <div className="p-3.5 rounded-2xl bg-white/[0.08] backdrop-blur-xl border border-white/[0.14] text-left">
                <div className="flex items-center gap-1.5 text-xs text-white/70 mb-1">
                  <Cpu className="w-3.5 h-3.5 text-white" />
                  <span>Switch Core</span>
                </div>
                <div className="text-lg sm:text-xl font-black text-white">&lt; 18ms</div>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white/[0.06] backdrop-blur-xl border border-white/[0.14] flex flex-wrap items-center justify-between gap-2 text-xs text-white/80">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#B5F5D8] animate-pulse" />
                <span>Cluster: DISHA8-2-Production-Backend</span>
              </div>
              <div className="font-mono text-[11px] text-[#FFB76B]">
                Primary Root Authority
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: GLASS ADMIN GATEWAY */}
          <div className="lg:col-span-6 w-full max-w-md mx-auto lg:ml-auto">
            <div className="relative rounded-[36px] p-6 sm:p-9 backdrop-blur-3xl bg-white/[0.14] hover:bg-white/[0.18] transition-all border border-white/[0.25] shadow-[0_30px_90px_rgba(0,0,0,0.5)] text-white before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-white/60 before:to-transparent">
              
              <div className="text-center mb-6">
                <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-amber-500/20 backdrop-blur-md border border-amber-400/30 text-[11px] font-black uppercase tracking-wider text-[#FFB76B] mb-2">
                  <ShieldAlert className="w-3.5 h-3.5 text-[#FFB76B]" />
                  <span>Administrative Gateway</span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                  Super Admin SaaS
                </h2>
                <p className="text-xs text-white/75 mt-1 max-w-xs mx-auto">
                  Sovereign infrastructure management, merchant provisioning, and bank rail oversight.
                </p>
              </div>

              {/* Mode Switcher */}
              <div className="flex items-center justify-between p-1.5 rounded-2xl bg-black/35 backdrop-blur-md border border-white/20 mb-6">
                <button
                  onClick={() => setAuthMode('clerk')}
                  className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                    authMode === 'clerk'
                      ? 'bg-white text-[#262626] shadow-md'
                      : 'text-white/80 hover:text-white'
                  }`}
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Clerk Auth</span>
                </button>

                <button
                  onClick={() => setAuthMode('credentials')}
                  className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                    authMode === 'credentials'
                      ? 'bg-white text-[#262626] shadow-md'
                      : 'text-white/80 hover:text-white'
                  }`}
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>Direct Password</span>
                </button>
              </div>

              {/* CLERK AUTH */}
              {authMode === 'clerk' && (
                <div className="space-y-4 animate-fade-in">
                  <SignedIn>
                    <div className="text-center py-6 space-y-4">
                      <div className="flex justify-center">
                        <div className="p-1 rounded-full bg-white/40 border border-white/60">
                          <UserButton afterSignOutUrl="/superadmin-login" />
                        </div>
                      </div>
                      <div>
                        <div className="text-base font-black text-white">
                          {user?.primaryEmailAddress?.emailAddress || 'Super Admin Active'}
                        </div>
                        <div className="text-xs text-[#B5F5D8] font-bold mt-0.5">
                          AUTHORIZED ADMINISTRATOR
                        </div>
                      </div>

                      <div className="pt-2">
                        <a
                          href="https://superadmin.disha8-2.thenitishkr.in/"
                          className="w-full py-3.5 px-4 rounded-xl text-xs font-bold uppercase tracking-wider text-white bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 shadow-lg shadow-amber-600/30 flex items-center justify-center gap-2 transition-all"
                        >
                          <span>Open Super Admin Console</span>
                          <ArrowRight className="w-4 h-4" />
                        </a>
                      </div>
                    </div>
                  </SignedIn>

                  <SignedOut>
                    <div className="clerk-glass-container">
                      <SignIn
                        routing="hash"
                        fallbackRedirectUrl="https://superadmin.disha8-2.thenitishkr.in/"
                        appearance={{
                          elements: {
                            rootBox: 'w-full',
                            card: 'bg-transparent shadow-none border-none p-0',
                            header: 'hidden',
                            footer: 'text-white/80 text-xs',
                            socialButtonsBlockButton:
                              'bg-white/90 hover:bg-white text-[#262626] font-bold text-xs rounded-xl shadow-sm border border-white/50 transition-all',
                            formButtonPrimary:
                              'bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white text-xs font-bold uppercase tracking-wider rounded-xl shadow-lg transition-all py-3',
                            formFieldInput:
                              'bg-white/90 border border-white/60 focus:border-amber-500 text-xs rounded-xl text-[#262626]',
                            formFieldLabel: 'text-xs font-bold text-white',
                            footerActionLink: 'text-[#FFB76B] font-bold hover:underline',
                            dividerText: 'text-[11px] text-white/70 font-semibold',
                            dividerLine: 'bg-white/30',
                          },
                        }}
                      />

                      <div className="mt-3 text-center">
                        <button
                          type="button"
                          onClick={() => clerk.openSignIn({})}
                          className="text-xs font-bold text-white hover:text-[#FFB76B] underline transition-colors"
                        >
                          Use Clerk Fast Login Modal
                        </button>
                      </div>
                    </div>
                  </SignedOut>
                </div>
              )}

              {/* DIRECT PASSWORD AUTH */}
              {authMode === 'credentials' && (
                <form onSubmit={handleCredentialsSubmit} className="space-y-4 animate-fade-in text-left">
                  {errorMsg && (
                    <div className="p-3 rounded-xl bg-red-500/20 border border-red-400/40 text-red-200 text-xs font-medium">
                      {errorMsg}
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-bold text-white mb-1">
                      Super Admin Email
                    </label>
                    <input
                      type="email"
                      required
                      value={adminEmail}
                      onChange={(e) => setAdminEmail(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white/90 border border-white/60 text-[#262626] text-xs placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-white mb-1">
                      Platform Master Password
                    </label>
                    <input
                      type="password"
                      required
                      placeholder="Enter administrator password"
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white/90 border border-white/60 text-[#262626] text-xs placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full mt-2 py-3 px-4 rounded-xl text-xs font-bold uppercase tracking-wider text-white bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 shadow-lg shadow-amber-600/30 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    <span>{isLoading ? 'Authenticating...' : 'Access Super Admin'}</span>
                  </button>
                </form>
              )}

              {/* Link back to Merchant Login */}
              <div className="mt-6 pt-4 border-t border-white/20 text-center">
                <a
                  href="/merchant-login"
                  className="text-xs text-white/70 hover:text-white transition-colors"
                >
                  Looking for Merchant Terminal? <span className="underline font-bold">Go to Merchant Login</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
