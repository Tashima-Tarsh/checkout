import React, { useState, useEffect, useRef } from 'react'
import { ArrowRight, Play, Pause, ChevronLeft, ChevronRight } from 'lucide-react'

// Images
import heroTrain from '../../assets/disha8-2-hero.jpg'
import himalayaSunrise from '../../assets/disha-himalaya-login.jpg'

interface Scene {
  number: string
  label: string
  headline: string
  subheadline?: string
  accent?: string
  content: string
  bgImage: string
  overlayStyle: string
}

export const CinematicExperience: React.FC = () => {
  const [currentScene, setCurrentScene] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const timerRef = useRef<number | null>(null)

  const scenes: Scene[] = [
    {
      number: '01',
      label: 'Contemporary Indian Commerce',
      headline:
        'India has transformed the way it pays. The next opportunity is to transform the way businesses own their payment infrastructure.',
      content:
        'Digital payments have become an essential part of Indian commerce, connecting businesses and customers with a speed and convenience that would have been difficult to imagine a generation ago. As this ecosystem continues to evolve, businesses deserve greater control over the technology and commercial arrangements supporting their financial operations.',
      bgImage: heroTrain,
      overlayStyle: 'bg-gradient-to-r from-black/80 via-black/50 to-black/30',
    },
    {
      number: '02',
      label: 'The Economics of Modern Payments',
      headline:
        'As businesses grow, the cost of their payment technology should be a commercial decision, not an unavoidable consequence of their success.',
      content:
        'For businesses using commercial payment platforms, technology fees, service charges, subscriptions, maintenance and applicable taxes can form a meaningful part of operational expenditure. When these expenses are connected to transaction volume, growth can introduce additional costs even when the underlying payment experience remains largely unchanged.',
      bgImage: himalayaSunrise,
      overlayStyle: 'bg-gradient-to-r from-black/85 via-black/55 to-black/35',
    },
    {
      number: '03',
      label: 'The Importance of Financial Ownership',
      headline:
        'The relationship between a business and its money should remain where it belongs.',
      content:
        'Businesses should be able to retain control over their receiving accounts while choosing the technology that supports their payment operations. DISHA 8.2 is designed around the distinction between managing payment activity and taking custody of the money involved.',
      bgImage: heroTrain,
      overlayStyle: 'bg-gradient-to-r from-black/80 via-black/50 to-black/30',
    },
    {
      number: '04',
      label: 'Introducing DISHA 8.2',
      accent: 'DISHA 8.2 IS ZERO TOLL FOR MONEY TRANSFER',
      headline:
        'Introducing DISHA 8.2, a different approach to the infrastructure behind Indian commerce.',
      content:
        'DISHA 8.2 brings together a self-hosted payment environment, intelligent transaction monitoring and coordinated verification workflows, giving businesses the opportunity to operate payment technology around their own commercial requirements rather than adapting their business to an externally managed environment.',
      bgImage: himalayaSunrise,
      overlayStyle: 'bg-gradient-to-r from-black/85 via-black/60 to-black/40',
    },
    {
      number: '05',
      label: 'The Future of Indian Enterprise',
      headline:
        'The future of Indian commerce should belong to the businesses that are building it.',
      content:
        'We believe the next chapter of India’s digital payment transformation should give businesses greater financial visibility, meaningful operational independence and the freedom to determine how their payment technology supports their long-term growth.',
      bgImage: heroTrain,
      overlayStyle: 'bg-gradient-to-r from-black/80 via-black/50 to-black/35',
    },
  ]

  // Auto-advance scenes every 8 seconds unless paused by user
  useEffect(() => {
    if (isPaused) {
      if (timerRef.current) clearInterval(timerRef.current)
      return
    }

    timerRef.current = window.setInterval(() => {
      setCurrentScene((prev) => (prev + 1) % scenes.length)
    }, 8000)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [isPaused, scenes.length])

  const scene = scenes[currentScene]

  return (
    <section className="relative w-full min-h-screen flex items-center justify-center overflow-hidden transition-all duration-700">
      {/* Background Cinematic Visual with Smooth Dissolve */}
      {scenes.map((s, idx) => (
        <div
          key={s.number}
          className={`absolute inset-0 bg-cover bg-center transition-opacity duration-1000 ease-out will-change-transform ${
            idx === currentScene ? 'opacity-100 scale-100' : 'opacity-0 scale-105 pointer-events-none'
          }`}
          style={{ backgroundImage: `url(${s.bgImage})` }}
          aria-hidden="true"
        />
      ))}

      {/* Atmospheric lighting overlay */}
      <div className={`absolute inset-0 ${scene.overlayStyle} transition-all duration-700 pointer-events-none`} />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40 pointer-events-none" />

      {/* Main Editorial Scene Typography */}
      <div className="relative z-20 max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 w-full pt-28 pb-20 text-white text-left">
        <div className="max-w-4xl space-y-6">
          
          {/* Tagline / Accent Badge */}
          {scene.accent ? (
            <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-[#245C49]/60 backdrop-blur-md border border-[#B9CFBC]/50 text-[#B9CFBC] text-xs font-mono font-bold tracking-wider uppercase">
              <span className="w-2 h-2 rounded-full bg-[#B9CFBC] animate-ping" />
              <span>{scene.accent}</span>
            </div>
          ) : (
            <div className="inline-flex items-center gap-3 text-xs font-mono tracking-widest text-[#B9CFBC] uppercase font-bold">
              <span>Scene {scene.number}</span>
              <span className="text-white/40">&mdash;</span>
              <span>{scene.label}</span>
            </div>
          )}

          {/* Primary Editorial Headline: Satoshi/PP Neue Montreal + Fluid Clamp */}
          <h1 className="text-3xl sm:text-5xl lg:text-[58px] font-brand font-extrabold tracking-[-0.035em] leading-[1.08] text-white">
            {scene.headline}
          </h1>

          {/* Substantive Human-Written Editorial Paragraph: Geist Sans */}
          <p className="text-base sm:text-xl text-white/90 font-sans leading-[1.65] font-normal max-w-3xl">
            {scene.content}
          </p>

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-4 pt-4">
            <a
              href="#philosophy"
              className="inline-flex items-center gap-2.5 px-6 py-3.5 rounded-full text-sm font-semibold tracking-wide text-white bg-[#245C49] hover:bg-[#1c493a] transition-all shadow-md group"
            >
              <span>Explore DISHA 8.2</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </a>

            <a
              href="#enterprise"
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full text-sm font-semibold tracking-wide text-white/90 bg-white/10 hover:bg-white/20 border border-white/25 backdrop-blur-md transition-all"
            >
              <span>Discuss Your Business Requirements</span>
            </a>
          </div>
        </div>
      </div>

      {/* Bottom Scene Progression Controls (Minimal, Accessible, Transparent) */}
      <div className="absolute bottom-8 left-6 sm:left-12 right-6 sm:right-12 z-30 flex items-center justify-between text-xs text-white/80 font-mono">
        <div className="flex items-center gap-3">
          {scenes.map((s, idx) => (
            <button
              key={s.number}
              onClick={() => setCurrentScene(idx)}
              className={`h-1.5 transition-all rounded-full ${
                idx === currentScene ? 'w-10 bg-[#B9CFBC]' : 'w-3 bg-white/30 hover:bg-white/60'
              }`}
              aria-label={`Go to scene ${s.number}`}
            />
          ))}
          <span className="ml-2 font-semibold">
            {scene.number} / 05
          </span>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsPaused(!isPaused)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 backdrop-blur-md transition-all"
            title={isPaused ? 'Resume sequence' : 'Pause sequence'}
          >
            {isPaused ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
            <span className="text-[11px]">{isPaused ? 'Play' : 'Pause'}</span>
          </button>

          <button
            onClick={() => setCurrentScene((prev) => (prev - 1 + scenes.length) % scenes.length)}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 backdrop-blur-md"
            aria-label="Previous scene"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => setCurrentScene((prev) => (prev + 1) % scenes.length)}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 backdrop-blur-md"
            aria-label="Next scene"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </section>
  )
}
