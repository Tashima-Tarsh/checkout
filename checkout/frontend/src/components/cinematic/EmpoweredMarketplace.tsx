import React from 'react'
import { CheckCircle2, ShoppingCart, Utensils, Shirt, Globe, ArrowUpRight } from 'lucide-react'

export const EmpoweredMarketplace: React.FC = () => {
  const merchants = [
    {
      title: 'Modern Supermarket',
      icon: ShoppingCart,
      quote: 'Checkout queues move at lightning speed. Zero POS terminal rental fees, and every single rupee hits our bank account in real-time.',
      metrics: '₹1.95 Lakh / mo Saved'
    },
    {
      title: 'Dining & Hospitality',
      icon: Utensils,
      quote: 'Weekend dinner payments reconcile instantly at the table. We pay local vegetable and dairy suppliers immediately on Saturday night with zero delays.',
      metrics: 'Zero Weekend Float'
    },
    {
      title: 'Luxury Retail Boutique',
      icon: Shirt,
      quote: 'High-ticket jewelry and bridal couture sales no longer trigger 2.5% card penalties. Our seasonal inventory restock is funded instantly by today’s revenue.',
      metrics: '100% Margin Retained'
    },
    {
      title: 'D2C Brand Seller',
      icon: Globe,
      quote: 'No cart drop-offs on clunky third-party gateway pages. Customers complete UPI in 2 seconds, and cash flows straight to our logistics and fulfillment accounts.',
      metrics: 'Instant Bank Sync'
    }
  ]

  return (
    <section className="py-24 bg-gradient-to-b from-white via-[#FAF8F3] to-[#FAF8F3] relative overflow-hidden border-t border-[#DCE2E7]">
      {/* Subterranean emerald energy lines */}
      <div className="absolute bottom-10 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#07865C]/40 to-transparent blur-sm pointer-events-none" />
      <div className="absolute bottom-10 left-10 right-10 h-0.5 bg-gradient-to-r from-transparent via-[#B5F5D8] to-transparent pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#07865C]/10 border border-[#07865C]/30 text-[#07865C] text-xs font-bold tracking-wide uppercase mb-4">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>The Empowered Indian Merchant</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-[#262626] tracking-tight leading-tight">
            Indian Commercial Streets,{' '}
            <span className="bg-gradient-to-r from-[#07865C] to-[#D7B77B] bg-clip-text text-transparent">
              Bathed in Clarity
            </span>
          </h2>
          <p className="mt-4 text-base sm:text-lg text-[#525252] leading-relaxed">
            Confidence, liquidity, and direct control. Connected by invisible emerald payment rails running beneath every business counter.
          </p>
        </div>

        {/* 4 Merchant Success Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {merchants.map((m, i) => {
            const Icon = m.icon
            return (
              <div
                key={i}
                className="bg-white rounded-3xl p-6 border border-[#D7B77B]/30 shadow-md hover:shadow-xl transition-all flex flex-col justify-between group hover:border-[#07865C]"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-3 rounded-2xl bg-[#07865C]/10 text-[#07865C] group-hover:bg-[#07865C] group-hover:text-white transition-colors">
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="text-[11px] font-extrabold text-[#07865C] uppercase tracking-wider bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100">
                      {m.metrics}
                    </span>
                  </div>

                  <h3 className="text-base font-extrabold text-[#262626] mb-2">{m.title}</h3>
                  <p className="text-xs text-[#525252] leading-relaxed italic">
                    "{m.quote}"
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-between text-xs text-[#07865C] font-bold">
                  <span>Direct Bank Credit</span>
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
