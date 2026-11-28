import React from 'react'
export const Navbar: React.FC = () => <header className="fixed top-0 left-0 right-0 z-50 bg-white/95 border-b border-gray-200">
<div className="max-w-[1440px] mx-auto h-[72px] px-5 flex items-center justify-between gap-4">
<a href="/" className="flex items-center gap-3"><span className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-emerald-400 text-white grid place-items-center font-bold">D</span><span className="font-bold text-lg text-[#23242d]">DISHA 8.2</span></a>
<nav aria-label="Main navigation" className="hidden lg:flex gap-6 text-sm font-semibold"><a href="/about">Why DISHA</a><a href="/how-it-works">How it works</a><a href="/payment-safety">Payment safety</a><a href="/compare-and-save">Compare &amp; save</a></nav>
<a className="btn-primary text-sm" href="/contact">Business inquiry</a>
</div></header>
