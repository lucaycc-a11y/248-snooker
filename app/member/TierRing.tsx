'use client'

import { motion } from 'framer-motion'
import { useTranslations } from 'next-intl'
import { type MemberProfile } from '@/lib/data/memberRedesignTypes'

// ════════════════════════════════════════════════════════════════════════════
// TierRing — P3: Animated circular progress ring showing tier advancement
// Shows current tier, points to next tier, and lifetime achievement
// ════════════════════════════════════════════════════════════════════════════

type Props = {
  profile: MemberProfile
}

export function TierRing({ profile }: Props) {
  const t = useTranslations('member')

  const tiers = [
    { id: 'amateur', min: 0, name_zh_hk: '業餘', color: '#10B981' },
    { id: 'century', min: 500, name_zh_hk: '世紀', color: '#F59E0B' },
    { id: 'maximum', min: 2000, name_zh_hk: '極限', color: '#A855F7' },
  ]

  const currentTier = tiers.find((t) => t.id === profile.tier_id) ?? tiers[0]
  const currentIndex = tiers.findIndex((t) => t.id === profile.tier_id)
  const nextTier = tiers[currentIndex + 1]

  let progress = 1 // Default to 100% if max tier
  let pointsToNext = 0
  let pointsInCurrentTier = profile.lifetime_points - currentTier.min

  if (nextTier) {
    const tierRange = nextTier.min - currentTier.min
    pointsToNext = nextTier.min - profile.lifetime_points
    progress = Math.min(pointsInCurrentTier / tierRange, 1)
  }

  const radius = 120
  const strokeWidth = 16
  const normalizedRadius = radius - strokeWidth / 2
  const circumference = normalizedRadius * 2 * Math.PI
  const strokeDashoffset = circumference - progress * circumference

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
          {/* Progress ring */}
          <motion.circle
            stroke={currentTier.color}
            fill="transparent"
            strokeWidth={strokeWidth}
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            r={normalizedRadius}
            cx={radius}
            cy={radius}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset }}
            transition={{ duration: 1.5, ease: 'easeInOut' }}
            style={{
              filter: `drop-shadow(0 0 8px ${currentTier.color}40)`,
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
            <p className="mt-1 text-3xl font-bold text-white" style={{ color: currentTier.color }}>
              {currentTier.name_zh_hk}
            </p>
            <p className="font-code mt-1 text-2xl text-white">{profile.lifetime_points.toLocaleString()}</p>
            <p className="font-label text-xs text-white/40">{t('tier.lifetime_points')}</p>
          </motion.div>
        </div>
      </div>

      {/* Next tier info */}
      {nextTier && pointsToNext > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mt-6 text-center"
        >
          <p className="font-label text-sm text-white/60">
            {t('tier.next_tier')}: <span className="font-bold text-white">{nextTier.name_zh_hk}</span>
          </p>
          <p className="mt-1 text-xl font-bold text-white">
            <span className="font-code">{pointsToNext.toLocaleString()}</span> <span className="font-label text-sm font-normal text-white/60">{t('tier.points_away')}</span>
          </p>
        </motion.div>
      )}

      {/* Max tier reached */}
      {!nextTier && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mt-6 rounded-full bg-gradient-to-r from-purple-500/20 to-pink-500/20 px-6 py-2 text-center backdrop-blur"
        >
          <p className="font-label text-sm text-purple-300">🏆 {t('tier.max_tier_reached')}</p>
        </motion.div>
      )}

      {/* Tier milestones */}
      <div className="mt-8 flex w-full max-w-md items-center justify-between">
        {tiers.map((tier, index) => {
          const isReached = profile.lifetime_points >= tier.min
          const isCurrent = tier.id === profile.tier_id

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
              <p className="mt-2 text-xs font-medium text-white/60">{tier.name_zh_hk}</p>
              <p className="font-code text-xs text-white/40">{tier.min.toLocaleString()}</p>

              {/* Connector line */}
              {index < tiers.length - 1 && (
                <div
                  className="absolute top-6 left-12 h-0.5 w-[calc(100%+2rem)]"
                  style={{
                    background:
                      profile.lifetime_points >= tiers[index + 1].min
                        ? `linear-gradient(to right, ${tier.color}, ${tiers[index + 1].color})`
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
