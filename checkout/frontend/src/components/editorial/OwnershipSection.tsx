import React from 'react'
import { ArrowRight, ShieldCheck, Check } from 'lucide-react'

export const OwnershipSection: React.FC = () => {
  return (
    <section id="platform" className="py-32 bg-white text-[#242722] border-b border-[#E5E0D5]">
      <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 text-left">
        
        {/* Editorial Eyebrow */}
        <div className="text-xs font-mono font-bold tracking-widest uppercase text-[#245C49] mb-6">
          Financial Ownership &mdash; The Non-Custodial Standard
        </div>

        {/* Section Headline */}
        <h2 className="text-3xl sm:text-5xl lg:text-[52px] font-brand font-bold tracking-[-0.035em] leading-[1.14] text-[#242722] max-w-4xl mb-12">
          Your business has worked for every rupee it earns, and the infrastructure supporting that revenue should respect the importance of financial ownership.
        </h2>

        {/* 2-Column Editorial Composition */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-start">
          
          {/* Left Text Narrative */}
          <div className="lg:col-span-7 space-y-6 text-lg sm:text-[20px] text-[#242722]/85 font-sans leading-[1.7]">
            <p>
              DISHA 8.2 is designed as a non-custodial payment technology environment. Customers continue to use supported payment methods through the existing UPI network, while eligible payments follow the banking network directly to the merchant’s registered receiving account.
            </p>

            <p>
              Rather than positioning itself between a business and its funds, DISHA focuses on the technology surrounding payment activity, providing a foundation for greater visibility, operational control and informed transaction management.
            </p>

            <div className="pt-4 space-y-3 text-sm font-medium text-[#242722]">
              <div className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-[#245C49]/15 text-[#245C49] flex items-center justify-center shrink-0 mt-0.5">
                  <Check className="w-3.5 h-3.5" />
                </div>
                <span>Direct bank-to-bank settlement into your RBI-regulated commercial account</span>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-[#245C49]/15 text-[#245C49] flex items-center justify-center shrink-0 mt-0.5">
                  <Check className="w-3.5 h-3.5" />
                </div>
                <span>Zero intermediary escrow accounts, nodal delays, or clearing float</span>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-[#245C49]/15 text-[#245C49] flex items-center justify-center shrink-0 mt-0.5">
                  <Check className="w-3.5 h-3.5" />
                </div>
                <span>Full sovereign audit trails across transactions, reversals, and settlement receipts</span>
              </div>
            </div>
          </div>

          {/* Right Architectural Diagram (Clean, Modern, Unboxed) */}
          <div className="lg:col-span-5 bg-[#F7F5EF] rounded-2xl p-8 border border-[#E5E0D5] space-y-6">
            <div className="text-xs font-mono font-bold uppercase tracking-wider text-[#245C49] pb-3 border-b border-[#E5E0D5]">
              Capital Flow Comparison
            </div>

            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-white border border-[#E5E0D5]">
                <div className="text-[11px] font-mono font-bold text-red-700 uppercase">Legacy Aggregator Model</div>
                <div className="text-sm font-semibold text-[#242722] mt-1">
                  Customer &rarr; Aggregator Nodal Pool &rarr; <span className="text-red-600">Toll / MDR Deducted</span> &rarr; T+3 Merchant Bank
                </div>
              </div>

              <div className="p-4 rounded-xl bg-[#245C49] text-white">
                <div className="text-[11px] font-mono font-bold text-[#B9CFBC] uppercase">DISHA 8.2 Direct Standard</div>
                <div className="text-sm font-semibold text-white mt-1">
                  Customer &rarr; Bank Switch (NPCI) &rarr; <span className="text-[#B9CFBC]">Immediate T+0 Credit</span> &rarr; Merchant Account
                </div>
              </div>
            </div>

            <p className="text-xs text-[#242722]/65 leading-relaxed pt-2">
              DISHA 8.2 operates purely as a software observation and verification layer, guaranteeing zero possession of funds at any point in the payment lifecycle.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
