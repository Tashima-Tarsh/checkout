import React, { useState } from 'react'
import { CheckCircle2, ArrowRight, ShieldCheck, Headphones, Server, Layers } from 'lucide-react'

export const CommercialApproach: React.FC = () => {
  const [submitted, setSubmitted] = useState(false)
  const [formData, setFormData] = useState({
    businessName: '',
    contactName: '',
    email: '',
    phone: '',
    volume: '50-250cr',
    infrastructure: 'self-hosted',
    consultation: 'technical-review',
    notes: '',
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // In production, posts to backend enterprise consultation pipeline
    setSubmitted(true)
  }

  return (
    <section id="enterprise" className="py-28 bg-[#F7F5EF] border-t border-[#E5E0D5]">
      <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 text-left">
        
        {/* Section Header */}
        <div className="max-w-3xl mb-20">
          <span className="text-xs font-mono font-bold tracking-widest text-[#245C49] uppercase block mb-3">
            Commercial Structure &amp; Deployment
          </span>
          <h2 className="text-3xl sm:text-5xl font-brand font-extrabold text-[#242722] tracking-[-0.03em] leading-tight mb-6">
            Predictable infrastructure licensing without transaction toll taxes.
          </h2>
          <p className="text-lg text-[#242722]/80 font-sans leading-relaxed">
            DISHA 8.2 is licensed as enterprise software deployed directly inside your corporate environment. We believe payment software should operate on predictable licensing—not variable tolls that penalise your transaction volume growth.
          </p>
        </div>

        {/* 4 Pillars of Enterprise Deployment */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-24">
          <div className="p-8 rounded-2xl bg-white border border-[#E5E0D5] hover:border-[#245C49]/40 transition-all shadow-sm">
            <Server className="w-6 h-6 text-[#245C49] mb-5" />
            <h3 className="text-lg font-bold font-brand text-[#242722] mb-3">
              Self-Hosted Deployment
            </h3>
            <p className="text-sm text-[#242722]/75 leading-relaxed font-sans">
              Deployed inside your dedicated AWS, Azure, GCP or bare-metal environment. Your transaction data, bank credentials, and webhook endpoints never leave your perimeter.
            </p>
          </div>

          <div className="p-8 rounded-2xl bg-white border border-[#E5E0D5] hover:border-[#245C49]/40 transition-all shadow-sm">
            <Layers className="w-6 h-6 text-[#245C49] mb-5" />
            <h3 className="text-lg font-bold font-brand text-[#242722] mb-3">
              Direct Switch Integration
            </h3>
            <p className="text-sm text-[#242722]/75 leading-relaxed font-sans">
              Pre-integrated adapters connect to HDFC, ICICI, SBI, Axis, and Yes Bank corporate payment gateways and direct UPI switches without intermediate aggregator layers.
            </p>
          </div>

          <div className="p-8 rounded-2xl bg-white border border-[#E5E0D5] hover:border-[#245C49]/40 transition-all shadow-sm">
            <ShieldCheck className="w-6 h-6 text-[#245C49] mb-5" />
            <h3 className="text-lg font-bold font-brand text-[#242722] mb-3">
              Non-Custodial Architecture
            </h3>
            <p className="text-sm text-[#242722]/75 leading-relaxed font-sans">
              Customer payments settle directly into your designated bank account with zero intermediate escrow pools, ensuring complete regulatory clarity and immediate cash availability.
            </p>
          </div>

          <div className="p-8 rounded-2xl bg-white border border-[#E5E0D5] hover:border-[#245C49]/40 transition-all shadow-sm">
            <Headphones className="w-6 h-6 text-[#245C49] mb-5" />
            <h3 className="text-lg font-bold font-brand text-[#242722] mb-3">
              Enterprise SRE &amp; SLA
            </h3>
            <p className="text-sm text-[#242722]/75 leading-relaxed font-sans">
              24/7 dedicated engineering support, 99.99% availability commitments, guaranteed sub-second failover, and active transaction monitoring assistance.
            </p>
          </div>
        </div>

        {/* Enterprise Consultation Form & Technical Discussion */}
        <div className="bg-white rounded-3xl border border-[#E5E0D5] p-8 sm:p-12 lg:p-16 shadow-sm">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
            
            {/* Left Context */}
            <div className="lg:col-span-5 space-y-6">
              <span className="text-xs font-mono font-bold tracking-widest text-[#245C49] uppercase">
                Direct Technical Briefing
              </span>
              <h3 className="text-2xl sm:text-4xl font-brand font-bold text-[#242722] tracking-[-0.02em] leading-snug">
                Initiate an architectural and commercial assessment.
              </h3>
              <p className="text-base text-[#242722]/75 font-sans leading-relaxed">
                Our principal systems architects work directly with your CTO, CFO, and Treasury leadership to analyze current gateway costs, model direct switch routing, and design a deployment timeline.
              </p>
              
              <div className="space-y-4 pt-4 border-t border-[#E5E0D5]">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-[#245C49] shrink-0 mt-0.5" />
                  <span className="text-sm text-[#242722]/85 font-medium">Complete NDA and security compliance briefing</span>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-[#245C49] shrink-0 mt-0.5" />
                  <span className="text-sm text-[#242722]/85 font-medium">Direct bank switch compatibility audit</span>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-[#245C49] shrink-0 mt-0.5" />
                  <span className="text-sm text-[#242722]/85 font-medium">Tailored 3-year cost-of-ownership model</span>
                </div>
              </div>
            </div>

            {/* Right Form */}
            <div className="lg:col-span-7">
              {submitted ? (
                <div className="p-8 sm:p-12 rounded-2xl bg-[#F7F5EF] border border-[#B9CFBC] text-center space-y-4">
                  <CheckCircle2 className="w-12 h-12 text-[#245C49] mx-auto" />
                  <h4 className="text-2xl font-brand font-bold text-[#242722]">
                    Briefing Request Received
                  </h4>
                  <p className="text-sm text-[#242722]/80 font-sans max-w-md mx-auto leading-relaxed">
                    Thank you. An enterprise technology director from Disha Nitish Technologies will contact you within one business day to coordinate your technical consultation.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-xs font-mono font-semibold text-[#242722] uppercase tracking-wider mb-2">
                        Enterprise Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.businessName}
                        onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                        placeholder="e.g. Acme Retail Technologies"
                        className="w-full px-4 py-3 rounded-xl border border-[#D5D0C5] bg-[#F7F5EF] text-[#242722] text-sm focus:outline-none focus:border-[#245C49] focus:bg-white transition-colors"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-mono font-semibold text-[#242722] uppercase tracking-wider mb-2">
                        Contact Person *
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.contactName}
                        onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                        placeholder="Full Name and Designation"
                        className="w-full px-4 py-3 rounded-xl border border-[#D5D0C5] bg-[#F7F5EF] text-[#242722] text-sm focus:outline-none focus:border-[#245C49] focus:bg-white transition-colors"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-xs font-mono font-semibold text-[#242722] uppercase tracking-wider mb-2">
                        Work Email *
                      </label>
                      <input
                        type="email"
                        required
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        placeholder="name@company.com"
                        className="w-full px-4 py-3 rounded-xl border border-[#D5D0C5] bg-[#F7F5EF] text-[#242722] text-sm focus:outline-none focus:border-[#245C49] focus:bg-white transition-colors"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-mono font-semibold text-[#242722] uppercase tracking-wider mb-2">
                        Phone Number *
                      </label>
                      <input
                        type="tel"
                        required
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        placeholder="+91 98765 43210"
                        className="w-full px-4 py-3 rounded-xl border border-[#D5D0C5] bg-[#F7F5EF] text-[#242722] text-sm focus:outline-none focus:border-[#245C49] focus:bg-white transition-colors"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-xs font-mono font-semibold text-[#242722] uppercase tracking-wider mb-2">
                        Annual Digital Volume
                      </label>
                      <select
                        value={formData.volume}
                        onChange={(e) => setFormData({ ...formData, volume: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl border border-[#D5D0C5] bg-[#F7F5EF] text-[#242722] text-sm focus:outline-none focus:border-[#245C49] focus:bg-white transition-colors"
                      >
                        <option value="under-10cr">&lt; ₹10 Crore / year</option>
                        <option value="10-50cr">₹10 – ₹50 Crore / year</option>
                        <option value="50-250cr">₹50 – ₹250 Crore / year</option>
                        <option value="above-250cr">₹250+ Crore / year</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-mono font-semibold text-[#242722] uppercase tracking-wider mb-2">
                        Consultation Preference
                      </label>
                      <select
                        value={formData.consultation}
                        onChange={(e) => setFormData({ ...formData, consultation: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl border border-[#D5D0C5] bg-[#F7F5EF] text-[#242722] text-sm focus:outline-none focus:border-[#245C49] focus:bg-white transition-colors"
                      >
                        <option value="technical-review">Technical Architecture Review</option>
                        <option value="in-person">Executive Briefing (In-Person)</option>
                        <option value="video">Secure Video Consultation</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-mono font-semibold text-[#242722] uppercase tracking-wider mb-2">
                      Current Payment Environment &amp; Requirements
                    </label>
                    <textarea
                      rows={3}
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      placeholder="Brief details regarding current gateway integrations, daily peak TPS, or infrastructure constraints..."
                      className="w-full px-4 py-3 rounded-xl border border-[#D5D0C5] bg-[#F7F5EF] text-[#242722] text-sm focus:outline-none focus:border-[#245C49] focus:bg-white transition-colors resize-none"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full inline-flex items-center justify-center gap-3 py-4 px-6 rounded-xl bg-[#245C49] hover:bg-[#1b4637] text-white font-semibold text-sm tracking-wide transition-all shadow-md group"
                  >
                    <span>Request Enterprise Technical Consultation</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </button>
                </form>
              )}
            </div>

          </div>
        </div>

      </div>
    </section>
  )
}
