import React, { useState } from 'react'
import { Sparkles, Zap, ArrowRight, ShieldCheck, CheckCircle2, Cpu, Radio, Network } from 'lucide-react'

export const TrainArrival: React.FC = () => {
  const [activeStep, setActiveStep] = useState(1)

  const steps = [
    {
      id: 1,
      badge: 'Engineering Marvel',
      title: 'Precision-Engineered Rail Architecture',
      tagline: 'Champagne Gold & Brushed Titanium Fuselage',
      desc: 'Inspired by modern Indian rail engineering, DISHA 8.2 glides along elevated payment tracks with emerald green energy lines (#07865C / #B5F5D8) illuminating its aerodynamic contours.',
      stat: '10,000+ TPS',
      statLabel: 'Peak Rail Throughput',
      features: [
        'Aerodynamic low-drag transaction routing',
        'Direct UPI switch connectivity bypassing gateways',
        'Sub-second deterministic confirmation pulses',
      ]
    },
    {
      id: 2,
      badge: 'Kinetic Dissolution',
      title: 'Dissolving the Intermediary Tax',
      tagline: 'Fee Notices Dissolve into Radiant Liquidity',
      desc: 'As the train crosses the merchant terminal, traditional 2.5% MDR deductions and 18% GST surcharges dissolve instantly into streaming liquid capital deposited straight into merchant accounts.',
      stat: '0% Intermediary MDR',
      statLabel: 'On Eligible UPI Rails',
      features: [
        'No aggregator escrow holding accounts',
        'Zero float exploitation or delayed batch payouts',
        'Instant liquidity return to operating cashflow',
      ]
    },
    {
      id: 3,
      badge: 'Software Emergence',
      title: 'The Digital Embodiment of Agentic Pay',
      tagline: 'Autonomous Intelligent Software Orchestration',
      desc: 'Physical rail energy condenses into pure software intelligence: dynamic merchant routing, instant cryptographic verification, and self-reconciling bank ledgers.',
      stat: '< 2.0s',
      statLabel: 'End-to-End Direct Credit',
      features: [
        'Bank-to-bank instant NEFT / IMPS / UPI verification',
        'Autonomous dispute shielding and receipt matching',
        'Merchant-owned terminal keys and data privacy',
      ]
    }
  ]

  const current = steps[activeStep - 1]

  return (
    <section id="benefits" className="py-24 bg-gradient-to-b from-[#F2EFE8] via-[#FAF8F3] to-[#FAF8F3] relative overflow-hidden">
      {/* Decorative elevated rail line */}
      <div className="absolute top-1/2 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#D7B77B]/40 to-transparent pointer-events-none" />
      <div className="absolute top-1/2 left-1/4 right-1/4 h-1 bg-gradient-to-r from-transparent via-[#07865C]/60 to-transparent blur-sm pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#07865C]/10 border border-[#07865C]/25 text-[#07865C] text-xs font-bold tracking-wide uppercase mb-4">
            <Sparkles className="w-3.5 h-3.5" />
            <span>The Arrival of DISHA 8.2</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-[#262626] tracking-tight leading-tight">
            High-Speed Rails for{' '}
            <span className="bg-gradient-to-r from-[#07865C] to-[#D7B77B] bg-clip-text text-transparent">
              Direct Indian Liquidity
            </span>
          </h2>
          <p className="mt-4 text-base sm:text-lg text-[#525252] leading-relaxed">
            The friction of legacy payment gateways ends here. Watch physical engineering transform into autonomous payment orchestration.
          </p>
        </div>

        {/* 3 Step Interactive Navigation */}
        <div className="flex justify-center mb-12">
          <div className="inline-flex p-1.5 rounded-2xl bg-white border border-[#D7B77B]/30 shadow-md gap-2">
            {steps.map((s) => (
              <button
                key={s.id}
                onClick={() => setActiveStep(s.id)}
                className={`px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 ${
                  activeStep === s.id
                    ? 'bg-gradient-to-r from-[#07865C] to-[#0a9b6b] text-white shadow-sm'
                    : 'text-[#525252] hover:text-[#262626] hover:bg-[#FAF8F3]'
                }`}
              >
                <span>0{s.id}.</span>
                <span>{s.badge}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Detailed Showcase Box */}
        <div className="bg-white rounded-3xl p-6 sm:p-12 border border-[#D7B77B]/40 shadow-xl relative overflow-hidden">
          {/* Subtle Ambient Embellishments */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-[#07865C]/5 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-[#D7B77B]/10 rounded-full blur-3xl pointer-events-none" />

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            {/* Left: Interactive Diagram / Visual Representation */}
            <div className="lg:col-span-6 relative">
              <div className="aspect-[4/3] rounded-2xl bg-gradient-to-br from-[#262626] to-[#171717] p-6 text-white relative overflow-hidden flex flex-col justify-between border border-[#D7B77B]/30 shadow-2xl">
                {/* Emerald illumination line */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#07865C] via-[#B5F5D8] to-[#D7B77B]" />

                {/* Top Badge */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#B5F5D8] animate-ping" />
                    <span className="text-xs font-mono font-bold text-[#B5F5D8] uppercase tracking-wider">
                      DISHA 8.2 // HIGH-SPEED RAIL
                    </span>
                  </div>
                  <span className="text-xs px-2.5 py-1 rounded-md bg-white/10 text-[#D7B77B] font-mono font-bold">
                    ACTIVE
                  </span>
                </div>

                {/* Stylized Visual Train & Software Orbit */}
                <div className="relative py-8 flex flex-col items-center justify-center">
                  {/* Glowing Core */}
                  <div className="w-36 h-36 rounded-full bg-gradient-to-tr from-[#07865C]/30 to-[#D7B77B]/30 border border-[#B5F5D8]/40 flex items-center justify-center relative animate-pulse">
                    <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[#07865C] to-[#043C2E] flex items-center justify-center shadow-lg shadow-[#07865C]/50">
                      <Zap className="w-10 h-10 text-[#B5F5D8]" />
                    </div>
                    {/* Orbiting particles */}
                    <div className="absolute inset-0 border border-dashed border-[#D7B77B]/50 rounded-full animate-spin [animation-duration:12s]" />
                  </div>

                  <div className="mt-4 text-center">
                    <div className="text-sm font-bold text-white tracking-wide">
                      Agentic Pay Orchestration Core
                    </div>
                    <div className="text-xs text-[#B5F5D8] font-mono mt-0.5">
                      Direct Peer-to-Peer UPI Settlement
                    </div>
                  </div>
                </div>

                {/* Bottom Real-time Telemetry */}
                <div className="grid grid-cols-3 gap-2 pt-4 border-t border-white/10 text-center">
                  <div>
                    <div className="text-[10px] text-gray-400 font-mono">LATENCY</div>
                    <div className="text-xs font-bold text-[#B5F5D8] font-mono">&lt; 180ms</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-gray-400 font-mono">SETTLEMENT</div>
                    <div className="text-xs font-bold text-[#D7B77B] font-mono">INSTANT (T+0)</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-gray-400 font-mono">ESCROW</div>
                    <div className="text-xs font-bold text-emerald-400 font-mono">0.00% ZERO</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Step Description & Impact */}
            <div className="lg:col-span-6 space-y-6">
              <div>
                <span className="text-xs font-extrabold uppercase tracking-widest text-[#07865C]">
                  Phase 0{current.id} &bull; {current.badge}
                </span>
                <h3 className="text-2xl sm:text-3xl font-extrabold text-[#262626] mt-1.5 leading-snug">
                  {current.title}
                </h3>
                <p className="text-sm font-semibold text-[#8F6E36] mt-1">
                  {current.tagline}
                </p>
              </div>

              <p className="text-base text-[#525252] leading-relaxed">
                {current.desc}
              </p>

              {/* Big Stat Callout */}
              <div className="p-5 rounded-2xl bg-[#FAF8F3] border border-[#D7B77B]/30 flex items-center justify-between">
                <div>
                  <div className="text-3xl font-extrabold text-[#07865C] tracking-tight">
                    {current.stat}
                  </div>
                  <div className="text-xs font-semibold text-[#737373] mt-0.5">
                    {current.statLabel}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-[#07865C]/10 text-[#07865C]">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
              </div>

              {/* Feature checklist */}
              <ul className="space-y-2.5">
                {current.features.map((feat, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm text-[#404040]">
                    <span className="w-2 h-2 rounded-full bg-[#07865C]" />
                    <span>{feat}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
