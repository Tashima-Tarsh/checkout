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
    <section className="py-28 bg-[#FAF8F5] relative overflow-hidden border-b border-[#E5DFD5]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#07865C]/10 border border-[#07865C]/30 text-[#07865C] text-xs font-bold tracking-wide uppercase mb-4">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Commercial Freedom</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-black text-[#12161A] tracking-tight leading-tight">
            Indian Commercial Hubs,{' '}
            <span className="text-[#07865C]">
              Operating with Complete Clarity.
            </span>
          </h2>
          <p className="mt-4 text-base sm:text-lg text-[#555E68] leading-relaxed">
            Confidence, liquidity, and direct control. Direct bank rail settlement running beneath every counter.
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
