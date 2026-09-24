'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { useTranslations } from 'next-intl'
import { type MemberDashboardData } from '@/lib/data/memberRedesignTypes'
import { MemberCardFlip } from './components/MemberCardFlip'
import { ActionGrid } from './components/ActionGrid'
import { UpcomingBookingCard } from './components/UpcomingBookingCard'
import { PastBookingsList } from './components/PastBookingsList'
import { BottomLinks } from './components/BottomLinks'

// ════════════════════════════════════════════════════════════════════════════
// MemberPageClient — Full Rebuild: Mobile-First Single Scroll
// Layout: Header → Flip Card → 2×2 Grid → Upcoming → Past → Footer
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
              你好，{profile.display_name ?? '會員'}
            </h1>
            <div className="w-6" /> {/* Spacer for center alignment */}
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="mx-auto max-w-7xl px-4 py-6">
        <div className="space-y-6">
          {/* Member Card */}
          <section>
            <MemberCardFlip
              profile={profile}
              flipped={cardFlipped}
              onFlip={() => setCardFlipped(!cardFlipped)}
            />
          </section>

          {/* 2×2 Action Grid */}
          <section>
            <ActionGrid profile={profile} />
          </section>

          {/* Upcoming Booking */}
          <section>
            <UpcomingBookingCard userId={profile.id} />
          </section>

          {/* Past Bookings */}
          <section>
            <PastBookingsList userId={profile.id} />
          </section>

          {/* Bottom Links */}
          <section>
            <BottomLinks />
          </section>
        </div>
      </div>
    </div>
  )
}
