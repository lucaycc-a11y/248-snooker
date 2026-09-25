'use client'

import { motion } from 'framer-motion'
import { QRCodeSVG } from 'qrcode.react'
import { Sparkles, Trophy, Gem } from 'lucide-react'
import { type MemberProfile } from '@/lib/data/memberRedesignTypes'
import { getTierName, getTierGradient } from '@/lib/member/tierHelpers'
import { resolveTier, DEFAULT_TIERS } from '@/lib/data/pricing'

// ════════════════════════════════════════════════════════════════════════════
// MemberCardFlip — Flippable card with Starbucks-style circular progress
// Front: Tier icon, name, points with circular progress to next tier
// Back: QR code (profile.member_code)
// ════════════════════════════════════════════════════════════════════════════

type Props = {
  profile: MemberProfile
  flipped: boolean
  onFlip: () => void
}

export function MemberCardFlip({ profile, flipped, onFlip }: Props) {
  const tierName = getTierName(profile.tier, 'zh-HK')
  const tierGradient = getTierGradient(profile.tier)
  const tierRingColors = getTierRingColorPair(profile.tier)
  const tierBackgroundGradient = getTierBackgroundGradient(profile.tier)

  // Calculate real progress to next tier using actual DB thresholds
  const { current, next, progress, pointsToNext } = resolveTier(profile.points, DEFAULT_TIERS)
  const isMaxTier = !next

  return (
    <div className="perspective-1000 mx-auto w-full max-w-md">
      <motion.div
        className="relative h-64 w-full cursor-pointer"
        onClick={onFlip}
        animate={{ rotateY: flipped ? 180 : 0 }}
        transition={{
          duration: 0.6,
          ease: [0.34, 1.56, 0.64, 1], // bounce/pop easing per project convention
        }}
        style={{ transformStyle: 'preserve-3d' }}
      >
        {/* Front */}
        <div
          className="absolute inset-0 overflow-hidden rounded-3xl border border-white/10"
          style={{ backfaceVisibility: 'hidden' }}
        >
          {/* Tier-based gradient background */}
          <div
            className="absolute inset-0"
            style={{
              background: tierBackgroundGradient,
            }}
          />

          {/* Watermark tier icon - large, subtle, bottom-right */}
          <div className="pointer-events-none absolute -bottom-6 -right-6 opacity-[0.04]">
            {getTierIconComponent(profile.tier, 'h-32 w-32')}
          </div>

          {/* Content overlay */}
          <div className="relative flex h-full w-full flex-col justify-between p-6">
            {/* Top row: SPACE8 logo + tier pill */}
            <div className="flex items-start justify-between">
              <div className="h-7 w-7 opacity-50">
                <svg viewBox="0 0 1000 1000" fill="currentColor" className="text-white">
                  <path d="M391.31,786.11c-94.11,0-155.08-68.48-155.08-173.16,0-66.9,31.81-112.55,75.55-129.08-35.79-13.38-66.27-49.59-66.27-122,0-97.6,61.63-147.97,155.08-147.97h198.81c93.44,0,155.74,50.37,155.74,147.97,0,72.41-31.15,108.62-66.93,122,43.74,16.53,75.55,62.18,75.55,129.08,0,104.68-60.97,173.16-155.08,173.16h-217.37ZM394.63,537.39c-47.05,0-73.56,26.76-73.56,73.99,0,49.59,37.77,74.77,90.79,74.77h176.28c53.02,0,90.79-25.19,90.79-74.77s-26.51-73.99-73.56-73.99h-210.74ZM416.5,313.07c-55.01,0-86.15,18.1-86.15,70.84,0,49.59,22.53,69.26,70.25,69.26h198.81c47.72,0,70.25-19.68,70.25-69.26,0-52.74-31.15-70.84-86.15-70.84h-167Z"/>
                </svg>
              </div>
              <div
                className="rounded-full px-3.5 py-1.5 text-xs font-semibold text-white backdrop-blur-sm"
                style={{ background: tierGradient }}
              >
                {tierName}
              </div>
            </div>

            {/* Member identity row - improved hierarchy */}
            <div className="flex-1 space-y-1">
              <p className="text-[10px] font-medium uppercase tracking-wider text-white/30">248 Member</p>
              <h3 className="text-3xl font-bold leading-tight text-white">{profile.display_name ?? '會員'}</h3>
            </div>

            {/* Points hero row: ring on left, points number on right */}
            <div className="flex items-end justify-between gap-4">
              {/* Circular Progress Ring with tier icon centered inside */}
              {!isMaxTier ? (
                <div className="relative h-20 w-20 flex-shrink-0">
                  <svg className="h-20 w-20 -rotate-90 transform">
                    {/* Background ring */}
                    <circle
                      cx="40"
                      cy="40"
                      r="34"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                      className="text-white/10"
                    />
                    {/* Progress ring - uses tier gradient color */}
                    <motion.circle
                      cx="40"
                      cy="40"
                      r="34"
                      stroke={tierRingColors[0]}
                      strokeWidth="4"
                      fill="none"
                      strokeLinecap="round"
                      strokeDasharray={`${2 * Math.PI * 34}`}
                      initial={{ strokeDashoffset: 2 * Math.PI * 34 }}
                      animate={{ strokeDashoffset: 2 * Math.PI * 34 * (1 - progress) }}
                      transition={{
                        duration: 0.7,
                        ease: [0.34, 1.56, 0.64, 1], // bounce/pop easing
                      }}
                    />
                  </svg>
                  {/* Tier icon centered in ring */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    {getTierIconComponent(profile.tier, 'h-8 w-8')}
                  </div>
                </div>
              ) : (
                /* Max tier: solid fill ring with distinct treatment */
                <div className="relative h-20 w-20 flex-shrink-0">
                  <svg className="h-20 w-20 -rotate-90 transform">
                    <circle
                      cx="40"
                      cy="40"
                      r="34"
                      stroke={tierRingColors[0]}
                      strokeWidth="4"
                      fill="none"
                      opacity="0.3"
                    />
                  </svg>
                  {/* Tier icon centered in ring */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    {getTierIconComponent(profile.tier, 'h-8 w-8')}
                  </div>
                </div>
              )}

              {/* Points number and caption */}
              <div className="flex-1 text-right">
                <p className="text-xs text-white/40">可用積分</p>
                <p className="font-code text-3xl font-bold leading-tight text-white">
                  {profile.points.toLocaleString()}
                </p>
                {!isMaxTier ? (
                  <p className="mt-1 text-xs leading-tight text-white/50">
                    距離下一等級尚差 {pointsToNext.toLocaleString()} 積分
                  </p>
                ) : (
                  <p className="mt-1 text-xs leading-tight text-white/50">
                    已達最高等級 · 尊享特級禮遇
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Back (QR Code) — EXACT SAME AS CURRENT MemberCard.tsx */}
        <div
          className="absolute inset-0 rounded-3xl p-[2px]"
          style={{
            backfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
            background: `linear-gradient(135deg, ${tierRingColors[0]}, ${tierRingColors[1]})`,
          }}
        >
          <div className="flex h-full w-full flex-col items-center justify-center rounded-3xl bg-[#0F131C]/90 p-6 backdrop-blur-xl">
            <div className="rounded-2xl bg-white p-4">
              <QRCodeSVG value={profile.member_code} size={160} level="H" />
            </div>
            <p className="font-code mt-4 text-sm text-white">{profile.member_code}</p>
            <p className="mt-1 text-xs text-white/40">掃描入場</p>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// § HELPERS
// ────────────────────────────────────────────────────────────────────────────

function getTierRingColorPair(tier: string): [string, string] {
  switch (tier) {
    case 'amateur':
      return ['rgba(102, 126, 234, 0.6)', 'rgba(118, 75, 162, 0.4)']
    case 'century':
      return ['rgba(189, 195, 199, 0.6)', 'rgba(44, 62, 80, 0.4)']
    case 'maximum':
      return ['rgba(240, 147, 251, 0.6)', 'rgba(245, 87, 108, 0.4)']
    default:
      return ['rgba(107, 114, 128, 0.6)', 'rgba(156, 163, 175, 0.4)']
  }
}

function getTierIconComponent(tier: string, sizeClass: string = 'h-12 w-12'): JSX.Element {
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

function getTierBackgroundGradient(tier: string): string {
  switch (tier) {
    case 'amateur':
      // Subtle blue-purple gradient for 新星會員
      return 'linear-gradient(135deg, rgba(102, 126, 234, 0.12) 0%, rgba(118, 75, 162, 0.08) 50%, rgba(15, 19, 28, 0.95) 100%)'
    case 'century':
      // Subtle silver gradient for 鉑金會員
      return 'linear-gradient(135deg, rgba(189, 195, 199, 0.12) 0%, rgba(44, 62, 80, 0.08) 50%, rgba(15, 19, 28, 0.95) 100%)'
    case 'maximum':
      // Subtle pink-purple gradient for 鑽石會員
      return 'linear-gradient(135deg, rgba(240, 147, 251, 0.15) 0%, rgba(245, 87, 108, 0.10) 50%, rgba(15, 19, 28, 0.95) 100%)'
    default:
      return 'linear-gradient(135deg, rgba(107, 114, 128, 0.08) 0%, rgba(15, 19, 28, 0.95) 100%)'
  }
}
