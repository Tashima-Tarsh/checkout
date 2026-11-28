import React, { useState, useEffect } from 'react'
import { Volume2, VolumeX, Menu, X, ArrowUpRight, ShieldCheck, Cpu } from 'lucide-react'

interface NavbarProps {
  onToggleAudio?: () => void
  isAudioPlaying?: boolean
}

export const Navbar: React.FC<NavbarProps> = ({ onToggleAudio, isAudioPlaying = false }) => {
  const [scrolled, setScrolled] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-[#FAF8F3]/90 backdrop-blur-xl border-b border-[#D7B77B]/20 shadow-sm py-3'
          : 'bg-transparent py-5'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
        {/* Brand Logo & Product Designation */}
        <a href="/" className="flex items-center gap-3 group">
          <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-[#FAF8F3] to-[#DCE2E7] border border-[#D7B77B]/40 flex items-center justify-center shadow-sm overflow-hidden group-hover:border-[#07865C] transition-colors">
            <span className="text-xl font-bold bg-gradient-to-br from-[#D7B77B] to-[#07865C] bg-clip-text text-transparent">
              D
            </span>
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-lg tracking-tight text-[#262626]">
                DISHA 8.2
              </span>
              <span className="text-[10px] uppercase font-bold tracking-widest px-1.5 py-0.5 rounded bg-[#07865C]/10 text-[#07865C] border border-[#07865C]/20">
                PROD
              </span>
            </div>
            <span className="text-xs font-semibold tracking-wide text-[#737373]">
              Agentic Pay
            </span>
          </div>
        </a>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-[#404040]">
          <a
            href="#discover"
            className="hover:text-[#07865C] transition-colors relative py-1"
          >
            Discover
          </a>
          <a
            href="#benefits"
            className="hover:text-[#07865C] transition-colors relative py-1"
          >
            Benefits
          </a>
          <a
            href="#calculator"
            className="hover:text-[#07865C] transition-colors relative py-1"
          >
            Calculate Savings
          </a>
          <a
            href="#ecosystem"
            className="hover:text-[#07865C] transition-colors relative py-1"
          >
            Product
          </a>
          <a
            href="#portfolio"
            className="hover:text-[#07865C] transition-colors relative py-1"
          >
            Portfolio
          </a>
        </nav>

        {/* Action Controls & Logins */}
        <div className="hidden lg:flex items-center gap-4">
          {/* Audio narration toggle */}
          {onToggleAudio && (
            <button
              onClick={onToggleAudio}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                isAudioPlaying
                  ? 'bg-[#07865C]/10 border-[#07865C] text-[#07865C]'
                  : 'bg-white/80 border-[#DCE2E7] text-[#525252] hover:border-[#D7B77B]'
              }`}
              title="Toggle Narration"
            >
              {isAudioPlaying ? (
                <>
                  <Volume2 className="w-3.5 h-3.5 animate-pulse text-[#07865C]" />
                  <span>Narration On</span>
                </>
              ) : (
                <>
                  <VolumeX className="w-3.5 h-3.5 text-[#737373]" />
                  <span>Narration</span>
                </>
              )}
            </button>
          )}

          {/* Super Admin link */}
          <a
            href="https://superadmin.disha8-2.thenitishkr.in/"
            className="text-xs font-semibold text-[#525252] hover:text-[#262626] transition-colors px-2 py-1 flex items-center gap-1"
          >
            <span>Super Admin</span>
          </a>

          {/* Merchant Portal Login */}
          <a
            href="https://merchant.disha8-2.thenitishkr.in/"
            className="text-xs font-semibold text-[#07865C] hover:text-[#065440] transition-colors px-2.5 py-1.5 rounded-lg border border-[#07865C]/25 hover:border-[#07865C] bg-[#07865C]/5"
          >
            Merchant Login
          </a>

          {/* Primary Action Button */}
          <a
            href="#calculator"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-[#07865C] to-[#0a9b6b] hover:from-[#065440] hover:to-[#08785c] shadow-sm hover:shadow transition-all group"
          >
            <span>Get Started</span>
            <ArrowUpRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
          </a>
        </div>

        {/* Mobile menu button */}
        <div className="flex md:hidden items-center gap-2">
          {onToggleAudio && (
            <button
              onClick={onToggleAudio}
              className="p-2 rounded-lg bg-white/80 border border-[#DCE2E7] text-[#525252]"
              aria-label="Toggle narration"
            >
              {isAudioPlaying ? <Volume2 className="w-4 h-4 text-[#07865C]" /> : <VolumeX className="w-4 h-4" />}
            </button>
          )}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-lg bg-white/80 border border-[#DCE2E7] text-[#262626]"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-[#FAF8F3] border-b border-[#D7B77B]/20 px-4 pt-3 pb-6 shadow-xl">
          <nav className="flex flex-col gap-3 text-sm font-medium text-[#404040]">
            <a
              href="#discover"
              onClick={() => setMobileMenuOpen(false)}
              className="py-1.5 hover:text-[#07865C]"
            >
              Discover
            </a>
            <a
              href="#benefits"
              onClick={() => setMobileMenuOpen(false)}
              className="py-1.5 hover:text-[#07865C]"
            >
              Benefits
            </a>
            <a
              href="#calculator"
              onClick={() => setMobileMenuOpen(false)}
              className="py-1.5 hover:text-[#07865C]"
            >
              Calculate Savings
            </a>
            <a
              href="#ecosystem"
              onClick={() => setMobileMenuOpen(false)}
              className="py-1.5 hover:text-[#07865C]"
            >
              Product Ecosystem
            </a>
            <a
              href="#portfolio"
              onClick={() => setMobileMenuOpen(false)}
              className="py-1.5 hover:text-[#07865C]"
            >
              Technology Portfolio
            </a>
            <div className="pt-3 border-t border-[#DCE2E7] flex flex-col gap-2">
              <a
                href="https://merchant.disha8-2.thenitishkr.in/"
                className="w-full text-center py-2 text-sm font-semibold text-[#07865C] bg-[#07865C]/10 rounded-xl"
              >
                Merchant Login
              </a>
              <a
                href="https://superadmin.disha8-2.thenitishkr.in/"
                className="w-full text-center py-2 text-sm font-semibold text-[#525252] bg-white border border-[#DCE2E7] rounded-xl"
              >
                Super Admin Login
              </a>
              <a
                href="#calculator"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full text-center py-2 text-sm font-bold text-white bg-[#07865C] rounded-xl"
              >
                Get Started
              </a>
            </div>
          </nav>
        </div>
      )}
    </header>
  )
}
