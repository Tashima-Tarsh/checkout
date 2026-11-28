import React, { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import {
  ArrowRight,
  Play,
  Pause,
  ShieldCheck,
  CheckCircle2,
  Zap,
  LogIn,
  TrendingUp,
  Cpu,
  Activity,
} from 'lucide-react'

// Official DISHA 8.2 high-resolution photograph background
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
  const heroContentRef = useRef<HTMLDivElement>(null)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })

  // -------------------------------------------------------------
  // GSAP ENTRANCE SEQUENCE
  // -------------------------------------------------------------
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } })

      tl.from('.hero-badge', {
        y: -20,
        opacity: 0,
        duration: 0.8,
        delay: 0.2,
      })
        .from(
          '.hero-title',
          {
            y: 35,
            opacity: 0,
            duration: 1.0,
          },
          '-=0.4'
        )
        .from(
          '.hero-tagline',
          {
            y: 20,
            opacity: 0,
            duration: 0.8,
          },
          '-=0.6'
        )
        .from(
          '.hero-description',
          {
            y: 20,
            opacity: 0,
            duration: 0.8,
          },
          '-=0.5'
        )
        .from(
          '.hero-metrics',
          {
            y: 20,
            opacity: 0,
            stagger: 0.1,
            duration: 0.7,
          },
          '-=0.5'
        )
        .from(
          '.hero-ctas',
          {
            y: 20,
            opacity: 0,
            duration: 0.7,
          },
          '-=0.4'
        )
    }, heroContentRef)

    return () => ctx.revert()
  }, [])

  // -------------------------------------------------------------
  // PHOTOREALISTIC MOTION CANVAS: Volumetric Clouds, Energy Rail
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

    // Cloud Mist for volumetric atmospheric depth
    const clouds: Array<{
      x: number
      y: number
      radius: number
      speed: number
      alpha: number
    }> = []

    for (let i = 0; i < 30; i++) {
      clouds.push({
        x: Math.random() * width,
        y: height * 0.42 + (Math.random() - 0.2) * (height * 0.45),
        radius: 140 + Math.random() * 220,
        speed: 0.15 + Math.random() * 0.35,
        alpha: 0.06 + Math.random() * 0.1,
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
      color: string
    }> = []

    for (let i = 0; i < 40; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        size: 1 + Math.random() * 2.2,
        speedY: -0.15 - Math.random() * 0.3,
        speedX: 0.1 + Math.random() * 0.2,
        opacity: 0.2 + Math.random() * 0.6,
        color: Math.random() > 0.4 ? '#D7B77B' : '#B5F5D8',
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
          cloud.y = height * 0.42 + (Math.random() - 0.2) * (height * 0.45)
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
        gradient.addColorStop(0.5, `rgba(245, 232, 215, ${cloud.alpha * 0.45})`)
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)')

        ctx.fillStyle = gradient
        ctx.beginPath()
        ctx.arc(cloud.x, cloud.y, cloud.radius, 0, Math.PI * 2)
        ctx.fill()
      }

      // 2. High-Speed Luminous Rail Pulse along the Viaduct
      pulseOffset += 0.022
      const railStartX = width * 0.16
      const railStartY = height * 0.86
      const railEndX = width * 0.48
      const railEndY = height * 0.56

      const pulseProgress = (Math.sin(pulseOffset * 1.6) + 1) / 2
      const currentPulseX = railStartX + (railEndX - railStartX) * (1 - pulseProgress)
      const currentPulseY = railStartY + (railEndY - railStartY) * (1 - pulseProgress)

      const railBeam = ctx.createRadialGradient(
        currentPulseX,
        currentPulseY,
        3,
        currentPulseX,
        currentPulseY,
        60
      )
      railBeam.addColorStop(0, 'rgba(181, 245, 216, 0.8)')
      railBeam.addColorStop(0.4, 'rgba(7, 134, 92, 0.4)')
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

  return (
    <section className="relative min-h-[95vh] flex items-center justify-center overflow-hidden pt-32 pb-24 border-b border-[#E5DFD5]">
      {/* ------------------------------------------------------------- */}
      {/* 1. CINEMATIC BACKGROUND IMAGE (Official DISHA 8.2 Train Art)   */}
      {/* ------------------------------------------------------------- */}
      <div
        className="absolute inset-0 bg-cover bg-center transition-transform duration-1000 ease-out will-change-transform"
        style={{
          backgroundImage: `url(${heroImage})`,
          animation: 'subtleBreathe 16s ease-in-out infinite alternate',
        }}
        aria-hidden="true"
      />

      {/* Atmospheric lighting gradients for uncompromising text readability */}
      <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-black/20 pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/35 pointer-events-none" />

      {/* ------------------------------------------------------------- */}
      {/* 2. REALISTIC MOTION CANVAS (Clouds, Energy Pulse, Sunlight)   */}
      {/* ------------------------------------------------------------- */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 pointer-events-none z-10"
        aria-hidden="true"
      />

      {/* ------------------------------------------------------------- */}
      {/* 3. HERO CONTENT: CRISP, ARCHITECTURAL LUXURY (NO GENERIC GRADIENTS) */}
      {/* ------------------------------------------------------------- */}
      <div
        ref={heroContentRef}
        className="relative z-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full text-left text-white"
      >
        <div className="max-w-3xl space-y-7">
          {/* Flagship Brand Eyebrow */}
          <div className="hero-badge inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-white/15 backdrop-blur-2xl border border-white/30 shadow-sm">
            <span className="w-2.5 h-2.5 rounded-full bg-[#B5F5D8] animate-ping" />
            <span className="text-xs font-black tracking-wider uppercase text-white font-mono">
              DISHA 8.2
            </span>
            <span className="text-white/40">|</span>
            <span className="text-xs font-bold tracking-wide text-[#B5F5D8]">
              Agentic Pay
            </span>
          </div>

          {/* Primary Headline: High-Contrast Solid Typography */}
          <h1 className="hero-title text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight leading-[1.04] text-white">
            The Next Direction of{' '}
            <span className="text-[#B5F5D8]">Indian Payments.</span>
          </h1>

          {/* Signature Tagline */}
          <p className="hero-tagline text-xl sm:text-2xl font-bold tracking-tight text-[#FAF8F5]">
            Your Business, Entirely in Your Control.
          </p>

          {/* Business Value Description */}
          <p className="hero-description text-base sm:text-lg text-white/90 max-w-2xl font-normal leading-relaxed">
            Autonomous, zero-custody UPI payment orchestration that deposits customer funds directly
            into your commercial bank account. Zero intermediary escrow, zero gateway toll deductions,
            and immediate T+0 settlement.
          </p>

          {/* Value Badges (Brushed Titanium, Zero Generic Gradient Blobs) */}
          <div className="hero-metrics flex flex-wrap gap-3 pt-1">
            <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/[0.12] backdrop-blur-xl border border-white/25 text-xs font-semibold text-white">
              <CheckCircle2 className="w-4 h-4 text-[#B5F5D8]" />
              <span>Direct Bank Credit</span>
            </div>

            <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/[0.12] backdrop-blur-xl border border-white/25 text-xs font-semibold text-white">
              <ShieldCheck className="w-4 h-4 text-[#D7B77B]" />
              <span>Zero Escrow Float</span>
            </div>

            <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/[0.12] backdrop-blur-xl border border-white/25 text-xs font-semibold text-white">
              <Zap className="w-4 h-4 text-[#B5F5D8]" />
              <span>Instant Settlement (T+0)</span>
            </div>

            <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/[0.12] backdrop-blur-xl border border-white/25 text-xs font-semibold text-white">
              <Activity className="w-4 h-4 text-[#00C888]" />
              <span>10,000+ Peak TPS</span>
            </div>
          </div>

          {/* Action CTAs */}
          <div className="hero-ctas flex flex-wrap items-center gap-4 pt-3">
            {/* Merchant Login CTA button directing to dedicated unboxed login page */}
            <a
              href="/merchant-login"
              className="inline-flex items-center gap-2.5 px-6 py-4 rounded-xl text-xs sm:text-sm font-bold uppercase tracking-wider text-white bg-[#07865C] hover:bg-[#065440] shadow-xl shadow-[#07865C]/40 border border-[#B5F5D8]/40 transition-all group"
            >
              <LogIn className="w-4 h-4" />
              <span>Merchant Login</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </a>

            <a
              href="#calculator"
              className="inline-flex items-center gap-2.5 px-6 py-4 rounded-xl text-xs sm:text-sm font-bold text-[#1a1a1a] bg-[#D7B77B] hover:bg-[#e4c48a] shadow-lg transition-all"
            >
              <span>Calculate Merchant Savings</span>
              <TrendingUp className="w-4 h-4 text-[#07865C]" />
            </a>

            {/* Audio Narration Toggle */}
            <button
              onClick={onToggleAudio}
              className={`inline-flex items-center gap-2.5 px-5 py-4 rounded-xl text-xs font-bold border backdrop-blur-xl transition-all ${
                isAudioPlaying
                  ? 'bg-[#07865C]/80 border-[#B5F5D8] text-white shadow-lg shadow-[#07865C]/40'
                  : 'bg-white/15 border-white/30 text-white hover:bg-white/25'
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
          <div className="pt-4 border-t border-white/15">
            <span className="text-xs font-medium text-white/75">
              Powered by{' '}
              <span className="text-white font-bold tracking-wide">
                Dishanitish Technologies
              </span>
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}
