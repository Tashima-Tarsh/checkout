import React, { useState, useEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import {
  Sparkles,
  Zap,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Building,
  Cpu,
  Layers,
} from 'lucide-react'

gsap.registerPlugin(ScrollTrigger)

export const TrainArrival: React.FC = () => {
  const [activeStep, setActiveStep] = useState(0)
  const sectionRef = useRef<HTMLElement>(null)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const ctx = gsap.context(() => {
      gsap.from('.arrival-header', {
        scrollTrigger: {
          trigger: '.arrival-header',
          start: 'top 85%',
        },
        y: 30,
        opacity: 0,
        duration: 0.8,
        ease: 'power3.out',
      })

      gsap.from('.arrival-card', {
        scrollTrigger: {
          trigger: '.arrival-card',
          start: 'top 80%',
        },
        y: 25,
        opacity: 0,
        duration: 0.8,
        ease: 'power3.out',
      })
    }, sectionRef)

    return () => ctx.revert()
  }, [])

  const steps = [
    {
      id: 1,
      badge: 'Direct Connectivity',
      title: 'Direct Bank-to-Bank Routing',
      tagline: 'Zero Intermediary Buffer Between Customer & Merchant',
      desc: 'DISHA 8.2 connects your counter terminals directly to regulated Indian banking switches (HDFC, ICICI, SBI, Axis, Yes Bank) and NPCI, enabling deterministic payment verification without gateways holding your liquidity in transit.',
      stat: '100% Direct',
      statLabel: 'Bank-to-Bank Credit',
      features: [
        'Direct UPI credit deposited into your corporate current account',
        'Elimination of third-party clearing pools and multi-day float holds',
        'Sub-second deterministic confirmation pulses across counters',
      ],
    },
    {
      id: 2,
      badge: 'Cost Elimination',
      title: 'Eliminate Hidden Gateway Fees',
      tagline: 'Stop Losing 2% to 3% on Every Customer Sale',
      desc: 'Traditional payment gateways slice off MDR percentages and add 18% GST on top. Agentic Pay operates on a pure software model, keeping 100% of transaction gross revenue in your account.',
      stat: '0% Gateway MDR',
      statLabel: 'On Eligible UPI Rails',
      features: [
        'No transaction percentages slicing into retail margins',
        'Zero 18% GST surcharge on payment gateway fee deductions',
        'Predictable, flat software model for complete operational cost control',
      ],
    },
    {
      id: 3,
      badge: 'Cashflow Acceleration',
      title: 'Instant Working Capital Access',
      tagline: 'Never Wait for 3-Day or Weekend Payout Freezes',
      desc: 'Customer payments settle immediately the moment they are verified. Use today’s revenue to pay suppliers, restock fast-selling inventory, and accelerate business operations.',
      stat: 'T+0 Instant',
      statLabel: 'Settlement Availability',
      features: [
        'Instant liquidity available for vendor and supplier RTGS payments',
        'Elimination of Friday-to-Tuesday weekend settlement holds',
        'Automated real-time ledger reconciliation across all counters',
      ],
    },
  ]

  const current = steps[activeStep]

  return (
    <section
      ref={sectionRef}
      id="benefits"
      className="py-28 bg-[#F4F1EA] relative overflow-hidden border-b border-[#E5DFD5]"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* Section Header */}
        <div className="arrival-header text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#07865C]/10 border border-[#07865C]/30 text-[#07865C] text-xs font-bold tracking-wide uppercase mb-4">
            <Cpu className="w-3.5 h-3.5" />
            <span>Direct Rail Architecture</span>
          </div>

          <h2 className="text-3xl sm:text-5xl font-black text-[#12161A] tracking-tight leading-tight">
            Direct Financial Rails for{' '}
            <span className="text-[#07865C]">Indian Enterprise.</span>
          </h2>

          <p className="mt-4 text-base sm:text-lg text-[#555E68] leading-relaxed">
            Payment operations redesigned for complete merchant autonomy, instant capital access, and zero intermediary toll deductions.
          </p>
        </div>

        {/* 3 Step Interactive Navigation */}
        <div className="flex justify-center mb-10">
          <div className="inline-flex p-1.5 rounded-2xl bg-white border border-[#E5DFD5] shadow-sm gap-2">
            {steps.map((s, idx) => (
              <button
                key={s.id}
                onClick={() => setActiveStep(idx)}
                className={`px-4 sm:px-6 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                  activeStep === idx
                    ? 'bg-[#12161A] text-white shadow-sm'
                    : 'text-[#555E68] hover:text-[#12161A] hover:bg-[#FAF8F5]'
                }`}
              >
                <span>{s.badge}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Active Rail Technical Card */}
        <div className="arrival-card bg-white rounded-3xl border border-[#E5DFD5] shadow-sm p-8 sm:p-12">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            
            {/* Left Content */}
            <div className="lg:col-span-7 space-y-5 text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#07865C]/10 text-[#07865C] text-xs font-bold tracking-wide uppercase">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{current.badge}</span>
              </div>

              <h3 className="text-2xl sm:text-3xl font-black text-[#12161A]">
                {current.title}
              </h3>

              <p className="text-sm sm:text-base font-semibold text-[#8B6B23]">
                {current.tagline}
              </p>

              <p className="text-sm text-[#555E68] leading-relaxed">
                {current.desc}
              </p>

              <div className="space-y-2.5 pt-2">
                {current.features.map((feat, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full bg-[#07865C]/15 text-[#07865C] flex items-center justify-center shrink-0">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-xs sm:text-sm font-medium text-[#12161A]">
                      {feat}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right Metric Box */}
            <div className="lg:col-span-5 bg-[#FAF8F5] rounded-2xl border border-[#E5DFD5] p-8 text-center flex flex-col justify-center items-center space-y-4">
              <div className="text-xs font-bold text-[#6E7781] uppercase tracking-wider">
                Autonomous Verification Benchmark
              </div>

              <div className="text-4xl sm:text-5xl font-black text-[#07865C] font-mono">
                {current.stat}
              </div>

              <div className="text-xs font-bold text-[#12161A]">
                {current.statLabel}
              </div>

              <div className="pt-4 border-t border-[#E5DFD5] w-full flex items-center justify-center gap-2 text-xs font-semibold text-[#6E7781]">
                <ShieldCheck className="w-4 h-4 text-[#07865C]" />
                <span>Zero Third-Party Escrow</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
