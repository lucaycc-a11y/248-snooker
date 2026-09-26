'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { Sparkles, Trophy, Gem, Maximize2, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { type MemberProfile } from '@/lib/data/memberRedesignTypes'
import { getTierName } from '@/lib/member/tierHelpers'

// ════════════════════════════════════════════════════════════════════════════
// MemberCardFlipRedesign — Phase 5 redesign matching 924_Member_QR_card.html
// Card face: logo+tier top-row, name+ID left col, QR-button right col
// Tap QR → full-screen white zoom overlay (position:fixed;inset:0)
// Tier palettes: slate/silver (std), deep emerald (prm), obsidian/gold (prs)
// ════════════════════════════════════════════════════════════════════════════

type Props = {
  profile: MemberProfile
  // kept for API compatibility — no longer used; zoom is self-contained
  flipped?: boolean
  onFlip?: () => void
}

export function MemberCardFlipRedesign({ profile }: Props) {
  const t = useTranslations('member.card_redesign')
  const tierName = getTierName(profile.tier, 'zh-HK')
  const v = getTierVisuals(profile.tier)
  const [zoomed, setZoomed] = useState(false)

  const openZoom = useCallback(() => setZoomed(true), [])
  const closeZoom = useCallback(() => setZoomed(false), [])

  // Close on Escape
  useEffect(() => {
    if (!zoomed) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') closeZoom() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [zoomed, closeZoom])

  return (
    <>
      {/* ═══════════════════ CARD FACE ═══════════════════ */}
      <div
        className="mx-auto w-full max-w-[560px] overflow-hidden rounded-[24px]"
        style={{
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

        <div
          className="relative grid"
          style={{
            gridTemplateColumns: '1fr auto',
            gridTemplateRows: 'auto 1fr',
            columnGap: 'clamp(14px,4vw,24px)',
            rowGap: '22px',
            padding: 'clamp(20px,4.5vw,28px)',
          }}
        >
          {/* Top row: logo + tier pill — spans both columns */}
          <div className="col-span-2 flex items-center gap-3">
            <svg
              viewBox="0 0 2400 1000"
              fill="currentColor"
              className="text-white/90"
              style={{ height: 'clamp(13px,3vw,16px)', width: 'auto' }}
              aria-label="SPACE8"
            >
              <path d="M391.31,786.11c-94.11,0-155.08-68.48-155.08-173.16,0-66.9,31.81-112.55,75.55-129.08-35.79-13.38-66.27-49.59-66.27-122,0-97.6,61.63-147.97,155.08-147.97h198.81c93.44,0,155.74,50.37,155.74,147.97,0,72.41-31.15,108.62-66.93,122,43.74,16.53,75.55,62.18,75.55,129.08,0,104.68-60.97,173.16-155.08,173.16h-217.37ZM394.63,537.39c-47.05,0-73.56,26.76-73.56,73.99,0,49.59,37.77,74.77,90.79,74.77h176.28c53.02,0,90.79-25.19,90.79-74.77s-26.51-73.99-73.56-73.99h-210.74ZM416.5,313.07c-55.01,0-86.15,18.1-86.15,70.84,0,49.59,22.53,69.26,70.25,69.26h198.81c47.72,0,70.25-19.68,70.25-69.26,0-52.74-31.15-70.84-86.15-70.84h-167Z"/>
              <text x="900" y="650" fill="currentColor" fontSize="420" fontWeight="300" letterSpacing="20" fontFamily="system-ui,-apple-system,sans-serif">SPACE8</text>
            </svg>
            <div className="flex-1" />
            <div
              className="flex items-center gap-[7px] rounded-full font-semibold"
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

          {/* Left: name + member ID */}
          <div className="flex min-w-0 flex-col justify-end gap-[16px] pb-[2px]">
            <div>
              <p
                className="font-label text-white/50"
                style={{ fontSize: '10.5px', letterSpacing: '0.14em' }}
              >
                MEMBER CARD
              </p>
              <p
                className="font-code mt-[6px] uppercase leading-[1.15] text-white"
                style={{ fontSize: 'clamp(20px,5.2vw,32px)' }}
              >
                {profile.display_name ?? '會員'}
              </p>
            </div>
            <div>
              <p className="text-white/50" style={{ fontSize: '11.5px', lineHeight: 1.5 }}>
                {t('member_id_label')}
              </p>
              <p
                className="font-mono mt-[2px] tracking-[0.04em]"
                style={{ fontSize: '12.5px', color: v.accent }}
              >
                {profile.member_code}
              </p>
            </div>
          </div>

          {/* Right: QR button + hint */}
          <div className="flex flex-col items-center gap-[9px]">
            <button
              className="transition-transform active:scale-[.97]"
              style={{
                width: 'clamp(108px,30vw,150px)',
                aspectRatio: '1',
                borderRadius: '16px',
                background: '#fff',
                padding: '5px',
                boxShadow: `0 10px 26px rgba(0,0,0,.45), 0 0 0 1px ${v.rim}`,
              }}
              onClick={openZoom}
              aria-label={t('tap_to_view_qr')}
              aria-haspopup="dialog"
            >
              <QRCodeSVG
                value={profile.member_code}
                size={200}
                level="H"
                style={{ width: '100%', height: '100%', borderRadius: '11px', display: 'block', imageRendering: 'pixelated' }}
              />
            </button>
            <div className="flex items-center gap-[5px] text-white/50" style={{ fontSize: '11.5px' }}>
              <Maximize2 style={{ width: 12, height: 12 }} />
              <span>{t('tap_to_view_qr')}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════ ZOOM OVERLAY ═══════════════════
          Matches 924_Member_QR_card.html: position:fixed;inset:0;background:#fff
          Full-viewport white takeover, close by tapping anywhere or pressing Esc */}
      {zoomed && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t('tap_to_view_qr')}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-[18px] bg-white p-6"
          onClick={closeZoom}
        >
          <QRCodeSVG
            value={profile.member_code}
            size={420}
            level="H"
            style={{
              width: 'min(82vw, 62vh, 420px)',
              height: 'min(82vw, 62vh, 420px)',
              imageRendering: 'pixelated',
            }}
          />
          <p
            className="font-code text-[#0A0B0E]"
            style={{ fontSize: '16px', textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: '6px' }}
          >
            {profile.display_name ?? '會員'}
          </p>
          <p
            className="font-code font-semibold text-[#333]"
            style={{ fontSize: 'clamp(15px,4.2vw,20px)', letterSpacing: '0.06em' }}
          >
            {profile.member_code}
          </p>
          <p className="text-[#6B7280]" style={{ fontSize: '12.5px' }}>
            {t('scan_to_enter')}
          </p>
          <button
            className="mt-1 rounded-full border border-[#D4D8DF] px-6 py-3 text-sm font-semibold text-[#0A0B0E] transition-colors hover:bg-[#F3F4F6]"
            style={{ minHeight: '44px' }}
            onClick={(e) => { e.stopPropagation(); closeZoom() }}
            aria-label="關閉"
          >
            <X style={{ width: 18, height: 18, display: 'inline', marginRight: 6, verticalAlign: 'middle' }} />
            {t('close') ?? '關閉'}
          </button>
        </div>
      )}
    </>
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
