'use client'

import { useTranslations } from 'next-intl'
import PilotTab from '../PilotTab'

// /member/pilot — Space Pilot score records and private photos.
// While Space Pilot is an admin-only beta, other members see a greyed "beta" card (PilotTab).
export default function MemberPilotPage() {
  const t = useTranslations('memberPilot')
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#05070C] via-[#0A0D12] to-[#0F131C] text-white">
      <header className="sticky top-0 z-50 border-b border-white/5 bg-[#0A0D12]/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <a href="/member" aria-label={t('back')} className="text-white/60 transition-colors hover:text-white">
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </a>
          <h1 className="text-lg font-medium" style={{ fontFamily: "'Good Times', 'Noto Sans TC', system-ui, sans-serif" }}>SPACE PILOT</h1>
          <span className="w-6" />
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-6 pb-16">
        <PilotTab />
      </main>
    </div>
  )
}
