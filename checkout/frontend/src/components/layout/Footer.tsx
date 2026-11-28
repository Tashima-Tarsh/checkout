import React from 'react'
import { ArrowUpRight, Mail, Phone } from 'lucide-react'

export const Footer: React.FC = () => {
  return (
    <footer className="bg-[#FAF8F3] border-t border-[#DCE2E7] pt-16 pb-12 text-[#525252]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-12">
          {/* Col 1: Brand Info (ONLY DISHA 8.2 typography, no other logo) */}
          <div className="md:col-span-1 space-y-4">
            <div className="flex flex-col">
              <span className="font-black text-2xl text-[#262626]">DISHA 8.2</span>
              <span className="text-xs font-semibold uppercase tracking-wider text-[#737373] -mt-0.5">
                Agentic Pay
              </span>
            </div>
            <p className="text-xs text-[#737373] leading-relaxed">
              The Next Direction of Indian Payments. Non-custodial, direct bank-to-bank UPI payment orchestration for forward-thinking merchants.
            </p>
            <div className="pt-2 text-xs font-semibold text-[#262626]">
              Your Business, Entirely in Your Control.
            </div>
          </div>

          {/* Col 2: Navigation */}
          <div>
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-[#262626] mb-4">
              Navigation
            </h4>
            <ul className="space-y-2.5 text-xs font-medium">
              <li>
                <a href="#discover" className="hover:text-[#07865C] transition-colors">
                  Discover DISHA 8.2
                </a>
              </li>
              <li>
                <a href="#benefits" className="hover:text-[#07865C] transition-colors">
                  High-Speed Rails
                </a>
              </li>
              <li>
                <a href="#architecture" className="hover:text-[#07865C] transition-colors">
                  Direct vs Aggregator Model
                </a>
              </li>
              <li>
                <a href="#calculator" className="hover:text-[#07865C] transition-colors">
                  Calculate Merchant Savings
                </a>
              </li>
              <li>
                <a href="#ecosystem" className="hover:text-[#07865C] transition-colors">
                  Product Fleet
                </a>
              </li>
            </ul>
          </div>

          {/* Col 3: DishaNitish Technologies Ecosystem */}
          <div>
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-[#262626] mb-4">
              DishaNitish Technologies Ecosystem
            </h4>
            <ul className="space-y-2.5 text-xs font-medium">
              <li>
                <span className="text-[#262626] font-semibold">DISHA 6.6</span> &bull; Sovereign Protection
              </li>
              <li>
                <span className="text-[#262626] font-semibold">DISHA 7.2</span> &bull; Quantum Signal Transport
              </li>
              <li>
                <span className="text-[#07865C] font-semibold">DISHA 8.2</span> &bull; Intelligent UPI Rail
              </li>
              <li className="pt-2">
                <a
                  href="https://merchant.disha8-2.thenitishkr.in/"
                  className="inline-flex items-center gap-1 text-[#07865C] font-bold hover:underline"
                >
                  <span>Merchant Portal Login</span>
                  <ArrowUpRight className="w-3 h-3" />
                </a>
              </li>
            </ul>
          </div>

          {/* Col 4: Contact & Support */}
          <div>
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-[#262626] mb-4">
              Merchant Operations
            </h4>
            <div className="space-y-3 text-xs">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-[#07865C]" />
                <a href="mailto:nitish@thenitishkr.in" className="hover:underline text-[#262626]">
                  nitish@thenitishkr.in
                </a>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-[#07865C]" />
                <a href="https://wa.me/919142197135" className="hover:underline text-[#262626]">
                  +91-9142197135
                </a>
              </div>
              <p className="text-[11px] text-[#737373] pt-2">
                Indian Enterprise Merchant Infrastructure
              </p>
            </div>
          </div>
        </div>

        {/* Corporate Attribution Banner */}
        <div className="pt-8 border-t border-[#DCE2E7] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#737373]">
          <div>
            &copy; {new Date().getFullYear()} DISHA 8.2 &bull; Agentic Pay. All rights reserved.
          </div>

          <div className="text-center font-medium">
            Powered by{' '}
            <span className="font-extrabold text-[#262626]">
              DishaNitish Technologies
            </span>
          </div>

          <div className="flex items-center gap-4">
            <a href="https://merchant.disha8-2.thenitishkr.in/" className="hover:text-[#07865C] font-semibold">
              Merchant Portal
            </a>
            <span>&bull;</span>
            <a href="https://checkout.disha8-2.thenitishkr.in/" className="hover:text-[#07865C] font-semibold">
              Checkout
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}
