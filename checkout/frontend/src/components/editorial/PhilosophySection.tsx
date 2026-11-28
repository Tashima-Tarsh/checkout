import React from 'react'

export const PhilosophySection: React.FC = () => {
  return (
    <section id="philosophy" className="py-32 bg-[#F7F5EF] text-[#242722] border-b border-[#E5E0D5]">
      <div className="max-w-5xl mx-auto px-6 sm:px-8 lg:px-12 text-left">
        
        {/* Editorial Subtitle */}
        <div className="text-xs font-mono font-bold tracking-widest uppercase text-[#245C49] mb-6">
          Our Philosophy &mdash; Architectural Sovereignty
        </div>

        {/* Major Editorial Headline */}
        <h2 className="text-3xl sm:text-5xl lg:text-[54px] font-brand font-bold tracking-[-0.035em] leading-[1.14] text-[#242722] mb-10">
          Payment infrastructure should be built around the business, rather than the business being built around the infrastructure.
        </h2>

        {/* Cohesive Narrative Paragraphs */}
        <div className="space-y-6 text-lg sm:text-[21px] text-[#242722]/85 font-sans leading-[1.7] max-w-3xl">
          <p>
            DISHA 8.2 was conceived around the belief that businesses deserve greater ownership of the technology supporting their financial operations. While the existing payment ecosystem has made digital commerce widely accessible, the next opportunity is to make the infrastructure behind that commerce more aligned with the needs and commercial interests of businesses.
          </p>

          <p>
            By bringing payment monitoring, operational management and verification capabilities into a dedicated environment, DISHA 8.2 offers a different perspective on how businesses can approach their payment technology&mdash;<span className="font-serif italic text-2xl text-[#245C49]">eliminating intermediary fee tolls</span> and allowing enterprise liquidity to flow directly to where it belongs.
          </p>
        </div>

        {/* Core Distinction Note */}
        <div className="mt-14 pt-8 border-t border-[#E5E0D5] flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs font-mono text-[#242722]/65">
          <div>
            <span className="font-bold text-[#245C49]">DISHA 8.2</span> &bull; ZERO TOLL FOR MONEY TRANSFER
          </div>
          <div>
            NON-CUSTODIAL &bull; SELF-HOSTED &bull; DIRECT REVENUE RETENTION
          </div>
        </div>
      </div>
    </section>
  )
}
