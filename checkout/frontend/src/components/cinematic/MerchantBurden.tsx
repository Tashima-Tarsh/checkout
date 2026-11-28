import React, { useState } from 'react'
import { AlertCircle, Clock, Percent, ShieldAlert, Lock, ShoppingCart, Utensils, Shirt, Globe, ArrowRight } from 'lucide-react'

export const MerchantBurden: React.FC = () => {
  const [activeArchetype, setActiveArchetype] = useState(0)

  const archetypes = [
    {
      id: 'supermarket',
      title: 'Modern Supermarket Owner',
      location: 'Bengaluru & Mumbai Commercial Hubs',
      volume: '₹75,00,000 / month',
      icon: ShoppingCart,
      painPoint: 'Peak hour counter queues slowed by POS card terminals taking 15-30s per swipe. At 2.2% MDR, over ₹1,65,000 is lost every month just to process payments.',
      feeBreakdown: [
        { label: 'MDR Deduction (2.2%)', value: '₹1,65,000 / mo', warning: true },
        { label: '18% GST on MDR', value: '₹29,700 / mo', warning: true },
        { label: 'Settlement Holding Period', value: 'T+3 Business Days', warning: true },
        { label: 'Locked Working Capital', value: '₹7,50,000 constantly in transit', warning: true }
      ]
    },
    {
      id: 'restaurant',
      title: 'Dining & Hospitality Merchant',
      location: 'Delhi NCR & Hyderabad',
      volume: '₹35,00,000 / month',
      icon: Utensils,
      painPoint: 'Weekend dinner rushes create massive payment congestion. Intermediary aggregator downtime during Saturday peak hours triggers failed settlements and lost revenue.',
      feeBreakdown: [
        { label: 'MDR + Terminal Rental', value: '₹84,000 / mo', warning: true },
        { label: '18% GST on Gateway Fees', value: '₹15,120 / mo', warning: true },
        { label: 'Weekend Payout Freeze', value: 'Friday to Tuesday delay', warning: true },
        { label: 'Supplier Payment Strain', value: 'Cannot pay fresh food vendors on time', warning: true }
      ]
    },
    {
      id: 'boutique',
      title: 'Premium Retail Boutique Owner',
      location: 'Jaipur, Ahmedabad & Pune',
      volume: '₹48,00,000 / month',
      icon: Shirt,
      painPoint: 'High-ticket bridal and festive purchases trigger chargeback risks and steep 2.5% card fees. Working capital remains trapped in aggregator escrow for days.',
      feeBreakdown: [
        { label: 'High-Ticket MDR (2.5%)', value: '₹1,20,000 / mo', warning: true },
        { label: 'Intermediary Gateway Fee', value: '₹12,500 / mo', warning: true },
        { label: 'Dispute & Reserve Hold', value: '10% of revenue withheld for 30 days', warning: true },
        { label: 'Inventory Restock Delay', value: 'New stock orders held back', warning: true }
      ]
    },
    {
      id: 'ecommerce',
      title: 'Online Direct-to-Consumer Seller',
      location: 'Pan-India Distribution',
      volume: '₹1,20,00,000 / month',
      icon: Globe,
      painPoint: 'Cart abandonment due to redirect hops on third-party aggregators. Weekly payouts leave supply chain cash flows severely constrained.',
      feeBreakdown: [
        { label: 'Platform Gateway Fee (2.0%)', value: '₹2,40,000 / mo', warning: true },
        { label: '18% GST on Payment Fees', value: '₹43,200 / mo', warning: true },
        { label: 'Settlement Lag', value: 'T+4 to T+7 Settlement schedule', warning: true },
        { label: 'Working Capital Erosion', value: 'Over ₹28 Lakhs tied up annually', warning: true }
      ]
    }
  ]

  const active = archetypes[activeArchetype]

  return (
    <section id="discover" className="py-24 bg-[#FAF8F3] relative overflow-hidden border-t border-[#DCE2E7]">
      {/* Background Ambience */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[#D7B77B]/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-[#07865C]/5 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-red-50 border border-red-200 text-red-700 text-xs font-bold tracking-wide uppercase mb-4">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>The Traditional Payment Burden</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-[#262626] tracking-tight leading-tight">
            How Intermediary Aggregators Drain{' '}
            <span className="text-red-600">Indian Business Margins</span>
          </h2>
          <p className="mt-4 text-base sm:text-lg text-[#525252] leading-relaxed">
            Every day across Indian commercial streets, hardworking merchants lose 2% to 3% of their top-line revenue to payment middlemen, while their working capital remains frozen in third-party escrow.
          </p>
        </div>

        {/* 4 Archetype Selector Tabs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-10">
          {archetypes.map((arch, idx) => {
            const Icon = arch.icon
            const isSelected = activeArchetype === idx
            return (
              <button
                key={arch.id}
                onClick={() => setActiveArchetype(idx)}
                className={`p-4 rounded-2xl text-left border transition-all flex flex-col justify-between ${
                  isSelected
                    ? 'bg-white border-[#D7B77B] shadow-md ring-2 ring-[#D7B77B]/30'
                    : 'bg-white/60 border-[#DCE2E7] hover:bg-white hover:border-[#D7B77B]/50'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className={`p-2.5 rounded-xl ${isSelected ? 'bg-[#07865C] text-white' : 'bg-[#DCE2E7]/50 text-[#525252]'}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="text-[11px] font-bold text-[#737373]">Archetype 0{idx + 1}</span>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#262626] line-clamp-1">{arch.title}</h3>
                  <p className="text-xs text-[#737373] mt-0.5">{arch.volume}</p>
                </div>
              </button>
            )
          })}
        </div>

        {/* Archetype Detail View & Floating Translucent Burden Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center bg-white rounded-3xl p-6 sm:p-10 border border-[#D7B77B]/30 shadow-lg">
          {/* Left: Narrative Description */}
          <div className="lg:col-span-5 space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-[#FAF8F3] border border-[#DCE2E7] text-xs font-semibold text-[#525252]">
              <span>📍 {active.location}</span>
            </div>

            <h3 className="text-2xl sm:text-3xl font-extrabold text-[#262626] leading-snug">
              {active.title}
            </h3>

            <p className="text-base text-[#525252] leading-relaxed">
              {active.painPoint}
            </p>

            <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200/80">
              <div className="flex items-start gap-3">
                <Lock className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wide">
                    Escrow Holding Reality
                  </h4>
                  <p className="text-xs text-amber-800 mt-1 leading-relaxed">
                    Customer money sits in aggregator clearing accounts generating float income for intermediaries while the merchant waits 72 to 120 hours to receive their own funds.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Floating Translucent Fee Statements */}
          <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {active.feeBreakdown.map((item, i) => (
              <div
                key={i}
                className="p-5 rounded-2xl bg-gradient-to-br from-white to-[#FAF8F3] border border-red-200/60 shadow-sm relative overflow-hidden group hover:border-red-400 transition-all"
              >
                <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/5 rounded-full blur-xl pointer-events-none" />
                <div className="flex items-center justify-between text-xs text-red-600 font-bold uppercase tracking-wider mb-2">
                  <span>Deduction Item 0{i + 1}</span>
                  <Percent className="w-3.5 h-3.5" />
                </div>
                <div className="text-xs text-[#737373] font-medium">{item.label}</div>
                <div className="text-xl font-extrabold text-[#262626] mt-1.5 tracking-tight">
                  {item.value}
                </div>
                <div className="mt-3 flex items-center gap-1.5 text-[11px] font-semibold text-red-600">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                  <span>Silent Profit Erosion</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Transition Teaser */}
        <div className="mt-12 text-center">
          <p className="text-sm font-semibold text-[#737373] uppercase tracking-wider">
            Indian commerce deserved a fundamentally new direction &mdash;
          </p>
        </div>
      </div>
    </section>
  )
}
