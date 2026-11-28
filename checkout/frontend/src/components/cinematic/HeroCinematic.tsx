import React, { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { ArrowRight, Play, Pause, TrendingUp, ShieldCheck, Sparkles, Move3d } from 'lucide-react'

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

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(container.clientWidth, container.clientHeight)
    renderer.setClearColor(0x000000, 0)
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.15
    container.appendChild(renderer.domElement)

    // Scene & Perspective Camera
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(
      38,
      container.clientWidth / container.clientHeight,
      0.1,
      100
    )
    camera.position.set(0, 1.8, 6.8)

    // -------------------------------------------------------------
    // Cinematic Lighting — Warm Indian Golden Hour & Emerald Glow
    // -------------------------------------------------------------
    const ambientLight = new THREE.AmbientLight(0xfff5ea, 1.6)
    scene.add(ambientLight)

    const sunLight = new THREE.DirectionalLight(0xffdfa8, 3.2)
    sunLight.position.set(7, 9, 6)
    sunLight.castShadow = true
    scene.add(sunLight)

    const rimLight = new THREE.DirectionalLight(0xb5f5d8, 1.8)
    rimLight.position.set(-6, 3, -4)
    scene.add(rimLight)

    const emeraldGlow = new THREE.PointLight(0x07865c, 3.5, 14)
    emeraldGlow.position.set(0, -0.4, 2.5)
    scene.add(emeraldGlow)

    // -------------------------------------------------------------
    // DISHA 8.2 Precision High-Speed Train
    // Champagne Gold (#D7B77B) & Brushed Titanium (#DCE2E7)
    // -------------------------------------------------------------
    const trainGroup = new THREE.Group()

    // Materials
    const goldMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xd7b77b,
      metalness: 0.88,
      roughness: 0.22,
      clearcoat: 0.6,
      clearcoatRoughness: 0.15,
      reflectivity: 0.9,
    })

    const titaniumMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xdce2e7,
      metalness: 0.92,
      roughness: 0.2,
      clearcoat: 0.4,
    })

    const glassMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x1f2937,
      metalness: 0.95,
      roughness: 0.08,
      transmission: 0.7,
      thickness: 0.5,
      transparent: true,
      opacity: 0.9,
    })

    const emeraldEmissive = new THREE.MeshStandardMaterial({
      color: 0xb5f5d8,
      emissive: 0x07865c,
      emissiveIntensity: 2.8,
      roughness: 0.1,
    })

    // 1. Sleek Streamlined Fuselage
    const mainBodyGeo = new THREE.CylinderGeometry(0.65, 0.72, 4.8, 48, 1, false, 0, Math.PI)
    mainBodyGeo.rotateZ(Math.PI / 2)
    const mainBody = new THREE.Mesh(mainBodyGeo, titaniumMaterial)
    mainBody.position.set(-0.3, 0.18, 0)
    mainBody.castShadow = true
    trainGroup.add(mainBody)

    // 2. Aerodynamic Bullet Nose (Champagne Gold)
    const noseGeo = new THREE.ConeGeometry(0.65, 2.2, 48, 1, false, 0, Math.PI)
    noseGeo.rotateZ(-Math.PI / 2)
    const nose = new THREE.Mesh(noseGeo, goldMaterial)
    nose.position.set(2.8, 0.18, 0)
    nose.castShadow = true
    trainGroup.add(nose)

    // 3. Panoramic Aerodynamic Windscreen
    const windshieldGeo = new THREE.CylinderGeometry(0.63, 0.64, 1.2, 24, 1, false, 0, Math.PI)
    windshieldGeo.rotateZ(Math.PI / 2)
    const windshield = new THREE.Mesh(windshieldGeo, glassMaterial)
    windshield.position.set(1.9, 0.32, 0)
    trainGroup.add(windshield)

    // 4. Lateral Emerald Energy Illumination Rails
    const railStripeGeo = new THREE.BoxGeometry(5.2, 0.045, 0.04)
    const leftStripe = new THREE.Mesh(railStripeGeo, emeraldEmissive)
    leftStripe.position.set(0.4, 0.16, 0.68)
    trainGroup.add(leftStripe)

    const rightStripe = new THREE.Mesh(railStripeGeo, emeraldEmissive)
    rightStripe.position.set(0.4, 0.16, -0.68)
    trainGroup.add(rightStripe)

    // 5. Roof Aero Fairing & Metallic Crown
    const fairingGeo = new THREE.BoxGeometry(3.6, 0.12, 0.45)
    const fairing = new THREE.Mesh(fairingGeo, goldMaterial)
    fairing.position.set(-0.2, 0.82, 0)
    trainGroup.add(fairing)

    trainGroup.position.set(0, -0.35, 0)
    scene.add(trainGroup)

    // -------------------------------------------------------------
    // Elevated Payment Tracks (Polished Gold Rails & Ties)
    // -------------------------------------------------------------
    const tracksGroup = new THREE.Group()

    const trackRailGeo = new THREE.CylinderGeometry(0.04, 0.04, 16, 16)
    trackRailGeo.rotateZ(Math.PI / 2)
    const trackRailMat = new THREE.MeshStandardMaterial({
      color: 0xd7b77b,
      metalness: 0.9,
      roughness: 0.25,
      emissive: 0x473919,
      emissiveIntensity: 0.2,
    })

    const trackLeft = new THREE.Mesh(trackRailGeo, trackRailMat)
    trackLeft.position.set(0, -0.88, 0.62)
    tracksGroup.add(trackLeft)

    const trackRight = new THREE.Mesh(trackRailGeo, trackRailMat)
    trackRight.position.set(0, -0.88, -0.62)
    tracksGroup.add(trackRight)

    // Magnetic Ties
    const crossTieGeo = new THREE.BoxGeometry(0.14, 0.06, 1.65)
    const crossTieMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      metalness: 0.6,
      roughness: 0.5,
    })
    for (let x = -8; x <= 8; x += 0.8) {
      const tie = new THREE.Mesh(crossTieGeo, crossTieMat)
      tie.position.set(x, -0.92, 0)
      tracksGroup.add(tie)
    }

    scene.add(tracksGroup)

    // -------------------------------------------------------------
    // High-Speed Payment Data Streams & Shimmering Dust
    // -------------------------------------------------------------
    const particleCount = 260
    const particleGeo = new THREE.BufferGeometry()
    const pCoords = new Float32Array(particleCount * 3)
    const pColors = new Float32Array(particleCount * 3)

    const goldCol = new THREE.Color(0xd7b77b)
    const emeraldCol = new THREE.Color(0x07865c)
    const mintCol = new THREE.Color(0xb5f5d8)

    for (let i = 0; i < particleCount; i++) {
      pCoords[i * 3] = (Math.random() - 0.5) * 16
      pCoords[i * 3 + 1] = (Math.random() - 0.5) * 4
      pCoords[i * 3 + 2] = (Math.random() - 0.5) * 4.5

      const c = Math.random() < 0.45 ? emeraldCol : Math.random() < 0.8 ? goldCol : mintCol
      pColors[i * 3] = c.r
      pColors[i * 3 + 1] = c.g
      pColors[i * 3 + 2] = c.b
    }

    particleGeo.setAttribute('position', new THREE.BufferAttribute(pCoords, 3))
    particleGeo.setAttribute('color', new THREE.BufferAttribute(pColors, 3))

    const particleMat = new THREE.PointsMaterial({
      size: 0.06,
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
    })
    const particleStream = new THREE.Points(particleGeo, particleMat)
    scene.add(particleStream)

    // -------------------------------------------------------------
    // Smooth Interactive Mouse Rotation & Inertia
    // -------------------------------------------------------------
    let mouseX = 0
    let mouseY = 0
    let targetRotY = 0
    let targetRotX = 0

    const onPointerMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect()
      mouseX = ((e.clientX - rect.left) / rect.width - 0.5) * 2
      mouseY = -((e.clientY - rect.top) / rect.height - 0.5) * 2
    }
    container.addEventListener('mousemove', onPointerMove)

    const onResize = () => {
      if (!container) return
      camera.aspect = container.clientWidth / container.clientHeight
      camera.updateProjectionMatrix()
      renderer.setSize(container.clientWidth, container.clientHeight)
    }
    const observer = new ResizeObserver(onResize)
    observer.observe(container)

    // Animation Loop
    let animId = 0
    const clock = new THREE.Clock()

    const animate = () => {
      animId = requestAnimationFrame(animate)
      const t = clock.getElapsedTime()

      // Interactive subtle damping
      targetRotY += (mouseX * 0.45 - targetRotY) * 0.05
      targetRotX += (mouseY * 0.2 - targetRotX) * 0.05

      trainGroup.rotation.y = targetRotY * 0.6
      trainGroup.rotation.x = -targetRotX * 0.4
      trainGroup.position.y = -0.35 + Math.sin(t * 2.2) * 0.03

      // Pulse emerald energy
      emeraldGlow.intensity = 2.8 + Math.sin(t * 3.5) * 1.0

      // High-speed particle propulsion
      const pos = particleGeo.attributes.position.array as Float32Array
      for (let i = 0; i < particleCount; i++) {
        pos[i * 3] -= 0.09
        if (pos[i * 3] < -8) {
          pos[i * 3] = 8
          pos[i * 3 + 1] = (Math.random() - 0.5) * 4
          pos[i * 3 + 2] = (Math.random() - 0.5) * 4.5
        }
      }
      particleGeo.attributes.position.needsUpdate = true

      renderer.render(scene, camera)
    }

    animate()

    return () => {
      cancelAnimationFrame(animId)
      container.removeEventListener('mousemove', onPointerMove)
      observer.disconnect()
      renderer.dispose()
      scene.clear()
      if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement)
      }
    }
  }, [])

  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-[#FDF9F2] via-[#FAF6EE] to-[#F1F8F4] pt-28 pb-20 border-b border-[#D7B77B]/20">
      {/* Rich Multi-Layer Cinematic Background Gradient & Ambient Glows */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(215,183,123,0.24)_0%,transparent_60%)] pointer-events-none" />
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[720px] h-[720px] bg-gradient-to-tr from-[#07865C]/10 via-[#D7B77B]/15 to-transparent rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute -bottom-10 left-10 w-96 h-96 bg-[#07865C]/8 rounded-full blur-[100px] pointer-events-none" />

      {/* Main Foreground Container */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        {/* Brand & Product Pill (NO PROD BADGE) */}
        <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-white/90 backdrop-blur-md border border-[#D7B77B]/40 shadow-sm mb-6 animate-fade-in">
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
        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight text-[#262626] max-w-4xl mx-auto leading-[1.08] mb-6">
          The Next Direction of{' '}
          <span className="bg-gradient-to-r from-[#07865C] via-[#099969] to-[#D7B77B] bg-clip-text text-transparent">
            Indian Payments.
          </span>
        </h1>

        {/* Signature Tagline */}
        <p className="text-xl sm:text-2xl font-bold text-[#333333] max-w-2xl mx-auto mb-4 tracking-tight">
          Your Business, Entirely in Your Control.
        </p>

        {/* Professional Business Description (NO ENGINEERING JARGON) */}
        <p className="text-base sm:text-lg text-[#525252] max-w-2xl mx-auto mb-8 font-normal leading-relaxed">
          Autonomous, zero-custody UPI payment orchestration that eliminates intermediary escrow,
          bypasses aggregator fee deductions, and deposits customer payments directly into your registered bank account.
        </p>

        {/* Primary Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-10">
          <a
            href="#discover"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-2xl text-sm font-bold text-white bg-gradient-to-r from-[#07865C] to-[#0a9b6b] hover:from-[#065440] hover:to-[#08785c] shadow-lg shadow-[#07865C]/20 hover:shadow-xl hover:shadow-[#07865C]/30 transition-all"
          >
            <span>Discover DISHA 8.2</span>
            <ArrowRight className="w-4 h-4" />
          </a>

          <a
            href="#calculator"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-2xl text-sm font-bold text-[#262626] bg-white/95 hover:bg-white border border-[#DCE2E7] hover:border-[#D7B77B] shadow-sm hover:shadow transition-all"
          >
            <span>Calculate Merchant Savings</span>
            <TrendingUp className="w-4 h-4 text-[#07865C]" />
          </a>

          {/* Voiceover Narration Control */}
          <button
            onClick={onToggleAudio}
            className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl text-xs font-semibold border backdrop-blur-md transition-all ${
              isAudioPlaying
                ? 'bg-[#07865C]/15 border-[#07865C] text-[#07865C]'
                : 'bg-white/80 border-[#DCE2E7] text-[#525252] hover:border-[#D7B77B]'
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

        {/* ------------------------------------------------------------------ */}
        {/* DEDICATED CINEMATIC 3D WEBGL STAGE (NO OVERLAPPING TEXT)          */}
        {/* ------------------------------------------------------------------ */}
        <div className="relative max-w-5xl mx-auto rounded-3xl bg-gradient-to-b from-white/90 to-[#FAF6EE]/80 p-3 sm:p-5 border border-[#D7B77B]/40 shadow-2xl backdrop-blur-md">
          {/* Stage Top Bar */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-[#D7B77B]/20 mb-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#07865C] animate-pulse" />
              <span className="font-extrabold tracking-wider text-[#262626] uppercase">
                DISHA 8.2 Interactive 3D Rail Experience
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-[#8F6E36] font-semibold text-[11px]">
              <Move3d className="w-3.5 h-3.5" />
              <span>Drag or Move Cursor to Inspect 3D Model</span>
            </div>
          </div>

          {/* 3D WebGL Canvas Viewport */}
          <div
            ref={containerRef}
            className="w-full h-[360px] sm:h-[440px] rounded-2xl overflow-hidden cursor-grab active:cursor-grabbing relative"
            aria-label="DISHA 8.2 3D Train Simulation"
          >
            {!hasWebGL && (
              <div className="absolute inset-0 flex items-center justify-center bg-[#FAF8F3] text-sm text-[#737373]">
                3D WebGL Viewport (Hardware acceleration required)
              </div>
            )}
          </div>

          {/* Stage Bottom Features Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3 pt-3 border-t border-[#D7B77B]/20 text-left">
            <div className="px-3 py-2 rounded-xl bg-white/70 border border-[#DCE2E7] flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-[#07865C]/10 text-[#07865C]">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-[#262626]">Non-Custodial Architecture</div>
                <div className="text-[10px] text-[#737373]">Zero money held in transit</div>
              </div>
            </div>

            <div className="px-3 py-2 rounded-xl bg-white/70 border border-[#DCE2E7] flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-[#D7B77B]/20 text-[#8F6E36]">
                <TrendingUp className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-[#262626]">Zero Intermediary Fees</div>
                <div className="text-[10px] text-[#737373]">100% of customer payment retained</div>
              </div>
            </div>

            <div className="px-3 py-2 rounded-xl bg-white/70 border border-[#DCE2E7] flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-[#07865C]/10 text-[#07865C]">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-[#262626]">Immediate Settlement</div>
                <div className="text-[10px] text-[#737373]">T+0 direct bank credit</div>
              </div>
            </div>
          </div>
        </div>

        {/* Corporate Attribution Footnote */}
        <div className="mt-8">
          <span className="text-xs font-medium text-[#737373]">
            Powered by{' '}
            <span className="text-[#262626] font-bold">
              DishaNitish Technologies
            </span>
          </span>
        </div>
      </div>
    </section>
  )
}
