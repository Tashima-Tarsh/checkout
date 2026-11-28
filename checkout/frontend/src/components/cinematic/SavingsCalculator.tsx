import React, { useState, useEffect, useRef } from 'react'
import * as THREE from 'three'
import confetti from 'canvas-confetti'
import { Calculator, Sparkles, TrendingUp, IndianRupee, ShieldCheck, ArrowRight } from 'lucide-react'

export const SavingsCalculator: React.FC = () => {
  // Input states
  // Volume in Rupees (default 50 Lakhs = 5,000,000)
  const [monthlyVolume, setMonthlyVolume] = useState<number>(5000000)
  // MDR percentage (e.g. 2.0%)
  const [mdrRate, setMdrRate] = useState<number>(2.0)
  // Average ticket (e.g. ₹1,200)
  const [avgTicket, setAvgTicket] = useState<number>(1200)

  const canvasRef = useRef<HTMLDivElement>(null)
  const sphereMeshRef = useRef<THREE.Mesh | null>(null)

  // Calculations
  const annualVolume = monthlyVolume * 12
  const mdrAmountAnnual = (annualVolume * mdrRate) / 100
  const gstOnMdrAnnual = mdrAmountAnnual * 0.18
  const currentAnnualCost = mdrAmountAnnual + gstOnMdrAnnual

  // Agentic Pay flat software subscription model (e.g. ₹4,999/mo = ₹59,988/yr)
  const agenticPayAnnualCost = 59988

  // Net annual capital retained
  const netRetained = Math.max(0, currentAnnualCost - agenticPayAnnualCost)

  // Working capital freed up (assuming 3 days of float eliminated)
  const workingCapitalFreed = (monthlyVolume / 30) * 3

  // Helper formatting for Indian Rupees (Lakhs and Crores)
  const formatINR = (val: number): string => {
    if (val >= 10000000) {
      return `₹${(val / 10000000).toFixed(2)} Cr`
    }
    if (val >= 100000) {
      return `₹${(val / 100000).toFixed(2)} Lakh`
    }
    return `₹${Math.round(val).toLocaleString('en-IN')}`
  }

  // 3D Sphere / Liquidity Canvas
  useEffect(() => {
    const container = canvasRef.current
    if (!container || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true })
    } catch {
      return
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
    renderer.setSize(container.clientWidth, container.clientHeight)
    renderer.setClearColor(0, 0)
    container.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 50)
    camera.position.set(0, 0, 5)

    const ambLight = new THREE.AmbientLight(0xfff8ee, 1.6)
    scene.add(ambLight)

    const pointLight = new THREE.PointLight(0xd7b77b, 3, 10)
    pointLight.position.set(2, 3, 4)
    scene.add(pointLight)

    const emeraldLight = new THREE.PointLight(0x07865c, 2.5, 8)
    emeraldLight.position.set(-2, -2, 3)
    scene.add(emeraldLight)

    // Golden Liquid Sphere representing retained capital
    const sphereGeo = new THREE.SphereGeometry(1.2, 48, 48)
    const sphereMat = new THREE.MeshPhysicalMaterial({
      color: 0xd7b77b,
      metalness: 0.9,
      roughness: 0.18,
      clearcoat: 0.8,
      clearcoatRoughness: 0.2,
      transmission: 0.35,
    })
    const sphere = new THREE.Mesh(sphereGeo, sphereMat)
    scene.add(sphere)
    sphereMeshRef.current = sphere

    // Outer golden orbit ring
    const ringGeo = new THREE.TorusGeometry(1.8, 0.03, 16, 100)
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0x07865c,
      metalness: 0.8,
      roughness: 0.2,
      emissive: 0x043c2e,
    })
    const ring = new THREE.Mesh(ringGeo, ringMat)
    ring.rotation.x = Math.PI / 3
    scene.add(ring)

    let animId = 0
    let clock = new THREE.Clock()

    const animate = () => {
      animId = requestAnimationFrame(animate)
      const t = clock.getElapsedTime()
      sphere.rotation.y = t * 0.4
      sphere.rotation.x = Math.sin(t * 0.3) * 0.2
      ring.rotation.z = t * 0.25
      renderer.render(scene, camera)
    }
    animate()

    const onResize = () => {
      if (!container) return
      camera.aspect = container.clientWidth / container.clientHeight
      camera.updateProjectionMatrix()
      renderer.setSize(container.clientWidth, container.clientHeight)
    }
    window.addEventListener('resize', onResize)

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', onResize)
      renderer.dispose()
      scene.clear()
      if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement)
      }
    }
  }, [])

  // Scale sphere dynamically based on retained savings
  useEffect(() => {
    if (sphereMeshRef.current) {
      const scaleFactor = Math.min(1.6, Math.max(0.7, 0.7 + (monthlyVolume / 50000000) * 0.8))
      sphereMeshRef.current.scale.set(scaleFactor, scaleFactor, scaleFactor)
    }
  }, [monthlyVolume])

  const triggerCelebration = () => {
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.7 },
      colors: ['#07865C', '#D7B77B', '#B5F5D8', '#FFB76B'],
    })
  }

  return (
    <section id="calculator" className="py-28 bg-[#FAF8F5] relative overflow-hidden border-b border-[#E5DFD5]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Section Heading */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#07865C]/10 border border-[#07865C]/30 text-[#07865C] text-xs font-bold tracking-wide uppercase mb-4">
            <Calculator className="w-3.5 h-3.5" />
            <span>Interactive 3D Savings Calculator</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-black text-[#12161A] tracking-tight leading-tight">
            Calculate How Much Capital{' '}
            <span className="text-[#07865C]">
              You Retain.
            </span>
          </h2>
          <p className="mt-4 text-base sm:text-lg text-[#555E68] leading-relaxed">
            Move the sliders below to see the exact capital you stop paying to gateway intermediaries every month and year.
          </p>
        </div>

        {/* Main Calculator Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center bg-white rounded-3xl p-6 sm:p-10 border border-[#E5DFD5] shadow-sm">
          {/* Controls Column (7 cols) */}
          <div className="lg:col-span-7 space-y-8">
            {/* Slider 1: Monthly Transaction Volume */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-bold text-[#12161A]">
                  Monthly Transaction Volume
                </label>
                <span className="text-lg font-black text-[#07865C] font-mono">
                  {formatINR(monthlyVolume)}
                </span>
              </div>
              <input
                type="range"
                min={500000}
                max={50000000}
                step={500000}
                value={monthlyVolume}
                onChange={(e) => setMonthlyVolume(Number(e.target.value))}
                className="w-full h-2.5 bg-[#E5DFD5] rounded-lg appearance-none cursor-pointer accent-[#07865C]"
              />
              <div className="flex justify-between text-[11px] text-[#6E7781] mt-1.5 font-medium">
                <span>₹5 Lakh</span>
                <span>₹1 Crore</span>
                <span>₹5 Crore+</span>
              </div>
            </div>

            {/* Slider 2: Current Aggregator MDR Rate */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-bold text-[#12161A]">
                  Current Payment Gateway MDR (+18% GST)
                </label>
                <span className="text-lg font-black text-red-600 font-mono">
                  {mdrRate.toFixed(1)}%
                </span>
              </div>
              <input
                type="range"
                min={1.2}
                max={3.0}
                step={0.1}
                value={mdrRate}
                onChange={(e) => setMdrRate(Number(e.target.value))}
                className="w-full h-2.5 bg-[#E5DFD5] rounded-lg appearance-none cursor-pointer accent-red-600"
              />
              <div className="flex justify-between text-[11px] text-[#6E7781] mt-1.5 font-medium">
                <span>1.2% (Standard)</span>
                <span>2.0% (Average)</span>
                <span>3.0% (High-Tier / Amex)</span>
              </div>
            </div>

            {/* Slider 3: Average Ticket Size */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-bold text-[#12161A]">
                  Average Order / Ticket Value
                </label>
                <span className="text-lg font-black text-[#12161A] font-mono">
                  ₹{avgTicket.toLocaleString('en-IN')}
                </span>
              </div>
              <input
                type="range"
                min={100}
                max={10000}
                step={100}
                value={avgTicket}
                onChange={(e) => setAvgTicket(Number(e.target.value))}
                className="w-full h-2.5 bg-[#E5DFD5] rounded-lg appearance-none cursor-pointer accent-[#C4A265]"
              />
              <div className="flex justify-between text-[11px] text-[#6E7781] mt-1.5 font-medium">
                <span>₹100 (Micro)</span>
                <span>₹1,500 (Retail)</span>
                <span>₹10,000+ (High Value)</span>
              </div>
            </div>

            {/* Summary Highlights */}
            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-[#E5DFD5]">
              <div className="p-4 rounded-2xl bg-red-50/70 border border-red-200">
                <div className="text-[11px] font-bold text-red-700 uppercase">Current Annual Loss</div>
                <div className="text-xl sm:text-2xl font-black text-red-600 mt-1 font-mono">
                  {formatINR(currentAnnualCost)}
                </div>
                <div className="text-[10px] text-red-500 mt-0.5">MDR + 18% GST Intermediary Fee</div>
              </div>

              <div className="p-4 rounded-2xl bg-[#07865C]/10 border border-[#07865C]/30">
                <div className="text-[11px] font-bold text-[#07865C] uppercase">Agentic Pay Software Fee</div>
                <div className="text-xl sm:text-2xl font-black text-[#07865C] mt-1 font-mono">
                  {formatINR(agenticPayAnnualCost)}
                </div>
                <div className="text-[10px] text-[#07865C] mt-0.5">Flat Non-Custodial Software License</div>
              </div>
            </div>
          </div>

          {/* Interactive Output Column with 3D Canvas (5 cols) */}
          <div className="lg:col-span-5 bg-[#12161A] rounded-3xl p-6 sm:p-8 text-white relative overflow-hidden shadow-2xl flex flex-col justify-between border border-[#07865C]/30">
            {/* 3D Golden Sphere Canvas */}
            <div
              ref={canvasRef}
              className="w-full h-44 mb-4 rounded-2xl overflow-hidden relative"
              aria-label="3D Retained Liquidity Visualization"
            />

            <div className="text-center">
              <span className="text-[11px] font-mono uppercase tracking-widest text-[#B5F5D8]">
                ANNUAL CAPITAL RETAINED
              </span>
              <div className="text-3xl sm:text-4xl font-black text-white mt-1.5 tracking-tight font-mono">
                {formatINR(netRetained)}
              </div>
              <p className="text-xs text-white/70 mt-1">
                Direct bottom-line margin returned to your business
              </p>
            </div>

            <div className="mt-6 pt-5 border-t border-white/10 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-white/60">Working Capital Freed (3 Days Float):</span>
                <span className="font-bold text-[#D7B77B] font-mono">{formatINR(workingCapitalFreed)}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-white/60">Monthly Net Savings:</span>
                <span className="font-bold text-[#B5F5D8] font-mono">{formatINR(netRetained / 12)} / mo</span>
              </div>
            </div>

            <button
              onClick={triggerCelebration}
              className="mt-6 w-full py-3.5 rounded-xl bg-[#07865C] hover:bg-[#065440] text-white text-xs font-bold uppercase tracking-wider shadow-lg flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
            >
              <Sparkles className="w-4 h-4 text-[#B5F5D8]" />
              <span>Celebrate Retained Capital</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
