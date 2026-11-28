import React, { useState, useEffect, useRef } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { ClerkProvider } from '@clerk/clerk-react'

import { Home } from './pages/Home'
import { About } from './pages/About'
import { HowItWorks } from './pages/HowItWorks'
import { PaymentSafety } from './pages/PaymentSafety'
import { Checkout } from './pages/Checkout'
import { Receipt } from './pages/Receipt'
import { MerchantPortal } from './pages/MerchantPortal'
import { AgentPortal } from './pages/AgentPortal'
import { OwnerDashboard } from './pages/OwnerDashboard'
import { CompareAndSave } from './pages/CompareAndSave'
import { Contact } from './pages/Contact'
import { Privacy } from './pages/Privacy'
import { Terms } from './pages/Terms'
import { CookiePreferences } from './pages/CookiePreferences'
import { Navbar } from './components/navigation/Navbar'
import { Footer } from './components/layout/Footer'

const CLERK_PUBLISHABLE_KEY = 'pk_live_Y2xlcmsudGhlbml0aXNoa3IuaW4k'

function App() {
  const [isAudioPlaying, setIsAudioPlaying] = useState(false)
  const synthRef = useRef<SpeechSynthesisUtterance | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)

  const handleToggleAudio = () => {
    if (!('speechSynthesis' in window)) {
      alert('Speech synthesis is not supported in this browser.')
      return
    }

    if (isAudioPlaying) {
      window.speechSynthesis.cancel()
      if (audioContextRef.current && audioContextRef.current.state === 'running') {
        audioContextRef.current.suspend()
      }
      setIsAudioPlaying(false)
    } else {
      window.speechSynthesis.cancel()

      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
        if (AudioCtx) {
          const ctx = audioContextRef.current || new AudioCtx()
          audioContextRef.current = ctx
          if (ctx.state === 'suspended') {
            ctx.resume()
          }
          const osc = ctx.createOscillator()
          const gain = ctx.createGain()
          osc.type = 'sine'
          osc.frequency.setValueAtTime(528, ctx.currentTime)
          osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.8)
          gain.gain.setValueAtTime(0.08, ctx.currentTime)
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2)
          osc.connect(gain)
          gain.connect(ctx.destination)
          osc.start()
          osc.stop(ctx.currentTime + 1.2)
        }
      } catch (e) {
        // Fallback
      }

      const narrationText =
        'For years, Indian businesses paid others to access their own money. ' +
        'DISHA 8.2 changes the direction. ' +
        'Agentic Pay brings payment operations directly into your control.'

      const utter = new SpeechSynthesisUtterance(narrationText)
      utter.rate = 0.95
      utter.pitch = 1.0

      const voices = window.speechSynthesis.getVoices()
      const indianVoice = voices.find(
        (v) => v.lang === 'en-IN' || v.name.includes('India') || v.name.includes('Indian')
      )
      if (indianVoice) {
        utter.voice = indianVoice
      }

      utter.onend = () => {
        setIsAudioPlaying(false)
      }
      utter.onerror = () => {
        setIsAudioPlaying(false)
      }

      synthRef.current = utter
      setIsAudioPlaying(true)
      window.speechSynthesis.speak(utter)
    }
  }

  useEffect(() => {
    return () => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel()
      }
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {})
      }
    }
  }, [])

  return (
    <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY}>
      <BrowserRouter>
        <div className="min-h-screen flex flex-col bg-[#FAF8F3] text-[#262626]">
          <Navbar isAudioPlaying={isAudioPlaying} onToggleAudio={handleToggleAudio} />
          <div className="flex-grow">
            <Routes>
              <Route
                path="/"
                element={
                  <Home
                    isAudioPlaying={isAudioPlaying}
                    onToggleAudio={handleToggleAudio}
                  />
                }
              />
              <Route path="/about" element={<About />} />
              <Route path="/why-disha" element={<About />} />
              <Route path="/how-it-works" element={<HowItWorks />} />
              <Route path="/payment-safety" element={<PaymentSafety />} />
              <Route path="/checkout" element={<Checkout />} />
              <Route path="/checkout/:orderId" element={<Checkout />} />
              <Route path="/receipt/:orderId" element={<Receipt />} />
              <Route path="/receipt" element={<Receipt />} />
              <Route path="/merchant-portal" element={<MerchantPortal />} />
              <Route path="/agent-portal" element={<AgentPortal />} />
              <Route path="/owner-dashboard" element={<OwnerDashboard />} />
              <Route path="/compare-and-save" element={<CompareAndSave />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="/cookie-preferences" element={<CookiePreferences />} />
            </Routes>
          </div>
          <Footer />
        </div>
      </BrowserRouter>
    </ClerkProvider>
  )
}

export default App
