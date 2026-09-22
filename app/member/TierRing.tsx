'use client'

import { motion } from 'framer-motion'
import { useTranslations, useLocale } from 'next-intl'
import { type MemberProfile, type TierValue } from '@/lib/data/memberRedesignTypes'
import { getTierName, getTierRingColor } from '@/lib/member/tierHelpers'

// ════════════════════════════════════════════════════════════════════════════
// TierRing — P3: Animated circular progress ring showing current tier
// FIXED: Uses real schema (tier, points) not phantom (tier_id, lifetime_points)
// Shows current tier and points balance (no "next tier" since thresholds aren't defined yet)
// ════════════════════════════════════════════════════════════════════════════

type Props = {
  profile: MemberProfile
}

export function TierRing({ profile }: Props) {
  const t = useTranslations('member')
  const locale = useLocale()

  // Tier colors from helpers
  const tierColor = getTierRingColor(profile.tier)
  const tierName = getTierName(profile.tier, locale)

  // Simple display: no thresholds yet, so show 100% ring
  const radius = 120
  const strokeWidth = 16
  const normalizedRadius = radius - strokeWidth / 2
  const circumference = normalizedRadius * 2 * Math.PI

  // All tiers (for milestone display)
  const allTiers: Array<{ id: TierValue; label: string; color: string }> = [
    { id: 'amateur', label: getTierName('amateur', locale), color: getTierRingColor('amateur') },
    { id: 'century', label: getTierName('century', locale), color: getTierRingColor('century') },
    { id: 'maximum', label: getTierName('maximum', locale), color: getTierRingColor('maximum') },
  ]

  const currentIndex = allTiers.findIndex((t) => t.id === profile.tier)

  return (
    <div className="relative flex flex-col items-center">
      {/* Ring */}
      <div className="relative">
        <svg height={radius * 2} width={radius * 2} className="rotate-[-90deg]">
          {/* Background ring */}
          <circle
            stroke="rgba(255, 255, 255, 0.1)"
            fill="transparent"
            strokeWidth={strokeWidth}
            r={normalizedRadius}
            cx={radius}
            cy={radius}
          />
          {/* Progress ring (full circle for now) */}
          <motion.circle
            stroke={tierColor}
            fill="transparent"
            strokeWidth={strokeWidth}
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={0}
            strokeLinecap="round"
            r={normalizedRadius}
            cx={radius}
            cy={radius}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: 0 }}
            transition={{ duration: 1.5, ease: 'easeInOut' }}
            style={{
              filter: `drop-shadow(0 0 8px ${tierColor}40)`,
            }}
          />
        </svg>

        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-center"
          >
            <p className="font-label text-sm text-white/40">{t('tier.current')}</p>
            <p className="mt-1 text-3xl font-bold text-white" style={{ color: tierColor }}>
              {tierName}
            </p>
            <p className="font-code mt-1 text-2xl text-white">{profile.points.toLocaleString()}</p>
            <p className="font-label text-xs text-white/40">{t('tier.current_points')}</p>
          </motion.div>
        </div>
      </div>

      {/* Tier badge (current tier highlight) */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="mt-6 rounded-full px-6 py-2 text-center backdrop-blur"
        style={{
          background: `linear-gradient(135deg, ${tierColor}40, ${tierColor}20)`,
          border: `1px solid ${tierColor}60`,
        }}
      >
        <p className="font-label text-sm" style={{ color: tierColor }}>
          {tierName}
        </p>
      </motion.div>

      {/* Tier milestones */}
      <div className="mt-8 flex w-full max-w-md items-center justify-between">
        {allTiers.map((tier, index) => {
          const isReached = index <= currentIndex
          const isCurrent = tier.id === profile.tier

          return (
            <div key={tier.id} className="relative flex flex-col items-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2 + index * 0.1 }}
                className={`flex h-12 w-12 items-center justify-center rounded-full border-2 ${
                  isReached ? 'border-transparent bg-white/10' : 'border-white/20 bg-transparent'
                }`}
                style={{
                  backgroundColor: isReached ? `${tier.color}20` : undefined,
                  borderColor: isCurrent ? tier.color : undefined,
                }}
              >
                {isReached && <span className="text-xl">✓</span>}
              </motion.div>
              <p className="mt-2 text-xs font-medium text-white/60">{tier.label}</p>

              {/* Connector line */}
              {index < allTiers.length - 1 && (
                <div
                  className="absolute top-6 left-12 h-0.5 w-[calc(100%+2rem)]"
                  style={{
                    background:
                      index < currentIndex
                        ? `linear-gradient(to right, ${tier.color}, ${allTiers[index + 1].color})`
                        : 'rgba(255, 255, 255, 0.1)',
                  }}
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
