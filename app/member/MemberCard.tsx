'use client'

import { motion } from 'framer-motion'
import { QRCodeSVG } from 'qrcode.react'
import { useTranslations } from 'next-intl'
import { type MemberProfile } from '@/lib/data/memberRedesignTypes'

// ════════════════════════════════════════════════════════════════════════════
// MemberCard — P1: Flippable card with front (profile) and back (QR)
// Design: Liquid glass surface with tier-colored accent ring
// ════════════════════════════════════════════════════════════════════════════

type Props = {
  profile: MemberProfile
  flipped: boolean
  onFlip: () => void
}

export function MemberCard({ profile, flipped, onFlip }: Props) {
  const t = useTranslations('member')

  const tierColor = getTierGradient(profile.tier_id)
  const tierRingColor = getTierRingColor(profile.tier_id)

  return (
    <div className="perspective-1000 mx-auto w-full max-w-md">
      <motion.div
        className="relative h-56 w-full cursor-pointer"
        onClick={onFlip}
        animate={{ rotateY: flipped ? 180 : 0 }}
        transition={{ duration: 0.6, type: 'spring', stiffness: 100 }}
        style={{ transformStyle: 'preserve-3d' }}
      >
        {/* Front */}
        <div
          className="absolute inset-0 rounded-3xl p-[2px]"
          style={{
            backfaceVisibility: 'hidden',
            background: `linear-gradient(135deg, ${tierRingColor[0]}, ${tierRingColor[1]})`,
          }}
        >
          <div className="h-full w-full rounded-3xl bg-[#0F131C]/90 p-6 backdrop-blur-xl">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div>
                <p className="font-label text-xs text-white/40">248 Member</p>
                <h3 className="mt-1 text-2xl font-bold text-white">{profile.display_name ?? 'Member'}</h3>
              </div>
              <div className={`font-label rounded-full ${tierColor} px-3 py-1 text-xs text-white shadow-lg`}>
                {profile.tier?.name_zh_hk ?? profile.tier_id}
              </div>
            </div>

            {/* Member Code */}
            <div className="mt-8">
              <p className="font-label text-xs text-white/40">{t('card.member_code')}</p>
              <p className="font-code mt-1 text-lg text-white">{profile.member_code}</p>
            </div>

            {/* Points Display */}
            <div className="mt-4 flex items-end justify-between">
              <div>
                <p className="font-label text-xs text-white/40">{t('card.available_points')}</p>
                <p className="font-code text-3xl text-white">{profile.points.toLocaleString()}</p>
              </div>
              <button className="font-label text-xs text-white/60 hover:text-white/80">
                {t('card.tap_for_qr')}
              </button>
            </div>
          </div>
        </div>

        {/* Back (QR Code) */}
        <div
          className="absolute inset-0 rounded-3xl p-[2px]"
          style={{
            backfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
            background: `linear-gradient(135deg, ${tierRingColor[0]}, ${tierRingColor[1]})`,
          }}
        >
          <div className="flex h-full w-full flex-col items-center justify-center rounded-3xl bg-[#0F131C]/90 p-6 backdrop-blur-xl">
            <div className="rounded-2xl bg-white p-4">
              <QRCodeSVG value={profile.member_code} size={160} level="H" />
            </div>
            <p className="font-code mt-4 text-sm text-white">{profile.member_code}</p>
            <p className="font-label mt-1 text-xs text-white/40">{t('card.scan_to_verify')}</p>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// § TIER COLOR HELPERS
// ────────────────────────────────────────────────────────────────────────────

function getTierGradient(tierId: string): string {
  switch (tierId) {
    case 'amateur':
      return 'bg-gradient-to-r from-green-500 to-emerald-500'
    case 'century':
      return 'bg-gradient-to-r from-amber-500 to-orange-500'
    case 'maximum':
      return 'bg-gradient-to-r from-purple-500 to-pink-500'
    default:
      return 'bg-gradient-to-r from-gray-500 to-gray-600'
  }
}

function getTierRingColor(tierId: string): [string, string] {
  switch (tierId) {
    case 'amateur':
      return ['rgba(16, 185, 129, 0.6)', 'rgba(52, 211, 153, 0.4)']
    case 'century':
      return ['rgba(245, 158, 11, 0.6)', 'rgba(251, 146, 60, 0.4)']
    case 'maximum':
      return ['rgba(168, 85, 247, 0.6)', 'rgba(236, 72, 153, 0.4)']
    default:
      return ['rgba(107, 114, 128, 0.6)', 'rgba(156, 163, 175, 0.4)']
  }
}
