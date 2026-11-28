import React, { useState } from 'react'
import {
  SignIn,
  SignedIn,
  SignedOut,
  UserButton,
  useUser,
  useClerk,
} from '@clerk/clerk-react'
import {
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Lock,
  Sparkles,
  Send,
  ExternalLink,
} from 'lucide-react'

// Official Himalayan artwork background (with natural Powered by Dishanitish Technologies)
import himalayaBg from '../assets/disha-himalaya-login.jpg'

export const MerchantLogin: React.FC = () => {
  const { user } = useUser()
  const clerk = useClerk()

  const [activeTab, setActiveTab] = useState<'login' | 'request'>('login')

  // Request Access form state
  const [businessName, setBusinessName] = useState('')
  const [contact, setContact] = useState('')
  const [volume, setVolume] = useState('₹50 Lakhs – ₹1 Crore')
  const [submitted, setSubmitted] = useState(false)

  const handleRequestSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!businessName || !contact) return
    setSubmitted(true)
  }

  return (
    <div className="relative min-h-screen w-full flex items-center justify-end overflow-hidden p-6 sm:p-12 lg:p-16">
      {/* ------------------------------------------------------------- */}
      {/* BREATHTAKING HIMALAYAN SUNRISE BACKGROUND                      */}
      {/* ------------------------------------------------------------- */}
      <div
        className="absolute inset-0 bg-cover bg-center transition-transform duration-1000 ease-out will-change-transform"
        style={{
          backgroundImage: `url(${himalayaBg})`,
          animation: 'subtleBreathe 16s ease-in-out infinite alternate',
        }}
        aria-hidden="true"
      />

      {/* Atmospheric lighting gradient */}
      <div className="absolute inset-0 bg-gradient-to-r from-black/40 via-transparent to-black/60 pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/30 pointer-events-none" />

      {/* ------------------------------------------------------------- */}
      {/* RIGHT SIDE FLOATING LOGIN (NO BOX, NO CARD BORDERS)            */}
      {/* ------------------------------------------------------------- */}
      <div className="relative z-20 w-full max-w-sm sm:max-w-md text-white my-auto animate-fade-in">
        
        {/* Floating Header */}
        <div className="mb-6 text-left">
          <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#B5F5D8] mb-1.5">
            <ShieldCheck className="w-4 h-4 text-[#B5F5D8]" />
            <span>Merchant Commercial Access</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white drop-shadow-md">
            Merchant Login
          </h1>
        </div>

        {/* Floating Tab Switcher (Zero Box, Pure Underline / Minimal Pill) */}
        <div className="flex items-center gap-6 border-b border-white/20 pb-3 mb-6">
          <button
            type="button"
            onClick={() => setActiveTab('login')}
            className={`text-sm font-bold transition-all relative py-1 ${
              activeTab === 'login'
                ? 'text-white'
                : 'text-white/60 hover:text-white'
            }`}
          >
            <span>Sign In</span>
            {activeTab === 'login' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#B5F5D8] rounded-full" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('request')}
            className={`text-sm font-bold transition-all relative py-1 ${
              activeTab === 'request'
                ? 'text-white'
                : 'text-white/60 hover:text-white'
            }`}
          >
            <span>Request Access</span>
            {activeTab === 'request' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#B5F5D8] rounded-full" />
            )}
          </button>
        </div>

        {/* TAB 1: CLERK MERCHANT SIGN IN (NO BOX, NO WHITE CARD) */}
        {activeTab === 'login' && (
          <div className="animate-fade-in space-y-4">
            <SignedIn>
              <div className="text-left py-4 space-y-4">
                <div className="flex items-center gap-3">
                  <UserButton afterSignOutUrl="/merchant-login" />
                  <div>
                    <div className="text-base font-bold text-white">
                      {user?.firstName || user?.username || 'Merchant'}
                    </div>
                    <div className="text-xs text-[#B5F5D8]">
                      {user?.primaryEmailAddress?.emailAddress}
                    </div>
                  </div>
                </div>

                <a
                  href="https://merchant.disha8-2.thenitishkr.in/"
                  className="w-full py-3.5 px-4 rounded-xl text-xs font-bold uppercase tracking-wider text-white bg-gradient-to-r from-[#07865C] to-[#0a9b6b] hover:from-[#065440] hover:to-[#08785c] shadow-lg shadow-[#07865C]/40 flex items-center justify-center gap-2 transition-all"
                >
                  <span>Enter Merchant Terminal</span>
                  <ArrowRight className="w-4 h-4" />
                </a>
              </div>
            </SignedIn>

            <SignedOut>
              <div className="clerk-no-box">
                <SignIn
                  routing="hash"
                  fallbackRedirectUrl="https://merchant.disha8-2.thenitishkr.in/"
                  appearance={{
                    elements: {
                      rootBox: 'w-full !bg-transparent !shadow-none !border-none !p-0',
                      card: '!bg-transparent !shadow-none !border-none !p-0',
                      cardBox: '!bg-transparent !shadow-none !border-none !p-0',
                      header: 'hidden',
                      footer: '!bg-transparent !text-white/70 !text-xs !border-none',
                      formButtonPrimary:
                        '!bg-gradient-to-r !from-[#07865C] !to-[#0a9b6b] hover:!from-[#065440] hover:!to-[#08785c] !text-white !text-xs !font-bold !uppercase !tracking-wider !rounded-xl !shadow-lg !transition-all !py-3',
                      formFieldInput:
                        '!bg-white/15 !border !border-white/30 focus:!border-[#B5F5D8] !text-sm !rounded-xl !text-white placeholder:!text-white/50 backdrop-blur-md',
                      formFieldLabel: '!text-xs !font-bold !text-white/90',
                      footerActionLink: '!text-[#B5F5D8] !font-bold hover:!underline',
                      dividerText: '!text-xs !text-white/60 !font-medium',
                      dividerLine: '!bg-white/20',
                    },
                  }}
                />
              </div>

              <div className="mt-3 text-left">
                <button
                  type="button"
                  onClick={() => clerk.openSignIn({})}
                  className="text-xs text-white/70 hover:text-white underline transition-colors"
                >
                  Quick Sign In Modal
                </button>
              </div>
            </SignedOut>
          </div>
        )}

        {/* TAB 2: REQUEST ACCESS FOR MERCHANTS (NO BOX) */}
        {activeTab === 'request' && (
          <div className="animate-fade-in space-y-4 text-left">
            {submitted ? (
              <div className="py-6 space-y-3">
                <div className="inline-flex items-center gap-2 text-[#B5F5D8]">
                  <CheckCircle2 className="w-5 h-5" />
                  <span className="font-bold text-sm">Access Request Received</span>
                </div>
                <p className="text-xs text-white/85 leading-relaxed">
                  Thank you. Direct bank rail onboarding for <strong className="text-white">{businessName}</strong> has been queued. Our integration engineer will reach out via <strong className="text-white">{contact}</strong>.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSubmitted(false)
                    setActiveTab('login')
                  }}
                  className="text-xs text-[#B5F5D8] underline hover:text-white pt-2 font-bold block"
                >
                  Return to Sign In
                </button>
              </div>
            ) : (
              <form onSubmit={handleRequestSubmit} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-bold text-white/90 mb-1">
                    Business Legal Name
                  </label>
                  <input
                    type="text"
                    required
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    placeholder="e.g. Enterprise / Store Name"
                    className="w-full px-4 py-3 rounded-xl bg-white/15 border border-white/30 text-white placeholder:text-white/40 text-sm backdrop-blur-md focus:outline-none focus:border-[#B5F5D8]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-white/90 mb-1">
                    Work Email or Mobile Number
                  </label>
                  <input
                    type="text"
                    required
                    value={contact}
                    onChange={(e) => setContact(e.target.value)}
                    placeholder="merchant@company.in or +91 98765 43210"
                    className="w-full px-4 py-3 rounded-xl bg-white/15 border border-white/30 text-white placeholder:text-white/40 text-sm backdrop-blur-md focus:outline-none focus:border-[#B5F5D8]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-white/90 mb-1">
                    Estimated Monthly Volume
                  </label>
                  <select
                    value={volume}
                    onChange={(e) => setVolume(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-white/20 border border-white/30 text-white text-sm backdrop-blur-md focus:outline-none focus:border-[#B5F5D8]"
                  >
                    <option value="₹10 Lakhs – ₹50 Lakhs" className="text-black">₹10 Lakhs – ₹50 Lakhs / month</option>
                    <option value="₹50 Lakhs – ₹1 Crore" className="text-black">₹50 Lakhs – ₹1 Crore / month</option>
                    <option value="₹1 Crore – ₹5 Crores" className="text-black">₹1 Crore – ₹5 Crores / month</option>
                    <option value="₹5 Crores+" className="text-black">₹5 Crores+ / month</option>
                  </select>
                </div>

                <button
                  type="submit"
                  className="w-full mt-2 py-3.5 px-4 rounded-xl text-xs font-bold uppercase tracking-wider text-white bg-gradient-to-r from-[#07865C] to-[#0a9b6b] hover:from-[#065440] hover:to-[#08785c] shadow-lg shadow-[#07865C]/40 flex items-center justify-center gap-2 transition-all"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Submit Access Request</span>
                </button>
              </form>
            )}
          </div>
        )}

        {/* Super Admin discrete link */}
        <div className="mt-8 pt-4 border-t border-white/15 text-left">
          <a
            href="/superadmin-login"
            className="inline-flex items-center gap-1.5 text-xs text-white/60 hover:text-white transition-colors"
          >
            <Lock className="w-3 h-3" />
            <span>Super Admin Gateway</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </div>
  )
}
