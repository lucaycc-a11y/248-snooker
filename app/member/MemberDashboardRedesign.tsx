'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslations } from 'next-intl'
import {
  type MemberDashboardData,
  type MemberProfile,
  type UserCoupon,
  type PointsTransaction,
  type Notification,
} from '@/lib/data/memberRedesignTypes'
import { getTierColor, getTierName } from '@/lib/member/tierHelpers'
import { MemberCard } from './MemberCard'
import { TierRing } from './TierRing'
import { OfferCard } from './OfferCard'
import { BookingHistory } from './BookingHistory'
import { PointsHistory } from './PointsHistory'
import { InboxView } from './InboxView'
import { PersonalInfo } from './PersonalInfo'
import { SecuritySettings } from './SecuritySettings'
import { NotificationSettings } from './NotificationSettings'
import { HelpCenter } from './HelpCenter'

// ════════════════════════════════════════════════════════════════════════════
// MemberDashboardRedesign — P1-P7 Complete Implementation
// Navigation: Home | Rewards | Bookings | Inbox | Settings | Help
// ════════════════════════════════════════════════════════════════════════════

type Tab = 'home' | 'rewards' | 'bookings' | 'inbox' | 'settings' | 'help'

type Props = {
  initialData: MemberDashboardData
}

export function MemberDashboardRedesign({ initialData }: Props) {
  const t = useTranslations('member')
  const [activeTab, setActiveTab] = useState<Tab>('home')
  const [data, setData] = useState(initialData)
  const [cardFlipped, setCardFlipped] = useState(false)

  // Refresh data on tab change (optimistic UI)
  const refreshData = async () => {
    try {
      const res = await fetch('/api/member/dashboard-data')
      if (res.ok) {
        const newData = await res.json()
        setData(newData)
      }
    } catch {
      /* silent fail, use cached */
    }
  }

  useEffect(() => {
    refreshData()
  }, [activeTab])

  const { profile, coupons, points, notifications, birthday_perk_eligible } = data

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#05070C] via-[#0A0D12] to-[#0F131C]">
      {/* Navigation Bar */}
      <nav className="sticky top-0 z-50 border-b border-white/5 bg-[#0A0D12]/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-8">
            <span className="text-xl font-bold tracking-tight text-white">248 Snooker</span>
            <div className="hidden gap-1 md:flex">
              {(['home', 'rewards', 'bookings', 'inbox', 'settings', 'help'] as Tab[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`font-label relative px-4 py-2 text-sm transition-colors ${
                    activeTab === tab ? 'text-white' : 'text-white/50 hover:text-white/80'
                  }`}
                >
                  {t(`tabs.${tab}`)}
                  {activeTab === tab && (
                    <motion.div
                      layoutId="active-tab"
                      className="absolute inset-x-0 -bottom-3 h-0.5 bg-gradient-to-r from-transparent via-[#38BDF8] to-transparent"
                    />
                  )}
                  {tab === 'inbox' && profile.unread_notifications > 0 && (
                    <span className="font-code absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs text-white">
                      {profile.unread_notifications > 9 ? '9+' : profile.unread_notifications}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-4">
            {birthday_perk_eligible && (
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="font-label flex items-center gap-2 rounded-full bg-gradient-to-r from-amber-500/20 to-orange-500/20 px-3 py-1.5 text-xs text-amber-300"
              >
                <span className="text-lg">🎂</span>
                <span>{t('birthday_perk_active')}</span>
              </motion.div>
            )}
            <div className="flex items-center gap-2 rounded-full bg-white/5 px-3 py-1.5 backdrop-blur">
              <div className={`h-2 w-2 rounded-full ${getTierColor(profile.tier)}`} />
              <span className="text-sm font-medium text-white">{profile.tier_definition?.name_zh_hk ?? getTierName(profile.tier, 'zh-HK')}</span>
            </div>
          </div>
        </div>

        {/* Mobile Navigation */}
        <div className="flex gap-1 overflow-x-auto border-t border-white/5 px-4 py-2 md:hidden">
          {(['home', 'rewards', 'bookings', 'inbox', 'settings', 'help'] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`font-label relative shrink-0 px-3 py-1.5 text-sm transition-colors ${
                activeTab === tab ? 'text-white' : 'text-white/50'
              }`}
            >
              {t(`tabs.${tab}`)}
              {tab === 'inbox' && profile.unread_notifications > 0 && (
                <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-red-500" />
              )}
            </button>
          ))}
        </div>
      </nav>

      {/* Content */}
      <div className="mx-auto max-w-7xl px-4 py-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            {activeTab === 'home' && (
              <HomeView
                profile={profile}
                coupons={coupons}
                cardFlipped={cardFlipped}
                onFlipCard={() => setCardFlipped(!cardFlipped)}
                onRefresh={refreshData}
              />
            )}
            {activeTab === 'rewards' && (
              <RewardsView profile={profile} coupons={coupons} points={points} onRefresh={refreshData} />
            )}
            {activeTab === 'bookings' && <BookingHistory userId={profile.id} />}
            {activeTab === 'inbox' && <InboxView notifications={notifications} onRefresh={refreshData} />}
            {activeTab === 'settings' && <SettingsView profile={profile} onRefresh={refreshData} />}
            {activeTab === 'help' && <HelpCenter />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// § HOME VIEW (P1)
// ────────────────────────────────────────────────────────────────────────────

type HomeViewProps = {
  profile: MemberProfile
  coupons: MemberDashboardData['coupons']
  cardFlipped: boolean
  onFlipCard: () => void
  onRefresh: () => void
}

function HomeView({ profile, coupons, cardFlipped, onFlipCard, onRefresh }: HomeViewProps) {
  const t = useTranslations('member')

  return (
    <div className="space-y-8">
      {/* Member Card (P1: flip to show QR) */}
      <section>
        <MemberCard profile={profile} flipped={cardFlipped} onFlip={onFlipCard} />
      </section>

      {/* Quick Stats */}
      <section className="grid gap-4 md:grid-cols-3">
        <StatCard
          label={t('stats.available_points')}
          value={profile.points.toLocaleString()}
          icon="💎"
          color="from-cyan-500/20 to-blue-500/20"
        />
        <StatCard
          label={t('stats.current_tier')}
          value={getTierName(profile.tier, 'zh-HK')}
          icon="🏆"
          color="from-amber-500/20 to-orange-500/20"
        />
        <StatCard
          label={t('stats.available_coupons')}
          value={coupons.available.length.toString()}
          icon="🎁"
          color="from-green-500/20 to-emerald-500/20"
        />
      </section>

      {/* Active Coupons Preview */}
      {coupons.available.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-xl font-bold text-white">{t('home.active_coupons')}</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {coupons.available.slice(0, 2).map((coupon) => (
              <OfferCard key={coupon.id} offer={coupon} variant="compact" onRefresh={onRefresh} />
            ))}
          </div>
        </section>
      )}

      {/* Quick Actions */}
      <section className="grid gap-4 md:grid-cols-2">
        <QuickActionCard
          title={t('home.book_now')}
          description={t('home.book_now_desc')}
          icon="📅"
          href="/booking"
          color="from-blue-500/20 to-cyan-500/20"
        />
        <QuickActionCard
          title={t('home.view_rewards')}
          description={t('home.view_rewards_desc')}
          icon="🎁"
          onClick={() => {}}
          color="from-purple-500/20 to-pink-500/20"
        />
      </section>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// § REWARDS VIEW (P3)
// ────────────────────────────────────────────────────────────────────────────

type RewardsViewProps = {
  profile: MemberProfile
  coupons: MemberDashboardData['coupons']
  points: PointsTransaction[]
  onRefresh: () => void
}

function RewardsView({ profile, coupons, points, onRefresh }: RewardsViewProps) {
  const t = useTranslations('member')
  const [subTab, setSubTab] = useState<'overview' | 'catalog' | 'history'>('overview')

  return (
    <div className="space-y-8">
      {/* Tier Ring with Points Progress (P3) */}
      <section className="flex justify-center">
        <TierRing profile={profile} />
      </section>

      {/* Sub Navigation */}
      <div className="flex justify-center gap-2 border-b border-white/10 pb-2">
        {(['overview', 'catalog', 'history'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setSubTab(tab)}
            className={`font-label px-4 py-2 text-sm transition-colors ${
              subTab === tab ? 'text-white' : 'text-white/50 hover:text-white/80'
            }`}
          >
            {t(`rewards.${tab}`)}
          </button>
        ))}
      </div>

      {/* Content */}
      {subTab === 'overview' && (
        <div className="space-y-6">
          {coupons.available.length > 0 && (
            <section className="space-y-4">
              <h3 className="text-lg font-bold text-white">{t('rewards.available_coupons')}</h3>
              <div className="grid gap-4 md:grid-cols-2">
                {coupons.available.map((coupon) => (
                  <OfferCard key={coupon.id} offer={coupon} onRefresh={onRefresh} />
                ))}
              </div>
            </section>
          )}

          <section className="space-y-4">
            <h3 className="text-lg font-bold text-white">{t('rewards.recent_points')}</h3>
            <PointsHistory points={points.slice(0, 5)} />
          </section>
        </div>
      )}

      {subTab === 'catalog' && (
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-white">{t('rewards.points_shop')}</h3>
          {coupons.catalog.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {coupons.catalog.map((template) => (
                <OfferCard key={template.id} offer={template} variant="catalog" onRefresh={onRefresh} />
              ))}
            </div>
          ) : (
            <EmptyState message={t('rewards.no_catalog')} icon="🎁" />
          )}
        </div>
      )}

      {subTab === 'history' && (
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-white">{t('rewards.coupon_history')}</h3>
          {coupons.history.length > 0 ? (
            <div className="space-y-3">
              {coupons.history.map((coupon) => (
                <OfferCard key={coupon.id} offer={coupon} variant="history" onRefresh={onRefresh} />
              ))}
            </div>
          ) : (
            <EmptyState message={t('rewards.no_history')} icon="📜" />
          )}
        </div>
      )}
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// § SETTINGS VIEW (P5)
// ────────────────────────────────────────────────────────────────────────────

type SettingsViewProps = {
  profile: MemberProfile
  onRefresh: () => void
}

function SettingsView({ profile, onRefresh }: SettingsViewProps) {
  const t = useTranslations('member')
  const [subTab, setSubTab] = useState<'personal' | 'security' | 'notifications' | 'privacy'>('personal')

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-white">{t('settings.title')}</h2>

      {/* Sub Navigation */}
      <div className="flex gap-2 overflow-x-auto border-b border-white/10 pb-2">
        {(['personal', 'security', 'notifications', 'privacy'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setSubTab(tab)}
            className={`shrink-0 px-4 py-2 text-sm font-medium transition-colors ${
              subTab === tab ? 'text-white' : 'text-white/50 hover:text-white/80'
            }`}
          >
            {t(`settings.${tab}`)}
          </button>
        ))}
      </div>

      {/* Content */}
      {subTab === 'personal' && <PersonalInfo profile={profile} onRefresh={onRefresh} />}
      {subTab === 'security' && <SecuritySettings profile={profile} />}
      {subTab === 'notifications' && <NotificationSettings profile={profile} onRefresh={onRefresh} />}
      {subTab === 'privacy' && <PrivacySettings profile={profile} />}
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// § UTILITY COMPONENTS
// ────────────────────────────────────────────────────────────────────────────

function StatCard({ label, value, icon, color }: { label: string; value: string; icon: string; color: string }) {
  return (
    <div className={`rounded-2xl bg-gradient-to-br ${color} p-6 backdrop-blur-xl`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="font-label text-sm text-white/60">{label}</p>
          <p className="font-code mt-1 text-3xl text-white">{value}</p>
        </div>
        <span className="text-4xl">{icon}</span>
      </div>
    </div>
  )
}

function QuickActionCard({
  title,
  description,
  icon,
  href,
  onClick,
  color,
}: {
  title: string
  description: string
  icon: string
  href?: string
  onClick?: () => void
  color: string
}) {
  const content = (
    <div className={`group relative overflow-hidden rounded-2xl bg-gradient-to-br ${color} p-6 backdrop-blur-xl transition-all hover:scale-[1.02]`}>
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-bold text-white">{title}</h3>
          <p className="mt-1 text-sm text-white/60">{description}</p>
        </div>
        <span className="text-3xl transition-transform group-hover:scale-110">{icon}</span>
      </div>
    </div>
  )

  if (href) {
    return <a href={href}>{content}</a>
  }

  return <button onClick={onClick}>{content}</button>
}

function EmptyState({ message, icon }: { message: string; icon: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl bg-white/5 py-16 text-center backdrop-blur">
      <span className="text-6xl opacity-30">{icon}</span>
      <p className="mt-4 text-white/60">{message}</p>
    </div>
  )
}

function PrivacySettings({ profile }: { profile: MemberProfile }) {
  const t = useTranslations('member')
  return (
    <div className="space-y-4 rounded-2xl bg-white/5 p-6 backdrop-blur">
      <h3 className="text-lg font-bold text-white">{t('settings.privacy_title')}</h3>
      <p className="text-sm text-white/60">{t('settings.privacy_desc')}</p>
      <button className="rounded-full bg-red-500/20 px-6 py-2 text-sm font-medium text-red-300 transition-colors hover:bg-red-500/30">
        {t('settings.delete_account')}
      </button>
    </div>
  )
}
