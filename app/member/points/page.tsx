'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Gem, Sparkles, Trophy } from 'lucide-react'
import { resolveTier, DEFAULT_TIERS } from '@/lib/data/pricing'

// ════════════════════════════════════════════════════════════════════════════
// Space Pts Page — Points detail view with tier benefits and progress
// Shows: large balance, progress ring, tier benefits, points history (if tracked)
// ════════════════════════════════════════════════════════════════════════════

type MemberProfile = {
  points: number
  tier: string
}

export default function PointsPage() {
  const [profile, setProfile] = useState<MemberProfile | null>(null)
  const [loading, setLoading] = useState(true)

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#05070C] via-[#0A0D12] to-[#0F131C]">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-white/5 bg-[#0A0D12]/80 backdrop-blur-xl">
        <div className="mx-auto max-w-3xl px-4 py-4">
          <div className="flex items-center justify-between">
            <a href="/member" className="text-white/60 transition-colors hover:text-white">
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </a>
            <h1 className="text-lg font-medium text-white">Space Pts</h1>
            <div className="w-6" />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="space-y-8">
          {/* Hero: Large points balance with progress ring */}
          <section className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-transparent p-8">
            <div className="flex flex-col items-center">
              {/* Larger progress ring */}
              <div className="relative">
                {!isMaxTier ? (
                  <div className="relative h-40 w-40">
                    <svg className="h-40 w-40 -rotate-90 transform">
                      <circle
                        cx="80"
                        cy="80"
                        r="68"
                        stroke="currentColor"
                        strokeWidth="8"
                        fill="none"
                        className="text-white/10"
                      />
                      <motion.circle
                        cx="80"
                        cy="80"
                        r="68"
                        stroke={tierRingColor}
                        strokeWidth="8"
                        fill="none"
                        strokeLinecap="round"
                        strokeDasharray={`${2 * Math.PI * 68}`}
                        initial={{ strokeDashoffset: 2 * Math.PI * 68 }}
                        animate={{ strokeDashoffset: 2 * Math.PI * 68 * (1 - progress) }}
                        transition={{
                          duration: 1.0,
                          ease: [0.34, 1.56, 0.64, 1],
                        }}
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      {getTierIcon(current.id, 'h-16 w-16')}
                    </div>
                  </div>
                ) : (
                  <div className="relative h-40 w-40">
                    <svg className="h-40 w-40 -rotate-90 transform">
                      <circle
                        cx="80"
                        cy="80"
                        r="68"
                        stroke={tierRingColor}
                        strokeWidth="8"
                        fill="none"
                        opacity="0.3"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      {getTierIcon(current.id, 'h-16 w-16')}
                    </div>
                  </div>
                )}
              </div>

              {/* Points balance */}
              <p className="mt-6 text-sm text-white/40">可用積分</p>
              <p className="font-code mt-2 text-5xl font-bold text-white">
                {profile.points.toLocaleString()}
              </p>

              {/* Progress caption */}
              {!isMaxTier ? (
                <p className="mt-3 text-sm text-white/60">
                  距離下一等級尚差 {pointsToNext.toLocaleString()} 積分
                </p>
              ) : (
                <p className="mt-3 text-sm text-white/60">已達最高等級 · 尊享特級禮遇</p>
              )}
            </div>
          </section>

          {/* Tier Benefits */}
          <section>
            <h2 className="mb-4 text-xl font-bold text-white">會員等級</h2>
            <div className="space-y-3">
              <TierCard
                tier="amateur"
                name="新星會員"
                threshold="0 積分"
                benefits="基礎積分累積"
                isCurrent={current.id === 'amateur'}
              />
              <TierCard
                tier="century"
                name="鉑金會員"
                threshold="800 積分"
                benefits="1.5倍積分倍率"
                isCurrent={current.id === 'century'}
              />
              <TierCard
                tier="maximum"
                name="鑽石會員"
                threshold="6,000 積分"
                benefits="2倍積分倍率 · 專屬優惠"
                isCurrent={current.id === 'maximum'}
              />
            </div>
          </section>

          {/* Points History Section - OMITTED as per spec */}
          {/* Only build if investigation confirms points transactions are tracked in DB */}
        </div>
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// § TIER CARD
// ────────────────────────────────────────────────────────────────────────────

type TierCardProps = {
  tier: string
  name: string
  threshold: string
  benefits: string
  isCurrent: boolean
}

function TierCard({ tier, name, threshold, benefits, isCurrent }: TierCardProps) {
  const gradient = getTierGradient(tier)

  return (
    <div
      className={`rounded-xl border p-4 transition-all ${
        isCurrent
          ? 'border-white/30 bg-gradient-to-br from-white/10 to-transparent'
          : 'border-white/10 bg-gradient-to-br from-white/5 to-transparent'
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {getTierIcon(tier, 'h-8 w-8')}
          <div>
            <div className="flex items-center gap-2">
              <p className="font-bold text-white">{name}</p>
              {isCurrent && (
                <div className="rounded-full bg-[#22c55e] px-2 py-0.5 text-xs font-bold text-white">
                  當前等級
                </div>
              )}
            </div>
            <p className="text-xs text-white/40">{threshold}</p>
          </div>
        </div>
        <div
          className="rounded-full px-3 py-1 text-xs text-white"
          style={{ background: gradient }}
        >
          {benefits}
        </div>
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// § HELPERS
// ────────────────────────────────────────────────────────────────────────────

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
