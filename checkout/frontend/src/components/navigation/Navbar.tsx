import React from 'react'
import { Link } from 'react-router-dom'
export const Navbar: React.FC = () => <header className="fixed top-0 left-0 right-0 z-50 bg-white/95 border-b border-gray-200">
<div className="max-w-[1440px] mx-auto h-[72px] px-5 flex items-center justify-between gap-4">
<Link to="/" className="flex items-center gap-3"><span className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-emerald-400 text-white grid place-items-center font-bold">D</span><span className="font-bold text-lg text-[#23242d]">DISHA 8.2</span></Link>
<nav aria-label="Main navigation" className="hidden lg:flex gap-6 text-sm font-semibold"><Link to="/about">Why DISHA</Link><Link to="/how-it-works">How it works</Link><Link to="/payment-safety">Payment safety</Link><Link to="/compare-and-save">Compare &amp; save</Link></nav>
<Link className="btn-primary text-sm" to="/contact">Business inquiry</Link>
</div></header>
