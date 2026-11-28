import React, { useState, useEffect } from 'react'
import { Volume2, VolumeX, Menu, X, ArrowUpRight } from 'lucide-react'

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
          ? 'bg-[#FAF8F3]/92 backdrop-blur-xl border-b border-[#D7B77B]/20 shadow-sm py-3'
          : 'bg-transparent py-5'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
        {/* Brand: DISHA 8.2 ONLY, NO OTHER LOGO, NO PROD BADGE */}
        <a href="/" className="flex flex-col group">
          <span className="font-black text-2xl tracking-tight text-[#262626] group-hover:text-[#07865C] transition-colors">
            DISHA 8.2
          </span>
          <span className="text-xs font-semibold tracking-wider uppercase text-[#737373] -mt-1">
            Agentic Pay
          </span>
        </a>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-8 text-sm font-semibold text-[#404040]">
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
            Ecosystem
          </a>
        </nav>

        {/* Action Controls & Logins (NO SUPER ADMIN) */}
        <div className="hidden lg:flex items-center gap-4">
          {/* Audio narration toggle */}
          {onToggleAudio && (
            <button
              onClick={onToggleAudio}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                isAudioPlaying
                  ? 'bg-[#07865C]/15 border-[#07865C] text-[#07865C]'
                  : 'bg-white/80 border-[#DCE2E7] text-[#525252] hover:border-[#D7B77B]'
              }`}
              title="Toggle Audio Narration"
            >
              {isAudioPlaying ? (
                <>
                  <Volume2 className="w-3.5 h-3.5 animate-pulse text-[#07865C]" />
                  <span>Narration Playing</span>
                </>
              ) : (
                <>
                  <VolumeX className="w-3.5 h-3.5 text-[#737373]" />
                  <span>Audio Narration</span>
                </>
              )}
            </button>
          )}

          {/* Merchant Portal Login */}
          <a
            href="https://merchant.disha8-2.thenitishkr.in/"
            className="text-xs font-bold text-[#07865C] hover:text-[#065440] transition-colors px-3 py-2 rounded-xl border border-[#07865C]/30 hover:border-[#07865C] bg-[#07865C]/5"
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
          <nav className="flex flex-col gap-3 text-sm font-semibold text-[#404040]">
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
              Product
            </a>
            <a
              href="#portfolio"
              onClick={() => setMobileMenuOpen(false)}
              className="py-1.5 hover:text-[#07865C]"
            >
              Ecosystem
            </a>
            <div className="pt-3 border-t border-[#DCE2E7] flex flex-col gap-2">
              <a
                href="https://merchant.disha8-2.thenitishkr.in/"
                className="w-full text-center py-2 text-sm font-bold text-[#07865C] bg-[#07865C]/10 rounded-xl"
              >
                Merchant Login
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
