import React, { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { Check, X, Shield, Clock, Layers, ArrowRight, Zap, CheckCircle2 } from 'lucide-react'

gsap.registerPlugin(ScrollTrigger)

export const FinancialTransformation: React.FC = () => {
  const sectionRef = useRef<HTMLElement>(null)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const ctx = gsap.context(() => {
      gsap.from('.transform-header', {
        scrollTrigger: {
          trigger: '.transform-header',
          start: 'top 85%',
        },
        y: 30,
        opacity: 0,
        duration: 0.8,
        ease: 'power3.out',
      })

      gsap.from('.transform-col-left', {
        scrollTrigger: {
          trigger: '.transform-col-left',
          start: 'top 80%',
        },
        x: -30,
        opacity: 0,
        duration: 0.8,
        ease: 'power3.out',
      })

      gsap.from('.transform-col-right', {
        scrollTrigger: {
          trigger: '.transform-col-right',
          start: 'top 80%',
        },
        x: 30,
        opacity: 0,
        duration: 0.8,
        ease: 'power3.out',
      })
    }, sectionRef)

    return () => ctx.revert()
  }, [])

  return (
    <section
      ref={sectionRef}
      id="architecture"
      className="py-28 bg-[#FAF8F5] relative overflow-hidden border-b border-[#E5DFD5]"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* Section Header */}
        <div className="transform-header text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#D7B77B]/20 border border-[#D7B77B]/50 text-[#8B6B23] text-xs font-bold tracking-wide uppercase mb-4">
            <Layers className="w-3.5 h-3.5" />
            <span>Architecture Comparison</span>
          </div>

          <h2 className="text-3xl sm:text-5xl font-black text-[#12161A] tracking-tight leading-tight">
            Traditional Aggregators vs.{' '}
            <span className="text-[#07865C]">Agentic Pay Direct Model</span>
          </h2>

          <p className="mt-4 text-base sm:text-lg text-[#555E68] leading-relaxed">
            Compare the friction of multi-hop intermediary escrow against autonomous non-custodial software.
          </p>
        </div>

        {/* Side-by-Side Model Comparison Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch mb-12">
          
          {/* Traditional Aggregator Model (Flawed) */}
          <div className="transform-col-left bg-white rounded-3xl p-8 sm:p-10 border border-red-200 shadow-sm flex flex-col justify-between relative overflow-hidden">
            <div className="absolute top-0 right-0 px-4 py-1.5 bg-red-100 text-red-700 text-xs font-extrabold rounded-bl-2xl">
              LEGACY CUSTODIAL
            </div>

            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center font-bold">
                  <X className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-[#12161A]">Traditional Gateway / Aggregator</h3>
                  <p className="text-xs text-[#737373]">Custodial, Delayed, Multi-Hop Float</p>
                </div>
              </div>

              {/* Step-by-step chain */}
              <div className="space-y-4 relative pl-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-red-200">
                <div className="relative">
                  <div className="absolute -left-6 top-1.5 w-3 h-3 rounded-full bg-red-400" />
                  <div className="text-xs font-bold text-[#12161A]">01. Customer Initiates Payment</div>
                  <div className="text-xs text-[#6E7781]">Trapped inside third-party iframe or external aggregator redirect</div>
                </div>

                <div className="relative">
                  <div className="absolute -left-6 top-1.5 w-3 h-3 rounded-full bg-red-400" />
                  <div className="text-xs font-bold text-red-600">02. Nodal / Escrow Pool Deposit</div>
                  <div className="text-xs text-[#6E7781]">Funds sit in aggregator accounts, not your commercial bank account</div>
                </div>

                <div className="relative">
                  <div className="absolute -left-6 top-1.5 w-3 h-3 rounded-full bg-red-400" />
                  <div className="text-xs font-bold text-red-600">03. T+2 to T+4 Settlement Holding Period</div>
                  <div className="text-xs text-[#6E7781]">Your capital is locked while batch clearing cycles process</div>
                </div>

                <div className="relative">
                  <div className="absolute -left-6 top-1.5 w-3 h-3 rounded-full bg-red-400" />
                  <div className="text-xs font-bold text-red-600">04. 1.8% – 2.5% MDR Surcharge Deducted</div>
                  <div className="text-xs text-[#6E7781]">Intermediary fee slices into gross merchant profit margins</div>
                </div>

                <div className="relative">
                  <div className="absolute -left-6 top-1.5 w-3 h-3 rounded-full bg-red-400" />
                  <div className="text-xs font-bold text-red-600">05. 18% GST Imposed on Processing Fees</div>
                  <div className="text-xs text-[#6E7781]">Mandatory tax levied directly on gateway processing charges</div>
                </div>

                <div className="relative">
                  <div className="absolute -left-6 top-1.5 w-3 h-3 rounded-full bg-red-500" />
                  <div className="text-xs font-bold text-[#12161A]">06. Net Reduced Merchant Payout</div>
                  <div className="text-xs text-[#6E7781]">Remaining net funds deposited into bank days later</div>
                </div>
              </div>
            </div>

            <div className="mt-8 pt-4 border-t border-red-100 flex items-center justify-between text-xs text-red-700 font-bold">
              <span>Average Margin Surrendered</span>
              <span className="font-mono text-sm">2.4% Gross Loss</span>
            </div>
          </div>

          {/* DISHA 8.2 Direct Model (Sovereign) */}
          <div className="transform-col-right bg-[#12161A] text-white rounded-3xl p-8 sm:p-10 border border-[#07865C]/40 shadow-xl flex flex-col justify-between relative overflow-hidden">
            <div className="absolute top-0 right-0 px-4 py-1.5 bg-[#07865C] text-[#B5F5D8] text-xs font-black rounded-bl-2xl">
              DISHA 8.2 &bull; SOVEREIGN
            </div>

            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-[#07865C]/20 text-[#B5F5D8] flex items-center justify-center font-bold">
                  <Check className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-white">Agentic Pay Direct Rail</h3>
                  <p className="text-xs text-[#B5F5D8]">Zero-Custody, Instant Bank Credit, Flat Software</p>
                </div>
              </div>

              {/* Step-by-step chain */}
              <div className="space-y-4 relative pl-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-[#07865C]/40">
                <div className="relative">
                  <div className="absolute -left-6 top-1.5 w-3 h-3 rounded-full bg-[#B5F5D8]" />
                  <div className="text-xs font-bold text-white">01. Customer Scans / Authorizes UPI</div>
                  <div className="text-xs text-white/70">Seamless bank-grade dynamic UPI QR on counter or web checkout</div>
                </div>

                <div className="relative">
                  <div className="absolute -left-6 top-1.5 w-3 h-3 rounded-full bg-[#B5F5D8]" />
                  <div className="text-xs font-bold text-[#B5F5D8]">02. Direct Switch Routing (NPCI / Banks)</div>
                  <div className="text-xs text-white/70">Transaction routes directly through regulated bank core switches</div>
                </div>

                <div className="relative">
                  <div className="absolute -left-6 top-1.5 w-3 h-3 rounded-full bg-[#B5F5D8]" />
                  <div className="text-xs font-bold text-[#B5F5D8]">03. Direct Credit into Merchant Account</div>
                  <div className="text-xs text-white/70">100% of payment amount hits your current account immediately</div>
                </div>

                <div className="relative">
                  <div className="absolute -left-6 top-1.5 w-3 h-3 rounded-full bg-[#B5F5D8]" />
                  <div className="text-xs font-bold text-[#B5F5D8]">04. Zero Gateway MDR Deduction</div>
                  <div className="text-xs text-white/70">No percentage commission is deducted from your gross revenue</div>
                </div>

                <div className="relative">
                  <div className="absolute -left-6 top-1.5 w-3 h-3 rounded-full bg-[#B5F5D8]" />
                  <div className="text-xs font-bold text-[#B5F5D8]">05. Zero GST Penalty on Processing Fees</div>
                  <div className="text-xs text-white/70">Eliminates intermediary tax surcharge completely</div>
                </div>

                <div className="relative">
                  <div className="absolute -left-6 top-1.5 w-3 h-3 rounded-full bg-[#B5F5D8]" />
                  <div className="text-xs font-bold text-white">06. Instant T+0 Working Capital Available</div>
                  <div className="text-xs text-white/70">Funds immediately ready for vendor payouts and operations</div>
                </div>
              </div>
            </div>

            <div className="mt-8 pt-4 border-t border-white/10 flex items-center justify-between text-xs text-[#B5F5D8] font-bold">
              <span>Capital Retained</span>
              <span className="font-mono text-sm">100% Gross Revenue</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
