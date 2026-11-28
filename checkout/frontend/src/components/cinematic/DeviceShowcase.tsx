import React, { useState } from 'react'
import { Monitor, Tablet, Smartphone, CheckCircle2, ArrowRight, ShieldCheck, Zap, Activity, RefreshCw } from 'lucide-react'

export const DeviceShowcase: React.FC = () => {
  const [activeDevice, setActiveDevice] = useState<'desktop' | 'tablet' | 'mobile'>('desktop')

  return (
    <section id="ecosystem" className="py-28 bg-[#F4F1EA] relative overflow-hidden border-b border-[#E5DFD5]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#07865C]/10 border border-[#07865C]/30 text-[#07865C] text-xs font-bold tracking-wide uppercase mb-4">
            <Monitor className="w-3.5 h-3.5" />
            <span>Hardware & Workstation Fleet</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-black text-[#12161A] tracking-tight leading-tight">
            Integrated Across Your Entire{' '}
            <span className="text-[#07865C]">
              Commercial Fleet.
            </span>
          </h2>
          <p className="mt-4 text-base sm:text-lg text-[#555E68] leading-relaxed">
            Experience Agentic Pay running seamlessly across enterprise desktop command centers, counter tablets, and merchant smartphones.
          </p>
        </div>

        {/* Device Switcher Tabs */}
        <div className="flex justify-center mb-12">
          <div className="inline-flex p-1.5 rounded-2xl bg-white border border-[#E5DFD5] shadow-sm gap-2">
            <button
              onClick={() => setActiveDevice('desktop')}
              className={`px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 ${
                activeDevice === 'desktop'
                  ? 'bg-[#262626] text-white shadow-sm'
                  : 'text-[#525252] hover:text-[#262626] hover:bg-[#FAF8F3]'
              }`}
            >
              <Monitor className="w-4 h-4" />
              <span>Desktop Command Center</span>
            </button>

            <button
              onClick={() => setActiveDevice('tablet')}
              className={`px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 ${
                activeDevice === 'tablet'
                  ? 'bg-[#262626] text-white shadow-sm'
                  : 'text-[#525252] hover:text-[#262626] hover:bg-[#FAF8F3]'
              }`}
            >
              <Tablet className="w-4 h-4" />
              <span>Counter Tablet POS</span>
            </button>

            <button
              onClick={() => setActiveDevice('mobile')}
              className={`px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 ${
                activeDevice === 'mobile'
                  ? 'bg-[#262626] text-white shadow-sm'
                  : 'text-[#525252] hover:text-[#262626] hover:bg-[#FAF8F3]'
              }`}
            >
              <Smartphone className="w-4 h-4" />
              <span>Merchant Mobile App</span>
            </button>
          </div>
        </div>

        {/* 3D Realistic Device Frame Viewport */}
        <div className="max-w-5xl mx-auto">
          {/* 1. DESKTOP VIEW */}
          {activeDevice === 'desktop' && (
            <div className="rounded-3xl bg-[#1E293B] p-4 sm:p-6 shadow-2xl border border-slate-700/60 text-white animate-fade-in">
              {/* Browser / OS Header */}
              <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500/80" />
                  <div className="w-3 h-3 rounded-full bg-amber-500/80" />
                  <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
                  <span className="text-xs font-mono text-slate-400 ml-2">
                    DISHA 8.2 // AGENTIC PAY COMMAND CENTER
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-400">
                  <span className="flex items-center gap-1 text-emerald-400 font-mono">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    NPCI UPI RAIL: 100% OPERATIONAL
                  </span>
                </div>
              </div>

              {/* Dashboard Content */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
                  <div className="text-[11px] font-mono text-slate-400">TODAY'S DIRECT SETTLEMENTS</div>
                  <div className="text-2xl font-extrabold text-emerald-400 mt-1 font-mono">₹4,82,450.00</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">384 Transactions &bull; 0 Delayed</div>
                </div>

                <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
                  <div className="text-[11px] font-mono text-slate-400">INTERMEDIARY MDR SAVED</div>
                  <div className="text-2xl font-extrabold text-[#D7B77B] mt-1 font-mono">₹10,613.90</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">100% Retained by Merchant</div>
                </div>

                <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
                  <div className="text-[11px] font-mono text-slate-400">SETTLEMENT SPEED</div>
                  <div className="text-2xl font-extrabold text-blue-400 mt-1 font-mono">&lt; 1.0s</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Direct Bank-to-Bank Confirmation</div>
                </div>
              </div>

              {/* Real-time transaction stream table */}
              <div className="rounded-xl bg-slate-900/90 border border-slate-800 overflow-hidden">
                <div className="p-3 bg-slate-800/40 text-xs font-mono text-slate-400 flex justify-between">
                  <span>LIVE RECONCILIATION FEED</span>
                  <span className="text-emerald-400">REAL-TIME AUTO DISPATCH</span>
                </div>
                <div className="divide-y divide-slate-800/60 font-mono text-xs">
                  <div className="p-3 flex items-center justify-between">
                    <span className="text-slate-300">ORD-948293 &bull; Supermarket Checkout #02</span>
                    <span className="text-slate-400">HDFC Bank UPI</span>
                    <span className="text-emerald-400 font-bold">+₹3,420.00 (T+0)</span>
                  </div>
                  <div className="p-3 flex items-center justify-between">
                    <span className="text-slate-300">ORD-948292 &bull; Dining Table #14</span>
                    <span className="text-slate-400">ICICI Bank UPI</span>
                    <span className="text-emerald-400 font-bold">+₹1,850.00 (T+0)</span>
                  </div>
                  <div className="p-3 flex items-center justify-between">
                    <span className="text-slate-300">ORD-948291 &bull; Boutique POS Terminal</span>
                    <span className="text-slate-400">SBI UPI Gateway</span>
                    <span className="text-emerald-400 font-bold">+₹14,900.00 (T+0)</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 2. TABLET VIEW */}
          {activeDevice === 'tablet' && (
            <div className="max-w-2xl mx-auto rounded-3xl bg-white p-6 shadow-2xl border-4 border-slate-800 text-[#262626] animate-fade-in">
              <div className="flex items-center justify-between pb-4 border-b border-gray-100 mb-6">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-[#07865C] text-white flex items-center justify-center font-bold text-xs">
                    D
                  </div>
                  <div>
                    <div className="text-sm font-bold">Counter Terminal POS</div>
                    <div className="text-[11px] text-[#737373]">DISHA 8.2 Dynamic Checkout</div>
                  </div>
                </div>
                <div className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800">
                  Ready for Customer
                </div>
              </div>

              {/* Dynamic QR Display */}
              <div className="text-center py-6">
                <div className="w-48 h-48 mx-auto p-4 rounded-2xl bg-white border-2 border-[#D7B77B] shadow-inner flex flex-col items-center justify-center relative">
                  <div className="text-6xl text-[#07865C] mb-2 font-mono">₹</div>
                  <div className="text-xs font-bold text-[#262626]">SCAN WITH ANY UPI APP</div>
                  <div className="text-[10px] text-[#737373]">GPay &bull; PhonePe &bull; Paytm &bull; BHIM</div>
                </div>
                <div className="text-2xl font-extrabold text-[#262626] mt-4 font-mono">
                  Amount Due: ₹2,450.00
                </div>
                <div className="text-xs text-[#07865C] font-semibold mt-1">
                  Direct Bank Transfer &bull; Zero MDR Deducted
                </div>
              </div>

              <div className="pt-4 border-t border-gray-100 flex items-center justify-between text-xs text-[#737373]">
                <span>Terminal ID: BLR-STORE-01</span>
                <span>Verification Time: 0.18s</span>
              </div>
            </div>
          )}

          {/* 3. MOBILE DASHBOARD VIEW */}
          {activeDevice === 'mobile' && (
            <div className="max-w-sm mx-auto rounded-[38px] bg-slate-900 p-3 shadow-2xl border-[6px] border-slate-800 text-white animate-fade-in">
              {/* Notch */}
              <div className="w-32 h-4 bg-slate-800 rounded-b-xl mx-auto mb-4" />

              <div className="px-3 pb-4">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-bold text-slate-400">DISHA 8.2 MOBILE</span>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                </div>

                <div className="p-4 rounded-2xl bg-gradient-to-br from-[#07865C] to-[#043C2E] shadow-lg mb-4">
                  <div className="text-[10px] uppercase font-bold text-[#B5F5D8]">Available Working Capital</div>
                  <div className="text-2xl font-extrabold font-mono mt-1">₹3,48,200.00</div>
                  <div className="text-[10px] text-[#B5F5D8]/80 mt-1">Deposited Straight into HDFC Current A/C</div>
                </div>

                <div className="space-y-2 mb-4">
                  <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700/50 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-bold">Instant UPI Alert</div>
                      <div className="text-[10px] text-slate-400">Customer #8392 verified</div>
                    </div>
                    <span className="font-bold text-emerald-400 font-mono">+₹4,500</span>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700/50 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-bold">Automated Sweep</div>
                      <div className="text-[10px] text-slate-400">Vendor payout authorized</div>
                    </div>
                    <span className="font-bold text-[#D7B77B] font-mono">-₹12,000</span>
                  </div>
                </div>

                <div className="text-center">
                  <button className="w-full py-2.5 rounded-xl bg-white text-slate-900 font-bold text-xs uppercase tracking-wider">
                    Biometric Settlement Auth
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
