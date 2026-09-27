'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Gem, Sparkles, Trophy, ChevronDown, Gift, ArrowLeft, History, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { resolveTier, DEFAULT_TIERS } from '@/lib/data/pricing'

// ════════════════════════════════════════════════════════════════════════════
// Space Pts Page — Premium redesign with glassmorphism and smooth animations
// ════════════════════════════════════════════════════════════════════════════

type MemberProfile = {
  points: number
  tier: string
}

type PointsTransaction = {
  id: string
  points: number
  description: string
  created_at: string
  balance_after: number
  category?: string
}

export default function PointsPage() {
  const t = useTranslations('member.points_page')
  const [profile, setProfile] = useState<MemberProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [benefitsExpanded, setBenefitsExpanded] = useState(false)
  const [showHistoryModal, setShowHistoryModal] = useState(false)
  const [transactions, setTransactions] = useState<PointsTransaction[]>([])

  useEffect(() => {
    loadProfile()
    loadTransactions()
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

  const loadTransactions = async () => {
    try {
      const res = await fetch('/api/member/points/transactions')
      if (res.ok) {
        const data = await res.json()
        setTransactions(data.transactions || [])
      }
    } catch {
      // Silent fail
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
  const tierRingColor = getTierRingColor(current.id)

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#05070C] via-[#0A0D12] to-[#0F131C]">
      {/* Header with glassmorphism */}
      <header className="sticky top-0 z-40 border-b border-white/5 bg-[#0A0D12]/80 backdrop-blur-xl">
        <div className="mx-auto max-w-3xl px-4 py-4">
          <div className="flex items-center justify-between">
            <a
              href="/member"
              className="flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:bg-white/10"
            >
              <ArrowLeft className="h-5 w-5 text-white/60" />
            </a>
            <h1 className="text-lg font-semibold text-white">{t('title')}</h1>
            <button
              onClick={() => setShowHistoryModal(true)}
              className="flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:bg-white/10"
            >
              <History className="h-5 w-5 text-white/60" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="mx-auto max-w-3xl px-4 pb-8 pt-8">
        {/* Points Display Card - Hero */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-white/10 via-white/5 to-transparent p-8 backdrop-blur-xl"
        >
          {/* Floating orbs background */}
          <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-purple-500/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-16 -left-16 h-64 w-64 rounded-full bg-blue-500/10 blur-3xl" />

          <div className="relative z-10">
            {/* Tier Badge */}
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 backdrop-blur-sm">
              {getTierIcon(current.id, 'h-5 w-5')}
              <span className="text-sm font-medium text-white">{getTierName(current.id, 'zh-HK')}</span>
            </div>

            {/* Points Display */}
            <div className="mb-2">
              <p className="text-sm font-medium uppercase tracking-wider text-white/50">
                {t('available_points')}
              </p>
              <h2 className="font-code mt-2 text-6xl font-bold tracking-tight text-white">
                {profile.points.toLocaleString()}
              </h2>
            </div>

            {/* Progress Bar */}
            {!isMaxTier && (
              <div className="mt-8">
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="text-white/60">{getTierName(current.id, 'zh-HK')}</span>
                  <span className="text-white/60">{getTierName(next!.id, 'zh-HK')}</span>
                </div>
                <div className="relative h-2 overflow-hidden rounded-full bg-white/10">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: tierRingColor }}
                    initial={{ width: 0 }}
                    animate={{ width: `${progress * 100}%` }}
                    transition={{ duration: 1, ease: [0.34, 1.56, 0.64, 1] }}
                  />
                </div>
                <p className="mt-2 text-sm text-white/50">
                  {t('points_to_next', {
                    points: pointsToNext.toLocaleString(),
                    tierName: getTierName(next!.id, 'zh-HK')
                  })}
                </p>
              </div>
            )}

            {isMaxTier && (
              <div className="mt-4 flex items-center gap-2 text-sm text-white/60">
                <Sparkles className="h-4 w-4" />
                <span>{t('max_tier_reached')}</span>
              </div>
            )}
          </div>
        </motion.div>

        {/* Tier Benefits Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mt-6"
        >
          <button
            onClick={() => setBenefitsExpanded(!benefitsExpanded)}
            className="w-full overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm transition-colors hover:bg-white/10"
          >
            <div className="flex items-center justify-between p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10">
                  <Gift className="h-5 w-5 text-white" />
                </div>
                <h3 className="text-base font-semibold text-white">{t('tier_benefits')}</h3>
              </div>
              <motion.div
                animate={{ rotate: benefitsExpanded ? 180 : 0 }}
                transition={{ duration: 0.3 }}
              >
                <ChevronDown className="h-5 w-5 text-white/60" />
              </motion.div>
            </div>
          </button>

          <AnimatePresence>
            {benefitsExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
                className="overflow-hidden"
              >
                <div className="mt-3 space-y-3">
                  {/* Nova tier */}
                  <div className="rounded-xl border border-white/10 bg-gradient-to-br from-blue-500/10 to-transparent p-4 backdrop-blur-sm">
                    <div className="mb-2 flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-blue-400" />
                      <h4 className="font-semibold text-white">{t('tier_nova')}</h4>
                    </div>
                    <p className="text-sm leading-relaxed text-white/70">{t('benefit_nova')}</p>
                  </div>

                  {/* Platinum tier */}
                  <div className="rounded-xl border border-white/10 bg-gradient-to-br from-gray-400/10 to-transparent p-4 backdrop-blur-sm">
                    <div className="mb-2 flex items-center gap-2">
                      <Trophy className="h-5 w-5 text-gray-300" />
                      <h4 className="font-semibold text-white">{t('tier_platinum')}</h4>
                    </div>
                    <p className="text-sm leading-relaxed text-white/70">{t('benefit_platinum')}</p>
                  </div>

                  {/* Diamond tier */}
                  <div className="rounded-xl border border-white/10 bg-gradient-to-br from-pink-500/10 to-transparent p-4 backdrop-blur-sm">
                    <div className="mb-2 flex items-center gap-2">
                      <Gem className="h-5 w-5 text-pink-400" />
                      <h4 className="font-semibold text-white">{t('tier_diamond')}</h4>
                    </div>
                    <p className="text-sm leading-relaxed text-white/70">{t('benefit_diamond')}</p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      {/* History Modal */}
      <AnimatePresence>
        {showHistoryModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm"
              onClick={() => setShowHistoryModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: '100%' }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed inset-x-0 bottom-0 z-50 max-h-[85vh] overflow-hidden rounded-t-3xl border-t border-white/10 bg-[#0A0D12] backdrop-blur-xl"
            >
              {/* Modal Header */}
              <div className="sticky top-0 z-10 border-b border-white/10 bg-[#0A0D12]/80 backdrop-blur-xl">
                <div className="flex items-center justify-between px-6 py-4">
                  <h2 className="text-lg font-semibold text-white">{t('history_button')}</h2>
                  <button
                    onClick={() => setShowHistoryModal(false)}
                    className="flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-white/10"
                  >
                    <X className="h-5 w-5 text-white/60" />
                  </button>
                </div>
              </div>

              {/* Modal Content */}
              <div className="overflow-y-auto p-6" style={{ maxHeight: 'calc(85vh - 64px)' }}>
                {transactions.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-white/5">
                      <History className="h-10 w-10 text-white/30" />
                    </div>
                    <p className="text-white/60">暫無積分記錄</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {transactions.map((tx, index) => (
                      <motion.div
                        key={tx.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm"
                      >
                        <div>
                          <p className="font-medium text-white">{tx.description}</p>
                          <p className="text-xs text-white/40">
                            {new Date(tx.created_at).toLocaleDateString('zh-HK', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className={`font-code text-lg font-semibold ${tx.points > 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {tx.points > 0 ? '+' : ''}{tx.points.toLocaleString()}
                          </p>
                          <p className="font-code text-xs text-white/40">
                            {tx.balance_after.toLocaleString()}
                          </p>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// § HELPERS
// ────────────────────────────────────────────────────────────────────────────

function getTierName(tier: string, locale: string): string {
  const names: Record<string, Record<string, string>> = {
    amateur: { 'zh-HK': '標準會員', en: 'Standard' },
    century: { 'zh-HK': '優越會員', en: 'Premier' },
    maximum: { 'zh-HK': '尊榮會員', en: 'Prestige' },
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

function getTierRingColor(tier: string): string {
  switch (tier) {
    case 'amateur':
      return 'linear-gradient(90deg, rgba(102, 126, 234, 0.8), rgba(118, 75, 162, 0.8))'
    case 'century':
      return 'linear-gradient(90deg, rgba(189, 195, 199, 0.8), rgba(149, 165, 166, 0.8))'
    case 'maximum':
      return 'linear-gradient(90deg, rgba(240, 147, 251, 0.8), rgba(245, 87, 108, 0.8))'
    default:
      return 'linear-gradient(90deg, rgba(107, 114, 128, 0.8), rgba(156, 163, 175, 0.8))'
  }
}
