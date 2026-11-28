import React, { useState } from 'react'
import { Monitor, Tablet, Smartphone, Building, Store, Truck, Factory } from 'lucide-react'

export const EnterpriseEnvironment: React.FC = () => {
  const [selectedFleet, setSelectedFleet] = useState<'desktop' | 'tablet' | 'mobile'>('desktop')

  const industries = [
    {
      sector: 'Organised Multi-Store Retail',
      icon: Store,
      metric: 'Sub-200ms Counter Checkout',
      desc: 'Supermarket and retail counter POS nodes connected directly to corporate current accounts, eliminating terminal rental fees and peak-hour queue delays.',
    },
    {
      sector: 'D2C & Digital E-Commerce',
      icon: Monitor,
      metric: 'Zero Redirect Friction',
      desc: 'Direct-to-bank dynamic UPI checkout integrated natively into store checkouts, reducing checkout drop-offs and returning working capital instantly on T+0.',
    },
    {
      sector: 'Modern Logistics & Distribution',
      icon: Truck,
      metric: 'Instant Cash-on-Delivery Sync',
      desc: 'Mobile agentic verification enabling delivery personnel to generate dynamic UPI QR codes with real-time central ledger reconciliation upon customer scan.',
    },
    {
      sector: 'Industrial Manufacturing',
      icon: Factory,
      metric: 'High-Ticket B2B Settlements',
      desc: 'Enterprise accounts handling distributor advance invoices and supplier RTGS/UPI settlements with zero escrow float and automated GST tax reporting.',
    },
  ]

  return (
    <section className="py-32 bg-[#F7F5EF] text-[#242722] border-b border-[#E5E0D5]">
      <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 text-left">
        
        {/* SECTION 1: ENTERPRISE FLEET ENVIRONMENT */}
        <div className="mb-24">
          <div className="text-xs font-mono font-bold tracking-widest uppercase text-[#245C49] mb-6">
            The Enterprise Environment &mdash; Connected Operational Control
          </div>

          <h2 className="text-3xl sm:text-5xl lg:text-[52px] font-brand font-bold tracking-[-0.035em] leading-[1.14] text-[#242722] max-w-4xl mb-8">
            A more connected understanding of the financial activity taking place throughout your business.
          </h2>

          <div className="space-y-6 text-lg sm:text-[20px] text-[#242722]/85 font-sans leading-[1.7] max-w-4xl mb-14">
            <p>
              As businesses expand across locations, operating environments and teams, payment management becomes increasingly difficult to oversee through disconnected systems. DISHA 8.2 is designed to bring these operations together within an environment that supports registered accounts, transaction activity, device management and accessible operational records.
            </p>
            <p>
              The objective is to provide authorised business teams with greater visibility into their payment operations while maintaining a clear understanding of responsibilities, access and transaction status.
            </p>
          </div>

          {/* Device Tabs */}
          <div className="flex gap-3 mb-8">
            <button
              onClick={() => setSelectedFleet('desktop')}
              className={`px-5 py-2.5 rounded-full text-xs font-bold font-mono transition-all border ${
                selectedFleet === 'desktop'
                  ? 'bg-[#242722] text-white border-[#242722]'
                  : 'bg-white text-[#242722]/70 border-[#E5E0D5] hover:border-[#242722]'
              }`}
            >
              Desktop Command Center
            </button>
            <button
              onClick={() => setSelectedFleet('tablet')}
              className={`px-5 py-2.5 rounded-full text-xs font-bold font-mono transition-all border ${
                selectedFleet === 'tablet'
                  ? 'bg-[#242722] text-white border-[#242722]'
                  : 'bg-white text-[#242722]/70 border-[#E5E0D5] hover:border-[#242722]'
              }`}
            >
              Countertop Tablet POS
            </button>
            <button
              onClick={() => setSelectedFleet('mobile')}
              className={`px-5 py-2.5 rounded-full text-xs font-bold font-mono transition-all border ${
                selectedFleet === 'mobile'
                  ? 'bg-[#242722] text-white border-[#242722]'
                  : 'bg-white text-[#242722]/70 border-[#E5E0D5] hover:border-[#242722]'
              }`}
            >
              Field Agentic Mobile
            </button>
          </div>

          {/* Workstation Frame */}
          <div className="bg-[#242722] text-white p-8 sm:p-12 rounded-2xl border border-white/10 font-mono text-xs">
            <div className="flex items-center justify-between pb-6 border-b border-white/10 mb-8">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#B9CFBC] animate-pulse" />
                <span className="text-[#B9CFBC] font-bold uppercase tracking-wider">
                  DISHA 8.2 &bull; Active Terminal Telemetry
                </span>
              </div>
              <div className="text-white/60">
                HOST: merchant.disha8-2.thenitishkr.in &bull; STATUS: VERIFIED
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
              <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                <div className="text-white/60 text-[11px] mb-1">SETTLEMENT TYPE</div>
                <div className="text-base font-bold text-white">Direct Non-Custodial</div>
              </div>
              <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                <div className="text-white/60 text-[11px] mb-1">INTERMEDIARY ESCROW</div>
                <div className="text-base font-bold text-[#B9CFBC]">₹0.00 Held</div>
              </div>
              <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                <div className="text-white/60 text-[11px] mb-1">ACTIVE REVENUE RETENTION</div>
                <div className="text-base font-bold text-white">100.00% Gross</div>
              </div>
            </div>

            <p className="text-white/70 font-sans text-xs leading-relaxed max-w-2xl">
              Engineered with end-to-end cryptographic proofs, real-time UDIR dispute coordination, and multi-location merchant terminal fleet telemetry.
            </p>
          </div>
        </div>

        {/* SECTION 2: BUILT FOR INDIAN ENTERPRISE */}
        <div className="pt-20 border-t border-[#E5E0D5]">
          <div className="text-xs font-mono font-bold tracking-widest uppercase text-[#245C49] mb-6">
            Ecosystem Breadth &mdash; Built for Indian Enterprise
          </div>

          <h2 className="text-3xl sm:text-5xl lg:text-[48px] font-brand font-bold tracking-[-0.035em] leading-[1.14] text-[#242722] max-w-4xl mb-8">
            Designed around the ambition, diversity and evolving commercial requirements of Indian businesses.
          </h2>

          <p className="text-lg sm:text-[20px] text-[#242722]/85 font-sans leading-[1.7] max-w-4xl mb-14">
            Modern Indian commerce is shaped by digital-first companies, established manufacturers, organised retail businesses, distribution networks, professional institutions and enterprises operating across increasingly sophisticated financial environments. DISHA 8.2 is being developed for businesses that recognise the importance of owning critical operational technology and establishing commercially sustainable approaches to their payment infrastructure.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {industries.map((ind, i) => {
              const IndIcon = ind.icon
              return (
                <div key={i} className="p-7 rounded-2xl bg-white border border-[#E5E0D5] flex flex-col justify-between">
                  <div>
                    <div className="w-10 h-10 rounded-xl bg-[#245C49]/10 text-[#245C49] flex items-center justify-center font-bold mb-5">
                      <IndIcon className="w-5 h-5" />
                    </div>
                    <h3 className="text-base font-bold text-[#242722] mb-1 font-brand">
                      {ind.sector}
                    </h3>
                    <div className="text-xs font-mono font-bold text-[#245C49] mb-3">
                      {ind.metric}
                    </div>
                    <p className="text-xs text-[#242722]/75 leading-relaxed font-sans">
                      {ind.desc}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

      </div>
    </section>
  )
}
