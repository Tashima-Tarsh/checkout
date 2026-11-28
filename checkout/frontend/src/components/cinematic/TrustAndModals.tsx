import React, { useState } from 'react'
import { ShieldCheck, Lock, CheckCircle, FileText, X, Scale } from 'lucide-react'

export const TrustAndModals: React.FC = () => {
  const [activeModal, setActiveModal] = useState<string | null>(null)

  const legalDocuments: Record<string, { title: string; content: React.ReactNode }> = {
    terms: {
      title: 'Terms of Service — DISHA 8.2 (Agentic Pay)',
      content: (
        <div className="space-y-4 text-xs text-[#525252] leading-relaxed">
          <p><strong>1. Non-Custodial Technology Model:</strong> DISHA 8.2 and Agentic Pay provide payment software automation and cryptographic verification infrastructure. At no point does DishaNitish Technologies take possession, custody, or control of merchant or customer funds. All monetary transfers are executed directly between regulated Reserve Bank of India (RBI) scheduled commercial banking entities.</p>
          <p><strong>2. Software Licensing:</strong> Licensees are granted a non-exclusive, non-transferable enterprise license to deploy Agentic Pay routing agents across authorized merchant terminal devices.</p>
          <p><strong>3. Uptime & SLA:</strong> Software architecture provides high-availability multi-region routing. Service telemetry is accessible in real-time through the Super Admin and Merchant consoles.</p>
          <p><strong>4. Governing Law:</strong> These terms are governed exclusively by the laws of India, with jurisdiction vested in the courts of New Delhi, India.</p>
        </div>
      )
    },
    privacy: {
      title: 'Privacy Policy & Data Sovereign Architecture',
      content: (
        <div className="space-y-4 text-xs text-[#525252] leading-relaxed">
          <p><strong>1. Data Sovereignty:</strong> In strict compliance with the Digital Personal Data Protection (DPDP) Act of India and RBI data localization directives, all transaction telemetry, terminal logs, and merchant metadata reside exclusively within domestic Indian data centers.</p>
          <p><strong>2. Zero Intermediary Storage:</strong> Customer payment credentials (such as UPI PINs or banking passwords) never pass through or touch DISHA 8.2 software. End-to-end encrypted signals pass directly to the customer’s PSP application and beneficiary bank.</p>
          <p><strong>3. Analytics & Logging:</strong> Telemetry logs are cryptographically hashed and retained solely for merchant audit compliance and dispute resolution.</p>
        </div>
      )
    },
    refund: {
      title: 'Refund & Dispute Resolution Policy',
      content: (
        <div className="space-y-4 text-xs text-[#525252] leading-relaxed">
          <p><strong>1. Merchant-Initiated Refunds:</strong> Because DISHA 8.2 operates as a non-custodial software layer, refunds are originated directly from the merchant’s linked commercial bank account to the customer’s original VPA (Virtual Payment Address) via NPCI UPI rail APIs.</p>
          <p><strong>2. Chargebacks & Dispute Handling:</strong> UPI transaction disputes are resolved via NPCI’s Unified Dispute & Resolution (UDIR) automated framework, guaranteeing real-time resolution without arbitrary gateway fee deductions.</p>
        </div>
      )
    },
    merchantAgreement: {
      title: 'Merchant Operating Agreement',
      content: (
        <div className="space-y-4 text-xs text-[#525252] leading-relaxed">
          <p><strong>1. Technology Service Provider (TSP) Alignment:</strong> Merchant acknowledges that DISHA 8.2 operates strictly as an outsourced technology infrastructure provider under RBI circulars for Digital Payment Security Controls.</p>
          <p><strong>2. Account Ownership:</strong> The merchant maintains direct ownership of their bank-issued VPA and terminal settlement accounts. No intermediary escrow buffer exists between the merchant and their funds.</p>
        </div>
      )
    },
    aup: {
      title: 'Acceptable Use Policy (AUP)',
      content: (
        <div className="space-y-4 text-xs text-[#525252] leading-relaxed">
          <p><strong>1. Lawful Indian Commerce:</strong> Agentic Pay software may only be deployed for bona fide commercial activities permitted under the laws of the Republic of India and banking regulations.</p>
          <p><strong>2. Prohibited Transactions:</strong> Software cannot be utilized for illegal gambling, prohibited financial speculation, contraband, or unauthorized cross-border remittances violating FEMA guidelines.</p>
        </div>
      )
    },
    dataAddendum: {
      title: 'Data Protection Addendum (DPA)',
      content: (
        <div className="space-y-4 text-xs text-[#525252] leading-relaxed">
          <p><strong>1. Security Standards:</strong> DISHA 8.2 enforces AES-256 GCM encryption at rest and TLS 1.3 in transit. All device tokens and agent authentication credentials utilize hardware security modules (HSM) where available.</p>
          <p><strong>2. Incident Notification:</strong> Any detected anomalies or security events are communicated to merchant compliance officers within regulatory reporting windows.</p>
        </div>
      )
    }
  }

  return (
    <section className="py-20 bg-white relative overflow-hidden border-t border-[#DCE2E7]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Compliance Trust Pillars */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#07865C]/10 border border-[#07865C]/30 text-[#07865C] text-xs font-bold tracking-wide uppercase mb-4">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Trust, Compliance &amp; Legal Foundation</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-[#262626] tracking-tight">
            Architected for Regulated Indian Banking
          </h2>
          <p className="mt-3 text-sm sm:text-base text-[#525252]">
            Built strictly under RBI Technology Service Provider guidelines with non-custodial integrity.
          </p>
        </div>

        {/* 4 Architectural Guarantees */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          <div className="p-6 rounded-2xl bg-[#FAF8F3] border border-[#DCE2E7] flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-xl bg-[#07865C]/10 text-[#07865C] flex items-center justify-center font-bold mb-4">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-[#262626] mb-1">Non-Custodial Architecture</h3>
              <p className="text-xs text-[#737373] leading-relaxed">
                Customer funds travel strictly between regulated commercial bank accounts. Zero intermediary escrow.
              </p>
            </div>
            <div className="mt-4 text-[11px] font-mono font-bold text-[#07865C]">ZERO MONEY HELD</div>
          </div>

          <div className="p-6 rounded-2xl bg-[#FAF8F3] border border-[#DCE2E7] flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-xl bg-[#07865C]/10 text-[#07865C] flex items-center justify-center font-bold mb-4">
                <Lock className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-[#262626] mb-1">Zero Wallet Holding</h3>
              <p className="text-xs text-[#737373] leading-relaxed">
                No nodal account delays, no wallet reserves, and zero float exploitation of merchant liquidity.
              </p>
            </div>
            <div className="mt-4 text-[11px] font-mono font-bold text-[#07865C]">100% DIRECT SETTLEMENT</div>
          </div>

          <div className="p-6 rounded-2xl bg-[#FAF8F3] border border-[#DCE2E7] flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-xl bg-[#07865C]/10 text-[#07865C] flex items-center justify-center font-bold mb-4">
                <Scale className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-[#262626] mb-1">RBI-Aligned TSP Framework</h3>
              <p className="text-xs text-[#737373] leading-relaxed">
                Operates strictly as an outsourced technology service provider in accordance with master directions.
              </p>
            </div>
            <div className="mt-4 text-[11px] font-mono font-bold text-[#07865C]">BANK GRADE TSP</div>
          </div>

          <div className="p-6 rounded-2xl bg-[#FAF8F3] border border-[#DCE2E7] flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-xl bg-[#07865C]/10 text-[#07865C] flex items-center justify-center font-bold mb-4">
                <CheckCircle className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-[#262626] mb-1">End-to-End Encryption</h3>
              <p className="text-xs text-[#737373] leading-relaxed">
                TLS 1.3 transport security, AES-256 storage encryption, and hardware token cryptographic signing.
              </p>
            </div>
            <div className="mt-4 text-[11px] font-mono font-bold text-[#07865C]">AES-256 + TLS 1.3</div>
          </div>
        </div>

        {/* Legal Modals Trigger Links */}
        <div className="pt-8 border-t border-gray-100 flex flex-wrap items-center justify-center gap-6 text-xs font-semibold text-[#525252]">
          <button
            onClick={() => setActiveModal('terms')}
            className="hover:text-[#07865C] hover:underline"
          >
            Terms of Service
          </button>
          <span className="text-gray-300">&bull;</span>
          <button
            onClick={() => setActiveModal('privacy')}
            className="hover:text-[#07865C] hover:underline"
          >
            Privacy Policy
          </button>
          <span className="text-gray-300">&bull;</span>
          <button
            onClick={() => setActiveModal('refund')}
            className="hover:text-[#07865C] hover:underline"
          >
            Refund &amp; Dispute Policy
          </button>
          <span className="text-gray-300">&bull;</span>
          <button
            onClick={() => setActiveModal('merchantAgreement')}
            className="hover:text-[#07865C] hover:underline"
          >
            Merchant Operating Agreement
          </button>
          <span className="text-gray-300">&bull;</span>
          <button
            onClick={() => setActiveModal('aup')}
            className="hover:text-[#07865C] hover:underline"
          >
            Acceptable Use Policy
          </button>
          <span className="text-gray-300">&bull;</span>
          <button
            onClick={() => setActiveModal('dataAddendum')}
            className="hover:text-[#07865C] hover:underline"
          >
            Data Protection Addendum
          </button>
        </div>
      </div>

      {/* Interactive Modal Popup */}
      {activeModal && legalDocuments[activeModal] && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-2xl w-full max-h-[80vh] overflow-y-auto shadow-2xl border border-[#D7B77B]/40 relative">
            <button
              onClick={() => setActiveModal(null)}
              className="absolute top-5 right-5 p-2 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-4">
              <FileText className="w-5 h-5 text-[#07865C]" />
              <h3 className="text-lg font-bold text-[#262626]">
                {legalDocuments[activeModal].title}
              </h3>
            </div>

            <div className="border-t border-gray-100 pt-4">
              {legalDocuments[activeModal].content}
            </div>

            <div className="mt-6 pt-4 border-t border-gray-100 text-right">
              <button
                onClick={() => setActiveModal(null)}
                className="px-5 py-2 rounded-xl bg-[#262626] text-white text-xs font-bold uppercase tracking-wider"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
