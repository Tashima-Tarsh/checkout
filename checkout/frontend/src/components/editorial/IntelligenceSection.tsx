import React from 'react'
import { Eye, ShieldCheck, Activity, Cpu, CheckCircle2, AlertTriangle } from 'lucide-react'

export const IntelligenceSection: React.FC = () => {
  return (
    <section className="py-32 bg-white text-[#242722] border-b border-[#E5E0D5]">
      <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 text-left">
        
        {/* Section Eyebrow */}
        <div className="text-xs font-mono font-bold tracking-widest uppercase text-[#245C49] mb-6">
          Agentic Intelligence &mdash; Coordinated Verification
        </div>

        {/* Section Headline */}
        <h2 className="text-3xl sm:text-5xl lg:text-[52px] font-brand font-bold tracking-[-0.035em] leading-[1.14] text-[#242722] max-w-4xl mb-8">
          Behind every payment should be an intelligent process that helps a business understand what has actually taken place.
        </h2>

        {/* Narrative Paragraphs */}
        <div className="space-y-6 text-lg sm:text-[20px] text-[#242722]/85 font-sans leading-[1.7] max-w-4xl mb-16">
          <p>
            DISHA 8.2 incorporates specialised software agents designed to observe payment activity, evaluate available transaction evidence and coordinate the verification process within a unified operational environment.
          </p>

          <p>
            The platform brings together debit observation, credit observation, receiver-side monitoring and verification workflows, with the objective of reducing reliance on fragmented payment confirmations and unnecessary manual intervention. Where the available information is insufficient, the platform must preserve uncertainty rather than presenting an unsupported observation as financial confirmation.
          </p>
        </div>

        {/* Coordinated Architectural Agent Matrix (Pure Editorial, Zero Robots/Brains) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          
          <div className="p-8 rounded-2xl bg-[#F7F5EF] border border-[#E5E0D5] flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-xl bg-[#245C49]/10 text-[#245C49] flex items-center justify-center font-bold mb-5">
                <Activity className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-[#242722] mb-2 font-brand">
                Debit Observation
              </h3>
              <p className="text-xs text-[#242722]/75 leading-relaxed font-sans">
                Monitors customer-side checkout initiation, PSP intent triggers, and NPCI network handshakes in sub-second intervals.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-[#E5E0D5] text-[11px] font-mono font-bold text-[#245C49]">
              REAL-TIME SIGNAL TELEMETRY
            </div>
          </div>

          <div className="p-8 rounded-2xl bg-[#F7F5EF] border border-[#E5E0D5] flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-xl bg-[#245C49]/10 text-[#245C49] flex items-center justify-center font-bold mb-5">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-[#242722] mb-2 font-brand">
                Credit Observation
              </h3>
              <p className="text-xs text-[#242722]/75 leading-relaxed font-sans">
                Observes direct beneficiary core banking switch responses, confirming actual arrival of funds into the merchant's current account.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-[#E5E0D5] text-[11px] font-mono font-bold text-[#245C49]">
              CORE BANK INTEGRATION
            </div>
          </div>

          <div className="p-8 rounded-2xl bg-[#F7F5EF] border border-[#E5E0D5] flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-xl bg-[#245C49]/10 text-[#245C49] flex items-center justify-center font-bold mb-5">
                <Eye className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-[#242722] mb-2 font-brand">
                Receiver-Side Monitoring
              </h3>
              <p className="text-xs text-[#242722]/75 leading-relaxed font-sans">
                Continuous edge monitoring across enrolled merchant point-of-sale terminals, counter soundboxes, and Android workspace nodes.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-[#E5E0D5] text-[11px] font-mono font-bold text-[#245C49]">
              COUNTERTOP SYNCHRONIZATION
            </div>
          </div>

          <div className="p-8 rounded-2xl bg-[#F7F5EF] border border-[#E5E0D5] flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-xl bg-[#245C49]/10 text-[#245C49] flex items-center justify-center font-bold mb-5">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-[#242722] mb-2 font-brand">
                Truth Protocol
              </h3>
              <p className="text-xs text-[#242722]/75 leading-relaxed font-sans">
                Preserves explicit uncertainty when telemetry is incomplete, preventing unsupported assumptions from being recorded as verified cash.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-[#E5E0D5] text-[11px] font-mono font-bold text-[#245C49]">
              MATHEMATICAL INTEGRITY
            </div>
          </div>

        </div>
      </div>
    </section>
  )
}
