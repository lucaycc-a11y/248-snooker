'use client'

import { motion } from 'framer-motion'
import { QRCodeSVG } from 'qrcode.react'
import { type MemberProfile } from '@/lib/data/memberRedesignTypes'
import { getTierName, getTierGradient } from '@/lib/member/tierHelpers'

// ════════════════════════════════════════════════════════════════════════════
// MemberCardFlip — Flippable card with tier-colored ring
// Front: Tier icon, name, points
// Back: QR code (profile.member_code) — exact same as current MemberCard.tsx
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
  const tierIcon = getTierIcon(profile.tier)

  return (
    <div className="perspective-1000 mx-auto w-full max-w-md">
      <motion.div
        className="relative h-56 w-full cursor-pointer"
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
          className="absolute inset-0 rounded-3xl p-[2px]"
          style={{
            backfaceVisibility: 'hidden',
            background: `linear-gradient(135deg, ${tierRingColors[0]}, ${tierRingColors[1]})`,
          }}
        >
          <div className="flex h-full w-full flex-col justify-between rounded-3xl bg-[#0F131C]/90 p-6 backdrop-blur-xl">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-white/40">248 Member</p>
                <h3 className="mt-1 text-2xl font-bold text-white">{profile.display_name ?? '會員'}</h3>
              </div>
              <div
                className="rounded-full px-3 py-1 text-xs text-white shadow-lg"
                style={{ background: tierGradient }}
              >
                {tierName}
              </div>
            </div>

            {/* Tier Icon + Points */}
            <div className="flex items-end justify-between">
              <div>
                <span className="text-5xl">{tierIcon}</span>
              </div>
              <div className="text-right">
                <p className="text-xs text-white/40">可用積分</p>
                <p className="font-code text-3xl text-white">{profile.points.toLocaleString()}</p>
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

function getTierIcon(tier: string): string {
  switch (tier) {
    case 'amateur':
      return '✨' // 新星會員 sparkle
    case 'century':
      return '🏆' // 鉑金會員 trophy
    case 'maximum':
      return '💎' // 鑽石會員 diamond
    default:
      return '✨'
  }
}
