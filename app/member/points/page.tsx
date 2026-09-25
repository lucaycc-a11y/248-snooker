'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Gem, Sparkles, Trophy, ChevronDown, Gift } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { resolveTier, DEFAULT_TIERS } from '@/lib/data/pricing'

// ════════════════════════════════════════════════════════════════════════════
// Space Pts Page — Starbucks Rewards inspired points center
// Header: Circular progress ring + points balance + tier status
// Content: White overlapping card, benefits list, point history (pending data source)
// Footer: Floating "兌換獎賞" button
// ════════════════════════════════════════════════════════════════════════════

type MemberProfile = {
  points: number
  tier: string
}

export default function PointsPage() {
  const t = useTranslations('member.points_page')
  const [profile, setProfile] = useState<MemberProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [benefitsExpanded, setBenefitsExpanded] = useState(false)
  const [showRewardsModal, setShowRewardsModal] = useState(false)

  useEffect(() => {
    loadProfile()
  }, [])

  const loadProfile = async () => {
    try {
      const res = await fetch('/api/member/profile')
      if (res.ok) {
        const data = await res.json()
        setProfile({
          points: data.points || 0,
          tier: data.tier || 'amateur',
        })
      }
    } catch {
      // Silent fail
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#05070C] via-[#0A0D12] to-[#0F131C]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#05070C] via-[#0A0D12] to-[#0F131C]">
        <p className="text-white/60">無法載入積分資料</p>
      </div>
    )
  }

  const { current, next, progress, pointsToNext } = resolveTier(profile.points, DEFAULT_TIERS)
  const isMaxTier = !next
  const tierGradient = getTierGradient(current.id)
  const tierRingColor = getTierRingColor(current.id)
  const tierBackgroundGradient = getTierBackgroundGradient(current.id)

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#05070C] via-[#0A0D12] to-[#0F131C]">
      {/* Dark Header with Circular Progress Ring */}
      <header className="relative overflow-hidden bg-gradient-to-br from-[#0A0D12] to-[#05070C] pb-24 pt-4">
        {/* Top bar */}
        <div className="relative z-10 mx-auto max-w-3xl px-4 py-2">
          <div className="flex items-center justify-between">
            <a href="/member" className="text-white/60 transition-colors hover:text-white">
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </a>
            <h1 className="text-lg font-semibold text-white">{t('title')}</h1>
            <button
              onClick={() => {/* TODO: Open point history modal */}}
              className="rounded-full bg-white/10 px-4 py-1.5 text-xs text-white/80 backdrop-blur-sm transition-colors hover:bg-white/20"
            >
              {t('history_button')}
            </button>
          </div>
        </div>

        {/* Circular Progress Ring + Points Balance */}
        <div className="relative z-10 mx-auto mt-6 flex flex-col items-center px-4">
          {/* Progress Ring */}
          <div className="relative">
            {!isMaxTier ? (
              <div className="relative h-36 w-36">
                <svg className="h-36 w-36 -rotate-90 transform">
                  <circle
                    cx="72"
                    cy="72"
                    r="64"
                    stroke="currentColor"
                    strokeWidth="6"
                    fill="none"
                    className="text-white/10"
                  />
                  <motion.circle
                    cx="72"
                    cy="72"
                    r="64"
                    stroke={tierRingColor}
                    strokeWidth="6"
                    fill="none"
                    strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 64}`}
                    initial={{ strokeDashoffset: 2 * Math.PI * 64 }}
                    animate={{ strokeDashoffset: 2 * Math.PI * 64 * (1 - progress) }}
                    transition={{
                      duration: 1.0,
                      ease: [0.34, 1.56, 0.64, 1],
                    }}
                  />
                </svg>
                {/* Tier icon centered */}
                <div className="absolute inset-0 flex items-center justify-center">
                  {getTierIcon(current.id, 'h-14 w-14')}
                </div>
              </div>
            ) : (
              <div className="relative h-36 w-36">
                <svg className="h-36 w-36 -rotate-90 transform">
                  <circle
                    cx="72"
                    cy="72"
                    r="64"
                    stroke={tierRingColor}
                    strokeWidth="6"
                    fill="none"
                    opacity="1"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  {getTierIcon(current.id, 'h-14 w-14')}
                </div>
              </div>
            )}
          </div>

          {/* Points Balance inside ring text */}
          <div className="mt-4 text-center">
            <p className="font-code text-5xl font-bold text-white">
              {profile.points.toLocaleString()}
            </p>
            <p className="mt-1 text-sm text-white/40">{t('available_points')}</p>
          </div>

          {/* Progress caption below ring */}
          {!isMaxTier ? (
            <p className="mt-3 text-sm text-white/60">
              {t('points_to_next', {
                points: pointsToNext.toLocaleString(),
                tierName: getTierName(next!.id, 'zh-HK')
              })}
            </p>
          ) : (
            <p className="mt-3 text-sm text-white/60">{t('max_tier_reached')}</p>
          )}
        </div>

        {/* Background watermark */}
        <div className="pointer-events-none absolute -bottom-10 -right-10 opacity-[0.02]">
          {getTierIcon(current.id, 'h-64 w-64')}
        </div>
      </header>

      {/* White Overlapping Card - Membership Status */}
      <div className="relative z-20 mx-auto -mt-16 max-w-3xl px-4">
        <div className="overflow-hidden rounded-2xl bg-white shadow-2xl">
          <div className="p-6">
            <p className="text-sm font-medium uppercase tracking-wide text-gray-500">{t('tier_status')}</p>
            <div className="mt-4 flex items-center gap-3">
              {getTierIcon(current.id, 'h-10 w-10 text-gray-800')}
              <div>
                <h2 className="text-2xl font-bold text-gray-900">{getTierName(current.id, 'zh-HK')}</h2>
                <p className="text-sm text-gray-600">
                  {t('points_count', { points: profile.points.toLocaleString() })}
                  {!isMaxTier && ` · ${t('points_to_next_short', { points: pointsToNext.toLocaleString() })}`}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Benefits Expandable Section */}
      <div className="relative z-10 mx-auto mt-8 max-w-3xl px-4 pb-32">
        <button
          onClick={() => setBenefitsExpanded(!benefitsExpanded)}
          className="w-full overflow-hidden rounded-2xl bg-white/5 backdrop-blur-sm transition-all hover:bg-white/8"
        >
          <div className="flex items-center justify-between p-5">
            <h3 className="text-base font-semibold text-white">{t('tier_benefits')}</h3>
            <motion.div
              animate={{ rotate: benefitsExpanded ? 180 : 0 }}
              transition={{ duration: 0.3 }}
            >
              <ChevronDown className="h-5 w-5 text-white/60" />
            </motion.div>
          </div>
        </button>

        {benefitsExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
            className="mt-3 space-y-3 overflow-hidden"
          >
            {/* Nova tier */}
            <div className="rounded-xl bg-white/5 p-4 backdrop-blur-sm">
              <div className="mb-2 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-blue-400" />
                <h4 className="text-sm font-semibold text-white">{t('tier_nova')}</h4>
              </div>
              <p className="text-sm text-white/60">{t('benefit_nova')}</p>
            </div>

            {/* Platinum tier */}
            <div className="rounded-xl bg-white/5 p-4 backdrop-blur-sm">
              <div className="mb-2 flex items-center gap-2">
                <Trophy className="h-4 w-4 text-gray-400" />
                <h4 className="text-sm font-semibold text-white">{t('tier_platinum')}</h4>
              </div>
              <p className="text-sm text-white/60">{t('benefit_platinum')}</p>
            </div>

            {/* Diamond tier */}
            <div className="rounded-xl bg-white/5 p-4 backdrop-blur-sm">
              <div className="mb-2 flex items-center gap-2">
                <Gem className="h-4 w-4 text-pink-400" />
                <h4 className="text-sm font-semibold text-white">{t('tier_diamond')}</h4>
              </div>
              <p className="text-sm text-white/60">{t('benefit_diamond')}</p>
            </div>
          </motion.div>
        )}
      </div>

      {/* Floating Redeem Button - always visible */}
      <div className="fixed bottom-8 right-8 z-50">
        <button
          onClick={() => setShowRewardsModal(true)}
          className="group flex items-center gap-2 rounded-full bg-gradient-to-r from-green-500 to-emerald-600 px-6 py-3.5 text-white shadow-2xl transition-all hover:scale-105 hover:shadow-green-500/50"
        >
          <Gift className="h-5 w-5" />
          <span className="font-semibold">{t('redeem_rewards')}</span>
        </button>
      </div>

      {/* Empty State Modal */}
      {showRewardsModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setShowRewardsModal(false)}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="mx-4 w-full max-w-md rounded-2xl bg-gradient-to-br from-[#0A0D12] to-[#05070C] p-8 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex justify-center">
              <Gift className="h-16 w-16 text-white/40" />
            </div>
            <h3 className="mb-2 text-xl font-bold text-white">{t('no_rewards_title')}</h3>
            <p className="mb-6 text-sm text-white/60">{t('no_rewards_message')}</p>
            <button
              onClick={() => setShowRewardsModal(false)}
              className="rounded-full bg-white/10 px-6 py-2 text-sm text-white transition-colors hover:bg-white/20"
            >
              {t('close')}
            </button>
          </motion.div>
        </div>
      )}
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// § HELPERS
// ────────────────────────────────────────────────────────────────────────────

function getTierName(tier: string, locale: string): string {
  const names: Record<string, Record<string, string>> = {
    amateur: { 'zh-HK': '新星會員', en: 'Nova' },
    century: { 'zh-HK': '鉑金會員', en: 'Platinum' },
    maximum: { 'zh-HK': '鑽石會員', en: 'Diamond' },
  }
  return names[tier]?.[locale] ?? tier
}

function getTierIcon(tier: string, sizeClass: string): JSX.Element {
  switch (tier) {
    case 'amateur':
      return <Sparkles className={`${sizeClass} text-white`} strokeWidth={1.5} />
    case 'century':
      return <Trophy className={`${sizeClass} text-white`} strokeWidth={1.5} />
    case 'maximum':
      return <Gem className={`${sizeClass} text-white`} strokeWidth={1.5} />
    default:
      return <Sparkles className={`${sizeClass} text-white`} strokeWidth={1.5} />
  }
}

function getTierGradient(tier: string): string {
  switch (tier) {
    case 'amateur':
      return 'linear-gradient(135deg, rgba(102, 126, 234, 0.8), rgba(118, 75, 162, 0.6))'
    case 'century':
      return 'linear-gradient(135deg, rgba(189, 195, 199, 0.8), rgba(44, 62, 80, 0.6))'
    case 'maximum':
      return 'linear-gradient(135deg, rgba(240, 147, 251, 0.8), rgba(245, 87, 108, 0.6))'
    default:
      return 'linear-gradient(135deg, rgba(107, 114, 128, 0.8), rgba(156, 163, 175, 0.6))'
  }
}

function getTierRingColor(tier: string): string {
  switch (tier) {
    case 'amateur':
      return 'rgba(102, 126, 234, 0.6)'
    case 'century':
      return 'rgba(189, 195, 199, 0.6)'
    case 'maximum':
      return 'rgba(240, 147, 251, 0.6)'
    default:
      return 'rgba(107, 114, 128, 0.6)'
  }
}

function getTierBackgroundGradient(tier: string): string {
  switch (tier) {
    case 'amateur':
      return 'linear-gradient(135deg, rgba(102, 126, 234, 0.12) 0%, rgba(118, 75, 162, 0.08) 50%, rgba(15, 19, 28, 0.95) 100%)'
    case 'century':
      return 'linear-gradient(135deg, rgba(189, 195, 199, 0.12) 0%, rgba(44, 62, 80, 0.08) 50%, rgba(15, 19, 28, 0.95) 100%)'
    case 'maximum':
      return 'linear-gradient(135deg, rgba(240, 147, 251, 0.15) 0%, rgba(245, 87, 108, 0.10) 50%, rgba(15, 19, 28, 0.95) 100%)'
    default:
      return 'linear-gradient(135deg, rgba(107, 114, 128, 0.08) 0%, rgba(15, 19, 28, 0.95) 100%)'
  }
}
