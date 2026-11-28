import React from 'react'
import { Link } from 'react-router-dom'

export const Navbar: React.FC = () => {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-b border-[var(--pdp-border)] bg-[var(--pdp-pearl-100)]/90 backdrop-blur-[24px]">
      <div className="container flex items-center justify-between px-4 py-3">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[var(--pdp-emerald-500)] text-white text-sm font-bold">
            D
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-bold tracking-tight text-[var(--pdp-ink,var(--pdp-dark-text))]">DISHA 8.2</span>
            <span className="text-xs text-[var(--pdp-muted,var(--pdp-dark-muted))]">Agentic UPI Verification</span>
          </div>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-6">
          <NavLink to="/" label="Home" />
          <NavLink to="/about" label="Why DISHA" />
          <NavLink to="/how-it-works" label="How It Works" />
          <NavLink to="/payment-safety" label="Payment Safety" />
          <NavLink to="/compare-and-save" label="Compare & Save" />
          <NavLink to="/in" label="India" />
          <NavLink to="/ae" label="Dubai & UAE" />
          <NavLink to="/bh" label="Bahrain" />
        </nav>

        <div className="flex items-center gap-3">
          <button className="btn-ghost">
            <span className="sr-only">Contact</span>
            <span className="text-[0.875rem]">Contact</span>
          </button>
          <button className="btn-primary">
            Business Inquiry
          </button>
          <button className="btn-icon">
            <span className="sr-only">Notifications</span>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A0.498 0.498 0 0 1 20 14.5v-1.414c0-0.889-0.485-1.595-1.189-1.886q-0.082-0.019-0.148-0.027c-0.162-0.023-0.362-0.012-0.494 0.027l-0.629 0.265c-0.497 0.204-0.776 0.632-0.776 1.354V15c0 0.549-0.199 1.063-0.497 1.354l-0.629 0.265c-0.497 0.204-0.776 0.632-0.776 1.354V17a2 2 0 0 1 1 2zM17 16a1 1 0 1 1 2 0v1a1 1 0 1 1-2 0zM7 16a1 1 0 1 1 2 0v1a1 1 0 1 1-2 0zM11 16a1 1 0 1 1 2 0v1a1 1 0 1 1-2 0zM13 21a1 1 0 1 0-2 0v1a1 1 0 1 1 2 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18a2 2 0 1 1-4 0v1a2 2 0 0 0 4 0z" />
            </svg>
          </button>
        </div>
      </div>
    </nav>
  )
}

const NavLink: React.FC<{ to: string, label: string }> = ({ to, label }) => {
  return (
    <a href={to} className="text-sm font-medium text-[var(--prism-text-secondary,var(--pdp-dark-muted))] hover:text-[var(--pdp-ink,var(--pdp-dark-text))] transition-colors px-2 py-2">
      {label}
    </a>
  )
}
