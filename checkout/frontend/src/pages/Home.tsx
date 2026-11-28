import React, { useEffect, useRef } from 'react'
import Lenis from 'lenis'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

import { HeroCinematic } from '../components/cinematic/HeroCinematic'
import { MerchantBurden } from '../components/cinematic/MerchantBurden'
import { TrainArrival } from '../components/cinematic/TrainArrival'
import { FinancialTransformation } from '../components/cinematic/FinancialTransformation'
import { SavingsCalculator } from '../components/cinematic/SavingsCalculator'
import { DeviceShowcase } from '../components/cinematic/DeviceShowcase'
import { EmpoweredMarketplace } from '../components/cinematic/EmpoweredMarketplace'
import { TechPortfolio } from '../components/cinematic/TechPortfolio'
import { TrustAndModals } from '../components/cinematic/TrustAndModals'

// Register GSAP ScrollTrigger
gsap.registerPlugin(ScrollTrigger)

interface HomeProps {
  isAudioPlaying: boolean
  onToggleAudio: () => void
}

export const Home: React.FC<HomeProps> = ({ isAudioPlaying, onToggleAudio }) => {
  const containerRef = useRef<HTMLDivElement>(null)

  // -------------------------------------------------------------
  // LENIS SMOOTH SCROLL & GSAP SCROLLTRIGGER ORCHESTRATION
  // -------------------------------------------------------------
  useEffect(() => {
    // Respect user's reduced motion settings
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return
    }

    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: 'vertical',
      gestureOrientation: 'vertical',
      smoothWheel: true,
      wheelMultiplier: 1.0,
      touchMultiplier: 1.5,
    })

    // Synchronize Lenis with GSAP ScrollTrigger
    lenis.on('scroll', ScrollTrigger.update)

    const updateLenis = (time: number) => {
      lenis.raf(time * 1000)
    }

    gsap.ticker.add(updateLenis)
    gsap.ticker.lagSmoothing(0)

    // Smooth scroll for internal anchor links (e.g. #calculator, #discover)
    const handleAnchorClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest('a')
      if (!target) return
      const href = target.getAttribute('href')
      if (href && href.startsWith('#') && href.length > 1) {
        const elem = document.querySelector(href)
        if (elem) {
          e.preventDefault()
          lenis.scrollTo(elem, { offset: -60, duration: 1.2 })
        }
      }
    }
    document.addEventListener('click', handleAnchorClick)

    return () => {
      document.removeEventListener('click', handleAnchorClick)
      gsap.ticker.remove(updateLenis)
      lenis.destroy()
      ScrollTrigger.getAll().forEach((t) => t.kill())
    }
  }, [])

  return (
    <div ref={containerRef} className="w-full overflow-x-hidden bg-[#FAF8F5] text-[#12161A] antialiased selection:bg-[#07865C] selection:text-white">
      {/* 01. Opening Cinematic Hero Scene with Real-Time Motion & Photograph Background */}
      <HeroCinematic isAudioPlaying={isAudioPlaying} onToggleAudio={onToggleAudio} />

      {/* 02. The Reality of Indian Commerce: Merchant Statements & Escrow Loss Audit */}
      <MerchantBurden />

      {/* 03. Direct Rail Architecture: Bypassing Intermediary Payment Tolls */}
      <TrainArrival />

      {/* 04. Financial Transformation: Legacy Aggregator vs Agentic Pay Direct Model */}
      <FinancialTransformation />

      {/* 05. Interactive 3D Savings Calculator with Real-Time Math & Confetti */}
      <SavingsCalculator />

      {/* 06. Sovereign Hardware & Workstation Simulator (Desktop, POS, Mobile) */}
      <DeviceShowcase />

      {/* 07. The Empowered Marketplace: Real-World Settlement Confidence */}
      <EmpoweredMarketplace />

      {/* 08. DishaNitish Technologies Ecosystem: Disciplined Technology Portfolio */}
      <TechPortfolio />

      {/* 09. Trust, RBI Compliance & Non-Custodial Integrity */}
      <TrustAndModals />
    </div>
  )
}
