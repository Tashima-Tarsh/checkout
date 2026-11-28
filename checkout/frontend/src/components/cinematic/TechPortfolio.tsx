import React from 'react'
import { Shield, Radio, Cpu, ArrowUpRight, Lock } from 'lucide-react'

export const TechPortfolio: React.FC = () => {
  const products = [
    {
      version: 'DISHA 6.6',
      name: 'Sovereign Protection',
      subtitle: 'Defensive Perimeter & Security Operations',
      desc: 'Autonomous multi-perimeter monitoring and physical asset security designed for critical enterprise infrastructure.',
      icon: Shield,
      accent: '#D7B77B',
      status: 'ENTERPRISE SECURITY',
      specs: ['Autonomous Threat Neutralization', 'Zero-Trust Perimeter Matrix', 'Hardened Physical Boundary Protection']
    },
    {
      version: 'DISHA 7.2',
      name: 'Quantum Signal Transport',
      subtitle: 'Encrypted Telemetry & Mission Communications',
      desc: 'High-security cryptographic transport protocols ensuring continuous encrypted telemetry across distributed operations.',
      icon: Radio,
      accent: '#94A3B8',
      status: 'SECURE COMMUNICATIONS',
      specs: ['Post-Quantum Cryptography', 'Long-Range Telemetry Transport', 'Zero-Interception Data Protocol']
    },
    {
      version: 'DISHA 8.2',
      name: 'Intelligent UPI Rail (Agentic Pay)',
      subtitle: 'Autonomous Real-Time Payment Orchestration',
      desc: 'Direct bank-to-bank UPI payment routing, zero-custody transaction settlement, and complete merchant financial sovereignty.',
      icon: Cpu,
      accent: '#07865C',
      status: 'FLAGSHIP COMMERCIAL',
      specs: ['Zero Intermediary Escrow', 'Pure Non-Custodial Software', 'Sub-200ms Instant Bank Credit']
    }
  ]

  return (
    <section id="portfolio" className="py-24 bg-[#1E293B] relative overflow-hidden text-white">
      {/* Background Grid & Subtle Lighting */}
      <div className="absolute inset-0 bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:24px_24px] opacity-25 pointer-events-none" />
      <div className="absolute top-1/3 left-1/4 w-96 h-96 bg-[#07865C]/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-[#D7B77B]/10 rounded-full blur-[140px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Section Header: DishaNitish Technologies Ecosystem */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 border border-white/20 text-[#D7B77B] text-xs font-bold tracking-wide uppercase mb-4">
            <Lock className="w-3.5 h-3.5" />
            <span>Product Portfolio</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight">
            DishaNitish Technologies{' '}
            <span className="bg-gradient-to-r from-[#D7B77B] to-[#B5F5D8] bg-clip-text text-transparent">
              Ecosystem
            </span>
          </h2>
          <p className="mt-4 text-base sm:text-lg text-slate-300 leading-relaxed">
            Three disciplined, mission-critical technology solutions developed by DishaNitish Technologies.
          </p>
        </div>

        {/* 3 Architectural Modules */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {products.map((p, i) => {
            const Icon = p.icon
            const isFlagship = i === 2
            return (
              <div
                key={p.version}
                className={`rounded-3xl p-8 bg-[#0F172A]/90 backdrop-blur-md border transition-all flex flex-col justify-between relative group hover:border-[#D7B77B] ${
                  isFlagship
                    ? 'border-[#07865C] ring-2 ring-[#07865C]/30 shadow-2xl'
                    : 'border-slate-800 hover:shadow-xl'
                }`}
              >
                {/* Edge Illumination Strip */}
                <div
                  className="absolute top-0 left-0 right-0 h-1 rounded-t-3xl"
                  style={{
                    background: isFlagship
                      ? 'linear-gradient(90deg, #07865C, #B5F5D8, #D7B77B)'
                      : `linear-gradient(90deg, ${p.accent}, transparent)`,
                  }}
                />

                <div>
                  <div className="flex items-center justify-between mb-6">
                    <span className="text-xs font-mono font-bold tracking-widest text-[#D7B77B]">
                      {p.version}
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/10 text-slate-300 border border-white/10">
                      {p.status}
                    </span>
                  </div>

                  <div className="p-3 rounded-2xl bg-white/5 w-fit mb-4 text-[#B5F5D8] group-hover:text-white transition-colors">
                    <Icon className="w-6 h-6" />
                  </div>

                  <h3 className="text-xl font-extrabold text-white mb-1">{p.name}</h3>
                  <p className="text-xs font-semibold text-slate-400 mb-4">{p.subtitle}</p>

                  <p className="text-xs text-slate-300 leading-relaxed mb-6">{p.desc}</p>
                </div>

                <div>
                  <div className="pt-4 border-t border-slate-800 space-y-2">
                    {p.specs.map((spec, sIdx) => (
                      <div key={sIdx} className="flex items-center gap-2 text-[11px] text-slate-400 font-mono">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#07865C]" />
                        <span>{spec}</span>
                      </div>
                    ))}
                  </div>

                  {isFlagship ? (
                    <a
                      href="#calculator"
                      className="mt-6 w-full py-2.5 rounded-xl bg-gradient-to-r from-[#07865C] to-[#0a9b6b] hover:from-[#065440] hover:to-[#08785c] text-white text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all shadow-md"
                    >
                      <span>Explore Agentic Pay</span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </a>
                  ) : (
                    <div className="mt-6 text-center text-[11px] text-slate-500 font-mono py-2">
                      Enterprise Access Only
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
