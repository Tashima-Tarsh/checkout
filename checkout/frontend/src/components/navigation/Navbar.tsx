import React, { useState, useEffect } from 'react'
import { Menu, X, ArrowUpRight } from 'lucide-react'

interface NavbarProps {
  onToggleAudio?: () => void
  isAudioPlaying?: boolean
}

export const Navbar: React.FC<NavbarProps> = () => {
  const [scrolled, setScrolled] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20)
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-[#F7F5EF]/95 backdrop-blur-md border-b border-[#E5E0D5] py-3.5 shadow-sm'
          : 'bg-transparent py-5'
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 flex items-center justify-between">
        {/* Left: Brand Identity (Pure text, no icons, no Hindi, authoritative) */}
        <a href="/" className="flex flex-col text-left group">
          <span className="font-extrabold text-2xl tracking-[-0.03em] text-[#242722] font-brand">
            DISHA 8.2
          </span>
          <span className="text-[10px] font-mono tracking-wider uppercase text-[#245C49] font-bold">
            ZERO TOLL FOR MONEY TRANSFER
          </span>
        </a>

        {/* Center: Text-based Refined Editorial Navigation */}
        <nav className="hidden md:flex items-center gap-8 text-[14px] font-medium text-[#242722]/85">
          <a
            href="#philosophy"
            className="hover:text-[#245C49] transition-colors py-1"
          >
            Our Philosophy
          </a>
          <a
            href="#platform"
            className="hover:text-[#245C49] transition-colors py-1"
          >
            The Platform
          </a>
          <a
            href="#economics"
            className="hover:text-[#245C49] transition-colors py-1"
          >
            Business Economics
          </a>
          <a
            href="#enterprise"
            className="hover:text-[#245C49] transition-colors py-1"
          >
            Enterprise
          </a>
        </nav>

        {/* Right: Merchant Login (routes to /merchant-login with Clerk) */}
        <div className="hidden md:flex items-center gap-4">
          <a
            href="/merchant-login"
            className="text-[14px] font-semibold text-[#245C49] hover:text-[#183d31] transition-colors py-2 px-4 rounded-full border border-[#245C49]/25 hover:border-[#245C49] bg-white/60 hover:bg-white"
          >
            Merchant Login
          </a>
        </div>

        {/* Mobile menu button */}
        <div className="flex md:hidden items-center gap-2">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-lg bg-white/80 border border-[#E5E0D5] text-[#242722]"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-[#F7F5EF] border-b border-[#E5E0D5] px-6 py-5 space-y-4 shadow-lg text-left">
          <a
            href="#philosophy"
            onClick={() => setMobileMenuOpen(false)}
            className="block text-base font-semibold text-[#242722] hover:text-[#245C49]"
          >
            Our Philosophy
          </a>
          <a
            href="#platform"
            onClick={() => setMobileMenuOpen(false)}
            className="block text-base font-semibold text-[#242722] hover:text-[#245C49]"
          >
            The Platform
          </a>
          <a
            href="#economics"
            onClick={() => setMobileMenuOpen(false)}
            className="block text-base font-semibold text-[#242722] hover:text-[#245C49]"
          >
            Business Economics
          </a>
          <a
            href="#enterprise"
            onClick={() => setMobileMenuOpen(false)}
            className="block text-base font-semibold text-[#242722] hover:text-[#245C49]"
          >
            Enterprise
          </a>
          <div className="pt-2 border-t border-[#E5E0D5]">
            <a
              href="/merchant-login"
              className="inline-block w-full text-center py-2.5 px-4 rounded-xl text-sm font-bold text-white bg-[#245C49]"
            >
              Merchant Login
            </a>
          </div>
        </div>
      )}
    </header>
  )
}
