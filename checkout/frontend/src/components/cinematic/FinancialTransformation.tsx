import React from 'react'
import { ArrowRight, Check, X, Shield, Clock, IndianRupee, Layers } from 'lucide-react'

export const FinancialTransformation: React.FC = () => {
  return (
    <section id="architecture" className="py-24 bg-[#FAF8F3] relative overflow-hidden border-t border-[#DCE2E7]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#D7B77B]/20 border border-[#D7B77B]/40 text-[#8F6E36] text-xs font-bold tracking-wide uppercase mb-4">
            <Layers className="w-3.5 h-3.5" />
            <span>The Financial Transformation</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-[#262626] tracking-tight leading-tight">
            Traditional Aggregators vs.{' '}
            <span className="text-[#07865C]">Agentic Pay Direct Model</span>
          </h2>
          <p className="mt-4 text-base sm:text-lg text-[#525252] leading-relaxed">
            Compare the friction of multi-hop intermediary escrow against pure non-custodial software.
          </p>
        </div>

        {/* Side-by-Side Model Comparison Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch mb-16">
          {/* Traditional Aggregator Model (Flawed) */}
          <div className="bg-white rounded-3xl p-8 border border-red-200 shadow-md flex flex-col justify-between relative overflow-hidden">
            <div className="absolute top-0 right-0 px-4 py-1.5 bg-red-100 text-red-700 text-xs font-extrabold rounded-bl-2xl">
              LEGACY ARCHITECTURE
            </div>

            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center font-bold">
                  <X className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-[#262626]">Traditional Gateway / Aggregator</h3>
                  <p className="text-xs text-[#737373]">Custodial, Delayed, Fee-Heavy</p>
                </div>
              </div>

              {/* Step-by-step chain */}
              <div className="space-y-3 relative pl-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-red-200">
                <div className="relative">
                  <div className="absolute -left-6 top-1.5 w-3 h-3 rounded-full bg-red-400" />
                  <div className="text-xs font-bold text-[#262626]">01. Customer Pays</div>
                  <div className="text-xs text-[#737373]">Customer initiates card or UPI payment through third-party iframe</div>
                </div>

                <div className="relative">
                  <div className="absolute -left-6 top-1.5 w-3 h-3 rounded-full bg-red-400" />
                  <div className="text-xs font-bold text-red-600">02. Aggregator Escrow Account</div>
                  <div className="text-xs text-[#737373]">Funds enter gateway nodal/escrow pool, not your bank account</div>
                </div>

                <div className="relative">
                  <div className="absolute -left-6 top-1.5 w-3 h-3 rounded-full bg-red-400" />
                  <div className="text-xs font-bold text-red-600">03. Settlement Holding Period (T+2 to T+5)</div>
                  <div className="text-xs text-[#737373]">Your liquidity is trapped while the gateway reconciles batches</div>
                </div>

                <div className="relative">
                  <div className="absolute -left-6 top-1.5 w-3 h-3 rounded-full bg-red-400" />
                  <div className="text-xs font-bold text-red-600">04. MDR Deductions (1.5% to 2.5%)</div>
                  <div className="text-xs text-[#737373]">Gateway and card networks slice off their transaction fee</div>
                </div>

                <div className="relative">
                  <div className="absolute -left-6 top-1.5 w-3 h-3 rounded-full bg-red-400" />
                  <div className="text-xs font-bold text-red-600">05. 18% GST Levied on Fees</div>
                  <div className="text-xs text-[#737373]">Additional tax imposed on top of intermediary processing fees</div>
                </div>

                <div className="relative">
                  <div className="absolute -left-6 top-1.5 w-3 h-3 rounded-full bg-red-500" />
                  <div className="text-xs font-bold text-[#262626]">06. Net Reduced Merchant Payout</div>
                  <div className="text-xs text-[#737373]">Remaining funds finally hit merchant account days later</div>
                </div>
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-red-100 flex items-center justify-between text-xs text-red-700 font-bold">
              <span>Annual Merchant Loss:</span>
              <span className="text-base font-extrabold">₹18 Lakhs – ₹36 Lakhs+ per ₹10 Cr</span>
            </div>
          </div>

          {/* Agentic Pay Direct Model (Optimal) */}
          <div className="bg-white rounded-3xl p-8 border-2 border-[#07865C] shadow-xl flex flex-col justify-between relative overflow-hidden ring-4 ring-[#07865C]/10">
            <div className="absolute top-0 right-0 px-4 py-1.5 bg-[#07865C] text-white text-xs font-extrabold rounded-bl-2xl">
              AGENTIC PAY ARCHITECTURE
            </div>

            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-[#07865C]/10 text-[#07865C] flex items-center justify-center font-bold">
                  <Check className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-[#262626]">DISHA 8.2 &bull; Agentic Pay</h3>
                  <p className="text-xs text-[#07865C] font-semibold">Non-Custodial, Instant, Pure Software</p>
                </div>
              </div>

              {/* Step-by-step chain */}
              <div className="space-y-3 relative pl-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-[#07865C]/30">
                <div className="relative">
                  <div className="absolute -left-6 top-1.5 w-3 h-3 rounded-full bg-[#07865C]" />
                  <div className="text-xs font-bold text-[#262626]">01. Customer Pays via UPI</div>
                  <div className="text-xs text-[#737373]">Customer scans dynamic QR or enters UPI handle on your terminal</div>
                </div>

                <div className="relative">
                  <div className="absolute -left-6 top-1.5 w-3 h-3 rounded-full bg-[#07865C]" />
                  <div className="text-xs font-bold text-[#07865C]">02. Direct Bank Credit</div>
                  <div className="text-xs text-[#737373]">Funds travel directly bank-to-bank via NPCI UPI rails</div>
                </div>

                <div className="relative">
                  <div className="absolute -left-6 top-1.5 w-3 h-3 rounded-full bg-[#07865C]" />
                  <div className="text-xs font-bold text-[#07865C]">03. Zero Intermediary Escrow</div>
                  <div className="text-xs text-[#737373]">No third-party wallet or aggregator pool holds your money</div>
                </div>

                <div className="relative">
                  <div className="absolute -left-6 top-1.5 w-3 h-3 rounded-full bg-[#07865C]" />
                  <div className="text-xs font-bold text-[#07865C]">04. Zero MDR on Eligible UPI Transactions</div>
                  <div className="text-xs text-[#737373]">100% of the customer payment remains in your bank account</div>
                </div>

                <div className="relative">
                  <div className="absolute -left-6 top-1.5 w-3 h-3 rounded-full bg-[#07865C]" />
                  <div className="text-xs font-bold text-[#07865C]">05. Immediate Real-Time Settlement</div>
                  <div className="text-xs text-[#737373]">Working capital is instantly accessible for suppliers and operations</div>
                </div>

                <div className="relative">
                  <div className="absolute -left-6 top-1.5 w-3 h-3 rounded-full bg-[#07865C]" />
                  <div className="text-xs font-bold text-[#262626]">06. Autonomous Verification Software</div>
                  <div className="text-xs text-[#737373]">Agentic Pay cryptographically confirms bank credit in milliseconds</div>
                </div>
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-[#07865C]/20 flex items-center justify-between text-xs text-[#07865C] font-bold">
              <span>Annual Merchant Capital Retained:</span>
              <span className="text-base font-extrabold text-[#07865C]">100% Direct Payout</span>
            </div>
          </div>
        </div>

        {/* Real Mathematical Savings Callout Box */}
        <div className="bg-gradient-to-br from-white to-[#FAF8F3] rounded-3xl p-8 border border-[#D7B77B]/40 shadow-lg text-center max-w-4xl mx-auto">
          <div className="text-xs font-bold uppercase tracking-wider text-[#8F6E36] mb-2">
            Real Mathematical Savings Example
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-[#262626] mb-3">
            An Indian merchant processing <span className="text-[#07865C]">₹50,00,000 / month</span>
          </div>
          <p className="text-sm text-[#525252] max-w-2xl mx-auto mb-6">
            Under a traditional 2.0% gateway MDR + GST, this business loses ₹1,18,000 monthly (₹14,16,000 annually) in intermediary toll fees. Under the Agentic Pay direct software model, this ₹14,16,000 is completely retained as operating profit.
          </p>
          <div className="inline-flex items-center gap-3 px-5 py-2.5 rounded-2xl bg-[#07865C]/10 border border-[#07865C]/30 text-[#07865C] font-bold text-sm">
            <IndianRupee className="w-4 h-4" />
            <span>₹14,16,000+ Direct Net Profit Retained Every Year</span>
          </div>
        </div>
      </div>
    </section>
  )
}
