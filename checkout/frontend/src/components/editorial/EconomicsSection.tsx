import React, { useState } from 'react'
import { Calculator, ArrowRight, IndianRupee, Sparkles } from 'lucide-react'

export const EconomicsSection: React.FC = () => {
  // Inputs
  const [annualVolume, setAnnualVolume] = useState<number>(250000000) // ₹25 Crores
  const [currentFeeRate, setCurrentFeeRate] = useState<number>(2.0) // 2.0%
  const [currentSubscriptions, setCurrentSubscriptions] = useState<number>(120000) // ₹1.2L / yr
  const [currentMaintenance, setCurrentMaintenance] = useState<number>(60000) // ₹60k / yr
  const [dishaSetupCost, setDishaSetupCost] = useState<number>(450000) // ₹4.5L one-time
  const [dishaAnnualSupport, setDishaAnnualSupport] = useState<number>(120000) // ₹1.2L / yr

  // Math
  const mdrAmount = (annualVolume * currentFeeRate) / 100
  const gstAmount = mdrAmount * 0.18
  const currentTotalAnnualCost = mdrAmount + gstAmount + currentSubscriptions + currentMaintenance

  // 3-year projected cumulative costs
  const currentThreeYearCost = currentTotalAnnualCost * 3
  const dishaThreeYearCost = dishaSetupCost + dishaAnnualSupport * 3
  const netRetainedThreeYears = Math.max(0, currentThreeYearCost - dishaThreeYearCost)
  const netRetainedAnnual = Math.max(0, currentTotalAnnualCost - dishaAnnualSupport)

  const formatINR = (val: number): string => {
    if (val >= 10000000) {
      return `₹${(val / 10000000).toFixed(2)} Cr`
    }
    if (val >= 100000) {
      return `₹${(val / 100000).toFixed(2)} Lakh`
    }
    return `₹${Math.round(val).toLocaleString('en-IN')}`
  }

  return (
    <section id="economics" className="py-32 bg-[#F7F5EF] text-[#242722] border-b border-[#E5E0D5]">
      <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 text-left">
        
        {/* Section Eyebrow */}
        <div className="text-xs font-mono font-bold tracking-widest uppercase text-[#245C49] mb-6">
          The Economics of Ownership &mdash; Commercial Viability
        </div>

        {/* Section Headline */}
        <h2 className="text-3xl sm:text-5xl lg:text-[52px] font-brand font-bold tracking-[-0.035em] leading-[1.14] text-[#242722] max-w-4xl mb-8">
          A business should be able to grow without its payment technology expenditure growing in equal proportion.
        </h2>

        {/* Editorial Text */}
        <div className="space-y-6 text-lg sm:text-[20px] text-[#242722]/85 font-sans leading-[1.7] max-w-4xl mb-16">
          <p>
            The financial implications of percentage-based technology charges become particularly significant as businesses expand. For enterprises processing substantial annual payment volumes, even relatively small differences in commercial arrangements can represent meaningful long-term expenditure.
          </p>

          <p>
            DISHA 8.2 proposes an infrastructure-led approach in which businesses invest in establishing their own payment environment, with deployment, infrastructure, maintenance and support arrangements defined according to their actual requirements. The intention is to help businesses evaluate payment technology as a long-term operational investment rather than simply accepting it as another recurring deduction from gross revenue.
          </p>
        </div>

        {/* Full-Width Interactive Cost-of-Ownership Calculator (Direct Editorial Integration) */}
        <div className="pt-12 border-t border-[#E5E0D5]">
          <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#245C49]">
                Interactive Financial Modeling
              </span>
              <h3 className="text-2xl sm:text-3xl font-brand font-bold text-[#242722] mt-1">
                Comparative Cost-of-Ownership Model
              </h3>
            </div>
            <p className="text-xs font-mono text-[#242722]/60 max-w-md">
              *Illustrative comparison model based on standard industry commercial terms. Final terms confirmed via enterprise agreement.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
            
            {/* Sliders & Parameters (7 cols) */}
            <div className="lg:col-span-7 space-y-8 bg-white p-8 sm:p-10 rounded-2xl border border-[#E5E0D5]">
              {/* Slider 1: Annual Payment Volume */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-bold text-[#242722]">
                    Annual Eligible Payment Volume
                  </label>
                  <span className="text-lg font-black font-mono text-[#245C49]">
                    {formatINR(annualVolume)}
                  </span>
                </div>
                <input
                  type="range"
                  min={10000000}
                  max={1000000000}
                  step={10000000}
                  value={annualVolume}
                  onChange={(e) => setAnnualVolume(Number(e.target.value))}
                  className="w-full h-2 bg-[#E5E0D5] rounded-lg appearance-none cursor-pointer accent-[#245C49]"
                />
                <div className="flex justify-between text-xs text-[#242722]/60 mt-1 font-mono">
                  <span>₹1 Crore</span>
                  <span>₹50 Crores</span>
                  <span>₹100 Crores</span>
                </div>
              </div>

              {/* Slider 2: Current Fee Percentage */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-bold text-[#242722]">
                    Current Intermediary Gateway Fee Rate
                  </label>
                  <span className="text-lg font-black font-mono text-red-700">
                    {currentFeeRate.toFixed(2)}% (+ 18% GST)
                  </span>
                </div>
                <input
                  type="range"
                  min={1.2}
                  max={2.8}
                  step={0.1}
                  value={currentFeeRate}
                  onChange={(e) => setCurrentFeeRate(Number(e.target.value))}
                  className="w-full h-2 bg-[#E5E0D5] rounded-lg appearance-none cursor-pointer accent-red-700"
                />
                <div className="flex justify-between text-xs text-[#242722]/60 mt-1 font-mono">
                  <span>1.2% (Tier 1)</span>
                  <span>2.0% (Average)</span>
                  <span>2.8% (Multi-Rail Premium)</span>
                </div>
              </div>

              {/* Subscriptions & Maintenance */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-[#E5E0D5]">
                <div>
                  <label className="block text-xs font-bold text-[#242722]/80 mb-1">
                    Current Annual Platform Subscriptions
                  </label>
                  <input
                    type="number"
                    value={currentSubscriptions}
                    onChange={(e) => setCurrentSubscriptions(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-[#E5E0D5] bg-[#F7F5EF] text-[#242722]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#242722]/80 mb-1">
                    Annual Hardware & Maintenance Charges
                  </label>
                  <input
                    type="number"
                    value={currentMaintenance}
                    onChange={(e) => setCurrentMaintenance(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-[#E5E0D5] bg-[#F7F5EF] text-[#242722]"
                  />
                </div>
              </div>

              {/* Cost breakdown readout */}
              <div className="pt-4 border-t border-[#E5E0D5] text-xs font-mono text-[#242722]/70 space-y-1">
                <div className="flex justify-between">
                  <span>Gross Gateway Deductions:</span>
                  <span className="font-bold text-red-700">{formatINR(mdrAmount)} / yr</span>
                </div>
                <div className="flex justify-between">
                  <span>18% GST on Gateway Deductions:</span>
                  <span className="font-bold text-red-700">{formatINR(gstAmount)} / yr</span>
                </div>
              </div>
            </div>

            {/* Calculated Output (5 cols) - Huge animated numerals */}
            <div className="lg:col-span-5 bg-[#242722] text-white p-8 sm:p-10 rounded-2xl flex flex-col justify-between space-y-8">
              <div>
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#B9CFBC]">
                  Net Capital Retained (Annual)
                </span>
                <div className="text-4xl sm:text-6xl font-brand font-black text-white mt-2 tracking-tight font-mono">
                  {formatINR(netRetainedAnnual)}
                </div>
                <p className="text-xs text-white/70 mt-1 font-sans">
                  Direct bottom-line liquidity returned to your commercial account annually.
                </p>
              </div>

              <div className="p-5 rounded-xl bg-white/5 border border-white/10 space-y-3 font-mono text-xs">
                <div className="flex justify-between items-center text-white/80">
                  <span>3-Year Intermediary Cost:</span>
                  <span className="font-bold text-red-400">{formatINR(currentThreeYearCost)}</span>
                </div>
                <div className="flex justify-between items-center text-white/80">
                  <span>3-Year DISHA Infrastructure:</span>
                  <span className="font-bold text-[#B9CFBC]">{formatINR(dishaThreeYearCost)}</span>
                </div>
                <div className="pt-2 border-t border-white/10 flex justify-between items-center text-white font-bold text-sm">
                  <span>3-Year Retained Capital:</span>
                  <span className="text-[#B9CFBC] text-base">{formatINR(netRetainedThreeYears)}</span>
                </div>
              </div>

              <div className="pt-2">
                <a
                  href="#enterprise"
                  className="w-full py-4 px-6 rounded-xl text-center text-xs font-bold uppercase tracking-wider text-[#242722] bg-[#B9CFBC] hover:bg-[#a6c2a9] transition-all flex items-center justify-center gap-2"
                >
                  <span>Request Custom Enterprise Assessment</span>
                  <ArrowRight className="w-4 h-4" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
