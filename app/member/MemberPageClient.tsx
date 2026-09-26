'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { useTranslations } from 'next-intl'
import dynamic from 'next/dynamic'
import { type MemberDashboardData } from '@/lib/data/memberRedesignTypes'
import { MemberCardFlipRedesign } from './components/MemberCardFlipRedesign'
import { HorizontalActionTiles } from './components/HorizontalActionTiles'

// Lazy load below-fold components
const UpcomingBookingCard = dynamic(
  () => import('./components/UpcomingBookingCard').then(mod => ({ default: mod.UpcomingBookingCard })),
  { ssr: false }
)
const PastBookingsList = dynamic(
  () => import('./components/PastBookingsList').then(mod => ({ default: mod.PastBookingsList })),
  { ssr: false }
)
const BottomLinks = dynamic(
  () => import('./components/BottomLinks').then(mod => ({ default: mod.BottomLinks })),
  { ssr: false }
)

// ════════════════════════════════════════════════════════════════════════════
// MemberPageClient — Uber-Style Horizontal Scrolling Layout
// Layout: Header → Member Card → Horizontal Action Tiles → Upcoming → Past → Footer
// Each section is independently scrollable horizontally (Uber app style)
// ════════════════════════════════════════════════════════════════════════════

type Props = {
  initialData: MemberDashboardData
}

export function MemberPageClient({ initialData }: Props) {
  const t = useTranslations('member')
  const [cardFlipped, setCardFlipped] = useState(false)
  const { profile } = initialData

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#05070C] via-[#0A0D12] to-[#0F131C]">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-white/5 bg-[#0A0D12]/80 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-4 py-4">
          <div className="flex items-center justify-between">
            <a
              href="/"
              className="text-white/60 transition-colors hover:text-white"
              aria-label="返回首頁"
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </a>
            <h1 className="text-lg font-medium text-white">
              {t('dashboard.greeting', { name: profile.display_name ?? '會員' })}
            </h1>
            <div className="w-6" /> {/* Spacer for center alignment */}
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="mx-auto max-w-7xl pb-8">
        <div className="space-y-6 sm:space-y-8">
          {/* Member Card */}
          <section className="px-4 pt-4 sm:pt-6">
            <MemberCardFlipRedesign
              profile={profile}
              flipped={cardFlipped}
              onFlip={() => setCardFlipped(!cardFlipped)}
            />
          </section>

          {/* Quick Actions */}
          <section>
            <div className="px-4 mb-3 sm:mb-4">
              <h2 className="text-sm font-medium uppercase tracking-wide text-white/60">{t('dashboard.quick_actions')}</h2>
            </div>
            <HorizontalActionTiles profile={profile} />
          </section>

          {/* Upcoming Booking */}
          <section>
            <div className="px-4 mb-3 sm:mb-4">
              <h2 className="text-sm font-medium uppercase tracking-wide text-white/60">{t('dashboard.upcoming')}</h2>
            </div>
            <div className="px-4">
              <UpcomingBookingCard userId={profile.id} />
            </div>
          </section>

          {/* Past Bookings */}
          <section>
            <div className="px-4 mb-3 sm:mb-4">
              <h2 className="text-sm font-medium uppercase tracking-wide text-white/60">{t('dashboard.history')}</h2>
            </div>
            <div className="px-4">
              <PastBookingsList userId={profile.id} />
            </div>
          </section>

          {/* Bottom Links - Account/Settings navigation */}
          <section className="px-4 pt-4 sm:pt-6">
            <BottomLinks />
          </section>
        </div>
      </div>
    </div>
  )
}
