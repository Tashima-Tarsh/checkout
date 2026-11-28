import React from 'react'
import { HeroCinematic } from '../components/cinematic/HeroCinematic'
import { MerchantBurden } from '../components/cinematic/MerchantBurden'
import { TrainArrival } from '../components/cinematic/TrainArrival'
import { FinancialTransformation } from '../components/cinematic/FinancialTransformation'
import { SavingsCalculator } from '../components/cinematic/SavingsCalculator'
import { DeviceShowcase } from '../components/cinematic/DeviceShowcase'
import { EmpoweredMarketplace } from '../components/cinematic/EmpoweredMarketplace'
import { TechPortfolio } from '../components/cinematic/TechPortfolio'
import { TrustAndModals } from '../components/cinematic/TrustAndModals'

interface HomeProps {
  isAudioPlaying: boolean
  onToggleAudio: () => void
}

export const Home: React.FC<HomeProps> = ({ isAudioPlaying, onToggleAudio }) => {
  return (
    <main className="w-full overflow-hidden bg-[#FAF8F3]">
      {/* 01. Opening Cinematic 3D Hero Scene with Bullet Train & Ambient Lighting */}
      <HeroCinematic isAudioPlaying={isAudioPlaying} onToggleAudio={onToggleAudio} />

      {/* 02. The Traditional Payment Burden (4 Indian Merchant Archetypes & Fee Breakdown) */}
      <MerchantBurden />

      {/* 03. The Arrival of DISHA 8.2 (High-Speed Elevated Rails & Dissolving Fee Statements) */}
      <TrainArrival />

      {/* 04. Financial Transformation (Traditional Aggregator Model vs Agentic Pay Direct Model) */}
      <FinancialTransformation />

      {/* 05. Interactive 3D Savings Calculator (Dynamic Golden Sphere + Lakhs/Crores Math) */}
      <SavingsCalculator />

      {/* 06. The Product Experience in Action (3D Workstation: Desktop, Tablet POS, Mobile) */}
      <DeviceShowcase />

      {/* 07. The Return to the Empowered Marketplace (Confidence, Clarity & Emerald Subterranean Rails) */}
      <EmpoweredMarketplace />

      {/* 08. Focused Technology Portfolio (DISHA 6.6, DISHA 7.2, DISHA 8.2) */}
      <TechPortfolio />

      {/* 09. Trust, Compliance & Legal Foundation (Non-Custodial Integrity & Interactive Modals) */}
      <TrustAndModals />
    </main>
  )
}
