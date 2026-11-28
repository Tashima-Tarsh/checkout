import React, { useEffect, useRef } from 'react'
import Lenis from 'lenis'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

// Editorial Master Brand Components
import { CinematicExperience } from '../components/editorial/CinematicExperience'
import { PhilosophySection } from '../components/editorial/PhilosophySection'
import { OwnershipSection } from '../components/editorial/OwnershipSection'
import { EconomicsSection } from '../components/editorial/EconomicsSection'
import { IntelligenceSection } from '../components/editorial/IntelligenceSection'
import { EnterpriseEnvironment } from '../components/editorial/EnterpriseEnvironment'
import { CommercialApproach } from '../components/editorial/CommercialApproach'
import { VisionFooter } from '../components/editorial/VisionFooter'

// Register GSAP ScrollTrigger
gsap.registerPlugin(ScrollTrigger)

interface HomeProps {
  isAudioPlaying?: boolean
  onToggleAudio?: () => void
}

export const Home: React.FC<HomeProps> = () => {
  const containerRef = useRef<HTMLDivElement>(null)

  // -------------------------------------------------------------
  // LENIS SMOOTH SCROLL & SCROLL ORCHESTRATION
  // -------------------------------------------------------------
  useEffect(() => {
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

    lenis.on('scroll', ScrollTrigger.update)

    const updateLenis = (time: number) => {
      lenis.raf(time * 1000)
    }

    gsap.ticker.add(updateLenis)
    gsap.ticker.lagSmoothing(0)

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
    <div
      ref={containerRef}
      className="w-full overflow-x-hidden bg-[#F7F5EF] text-[#242722] antialiased selection:bg-[#245C49] selection:text-white"
    >
      {/* 01. Five-Scene Cinematic Narrative Sequence (Photorealistic Indian Visuals & Master Tagline) */}
      <CinematicExperience />

      {/* 02. Institutional Editorial Philosophy: Foundations of Indian Commerce */}
      <PhilosophySection />

      {/* 03. Financial Ownership & Zero-Custody Direct Settlement Architecture */}
      <OwnershipSection />

      {/* 04. Economics of Modern Payments & Full-Width Interactive Ownership Calculator */}
      <EconomicsSection />

      {/* 05. Intelligent Multi-Agent Verification Architecture (4 Coordinated Verification Channels) */}
      <IntelligenceSection />

      {/* 06. Contemporary Indian Enterprise Environments & Interactive Workstation Simulation */}
      <EnterpriseEnvironment />

      {/* 07. Commercial Approach, Self-Hosted Deployment Options & Enterprise Consultation Briefing */}
      <CommercialApproach />

      {/* 08. Closing Vision & Institutional Regulatory Footer (Powered by Disha Nitish Technologies) */}
      <VisionFooter />
    </div>
  )
}
