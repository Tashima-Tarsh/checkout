import React, { useRef, useEffect, useState } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { motion } from 'framer-motion'

gsap.registerPlugin(ScrollTrigger)

export const Home: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    const tl = gsap.timeline()
    
    tl.from('.hero-eyebrow', {
      opacity: 0,
      y: 30,
      duration: 0.8,
      ease: 'power2.out'
    })
    .from('.hero-h1', {
      opacity: 0,
      y: 40,
      duration: 0.8,
      ease: 'power2.out'
    }, '-=0.6')
    .from('.hero-p', {
      opacity: 0,
      y: 30,
      duration: 0.8,
      ease: 'power2.out'
    }, '-=0.4')
    .from('.hero-actions .btn', {
      opacity: 0,
      y: 30,
      stagger: 0.2,
      duration: 0.6,
      ease: 'power2.out'
    }, '-=0.4')

    setIsLoaded(true)
  }, [])

  return (
    <section className="hero-section relative min-h-[90vh] flex items-center justify-center overflow-hidden">
      {/* 3D Canvas */}
      <div className="hero-canvas absolute inset-0 z-0">
        <canvas ref={canvasRef} className="w-full h-full" />
      </div>

      {/* Hero Content */}
      <div className="hero-content relative z-10 max-w-[900px] px-4 z-10">
        <div className="hero-eyebrow text-sm font-bold text-[var(--disha-violet)] text-transform:uppercase tracking-tight mb-4">
          Introducing a new direction for Indian commerce
        </div>
        <h1 className="hero-h1 text-[clamp(2.5rem,5.5vw,5.5rem)] leading-[1.08] font-[750] leading-[1.08] mb-6 text-[var(--disha-ink)]">
          DISHA 8.2
        </h1>
        <p className="hero-p text-[clamp(1rem,1.2vw,1.125rem)] leading-[1.75] text-[var(--disha-muted)] max-w-[570px] mb-8">
          DISHA 8.2 brings a software-led approach to payments, helping businesses manage their payment operations without DISHA 8.2 holding their money.
        </p>
        <div className="hero-actions flex flex-col sm:flex-row gap-3">
          <button className="btn-primary flex items-center gap-2">
            Discover DISHA 8.2
          </button>
          <button className="btn-secondary">
            Calculate your payment costs
          </button>
        </div>
        <div className="rupee-badge mt-8 flex items-center gap-3 px-4 py-3 bg-[var(--gradient-emerald)] rounded-lg text-white shadow-[0_20px_50px_rgba(8,120,92,0.25)]">
          <span className="rupee-symbol text-xl font-bold">₹</span>
          <span className="rupee-label text-sm font-semibold">Verified payment software</span>
        </div>
      </div>
    </section>
  )
}