import React, { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { ArrowRight, Play, Pause, Sparkles, CheckCircle2, TrendingUp, ShieldCheck } from 'lucide-react'

interface HeroCinematicProps {
  isAudioPlaying: boolean
  onToggleAudio: () => void
}

export const HeroCinematic: React.FC<HeroCinematicProps> = ({
  isAudioPlaying,
  onToggleAudio,
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const [hasWebGL, setHasWebGL] = useState(true)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    // Check prefers-reduced-motion
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return
    }

    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        powerPreference: 'high-performance',
      })
    } catch (e) {
      setHasWebGL(false)
      return
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75))
    renderer.setSize(container.clientWidth, container.clientHeight)
    renderer.setClearColor(0x000000, 0)
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    container.appendChild(renderer.domElement)

    // Scene & Camera
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(
      42,
      container.clientWidth / container.clientHeight,
      0.1,
      100
    )
    camera.position.set(0, 1.2, 7.5)

    // Warm Indian daylight & Golden hour lighting
    const ambientLight = new THREE.AmbientLight(0xfff8ee, 1.4)
    scene.add(ambientLight)

    const sunLight = new THREE.DirectionalLight(0xffdfa9, 2.8)
    sunLight.position.set(6, 8, 5)
    sunLight.castShadow = true
    scene.add(sunLight)

    const emeraldGlow = new THREE.PointLight(0x07865c, 2.5, 12)
    emeraldGlow.position.set(0, -0.2, 2)
    scene.add(emeraldGlow)

    // -------------------------------------------------------------
    // DISHA 8.2 Precision-Engineered Aerodynamic Train Group
    // Champagne Gold (#D7B77B) & Brushed Titanium (#DCE2E7)
    // -------------------------------------------------------------
    const trainGroup = new THREE.Group()

    // 1. Aerodynamic Nose & Main Fuselage
    const fuselageGeo = new THREE.CylinderGeometry(0.7, 0.78, 4.2, 32, 1, false, 0, Math.PI)
    fuselageGeo.rotateZ(Math.PI / 2)
    const titaniumMat = new THREE.MeshStandardMaterial({
      color: 0xdce2e7,
      metalness: 0.85,
      roughness: 0.22,
    })
    const fuselage = new THREE.Mesh(fuselageGeo, titaniumMat)
    fuselage.position.set(-0.2, 0.2, 0)
    trainGroup.add(fuselage)

    // 2. Champagne Gold Aerodynamic Crown
    const crownGeo = new THREE.ConeGeometry(0.7, 1.8, 32, 1, false, 0, Math.PI)
    crownGeo.rotateZ(-Math.PI / 2)
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xd7b77b,
      metalness: 0.9,
      roughness: 0.28,
    })
    const trainNose = new THREE.Mesh(crownGeo, goldMat)
    trainNose.position.set(2.4, 0.2, 0)
    trainGroup.add(trainNose)

    // 3. Emerald Energy Illumination Rail along Train Body
    const energyStripeGeo = new THREE.BoxGeometry(4.4, 0.05, 0.04)
    const emeraldEmissiveMat = new THREE.MeshStandardMaterial({
      color: 0xb5f5d8,
      emissive: 0x07865c,
      emissiveIntensity: 2.2,
      roughness: 0.1,
    })
    const energyStripeLeft = new THREE.Mesh(energyStripeGeo, emeraldEmissiveMat)
    energyStripeLeft.position.set(0.2, 0.18, 0.72)
    trainGroup.add(energyStripeLeft)

    const energyStripeRight = new THREE.Mesh(energyStripeGeo, emeraldEmissiveMat)
    energyStripeRight.position.set(0.2, 0.18, -0.72)
    trainGroup.add(energyStripeRight)

    // 4. Cockpit Visor & High-Tech Glass
    const visorGeo = new THREE.CylinderGeometry(0.68, 0.69, 0.8, 16, 1, false, 0, Math.PI)
    visorGeo.rotateZ(Math.PI / 2)
    const visorMat = new THREE.MeshPhysicalMaterial({
      color: 0x262626,
      metalness: 0.95,
      roughness: 0.1,
      transmission: 0.6,
      thickness: 0.3,
    })
    const visor = new THREE.Mesh(visorGeo, visorMat)
    visor.position.set(1.6, 0.32, 0)
    trainGroup.add(visor)

    trainGroup.position.set(-0.6, -0.2, 0)
    scene.add(trainGroup)

    // -------------------------------------------------------------
    // Elevated Payment Rails Suspended in Space
    // -------------------------------------------------------------
    const railGroup = new THREE.Group()

    const railGeo = new THREE.CylinderGeometry(0.045, 0.045, 14, 16)
    railGeo.rotateZ(Math.PI / 2)
    const railMat = new THREE.MeshStandardMaterial({
      color: 0xd7b77b,
      metalness: 0.9,
      roughness: 0.25,
      emissive: 0x5a4822,
      emissiveIntensity: 0.3,
    })
    const rail1 = new THREE.Mesh(railGeo, railMat)
    rail1.position.set(0, -0.75, 0.65)
    railGroup.add(rail1)

    const rail2 = new THREE.Mesh(railGeo, railMat)
    rail2.position.set(0, -0.75, -0.65)
    railGroup.add(rail2)

    // Rail cross ties
    const tieGeo = new THREE.BoxGeometry(0.12, 0.05, 1.6)
    const tieMat = new THREE.MeshStandardMaterial({
      color: 0x404040,
      metalness: 0.5,
      roughness: 0.7,
    })
    for (let i = -7; i <= 7; i += 0.8) {
      const tie = new THREE.Mesh(tieGeo, tieMat)
      tie.position.set(i, -0.78, 0)
      railGroup.add(tie)
    }

    scene.add(railGroup)

    // -------------------------------------------------------------
    // High-Speed Transaction Particle Streams & Dust Atmosphere
    // -------------------------------------------------------------
    const particleCount = 280
    const particleGeo = new THREE.BufferGeometry()
    const particlePositions = new Float32Array(particleCount * 3)
    const particleColors = new Float32Array(particleCount * 3)

    const cGold = new THREE.Color(0xd7b77b)
    const cEmerald = new THREE.Color(0x07865c)
    const cMint = new THREE.Color(0xb5f5d8)

    for (let i = 0; i < particleCount; i++) {
      particlePositions[i * 3] = (Math.random() - 0.5) * 14
      particlePositions[i * 3 + 1] = (Math.random() - 0.5) * 4.5
      particlePositions[i * 3 + 2] = (Math.random() - 0.5) * 5

      const mixCol = Math.random() < 0.5 ? cEmerald : Math.random() < 0.8 ? cGold : cMint
      particleColors[i * 3] = mixCol.r
      particleColors[i * 3 + 1] = mixCol.g
      particleColors[i * 3 + 2] = mixCol.b
    }

    particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3))
    particleGeo.setAttribute('color', new THREE.BufferAttribute(particleColors, 3))

    const particleMat = new THREE.PointsMaterial({
      size: 0.06,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
    })
    const particleSystem = new THREE.Points(particleGeo, particleMat)
    scene.add(particleSystem)

    // -------------------------------------------------------------
    // Interactive mouse / parallax motion
    // -------------------------------------------------------------
    let mouseX = 0
    let mouseY = 0
    let targetX = 0
    let targetY = 0

    const onMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect()
      mouseX = ((e.clientX - rect.left) / rect.width - 0.5) * 2
      mouseY = -((e.clientY - rect.top) / rect.height - 0.5) * 2
    }
    window.addEventListener('mousemove', onMouseMove)

    // Resize handling
    const onResize = () => {
      if (!container) return
      const width = container.clientWidth
      const height = container.clientHeight
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      renderer.setSize(width, height)
    }
    const resizeObserver = new ResizeObserver(onResize)
    resizeObserver.observe(container)

    // Animation Loop
    let animId = 0
    let clock = new THREE.Clock()

    const animate = () => {
      animId = requestAnimationFrame(animate)
      const elapsedTime = clock.getElapsedTime()

      // Smooth camera parallax
      targetX += (mouseX * 0.45 - targetX) * 0.05
      targetY += (mouseY * 0.3 - targetY) * 0.05
      camera.position.x = targetX
      camera.position.y = 1.2 + targetY
      camera.lookAt(0, 0, 0)

      // Aerodynamic train breathing & levitation vibration
      trainGroup.position.y = -0.2 + Math.sin(elapsedTime * 2.5) * 0.035
      trainGroup.rotation.z = Math.sin(elapsedTime * 1.8) * 0.012

      // Pulse rail energy
      emeraldGlow.intensity = 2.2 + Math.sin(elapsedTime * 4) * 0.8

      // High-speed data particle flow
      const positions = particleGeo.attributes.position.array as Float32Array
      for (let i = 0; i < particleCount; i++) {
        // Move backwards along X to simulate forward speed
        positions[i * 3] -= 0.085
        if (positions[i * 3] < -7) {
          positions[i * 3] = 7
          positions[i * 3 + 1] = (Math.random() - 0.5) * 4.5
          positions[i * 3 + 2] = (Math.random() - 0.5) * 5
        }
      }
      particleGeo.attributes.position.needsUpdate = true

      renderer.render(scene, camera)
    }

    animate()

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('mousemove', onMouseMove)
      resizeObserver.disconnect()
      renderer.dispose()
      scene.clear()
      if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement)
      }
    }
  }, [])

  return (
    <section className="relative min-h-[92vh] flex items-center justify-center overflow-hidden bg-gradient-to-b from-[#FAF8F3] via-[#FAF8F3] to-[#F2EFE8] pt-24 pb-16">
      {/* Three.js 3D Interactive Canvas */}
      <div
        ref={containerRef}
        className="absolute inset-0 z-0 pointer-events-none opacity-90"
        aria-hidden="true"
      />

      {/* Atmospheric ambient lighting & subtle grid */}
      <div className="absolute inset-0 bg-[radial-gradient(#D7B77B_1px,transparent_1px)] [background-size:36px_36px] opacity-[0.18] pointer-events-none" />

      {/* Floating Decorative Glow Orbs */}
      <div className="absolute top-1/4 left-10 w-96 h-96 rounded-full bg-[#07865C]/8 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-96 h-96 rounded-full bg-[#D7B77B]/12 blur-[140px] pointer-events-none" />

      {/* Foreground Content Container */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center pt-8">
        {/* Flagship Brand & Product Badge */}
        <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-white/80 backdrop-blur-md border border-[#D7B77B]/40 shadow-sm mb-6 animate-fade-in">
          <span className="w-2 h-2 rounded-full bg-[#07865C] animate-ping" />
          <span className="text-xs font-bold tracking-wider uppercase text-[#262626]">
            Flagship Brand: DISHA 8.2
          </span>
          <span className="text-gray-300">|</span>
          <span className="text-xs font-bold tracking-wide text-[#07865C]">
            Product: Agentic Pay
          </span>
        </div>

        {/* Primary Positioning Heading */}
        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-[#262626] max-w-4xl mx-auto leading-[1.08] mb-6">
          The Next Direction of{' '}
          <span className="bg-gradient-to-r from-[#07865C] via-[#099969] to-[#D7B77B] bg-clip-text text-transparent">
            Indian Payments.
          </span>
        </h1>

        {/* Signature Tagline */}
        <p className="text-xl sm:text-2xl font-semibold text-[#404040] max-w-2xl mx-auto mb-4 tracking-tight">
          Your Business, Entirely in Your Control.
        </p>

        {/* Subtitle / Value proposition */}
        <p className="text-base sm:text-lg text-[#525252] max-w-2xl mx-auto mb-8 font-normal leading-relaxed">
          Autonomous, zero-custody UPI payment orchestration that eliminates intermediary escrow,
          bypasses aggregator MDR, and deposits customer payments directly into your regulated bank account.
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
          <a
            href="#discover"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-2xl text-sm font-bold text-white bg-gradient-to-r from-[#07865C] to-[#0a9b6b] hover:from-[#065440] hover:to-[#08785c] shadow-lg shadow-[#07865C]/20 hover:shadow-xl hover:shadow-[#07865C]/30 transition-all"
          >
            <span>Discover DISHA 8.2</span>
            <ArrowRight className="w-4 h-4" />
          </a>

          <a
            href="#calculator"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-2xl text-sm font-bold text-[#262626] bg-white/90 hover:bg-white border border-[#DCE2E7] hover:border-[#D7B77B] shadow-sm hover:shadow transition-all"
          >
            <span>Calculate Merchant Savings</span>
            <TrendingUp className="w-4 h-4 text-[#07865C]" />
          </a>

          {/* Voiceover Narration Button */}
          <button
            onClick={onToggleAudio}
            className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl text-xs font-semibold border backdrop-blur-md transition-all ${
              isAudioPlaying
                ? 'bg-[#07865C]/15 border-[#07865C] text-[#07865C]'
                : 'bg-white/70 border-[#DCE2E7] text-[#525252] hover:border-[#D7B77B]'
            }`}
          >
            {isAudioPlaying ? (
              <>
                <Pause className="w-4 h-4 text-[#07865C]" />
                <span>Pause Voiceover</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 text-[#D7B77B]" />
                <span>Listen to Story (15s)</span>
              </>
            )}
          </button>
        </div>

        {/* Three Pillars Summary Card Strip */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl mx-auto text-left">
          <div className="p-4 rounded-2xl bg-white/80 backdrop-blur-md border border-[#D7B77B]/20 shadow-sm flex items-start gap-3">
            <div className="p-2 rounded-xl bg-[#07865C]/10 text-[#07865C] shrink-0 mt-0.5">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-[#262626]">
                Non-Custodial
              </h4>
              <p className="text-xs text-[#737373] mt-0.5">
                Zero wallet holding. Money moves strictly bank-to-bank via UPI rails.
              </p>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-white/80 backdrop-blur-md border border-[#D7B77B]/20 shadow-sm flex items-start gap-3">
            <div className="p-2 rounded-xl bg-[#D7B77B]/20 text-[#8F6E36] shrink-0 mt-0.5">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-[#262626]">
                Zero Intermediary MDR
              </h4>
              <p className="text-xs text-[#737373] mt-0.5">
                Retain up to 2.5% of your transaction revenue on eligible UPI payments.
              </p>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-white/80 backdrop-blur-md border border-[#D7B77B]/20 shadow-sm flex items-start gap-3">
            <div className="p-2 rounded-xl bg-[#07865C]/10 text-[#07865C] shrink-0 mt-0.5">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-[#262626]">
                Instant Settlement
              </h4>
              <p className="text-xs text-[#737373] mt-0.5">
                Eliminate T+3 settlement holds. Access working capital the second a customer pays.
              </p>
            </div>
          </div>
        </div>

        {/* Corporate Attribution Footnote */}
        <div className="mt-8">
          <span className="text-xs font-medium text-[#737373]">
            Powered by{' '}
            <span className="text-[#262626] font-semibold hover:underline cursor-pointer">
              Disha Nitish Technology
            </span>
          </span>
        </div>
      </div>
    </section>
  )
}
