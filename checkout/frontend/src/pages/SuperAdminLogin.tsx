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
  ShieldAlert,
  KeyRound,
  Lock,
} from 'lucide-react'

// Official Himalayan artwork background
import himalayaBg from '../assets/disha-himalaya-login.jpg'

export const SuperAdminLogin: React.FC = () => {
  const { user } = useUser()
  const clerk = useClerk()
  const [authMode, setAuthMode] = useState<'clerk' | 'credentials'>('clerk')

  // Direct credentials state
  const [adminEmail, setAdminEmail] = useState('nitish@thenitishkr.in')
  const [adminPassword, setAdminPassword] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setErrorMsg('')

    try {
      if (adminEmail === 'nitish@thenitishkr.in' && adminPassword === 'Tashima@906099') {
        localStorage.setItem('disha_superadmin_auth', 'authenticated')
        window.location.href = 'https://superadmin.disha8-2.thenitishkr.in/'
      } else {
        setErrorMsg('Invalid Super Admin credentials. Please check your password.')
      }
    } catch (err) {
      setErrorMsg('Authentication service unavailable.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen w-full flex items-center justify-end overflow-hidden p-6 sm:p-12 lg:p-16">
      {/* Background Image */}
      <div
        className="absolute inset-0 bg-cover bg-center transition-transform duration-1000 ease-out will-change-transform"
        style={{
          backgroundImage: `url(${himalayaBg})`,
          animation: 'subtleBreathe 16s ease-in-out infinite alternate',
        }}
        aria-hidden="true"
      />

      {/* Atmospheric lighting gradient */}
      <div className="absolute inset-0 bg-gradient-to-r from-black/50 via-black/20 to-black/70 pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/40 pointer-events-none" />

      {/* RIGHT SIDE FLOATING LOGIN (NO BOX, NO CARD BORDERS) */}
      <div className="relative z-20 w-full max-w-sm sm:max-w-md text-white my-auto animate-fade-in">
        
        {/* Floating Header */}
        <div className="mb-6 text-left">
          <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#FFB76B] mb-1.5">
            <ShieldAlert className="w-4 h-4 text-[#FFB76B]" />
            <span>Restricted Gateway</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white drop-shadow-md">
            Super Admin Login
          </h1>
        </div>

        {/* Mode Switcher (Floating Underlines, Zero Box) */}
        <div className="flex items-center gap-6 border-b border-white/20 pb-3 mb-6">
          <button
            type="button"
            onClick={() => setAuthMode('clerk')}
            className={`text-sm font-bold transition-all relative py-1 ${
              authMode === 'clerk'
                ? 'text-white'
                : 'text-white/60 hover:text-white'
            }`}
          >
            <span>Clerk Auth</span>
            {authMode === 'clerk' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#FFB76B] rounded-full" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setAuthMode('credentials')}
            className={`text-sm font-bold transition-all relative py-1 ${
              authMode === 'credentials'
                ? 'text-white'
                : 'text-white/60 hover:text-white'
            }`}
          >
            <span>Master Password</span>
            {authMode === 'credentials' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#FFB76B] rounded-full" />
            )}
          </button>
        </div>

        {/* CLERK AUTH (NO BOX) */}
        {authMode === 'clerk' && (
          <div className="animate-fade-in space-y-4">
            <SignedIn>
              <div className="text-left py-4 space-y-4">
                <div className="flex items-center gap-3">
                  <UserButton afterSignOutUrl="/superadmin-login" />
                  <div>
                    <div className="text-base font-bold text-white">
                      {user?.primaryEmailAddress?.emailAddress}
                    </div>
                    <div className="text-xs text-[#B5F5D8] font-bold">
                      AUTHORIZED ADMINISTRATOR
                    </div>
                  </div>
                </div>

                <a
                  href="https://superadmin.disha8-2.thenitishkr.in/"
                  className="w-full py-3.5 px-4 rounded-xl text-xs font-bold uppercase tracking-wider text-white bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 shadow-lg shadow-amber-600/30 flex items-center justify-center gap-2 transition-all"
                >
                  <span>Open Super Admin Console</span>
                  <ArrowRight className="w-4 h-4" />
                </a>
              </div>
            </SignedIn>

            <SignedOut>
              <div className="clerk-no-box">
                <SignIn
                  routing="hash"
                  fallbackRedirectUrl="https://superadmin.disha8-2.thenitishkr.in/"
                  appearance={{
                    elements: {
                      rootBox: 'w-full !bg-transparent !shadow-none !border-none !p-0',
                      card: '!bg-transparent !shadow-none !border-none !p-0',
                      cardBox: '!bg-transparent !shadow-none !border-none !p-0',
                      header: 'hidden',
                      footer: '!bg-transparent !text-white/70 !text-xs !border-none',
                      formButtonPrimary:
                        '!bg-gradient-to-r !from-amber-600 !to-amber-700 hover:!from-amber-700 hover:!to-amber-800 !text-white !text-xs !font-bold !uppercase !tracking-wider !rounded-xl !shadow-lg !transition-all !py-3',
                      formFieldInput:
                        '!bg-white/15 !border !border-white/30 focus:!border-[#FFB76B] !text-sm !rounded-xl !text-white placeholder:!text-white/50 backdrop-blur-md',
                      formFieldLabel: '!text-xs !font-bold !text-white/90',
                      footerActionLink: '!text-[#FFB76B] !font-bold hover:!underline',
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

        {/* DIRECT PASSWORD AUTH (NO BOX) */}
        {authMode === 'credentials' && (
          <form onSubmit={handleCredentialsSubmit} className="space-y-4 animate-fade-in text-left">
            {errorMsg && (
              <div className="p-3 rounded-xl bg-red-500/20 border border-red-400/40 text-red-200 text-xs font-medium">
                {errorMsg}
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-white/90 mb-1">
                Super Admin Email
              </label>
              <input
                type="email"
                required
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-white/15 border border-white/30 text-white placeholder:text-white/40 text-sm backdrop-blur-md focus:outline-none focus:border-[#FFB76B]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-white/90 mb-1">
                Platform Master Password
              </label>
              <input
                type="password"
                required
                placeholder="Enter administrator password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-white/15 border border-white/30 text-white placeholder:text-white/40 text-sm backdrop-blur-md focus:outline-none focus:border-[#FFB76B]"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 py-3.5 px-4 rounded-xl text-xs font-bold uppercase tracking-wider text-white bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 shadow-lg shadow-amber-600/30 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>{isLoading ? 'Authenticating...' : 'Access Super Admin'}</span>
            </button>
          </form>
        )}

        {/* Link back to Merchant Login */}
        <div className="mt-8 pt-4 border-t border-white/15 text-left">
          <a
            href="/merchant-login"
            className="text-xs text-white/60 hover:text-white transition-colors"
          >
            Merchant Terminal? <span className="underline font-bold text-[#B5F5D8]">Go to Merchant Login</span>
          </a>
        </div>
      </div>
    </div>
  )
}
