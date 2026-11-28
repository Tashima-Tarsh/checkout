import React from 'react'
import { ArrowUpRight, ShieldCheck } from 'lucide-react'

export const VisionFooter: React.FC = () => {
  return (
    <footer className="bg-[#1C201C] text-[#E5E0D5] border-t border-white/10 pt-24 pb-16">
      <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 text-left">
        
        {/* Large Editorial Vision Closing Statement */}
        <div className="max-w-4xl pb-16 border-b border-white/10">
          <span className="text-xs font-mono font-bold tracking-widest text-[#B9CFBC] uppercase block mb-4">
            Our Long-Term Commitment
          </span>
          <h2 className="text-3xl sm:text-5xl lg:text-6xl font-brand font-extrabold text-white tracking-[-0.03em] leading-[1.15] mb-8">
            Building a future in which Indian businesses have greater ownership over the technology that powers their commerce.
          </h2>
          <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-white/5 border border-white/15 text-xs font-mono text-[#B9CFBC]">
            <span className="w-2 h-2 rounded-full bg-[#B9CFBC]" />
            <span className="font-bold tracking-wider uppercase">DISHA 8.2 IS ZERO TOLL FOR MONEY TRANSFER</span>
          </div>
        </div>

        {/* Navigation & Portal Access Links */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 py-16 border-b border-white/10 text-sm">
          
          {/* Col 1: Identity */}
          <div className="space-y-4">
            <div className="text-2xl font-brand font-black text-white tracking-tight">
              DISHA 8.2
            </div>
            <p className="text-white/70 text-sm leading-relaxed font-sans">
              Autonomous non-custodial payment infrastructure designed for contemporary Indian enterprise commerce.
            </p>
            <div className="text-xs font-mono text-white/50 pt-2">
              Product: Agentic Pay
            </div>
          </div>

          {/* Col 2: Navigation */}
          <div>
            <h4 className="text-xs font-mono font-semibold uppercase tracking-wider text-white/90 mb-4">
              Architecture &amp; Platform
            </h4>
            <ul className="space-y-2.5 text-white/70">
              <li>
                <a href="#philosophy" className="hover:text-white transition-colors">
                  Our Philosophy
                </a>
              </li>
              <li>
                <a href="#platform" className="hover:text-white transition-colors">
                  Non-Custodial Flow
                </a>
              </li>
              <li>
                <a href="#economics" className="hover:text-white transition-colors">
                  Cost-of-Ownership Calculator
                </a>
              </li>
              <li>
                <a href="#intelligence" className="hover:text-white transition-colors">
                  Multi-Agent Verification
                </a>
              </li>
              <li>
                <a href="#enterprise" className="hover:text-white transition-colors">
                  Enterprise Deployments
                </a>
              </li>
            </ul>
          </div>

          {/* Col 3: Portal Authentication (Clean unboxed links) */}
          <div>
            <h4 className="text-xs font-mono font-semibold uppercase tracking-wider text-white/90 mb-4">
              Access Gateways
            </h4>
            <ul className="space-y-3">
              <li>
                <a
                  href="/merchant-login"
                  className="inline-flex items-center gap-2 text-white hover:text-[#B9CFBC] font-medium transition-colors"
                >
                  <span>Merchant Portal</span>
                  <ArrowUpRight className="w-3.5 h-3.5 opacity-70" />
                </a>
              </li>
              <li>
                <a
                  href="/superadmin-login"
                  className="inline-flex items-center gap-2 text-white hover:text-[#B9CFBC] font-medium transition-colors"
                >
                  <span>Super Admin Gateway</span>
                  <ArrowUpRight className="w-3.5 h-3.5 opacity-70" />
                </a>
              </li>
            </ul>
          </div>

          {/* Col 4: Standards & Integrity */}
          <div>
            <h4 className="text-xs font-mono font-semibold uppercase tracking-wider text-white/90 mb-4">
              Compliance Standard
            </h4>
            <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-2 text-xs text-white/70 leading-relaxed font-sans">
              <div className="flex items-center gap-2 text-white font-medium">
                <ShieldCheck className="w-4 h-4 text-[#B9CFBC]" />
                <span>Zero Escrow Custody</span>
              </div>
              <p>
                Strict adherence to non-custodial architecture where commercial fund settlement happens bank-to-bank directly without intermediary pooling.
              </p>
            </div>
          </div>

        </div>

        {/* Regulatory Disclosure Statement */}
        <div className="py-8 border-b border-white/10 text-xs text-white/50 leading-relaxed font-sans">
          <p>
            <strong>Regulatory Notice:</strong> DISHA 8.2 is enterprise financial technology software developed by Disha Nitish Technologies. DISHA 8.2 does not hold merchant funds, operate payment escrow accounts, or function as a payment aggregator. All fund movements occur directly between participating commercial banks and merchant-owned accounts under applicable Reserve Bank of India (RBI) guidelines.
          </p>
        </div>

        {/* Bottom Attribution */}
        <div className="pt-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs font-sans text-white/60">
          <div>
            &copy; {new Date().getFullYear()} DISHA 8.2. All rights reserved.
          </div>
          <div className="font-semibold text-white/90 tracking-wide">
            Powered by Disha Nitish Technologies
          </div>
        </div>

      </div>
    </footer>
  )
}
