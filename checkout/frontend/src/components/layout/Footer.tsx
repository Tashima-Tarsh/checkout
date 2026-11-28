import React from 'react'
import { Link } from 'react-router-dom'

export const Footer: React.FC = () => {
  return (
    <footer className="border-t border-[var(--pdp-border)] bg-[var(--pdp-pearl-100)]">
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[var(--pdp-emerald-500)] text-white text-sm font-bold">
              D
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-bold text-[var(--pdp-ink,var(--pdp-dark-text))]">DISHA 8.2</span>
              <span className="text-xs text-[var(--pdp-muted,var(--pdp-dark-muted))]">Agentic UPI Payment Verification</span>
            </div>
          </div>
          <div className="flex flex-col gap-4 text-sm text-[var(--pdp-muted,var(--pdp-dark-muted))]">
            <p className="max-w-[300px]">
              DISHA 8.2 is a non-custodial payment software product developed for Indian businesses seeking greater control over payment operations.
            </p>
            <div className="mt-4 flex items-center gap-3 text-sm">
              <span className="text-[var(--pdp-emerald-500)]">✉</span>
              <a href="mailto:nitish@thenitishkr.in" className="text-[var(--pdp-emerald-500)] hover:underline">nitish@thenitishkr.in</a>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <span className="text-[var(--pdp-emerald-500)]">📱</span>
              <a href="https://wa.me/919142197135" className="text-[var(--pdp-emerald-500)] hover:underline">+91-9142197135</a>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <h4 className="text-sm font-bold text-[var(--pdp-ink,var(--pdp-dark-text))]">Platform</h4>
            <ul className="flex flex-col gap-2 text-sm text-[var(--pdp-muted,var(--pdp-dark-muted))]">
              <li><a href="/about" className="hover:text-[var(--pdp-emerald-500)]">About DISHA</a></li>
              <li><a href="/how-it-works" className="hover:text-[var(--pdp-emerald-500)]">How It Works</a></li>
              <li><a href="/payment-safety" className="hover:text-[var(--pdp-emerald-500)]">Payment Safety</a></li>
              <li><a href="/compare-and-save" className="hover:text-[var(--pdp-emerald-500)]">Compare & Save</a></li>
            </ul>
          </div>
          <div className="flex flex-col gap-2">
            <h4 className="text-sm font-bold text-[var(--pdp-ink,var(--pdp-dark-text))]">Markets</h4>
            <ul className="flex flex-col gap-2 text-sm text-[var(--pdp-muted,var(--pdp-dark-muted))]">
              <li><a href="/in" className="hover:text-[var(--pdp-emerald-500)]">India</a></li>
              <li><a href="/ae" className="hover:text-[var(--pdp-emerald-500)]">Dubai & UAE</a></li>
              <li><a href="/bh" className="hover:text-[var(--pdp-emerald-500)]">Bahrain</a></li>
            </ul>
          </div>
          <div className="flex flex-col gap-2">
            <h4 className="text-sm font-bold text-[var(--pdp-ink,var(--pdp-dark-text))]">Legal</h4>
            <ul className="flex flex-col gap-2 text-sm text-[var(--pdp-muted,var(--pdp-dark-muted))]">
              <li><a href="/privacy" className="hover:text-[var(--pdp-emerald-500)]">Privacy Policy</a></li>
              <li><a href="/terms" className="hover:text-[var(--pdp-emerald-500)]">Terms of Service</a></li>
              <li><a href="/cookie-preferences" className="hover:text-[var(--pdp-emerald-500)]">Cookie Preferences</a></li>
            </ul>
          </div>
        </div>
        <div className="mt-8 pt-8 border-t border-[var(--pdp-border)] flex flex-col lg:flex-row justify-between items-center gap-4 text-sm text-[var(--pdp-muted,var(--pdp-dark-muted))]">
          <p>© 2026 DISHA 8.2. All rights reserved.</p>
          <div className="flex items-center gap-4 text-sm">
            <a href="/" className="hover:text-[var(--pdp-emerald-500)]">Home</a>
            <a href="/about/" className="hover:text-[var(--pdp-emerald-500)]">Why DISHA</a>
            <a href="/contact/" className="hover:text-[var(--pdp-emerald-500)]">Contact</a>
            <a href="/privacy/" className="hover:text-[var(--pdp-emerald-500)]">Privacy</a>
            <a href="/terms/" className="hover:text-[var(--pdp-emerald-500)]">Terms</a>
          </div>
        </div>
      </div>
    </footer>
  )
}
