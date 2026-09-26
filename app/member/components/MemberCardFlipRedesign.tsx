'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { QRCodeSVG } from 'qrcode.react'
import { Sparkles, Trophy, Gem } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { type MemberProfile } from '@/lib/data/memberRedesignTypes'
import { getTierName } from '@/lib/member/tierHelpers'

// ════════════════════════════════════════════════════════════════════════════
// MemberCardFlipRedesign — Phase 4 redesign matching 924 mockup
// Grid layout: logo+tier top-row, name+ID left col, QR right col
// Tier palettes: slate/silver (std), deep emerald (prm), obsidian/gold (prs)
// ════════════════════════════════════════════════════════════════════════════

type Props = {
  profile: MemberProfile
  flipped: boolean
  onFlip: () => void
}

export function MemberCardFlipRedesign({ profile, flipped, onFlip }: Props) {
  const t = useTranslations('member.card_redesign')
  const tierName = getTierName(profile.tier, 'zh-HK')
  const v = getTierVisuals(profile.tier)

  return (
    <div className="perspective-1000 mx-auto w-full max-w-[560px]">
      <motion.div
        className="relative cursor-pointer"
        style={{ height: 'clamp(160px, 42vw, 210px)', transformStyle: 'preserve-3d' }}
        onClick={onFlip}
        animate={{ rotateY: flipped ? 180 : 0 }}
        transition={{ duration: 0.65, ease: [0.34, 1.2, 0.64, 1] }}
        whileHover={{ scale: 1.015 }}
        whileTap={{ scale: 0.985 }}
      >
        {/* ═══════════════════ FRONT ═══════════════════ */}
        <div
          className="absolute inset-0 overflow-hidden rounded-[24px]"
          style={{
            backfaceVisibility: 'hidden',
            background: v.surface,
            border: `1px solid ${v.rim}`,
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,.08), 0 30px 70px rgba(0,0,0,.55)',
          }}
        >
          {/* Sheen overlay */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{ background: `radial-gradient(120% 90% at 0% 0%, ${v.sheen}, transparent 55%)` }}
          />

          {/* Grid: [name-col] [qr-col] */}
          <div
            className="relative flex h-full flex-col p-[clamp(16px,4.5vw,24px)]"
            style={{ gap: 'clamp(10px,2.5vw,18px)' }}
          >
            {/* Top row: logo + tier pill */}
            <div className="flex items-center justify-between">
              {/* SPACE8 wordmark — inline SVG so no img src needed */}
              <svg
                viewBox="0 0 2400 1000"
                fill="currentColor"
                className="text-white/90"
                style={{ height: 'clamp(12px,2.8vw,16px)', width: 'auto' }}
                aria-label="SPACE8"
              >
                <path d="M391.31,786.11c-94.11,0-155.08-68.48-155.08-173.16,0-66.9,31.81-112.55,75.55-129.08-35.79-13.38-66.27-49.59-66.27-122,0-97.6,61.63-147.97,155.08-147.97h198.81c93.44,0,155.74,50.37,155.74,147.97,0,72.41-31.15,108.62-66.93,122,43.74,16.53,75.55,62.18,75.55,129.08,0,104.68-60.97,173.16-155.08,173.16h-217.37ZM394.63,537.39c-47.05,0-73.56,26.76-73.56,73.99,0,49.59,37.77,74.77,90.79,74.77h176.28c53.02,0,90.79-25.19,90.79-74.77s-26.51-73.99-73.56-73.99h-210.74ZM416.5,313.07c-55.01,0-86.15,18.1-86.15,70.84,0,49.59,22.53,69.26,70.25,69.26h198.81c47.72,0,70.25-19.68,70.25-69.26,0-52.74-31.15-70.84-86.15-70.84h-167Z"/>
                <text x="900" y="650" fill="currentColor" fontSize="420" fontWeight="300" letterSpacing="20" fontFamily="system-ui,-apple-system,sans-serif">SPACE8</text>
              </svg>

              {/* Tier pill */}
              <div
                className="flex items-center gap-[7px] rounded-full font-semibold shadow-lg"
                style={{
                  padding: '8px 15px 8px 12px',
                  background: v.pill,
                  color: v.pillInk,
                  fontSize: '13.5px',
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,.35), 0 4px 14px rgba(0,0,0,.3)',
                }}
              >
                {getTierIcon(profile.tier)}
                <span>{tierName}</span>
              </div>
            </div>

            {/* Bottom section: name+ID left, QR right */}
            <div className="flex flex-1 items-end gap-[clamp(14px,4vw,24px)]">
              {/* Left: name + member ID */}
              <div className="flex min-w-0 flex-1 flex-col justify-end gap-[14px]">
                <div>
                  <p
                    className="font-code uppercase leading-tight tracking-wide text-white"
                    style={{ fontSize: 'clamp(18px,5vw,30px)' }}
                  >
                    {profile.display_name ?? '會員'}
                  </p>
                  <p
                    className="mt-[6px] text-white/50"
                    style={{ fontSize: '10.5px', letterSpacing: '0.14em' }}
                  >
                    {t('membership_label')}
                  </p>
                </div>
                <div>
                  <p className="text-white/50" style={{ fontSize: '11.5px', lineHeight: 1.5 }}>
                    {t('member_id_label')}
                  </p>
                  <p
                    className="font-code mt-[2px] tracking-[0.04em]"
                    style={{ fontSize: '12.5px', color: v.accent }}
                  >
                    {profile.member_code}
                  </p>
                </div>
              </div>

              {/* Right: QR button */}
              <button
                className="flex-shrink-0"
                style={{
                  width: 'clamp(96px,28vw,140px)',
                  aspectRatio: '1',
                  borderRadius: '16px',
                  background: '#fff',
                  padding: '5px',
                  boxShadow: `0 10px 26px rgba(0,0,0,.45), 0 0 0 1px ${v.rim}`,
                }}
                onClick={(e) => { e.stopPropagation(); onFlip() }}
                aria-label={t('tap_to_view_qr')}
              >
                <QRCodeSVG
                  value={profile.member_code}
                  size={200}
                  level="H"
                  style={{ width: '100%', height: '100%', borderRadius: '11px', display: 'block' }}
                />
              </button>
            </div>
          </div>
        </div>

        {/* ═══════════════════ BACK ═══════════════════ */}
        <div
          className="absolute inset-0 overflow-hidden rounded-[24px]"
          style={{
            backfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
            background: `linear-gradient(135deg, ${v.accentA}, ${v.accentB})`,
          }}
        >
          <div
            className="flex h-full w-full flex-col items-center justify-center gap-4 rounded-[22px] bg-[#0A0B0E]/94 p-8"
            style={{ margin: '2px', width: 'calc(100% - 4px)', height: 'calc(100% - 4px)' }}
          >
            {/* QR code with glow */}
            <div className="relative">
              <div
                className="absolute inset-0 blur-2xl opacity-35"
                style={{ background: v.accentA }}
              />
              <motion.div
                className="relative rounded-2xl bg-white p-4 shadow-2xl"
                initial={{ scale: 0.85, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.25, duration: 0.45 }}
              >
                <QRCodeSVG value={profile.member_code} size={130} level="H" />
              </motion.div>
            </div>

            <motion.p
              className="font-code text-sm font-bold tracking-widest text-white"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              {profile.member_code}
            </motion.p>

            <motion.p
              className="text-xs font-medium text-white/55"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
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

type TierVisuals = {
  surface: string
  sheen: string
  rim: string
  pill: string
  pillInk: string
  accent: string
  accentA: string
  accentB: string
}

function getTierVisuals(tier: string): TierVisuals {
  switch (tier) {
    case 'amateur':
      // 標準: slate & silver
      return {
        surface: 'linear-gradient(150deg,#2B3039 0%,#1B1E24 55%,#23272F 100%)',
        sheen: 'rgba(255,255,255,.07)',
        rim: 'rgba(255,255,255,.12)',
        pill: 'linear-gradient(180deg,#A2AEC4,#7F8BA2)',
        pillInk: '#fff',
        accent: '#C7CDD8',
        accentA: '#A2AEC4',
        accentB: '#7F8BA2',
      }
    case 'century':
      // 優越: deep emerald
      return {
        surface: 'linear-gradient(150deg,#16463A 0%,#0A211B 55%,#11342B 100%)',
        sheen: 'rgba(94,234,170,.12)',
        rim: 'rgba(94,234,170,.22)',
        pill: 'linear-gradient(180deg,#5EDBA4,#1F9A63)',
        pillInk: '#fff',
        accent: '#9FE7C6',
        accentA: '#5EDBA4',
        accentB: '#1F9A63',
      }
    case 'maximum':
      // 尊榮: obsidian & champagne gold
      return {
        surface: 'linear-gradient(150deg,#2A241B 0%,#0E0C09 55%,#1D1913 100%)',
        sheen: 'rgba(240,210,140,.13)',
        rim: 'rgba(230,203,138,.34)',
        pill: 'linear-gradient(180deg,#F3DDA6,#C29A4A)',
        pillInk: '#2A1E08',
        accent: '#E8CD8C',
        accentA: '#F3DDA6',
        accentB: '#C29A4A',
      }
    default:
      return {
        surface: 'linear-gradient(150deg,#1E2026 0%,#14161A 100%)',
        sheen: 'rgba(255,255,255,.05)',
        rim: 'rgba(255,255,255,.10)',
        pill: 'linear-gradient(180deg,#6B7280,#4B5563)',
        pillInk: '#fff',
        accent: '#9CA3AF',
        accentA: '#6B7280',
        accentB: '#4B5563',
      }
  }
}

function getTierIcon(tier: string): React.ReactElement {
  const cls = 'h-[15px] w-[15px]'
  switch (tier) {
    case 'amateur':  return <Sparkles className={cls} strokeWidth={1.8} />
    case 'century':  return <Trophy className={cls} strokeWidth={1.8} />
    case 'maximum':  return <Gem className={cls} strokeWidth={1.8} />
    default:         return <Sparkles className={cls} strokeWidth={1.8} />
  }
}
