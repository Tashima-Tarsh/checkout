import React, { useEffect, useRef } from 'react'
import {
  ArrowRight,
  Play,
  Pause,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
  Zap,
  LogIn,
  TrendingUp,
} from 'lucide-react'

// Import official DISHA 8.2 high-resolution photograph background
import heroImage from '../../assets/disha8-2-hero.jpg'

interface HeroCinematicProps {
  isAudioPlaying: boolean
  onToggleAudio: () => void
}

export const HeroCinematic: React.FC<HeroCinematicProps> = ({
  isAudioPlaying,
  onToggleAudio,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // -------------------------------------------------------------
  // Photorealistic Motion Layer: Volumetric Clouds & Energy Pulse
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
    }> = []

    for (let i = 0; i < 32; i++) {
      clouds.push({
        x: Math.random() * width,
        y: height * 0.4 + (Math.random() - 0.2) * (height * 0.45),
        radius: 140 + Math.random() * 200,
        speed: 0.15 + Math.random() * 0.35,
        alpha: 0.07 + Math.random() * 0.12,
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

    for (let i = 0; i < 48; i++) {
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

      // 1. Drifting Soft Cloud Fog Layers (Volumetric Cloud Flow)
      for (const cloud of clouds) {
        cloud.x -= cloud.speed
        if (cloud.x < -cloud.radius * 2) {
          cloud.x = width + cloud.radius
          cloud.y = height * 0.4 + (Math.random() - 0.2) * (height * 0.45)
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
        65
      )
      railBeam.addColorStop(0, 'rgba(181, 245, 216, 0.75)')
      railBeam.addColorStop(0.4, 'rgba(7, 134, 92, 0.45)')
      railBeam.addColorStop(1, 'rgba(7, 134, 92, 0)')

      ctx.fillStyle = railBeam
      ctx.beginPath()
      ctx.arc(currentPulseX, currentPulseY, 65, 0, Math.PI * 2)
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

  return (
    <section className="relative min-h-[92vh] flex items-center justify-center overflow-hidden pt-28 pb-20">
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

      {/* Atmospheric lighting gradient overlay for high readability */}
      <div className="absolute inset-0 bg-gradient-to-r from-black/55 via-black/30 to-black/10 pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/30 pointer-events-none" />

      {/* ------------------------------------------------------------- */}
      {/* 2. REALISTIC MOTION CANVAS (Clouds, Energy, Sunlight, Dust)   */}
      {/* ------------------------------------------------------------- */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 pointer-events-none z-10"
        aria-hidden="true"
      />

      {/* ------------------------------------------------------------- */}
      {/* 3. HERO CONTENT: CLEAN, LUXURY PRESENTATION (NO LOGIN BOX)     */}
      {/* ------------------------------------------------------------- */}
      <div className="relative z-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full text-left text-white drop-shadow-md">
        <div className="max-w-3xl space-y-6">
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

          {/* Business Value Description */}
          <p className="text-base sm:text-lg text-white/90 max-w-2xl font-normal leading-relaxed">
            Autonomous, zero-custody UPI payment orchestration that deposits customer funds directly
            into your commercial bank account. Zero intermediary escrow, zero gateway toll deductions,
            and immediate T+0 settlement.
          </p>

          {/* Quick Value Badges */}
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

          {/* Action CTAs */}
          <div className="flex flex-wrap items-center gap-4 pt-4">
            {/* Merchant Login CTA button directing to dedicated login page */}
            <a
              href="/merchant-login"
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl text-xs sm:text-sm font-bold text-white bg-gradient-to-r from-[#07865C] to-[#0a9b6b] hover:from-[#065440] hover:to-[#08785c] shadow-xl shadow-[#07865C]/30 transition-all group"
            >
              <LogIn className="w-4 h-4" />
              <span>Merchant Login</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </a>

            <a
              href="#calculator"
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl text-xs sm:text-sm font-bold text-[#1a1a1a] bg-gradient-to-r from-[#D7B77B] via-[#eed9ab] to-[#D7B77B] hover:brightness-105 shadow-xl transition-all"
            >
              <span>Calculate Merchant Savings</span>
              <TrendingUp className="w-4 h-4 text-[#07865C]" />
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

          {/* Corporate Attribution Footnote */}
          <div className="pt-6">
            <span className="text-xs font-medium text-white/75">
              Powered by{' '}
              <span className="text-white font-bold">
                Dishanitish Technologies
              </span>
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}
