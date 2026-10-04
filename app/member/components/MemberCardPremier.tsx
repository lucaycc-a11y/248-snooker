'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { useTranslations, useLocale } from 'next-intl'
import { type MemberProfile } from '@/lib/data/memberRedesignTypes'

// ════════════════════════════════════════════════════════════════════════════
// MemberCardPremier — Unified "優越會員" card with tilt/gyro interactions
// Reference: member-card (1).html prototype
// All members see the same card design; tier logic stays in backend only
// ════════════════════════════════════════════════════════════════════════════

type Props = {
  profile: MemberProfile
}

export function MemberCardPremier({ profile }: Props) {
  const t = useTranslations('member.card_premier')
  const locale = useLocale()
  const [zoomed, setZoomed] = useState(false)
  const sceneRef = useRef<HTMLDivElement>(null)
  const [tilt, setTilt] = useState({ rx: 0, ry: 0 })
  const [light, setLight] = useState({ px: -1.7, py: 1.4, mx: 30, my: 20, ang: 200 })
  const activeRef = useRef(false)
  const idleTimerRef = useRef<NodeJS.Timeout>()
  const gyroRef = useRef({ enabled: false, base: { g: 0, b: 0 }, asked: false })
  const targetRef = useRef({ tx: 0, ty: 0 })
  const smoothRef = useRef({ sx: -1.7, sy: 1.4, tiltK: 1 })
  const frameRef = useRef<number>()
  const t0Ref = useRef(performance.now())

  const isEN = locale === 'en'
  const reduceMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

  const openZoom = useCallback(() => {
    setZoomed(true)
    // Request gyro permission on first interaction (iOS)
    if (!gyroRef.current.asked && !reduceMotion && typeof DeviceOrientationEvent !== 'undefined') {
      gyroRef.current.asked = true
      if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
        ;(DeviceOrientationEvent as any).requestPermission().then((response: string) => {
          if (response === 'granted') {
            window.addEventListener('deviceorientation', handleOrientation)
          }
        }).catch(() => {
          // Permission denied, fall back to drag + idle sway
        })
      } else {
        // Android or desktop — just listen
        window.addEventListener('deviceorientation', handleOrientation)
      }
    }
  }, [reduceMotion])

  const closeZoom = useCallback(() => {
    setZoomed(false)
  }, [])

  const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))

  const handlePointer = useCallback((e: PointerEvent) => {
    if (gyroRef.current.enabled && e.pointerType !== 'mouse') return
    if (!sceneRef.current) return
    const r = sceneRef.current.getBoundingClientRect()
    targetRef.current.tx = clamp((e.clientX - (r.left + r.width / 2)) / (r.width * 0.75), -1, 1)
    targetRef.current.ty = clamp((e.clientY - (r.top + r.height / 2)) / (r.height * 0.9), -1, 1)
    activeRef.current = true
    clearTimeout(idleTimerRef.current)
    if (e.pointerType !== 'mouse') {
      idleTimerRef.current = setTimeout(() => { activeRef.current = false }, 900)
    }
  }, [])

  const handleOrientation = useCallback((e: DeviceOrientationEvent) => {
    if (e.gamma == null || e.beta == null) return // Desktop fires empty events
    if (!gyroRef.current.base.g && !gyroRef.current.base.b) {
      gyroRef.current.base = { g: e.gamma, b: e.beta }
    }
    // Slowly follow base to avoid drift
    gyroRef.current.base.g += (e.gamma - gyroRef.current.base.g) * 0.004
    gyroRef.current.base.b += (e.beta - gyroRef.current.base.b) * 0.004
    gyroRef.current.enabled = true
    targetRef.current.tx = clamp((e.gamma - gyroRef.current.base.g) / 24, -1, 1)
    targetRef.current.ty = clamp((e.beta - gyroRef.current.base.b) / 24, -1, 1)
  }, [])

  const animate = useCallback(() => {
    const now = performance.now()
    let gx = 0, gy = 0

    if (gyroRef.current.enabled || activeRef.current) {
      gx = targetRef.current.tx
      gy = targetRef.current.ty
    } else if (!reduceMotion) {
      // Idle sway
      const t = (now - t0Ref.current) / 1000
      gx = Math.sin(t * 0.85) * 0.55
      gy = Math.cos(t * 0.65) * 0.4
    }

    // Smooth interpolation
    smoothRef.current.sx += (gx - smoothRef.current.sx) * 0.09
    smoothRef.current.sy += (gy - smoothRef.current.sy) * 0.09
    smoothRef.current.tiltK += ((gyroRef.current.enabled ? 0 : 1) - smoothRef.current.tiltK) * 0.08

    const sx = smoothRef.current.sx
    const sy = smoothRef.current.sy
    const tiltK = smoothRef.current.tiltK

    setTilt({
      rx: -sy * 11 * tiltK,
      ry: sx * 15 * tiltK,
    })
    setLight({
      px: sx,
      py: sy,
      mx: 50 + sx * 42,
      my: 38 + sy * 42,
      ang: 200 + sx * 80 + sy * 30,
    })

    if (!reduceMotion) {
      frameRef.current = requestAnimationFrame(animate)
    }
  }, [reduceMotion])

  useEffect(() => {
    if (reduceMotion) {
      // Static card
      smoothRef.current = { sx: 0, sy: 0, tiltK: 0 }
      animate()
      return
    }

    window.addEventListener('pointermove', handlePointer, { passive: true })
    window.addEventListener('pointerdown', handlePointer, { passive: true })
    document.addEventListener('pointerleave', () => { activeRef.current = false })
    window.addEventListener('blur', () => { activeRef.current = false })

    // Android/desktop: listen for gyro immediately
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof (DeviceOrientationEvent as any).requestPermission !== 'function') {
      gyroRef.current.asked = true
      window.addEventListener('deviceorientation', handleOrientation)
    }

    frameRef.current = requestAnimationFrame(animate)

    return () => {
      window.removeEventListener('pointermove', handlePointer)
      window.removeEventListener('pointerdown', handlePointer)
      window.removeEventListener('deviceorientation', handleOrientation)
      document.removeEventListener('pointerleave', () => { activeRef.current = false })
      window.removeEventListener('blur', () => { activeRef.current = false })
      if (frameRef.current) cancelAnimationFrame(frameRef.current)
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
    }
  }, [handlePointer, handleOrientation, animate, reduceMotion])

  // Close on Escape
  useEffect(() => {
    if (!zoomed) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') closeZoom() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [zoomed, closeZoom])

  return (
    <>
      {/* ═══════════════════ CARD ═══════════════════ */}
      <div
        ref={sceneRef}
        className="mx-auto w-full"
        style={{
          maxWidth: 'min(100%, 440px)',
          perspective: '1100px',
          position: 'relative',
          containerType: 'inline-size',
          touchAction: 'pan-y',
          marginBottom: '40px',
        }}
      >
        {/* Glow under card */}
        <div
          style={{
            position: 'absolute',
            left: '10%',
            right: '10%',
            bottom: '-30px',
            height: '46px',
            borderRadius: '50%',
            zIndex: -1,
            background: 'radial-gradient(ellipse at center, rgba(104,52,200,0.55), rgba(36,92,52,0.28) 55%, transparent 75%)',
            filter: 'blur(20px)',
            transform: `translateX(${light.px * -26}px)`,
          }}
        />

        <article
          className={isEN ? 'en' : ''}
          style={{
            position: 'relative',
            aspectRatio: '85.6 / 53.98',
            transformStyle: 'preserve-3d',
            transform: `rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg)`,
            willChange: 'transform',
          }}
        >
          {/* Card face */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '5.6cqw',
              overflow: 'hidden',
              isolation: 'isolate',
              background: '#12051a',
            }}
          >
            {/* Mesh gradient */}
            <div
              style={{
                position: 'absolute',
                inset: '-8%',
                background: `
                  radial-gradient(75% 85% at 100% 0%, #2f6e3b 0%, rgba(33,78,42,0.78) 28%, transparent 72%),
                  radial-gradient(85% 90% at 0% 100%, #5d1393 0%, rgba(73,12,111,0.82) 30%, transparent 74%),
                  radial-gradient(80% 85% at 100% 100%, #1d1b92 0%, rgba(22,18,99,0.88) 30%, transparent 75%),
                  linear-gradient(135deg, #12051a 0%, #160b27 40%, #1b1338 100%)
                `,
                transform: `translate3d(${light.px * -2.2}%, ${light.py * -2.2}%, 0)`,
              }}
            />

            {/* Rings */}
            <svg
              viewBox="0 0 100 63"
              preserveAspectRatio="xMidYMid slice"
              aria-hidden="true"
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                transform: `translate3d(${light.px * 1.6}%, ${light.py * 1.6}%, 0)`,
              }}
            >
              <circle cx="90" cy="6" r="22" fill="none" stroke="rgba(255,255,255,0.075)" strokeWidth="0.35" />
              <circle cx="90" cy="6" r="34" fill="none" stroke="rgba(255,255,255,0.075)" strokeWidth="0.35" />
              <circle cx="90" cy="6" r="46" fill="none" stroke="rgba(255,255,255,0.075)" strokeWidth="0.35" />
            </svg>

            {/* Shade */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: `
                  linear-gradient(118deg, rgba(255,255,255,0.17) 0%, rgba(255,255,255,0.04) 28%, transparent 46%),
                  linear-gradient(0deg, rgba(6,2,14,0.34), transparent 48%)
                `,
              }}
            />

            {/* Foil sweep */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                mixBlendMode: 'color-dodge',
                opacity: 0.5,
                background: 'linear-gradient(105deg, transparent 28%, rgba(94,234,170,0.38) 41%, rgba(120,140,255,0.4) 50%, rgba(222,120,255,0.38) 59%, transparent 72%)',
                backgroundSize: '260% 100%',
                backgroundPosition: `calc(50% + ${light.px * 50}%) 0`,
              }}
            />

            {/* Glare */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                mixBlendMode: 'overlay',
                background: `radial-gradient(circle at ${light.mx}% ${light.my}%, rgba(255,255,255,0.55), rgba(255,255,255,0.12) 32%, transparent 58%)`,
              }}
            />

            {/* Grain */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                opacity: 0.17,
                mixBlendMode: 'overlay',
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
              }}
            />

            {/* Rim light */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: 'inherit',
                padding: '1.5px',
                pointerEvents: 'none',
                background: `conic-gradient(from ${light.ang}deg at 50% 50%, rgba(255,255,255,0.75), rgba(255,255,255,0.06) 22%, rgba(190,170,255,0.42) 48%, rgba(255,255,255,0.06) 74%, rgba(255,255,255,0.75))`,
                WebkitMask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
                WebkitMaskComposite: 'xor',
                maskComposite: 'exclude',
              }}
            />
          </div>

          {/* Content */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              padding: '6.4cqw',
              transformStyle: 'preserve-3d',
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1fr) auto',
              gridTemplateRows: 'auto 1fr',
              gridTemplateAreas: '"logo ." "who qr"',
              columnGap: '4cqw',
            }}
          >
            {/* Logo */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logos/logo-white-horizontal.svg"
              alt="SPACE8"
              style={{
                gridArea: 'logo',
                justifySelf: 'start',
                alignSelf: 'start',
                height: '3.9cqw',
                width: 'auto',
                display: 'block',
                transform: 'translateZ(26px)',
                opacity: 0.95,
              }}
            />

            {/* Title + Member ID */}
            <div
              style={{
                gridArea: 'who',
                alignSelf: 'end',
                minWidth: 0,
                transform: 'translateZ(38px)',
              }}
            >
              <h1
                className={isEN ? 'font-label' : ''}
                style={{
                  fontSize: isEN ? '6.9cqw' : '10.2cqw',
                  lineHeight: isEN ? 1.22 : 1.08,
                  fontWeight: isEN ? 400 : 700,
                  letterSpacing: isEN ? '0.02em' : '0.08em',
                  whiteSpace: isEN ? 'normal' : 'nowrap',
                  background: 'linear-gradient(180deg, #fff 18%, #d9d3ee 62%, #b9b0d8 100%)',
                  WebkitBackgroundClip: 'text',
                  backgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  color: 'transparent',
                  filter: 'drop-shadow(0 0.35cqw 0 rgba(8,2,18,0.45))',
                }}
              >
                {t('title')}
              </h1>
              {!isEN && (
                <div
                  className="font-label"
                  style={{
                    marginTop: '1.6cqw',
                    fontSize: 'max(9px, 2.9cqw)',
                    letterSpacing: '0.16em',
                    color: 'rgba(235,228,255,0.72)',
                  }}
                >
                  Premier
                </div>
              )}
              <div style={{ marginTop: '4.6cqw', transform: 'translateZ(-8px)' }}>
                <div
                  style={{
                    fontSize: 'max(10px, 2.6cqw)',
                    color: 'rgba(235,228,255,0.62)',
                    letterSpacing: '0.06em',
                  }}
                >
                  {t('member_id_label')}
                </div>
                <code
                  className="font-code"
                  style={{
                    display: 'block',
                    marginTop: '0.5cqw',
                    fontWeight: 500,
                    fontSize: 'max(11px, 3.1cqw)',
                    letterSpacing: '0.06em',
                    color: 'rgba(255,255,255,0.92)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {profile.member_code}
                </code>
              </div>
            </div>

            {/* QR button */}
            <div
              style={{
                gridArea: 'qr',
                alignSelf: 'end',
                transform: 'translateZ(50px)',
              }}
            >
              <button
                onClick={openZoom}
                aria-label={t('tap_to_enlarge')}
                aria-haspopup="dialog"
                style={{
                  display: 'block',
                  width: '30cqw',
                  aspectRatio: '1',
                  borderRadius: '3.6cqw',
                  background: '#fff',
                  padding: '1.7cqw',
                  boxShadow: '0 0 0 1px rgba(255,255,255,0.55), 0 1.6cqw 4cqw rgba(8,2,28,0.5)',
                  transition: 'transform 0.18s ease',
                  cursor: 'pointer',
                  border: 'none',
                }}
                className="active:scale-[0.97]"
              >
                <QRCodeSVG
                  value={profile.member_code}
                  size={200}
                  level="H"
                  style={{
                    width: '100%',
                    height: '100%',
                    display: 'block',
                    imageRendering: 'pixelated',
                    borderRadius: '2.1cqw',
                  }}
                />
              </button>
            </div>
          </div>
        </article>

        {/* Mobile layout adjustment */}
        <style jsx>{`
          @media (max-width: 340px) {
            article > div {
              grid-template-columns: 1fr !important;
              grid-template-areas: "logo" "who" "qr" !important;
            }
          }
        `}</style>
      </div>

      {/* Hint */}
      <p
        style={{
          marginTop: '34px',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          fontSize: '13px',
          color: 'rgba(143,139,163,1)',
        }}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
        </svg>
        <span>{t('tap_to_enlarge')}</span>
      </p>

      {/* ═══════════════════ ZOOM OVERLAY ═══════════════════ */}
      {zoomed && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="zName"
          onClick={closeZoom}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 50,
            background: '#fff',
            color: '#0A0B0E',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '18px',
            padding: '24px',
          }}
        >
          <QRCodeSVG
            value={profile.member_code}
            size={420}
            level="H"
            style={{
              width: 'min(82vw, 62vh, 420px)',
              aspectRatio: '1',
              imageRendering: 'pixelated',
            }}
          />
          <div
            id="zName"
            style={{
              fontSize: '20px',
              fontWeight: 700,
              letterSpacing: '0.06em',
              marginTop: '6px',
            }}
          >
            {t('title')}
          </div>
          <code
            className="font-code"
            style={{
              fontWeight: 600,
              fontSize: 'clamp(15px, 4.2vw, 20px)',
              letterSpacing: '0.06em',
              color: '#333',
            }}
          >
            {profile.member_code}
          </code>
          <div style={{ fontSize: '12.5px', color: '#6B7280' }}>
            {t('scan_tip')}
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); closeZoom() }}
            aria-label={t('close')}
            style={{
              marginTop: '4px',
              padding: '12px 26px',
              borderRadius: '999px',
              border: '1px solid #D4D8DF',
              fontSize: '14px',
              fontWeight: 600,
              minHeight: '44px',
              background: 'transparent',
              cursor: 'pointer',
            }}
          >
            {t('close')}
          </button>
        </div>
      )}
    </>
  )
}
