import React, { useState, useEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import {
  AlertCircle,
  Clock,
  Percent,
  ShieldAlert,
  ShoppingCart,
  Utensils,
  Shirt,
  Globe,
  ArrowRight,
  TrendingDown,
  Building2,
} from 'lucide-react'

gsap.registerPlugin(ScrollTrigger)

export const MerchantBurden: React.FC = () => {
  const [activeArchetype, setActiveArchetype] = useState(0)
  const sectionRef = useRef<HTMLElement>(null)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const ctx = gsap.context(() => {
      gsap.from('.burden-header', {
        scrollTrigger: {
          trigger: '.burden-header',
          start: 'top 85%',
        },
        y: 30,
        opacity: 0,
        duration: 0.8,
        ease: 'power3.out',
      })

      gsap.from('.burden-tabs', {
        scrollTrigger: {
          trigger: '.burden-tabs',
          start: 'top 85%',
        },
        y: 20,
        opacity: 0,
        duration: 0.7,
        ease: 'power3.out',
      })

      gsap.from('.burden-dossier', {
        scrollTrigger: {
          trigger: '.burden-dossier',
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

  const archetypes = [
    {
      id: 'supermarket',
      title: 'Modern Supermarket & Retail Chain',
      location: 'Bengaluru & Mumbai Commercial Hubs',
      volume: '₹75,00,000 / month',
      icon: ShoppingCart,
      painPoint:
        'Peak hour counter queues slowed by POS card terminals taking 15-30s per swipe. At 2.2% MDR, over ₹1,65,000 is lost every month just to process customer payments.',
      feeBreakdown: [
        { label: 'MDR Deduction (2.2%)', value: '₹1,65,000 / mo', warning: true },
        { label: '18% GST on MDR', value: '₹29,700 / mo', warning: true },
        { label: 'Settlement Holding Period', value: 'T+3 Business Days', warning: true },
        { label: 'Locked Working Capital', value: '₹7,50,000 constantly in transit', warning: true },
      ],
      netAnnualLoss: '₹23,36,400',
    },
    {
      id: 'restaurant',
      title: 'Dining & Hospitality Merchant',
      location: 'Delhi NCR & Hyderabad',
      volume: '₹35,00,000 / month',
      icon: Utensils,
      painPoint:
        'Weekend dinner rushes create massive payment congestion. Intermediary aggregator downtime during Saturday peak hours triggers failed settlements and lost revenue.',
      feeBreakdown: [
        { label: 'MDR + Terminal Rental', value: '₹84,000 / mo', warning: true },
        { label: '18% GST on Gateway Fees', value: '₹15,120 / mo', warning: true },
        { label: 'Weekend Payout Freeze', value: 'Friday to Tuesday delay', warning: true },
        { label: 'Supplier Payment Strain', value: 'Cannot pay fresh food vendors on time', warning: true },
      ],
      netAnnualLoss: '₹11,89,440',
    },
    {
      id: 'boutique',
      title: 'Premium Retail Boutique Owner',
      location: 'Jaipur, Ahmedabad & Pune',
      volume: '₹48,00,000 / month',
      icon: Shirt,
      painPoint:
        'High-ticket bridal and festive purchases trigger chargeback risks and steep 2.5% card fees. Working capital remains trapped in aggregator escrow for days.',
      feeBreakdown: [
        { label: 'High-Ticket MDR (2.5%)', value: '₹1,20,000 / mo', warning: true },
        { label: 'Intermediary Gateway Fee', value: '₹12,500 / mo', warning: true },
        { label: 'Dispute & Reserve Hold', value: '10% of revenue withheld for 30 days', warning: true },
        { label: 'Inventory Restock Delay', value: 'New seasonal stock orders held back', warning: true },
      ],
      netAnnualLoss: '₹15,90,000',
    },
    {
      id: 'ecommerce',
      title: 'Online Direct-to-Consumer Seller',
      location: 'Pan-India Distribution',
      volume: '₹1,20,00,000 / month',
      icon: Globe,
      painPoint:
        'Cart abandonment due to redirect hops on third-party aggregators. Weekly payouts leave supply chain cash flows severely constrained.',
      feeBreakdown: [
        { label: 'Platform Gateway Fee (2.0%)', value: '₹2,40,000 / mo', warning: true },
        { label: '18% GST on Payment Fees', value: '₹43,200 / mo', warning: true },
        { label: 'Settlement Lag', value: 'T+4 to T+7 Settlement schedule', warning: true },
        { label: 'Working Capital Erosion', value: 'Over ₹28 Lakhs tied up annually', warning: true },
      ],
      netAnnualLoss: '₹34,00,000',
    },
  ]

  const active = archetypes[activeArchetype]
  const IconComponent = active.icon

  return (
    <section
      ref={sectionRef}
      id="discover"
      className="py-28 bg-[#FAF8F5] relative overflow-hidden border-b border-[#E5DFD5]"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* Section Header */}
        <div className="burden-header text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-red-100/70 border border-red-300 text-red-800 text-xs font-bold tracking-wide uppercase mb-4">
            <AlertCircle className="w-3.5 h-3.5 text-red-700" />
            <span>The Reality of Indian Commerce</span>
          </div>

          <h2 className="text-3xl sm:text-5xl font-black text-[#12161A] tracking-tight leading-tight">
            The Hidden Cost of{' '}
            <span className="text-red-700">Payment Intermediaries.</span>
          </h2>

          <p className="mt-4 text-base sm:text-lg text-[#555E68] leading-relaxed">
            For decades, Indian businesses have surrendered hard-earned margins to third-party gateways that hold funds in transit, deduct MDR tolls, and charge GST on transaction fees.
          </p>
        </div>

        {/* 4 Archetype Selector Tabs */}
        <div className="burden-tabs flex flex-wrap items-center justify-center gap-2 sm:gap-3 mb-12">
          {archetypes.map((arch, index) => {
            const ArchIcon = arch.icon
            const isSelected = activeArchetype === index
            return (
              <button
                key={arch.id}
                onClick={() => setActiveArchetype(index)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all border ${
                  isSelected
                    ? 'bg-[#12161A] text-white border-[#12161A] shadow-md'
                    : 'bg-white text-[#555E68] border-[#E5DFD5] hover:border-[#12161A] hover:text-[#12161A]'
                }`}
              >
                <ArchIcon className={`w-4 h-4 ${isSelected ? 'text-[#B5F5D8]' : 'text-[#889098]'}`} />
                <span>{arch.title.split('&')[0]}</span>
              </button>
            )
          })}
        </div>

        {/* Investigative Dossier Card */}
        <div className="burden-dossier bg-white rounded-3xl border border-[#E5DFD5] shadow-sm overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-[#E5DFD5]">
            
            {/* Left Column: Archetype Profile & Commercial Context */}
            <div className="lg:col-span-5 p-8 sm:p-10 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-12 h-12 rounded-2xl bg-[#12161A] text-[#B5F5D8] flex items-center justify-center shadow-sm">
                    <IconComponent className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-[#12161A]">{active.title}</h3>
                    <p className="text-xs text-[#6E7781] font-medium">{active.location}</p>
                  </div>
                </div>

                <div className="mb-6 p-4 rounded-2xl bg-[#FAF8F5] border border-[#E5DFD5]">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-[#6E7781]">
                    Monthly Commercial Turn
                  </div>
                  <div className="text-2xl font-black text-[#12161A] mt-0.5 font-mono">
                    {active.volume}
                  </div>
                </div>

                <p className="text-sm text-[#444D56] leading-relaxed">
                  {active.painPoint}
                </p>
              </div>

              {/* Net Annual Loss Highlight */}
              <div className="mt-8 pt-6 border-t border-[#E5DFD5]">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-[#6E7781] uppercase tracking-wider">
                    Annual Capital Surrendered
                  </div>
                  <div className="text-xl font-black text-red-600 font-mono">
                    {active.netAnnualLoss}
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Deductions & Escrow Breakdown */}
            <div className="lg:col-span-7 p-8 sm:p-10 bg-[#FCFBF8]">
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-[#E5DFD5]">
                <span className="text-xs font-bold uppercase tracking-wider text-[#12161A]">
                  Fee Statement Audit
                </span>
                <span className="text-xs font-semibold text-red-600 flex items-center gap-1">
                  <TrendingDown className="w-3.5 h-3.5" />
                  Direct Margin Erosion
                </span>
              </div>

              <div className="space-y-4">
                {active.feeBreakdown.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-2xl bg-white border border-[#E5DFD5] flex items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-red-500" />
                      <span className="text-xs sm:text-sm font-bold text-[#12161A]">
                        {item.label}
                      </span>
                    </div>
                    <span className="text-xs sm:text-sm font-black text-red-600 font-mono text-right">
                      {item.value}
                    </span>
                  </div>
                ))}
              </div>

              {/* Solution Preview Pill */}
              <div className="mt-6 p-4 rounded-2xl bg-[#07865C]/10 border border-[#07865C]/30 flex items-center justify-between text-xs text-[#065440]">
                <span className="font-bold">
                  DISHA 8.2 Solution: 0% Escrow &bull; Direct T+0 Bank Settlement
                </span>
                <a
                  href="#calculator"
                  className="inline-flex items-center gap-1 font-extrabold text-[#07865C] hover:underline"
                >
                  <span>Calculate Savings</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
