'use client'

import { motion } from 'framer-motion'
import { QRCodeSVG } from 'qrcode.react'
import { Sparkles, Trophy, Gem, ChevronRight } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { type MemberProfile } from '@/lib/data/memberRedesignTypes'
import { getTierName, getTierGradient } from '@/lib/member/tierHelpers'
import { resolveTier, DEFAULT_TIERS } from '@/lib/data/pricing'

// ════════════════════════════════════════════════════════════════════════════
// MemberCardFlipRedesign — Phase 3 Complete Figma-based Redesign
// Premium visual design with enhanced glassmorphism, refined typography,
// and polished micro-interactions
// ════════════════════════════════════════════════════════════════════════════

type Props = {
  profile: MemberProfile
  flipped: boolean
  onFlip: () => void
}

export function MemberCardFlipRedesign({ profile, flipped, onFlip }: Props) {
  const t = useTranslations('member.card_redesign')
  const tierName = getTierName(profile.tier, 'zh-HK')
  const tierVisuals = getTierVisuals(profile.tier)

  // Calculate progress using actual DB thresholds
  const { current, next, progress, pointsToNext } = resolveTier(profile.points, DEFAULT_TIERS)
  const isMaxTier = !next

  return (
    <div className="perspective-1000 mx-auto w-full max-w-md">
      <motion.div
        className="relative h-[280px] w-full cursor-pointer"
        onClick={onFlip}
        animate={{ rotateY: flipped ? 180 : 0 }}
        transition={{
          duration: 0.7,
          ease: [0.34, 1.56, 0.64, 1],
        }}
        style={{ transformStyle: 'preserve-3d' }}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* FRONT CARD */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <div
          className="absolute inset-0 overflow-hidden rounded-[24px] border shadow-2xl"
          style={{
            backfaceVisibility: 'hidden',
            borderColor: tierVisuals.borderColor,
            background: tierVisuals.backgroundGradient,
          }}
        >
          {/* Animated grain texture overlay */}
          <div
            className="absolute inset-0 opacity-[0.03] mix-blend-overlay"
            style={{
              backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 400 400\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noiseFilter\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' /%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noiseFilter)\' /%3E%3C/svg%3E")',
              backgroundSize: '200px 200px',
            }}
          />

          {/* Glassmorphism blur layer */}
          <div className="absolute inset-0 backdrop-blur-[2px]" />

          {/* Radial gradient spotlight */}
          <div
            className="absolute inset-0 opacity-40"
            style={{
              background: `radial-gradient(circle at 30% 20%, ${tierVisuals.accentColor}40 0%, transparent 50%)`,
            }}
          />

          {/* Content */}
          <div className="relative flex h-full flex-col p-7">
            {/* Top row: Logo + Tier badge */}
            <div className="flex items-start justify-between">
              {/* SPACE8 logo */}
              <div className="opacity-70">
                <svg viewBox="0 0 2400 1000" fill="currentColor" className="h-6 w-auto text-white drop-shadow-sm">
                  <path d="M391.31,786.11c-94.11,0-155.08-68.48-155.08-173.16,0-66.9,31.81-112.55,75.55-129.08-35.79-13.38-66.27-49.59-66.27-122,0-97.6,61.63-147.97,155.08-147.97h198.81c93.44,0,155.74,50.37,155.74,147.97,0,72.41-31.15,108.62-66.93,122,43.74,16.53,75.55,62.18,75.55,129.08,0,104.68-60.97,173.16-155.08,173.16h-217.37ZM394.63,537.39c-47.05,0-73.56,26.76-73.56,73.99,0,49.59,37.77,74.77,90.79,74.77h176.28c53.02,0,90.79-25.19,90.79-74.77s-26.51-73.99-73.56-73.99h-210.74ZM416.5,313.07c-55.01,0-86.15,18.1-86.15,70.84,0,49.59,22.53,69.26,70.25,69.26h198.81c47.72,0,70.25-19.68,70.25-69.26,0-52.74-31.15-70.84-86.15-70.84h-167Z"/>
                  <text x="900" y="650" fill="currentColor" fontSize="420" fontWeight="300" letterSpacing="20" fontFamily="system-ui,-apple-system,sans-serif">SPACE8</text>
                </svg>
              </div>

              {/* Tier badge with glow */}
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2 }}
                className="relative"
              >
                <div
                  className="absolute inset-0 blur-xl opacity-60"
                  style={{ background: tierVisuals.accentColor }}
                />
                <div
                  className="relative flex items-center gap-2 rounded-full px-4 py-2 font-semibold text-white shadow-lg backdrop-blur-sm"
                  style={{
                    background: `linear-gradient(135deg, ${tierVisuals.accentColor}E6, ${tierVisuals.accentColorDark}E6)`,
                  }}
                >
                  {getTierIconComponent(profile.tier, 'h-4 w-4')}
                  <span className="font-code text-xs tracking-wide">{tierName}</span>
                </div>
              </motion.div>
            </div>

            {/* Member name + subtitle */}
            <div className="mt-8">
              <motion.h3
                className="font-code text-4xl font-bold leading-tight text-white drop-shadow-md"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                {profile.display_name ?? '會員'}
              </motion.h3>
              <motion.p
                className="mt-1 text-sm font-medium text-white/60"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
              >
                尊享會員
              </motion.p>
            </div>

            {/* Progress section */}
            {!isMaxTier && next && (
              <motion.div
                className="mt-6"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
              >
                {/* Current → Next tier labels */}
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {getTierIconComponent(current.id, 'h-3.5 w-3.5 opacity-80')}
                    <span className="font-code text-xs font-medium text-white/70">
                      {getTierName(current.id, 'zh-HK')}
                    </span>
                  </div>
                  <ChevronRight className="h-3.5 w-3.5 text-white/40" strokeWidth={2.5} />
                  <div className="flex items-center gap-2">
                    {getTierIconComponent(next.id, 'h-3.5 w-3.5 opacity-80')}
                    <span className="font-code text-xs font-medium text-white/70">
                      {getTierName(next.id, 'zh-HK')}
                    </span>
                  </div>
                </div>

                {/* Progress track */}
                <div className="relative h-2 overflow-hidden rounded-full bg-white/10 shadow-inner">
                  <motion.div
                    className="absolute inset-y-0 left-0 rounded-full shadow-md"
                    style={{
                      background: `linear-gradient(90deg, ${tierVisuals.accentColor}, ${tierVisuals.accentColorDark})`,
                    }}
                    initial={{ width: '0%' }}
                    animate={{ width: `${progress * 100}%` }}
                    transition={{
                      duration: 1.2,
                      ease: [0.34, 1.56, 0.64, 1],
                      delay: 0.6,
                    }}
                  />
                  {/* Shimmer effect on progress bar */}
                  <motion.div
                    className="absolute inset-y-0 left-0 w-full"
                    style={{
                      background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.3) 50%, transparent 100%)',
                      width: `${progress * 100}%`,
                    }}
                    animate={{
                      x: ['-100%', '200%'],
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: 'linear',
                      delay: 1,
                    }}
                  />
                </div>

                {/* Progress text */}
                <p className="mt-2 font-code text-[11px] font-medium text-white/50">
                  已消費 HK${profile.points.toLocaleString()} •
                  還需 HK${pointsToNext.toLocaleString()} 升級至{getTierName(next.id, 'zh-HK')}
                </p>
              </motion.div>
            )}

            {/* Max tier badge */}
            {isMaxTier && (
              <motion.div
                className="mt-6 flex items-center gap-2"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10">
                  <Gem className="h-4 w-4 text-white" strokeWidth={2} />
                </div>
                <span className="font-code text-sm font-medium text-white/70">
                  {t('max_tier_reached')}
                </span>
              </motion.div>
            )}

            {/* Points display - bottom right */}
            <motion.div
              className="mt-auto flex items-end justify-between"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7 }}
            >
              <div className="flex items-center gap-2 text-white/50">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.5 12.5l-3-3m0 0l-3 3m3-3v9m0-15a9 9 0 110 18 9 9 0 010-18z" />
                </svg>
                <span className="font-code text-xs">輕觸查看 QR</span>
              </div>
              <div className="text-right">
                <p className="font-code text-[10px] uppercase tracking-wider text-white/40">
                  Space Points
                </p>
                <p className="font-code text-5xl font-bold leading-none text-white drop-shadow-md">
                  {profile.points.toLocaleString()}
                </p>
              </div>
            </motion.div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* BACK CARD (QR) */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <div
          className="absolute inset-0 rounded-[24px] p-[2px] shadow-2xl"
          style={{
            backfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
            background: `linear-gradient(135deg, ${tierVisuals.accentColor}, ${tierVisuals.accentColorDark})`,
          }}
        >
          <div className="flex h-full w-full flex-col items-center justify-center rounded-[22px] bg-[#0A0D12]/95 p-8 backdrop-blur-xl">
            {/* QR code container with glow */}
            <div className="relative">
              <div
                className="absolute inset-0 blur-2xl opacity-40"
                style={{ background: tierVisuals.accentColor }}
              />
              <motion.div
                className="relative rounded-2xl bg-white p-4 shadow-2xl"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.3, duration: 0.5 }}
              >
                <QRCodeSVG value={profile.member_code} size={140} level="H" />
              </motion.div>
            </div>

            {/* Member code */}
            <motion.p
              className="font-code mt-6 text-base font-bold tracking-wider text-white"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              {profile.member_code}
            </motion.p>

            {/* Instruction text */}
            <motion.p
              className="mt-2 text-xs font-medium text-white/60"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
            >
              {t('scan_to_enter')}
            </motion.p>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// § HELPERS
// ────────────────────────────────────────────────────────────────────────────

function getTierVisuals(tier: string) {
  switch (tier) {
    case 'amateur':
      // Nova: Enhanced silver with cooler tones
      return {
        accentColor: '#94A3B8',
        accentColorDark: '#64748B',
        borderColor: 'rgba(148, 163, 184, 0.3)',
        backgroundGradient: 'linear-gradient(135deg, rgba(148, 163, 184, 0.15) 0%, rgba(100, 116, 139, 0.10) 40%, rgba(15, 19, 28, 0.98) 100%)',
      }
    case 'century':
      // Platinum: Vibrant green with energy
      return {
        accentColor: '#22C55E',
        accentColorDark: '#16A34A',
        borderColor: 'rgba(34, 197, 94, 0.4)',
        backgroundGradient: 'linear-gradient(135deg, rgba(34, 197, 94, 0.18) 0%, rgba(22, 163, 74, 0.12) 40%, rgba(15, 19, 28, 0.98) 100%)',
      }
    case 'maximum':
      // Diamond: Royal purple with pink shimmer
      return {
        accentColor: '#C084FC',
        accentColorDark: '#A855F7',
        borderColor: 'rgba(192, 132, 252, 0.4)',
        backgroundGradient: 'linear-gradient(135deg, rgba(192, 132, 252, 0.20) 0%, rgba(168, 85, 247, 0.15) 40%, rgba(15, 19, 28, 0.98) 100%)',
      }
    default:
      return {
        accentColor: '#6B7280',
        accentColorDark: '#4B5563',
        borderColor: 'rgba(107, 114, 128, 0.2)',
        backgroundGradient: 'linear-gradient(135deg, rgba(107, 114, 128, 0.10) 0%, rgba(15, 19, 28, 0.98) 100%)',
      }
  }
}

function getTierIconComponent(tier: string, sizeClass: string = 'h-12 w-12'): JSX.Element {
  const className = `${sizeClass} text-white`
  switch (tier) {
    case 'amateur':
      return <Sparkles className={className} strokeWidth={2} />
    case 'century':
      return <Trophy className={className} strokeWidth={2} />
    case 'maximum':
      return <Gem className={className} strokeWidth={2} />
    default:
      return <Sparkles className={className} strokeWidth={2} />
  }
}
