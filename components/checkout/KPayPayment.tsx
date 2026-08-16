"use client"

import { useEffect, useRef, useState, useCallback } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { tokens } from '@/app/styles/tokens'

// ── Types ────────────────────────────────────────────────────────────────────

export type KPayMethod = 'fps' | 'payme' | 'octopus'

export type KPayState =
  | 'idle'          // initial — not yet created
  | 'pending'       // QR/H5 shown, awaiting customer payment
  | 'pending_confirmation' // webhook received, DB confirming
  | 'success'       // payment confirmed
  | 'failed'        // payment failed / expired
  | 'expired'       // QR/H5 link expired

export type KPayMode = 'qr' | 'h5'

export type KPayBlock = {
  date: string
  startHour: number
  duration: number
  tableNumber: 1 | 2
}

export type KPayLabels = {
  title: string
  pending: string
  pending_desc: string
  pending_confirmation: string
  pending_confirmation_desc: string
  success: string
  success_desc: string
  failed: string
  failed_desc: string
  expired: string
  expired_desc: string
  regenerate: string
  try_again: string
  countdown: string
  help: string
  support_whatsapp: string
  back_to_methods: string
  processing: string
}

type Props = {
  /** Blocks to lock+book (Mode A — the KPay path creates bookings server-side) */
  blocks: KPayBlock[]
  /** Existing bookingId (Mode B — for re-creates after expiry) */
  bookingId?: string
  orderGroupId?: string
  method: KPayMethod
  mode: KPayMode
  labels: KPayLabels
  onBackToMethods: () => void
  onSuccess: () => void
}

// ── Method display names ─────────────────────────────────────────────────────

const METHOD_NAMES: Record<KPayMethod, string> = {
  fps: 'FPS 轉數快',
  payme: 'PayMe',
  octopus: '八達通',
}

// ── Color tokens (Space8 design system — never Tailwind greens) ──────────────

const GREEN = '#1a9d5c'
const GREEN_BRIGHT = '#22b86b'
const GREEN_DEEP = '#0f7845'
const BG = '#000000'
const SURFACE = '#111111'
const TEXT = '#ffffff'
const TEXT_MUTED = 'rgba(255,255,255,0.72)'
const TEXT_FAINT = 'rgba(255,255,255,0.52)'
const BORDER = 'rgba(255,255,255,0.1)'
const DANGER = '#FF453A'

// ── Easing curves ────────────────────────────────────────────────────────────

const EASE_SPRING = 'cubic-bezier(.34,1.56,.64,1)'
const EASE_STANDARD = 'cubic-bezier(.2,.7,.3,1)'

// ── Component ────────────────────────────────────────────────────────────────

export default function KPayPayment(props: Props) {
  const { blocks, bookingId, orderGroupId, method, mode, labels, onBackToMethods, onSuccess } = props

  const [state, setState] = useState<KPayState>('idle')
  const [payInfo, setPayInfo] = useState<string | null>(null)
  const [providerOrderNo, setProviderOrderNo] = useState<string | null>(null)
  const [localBookingId, setLocalBookingId] = useState<string | undefined>(bookingId)
  const [localOrderGroupId, setLocalOrderGroupId] = useState<string | undefined>(orderGroupId)
  const [expiresIn, setExpiresIn] = useState<number>(0)
  const [countdown, setCountdown] = useState<number>(0)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const creatingRef = useRef(false)

  // ── Create order (idempotent) ──────────────────────────────────────────────

  const createOrder = useCallback(async () => {
    if (creatingRef.current) return
    creatingRef.current = true
    setCreating(true)
    setError(null)

    try {
      const body: Record<string, unknown> = {
        method,
        mode,
      }

      // Mode A: blocks[] — the KPay path creates bookings server-side
      if (blocks && blocks.length > 0) {
        body.blocks = blocks.map((b) => ({
          date: b.date,
          startHour: b.startHour,
          duration: b.duration,
          tableNumber: b.tableNumber,
        }))
      } else {
        // Mode B: existing bookingId (re-create after expiry)
        body.bookingId = localBookingId
        body.orderGroupId = localOrderGroupId
      }

      const res = await fetch('/api/checkout/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const json = await res.json()

      if (!res.ok) {
        setError(json.error ?? 'Failed to create order')
        setState('failed')
        return
      }

      setProviderOrderNo(json.providerOrderNo)
      setPayInfo(json.payInfo)
      setExpiresIn(json.expiresInSeconds)
      setCountdown(json.expiresInSeconds)
      // Mode A returns bookingId/orderGroupId — remember them so re-creates
      // (after expiry) use Mode B on the SAME booking instead of re-locking.
      if (json.bookingId) setLocalBookingId(String(json.bookingId))
      if (json.orderGroupId) setLocalOrderGroupId(String(json.orderGroupId))
      setState('pending')

      // If mode is H5, the user is redirected immediately
      if (mode === 'h5' && json.payInfo) {
        window.location.href = json.payInfo
      }
    } catch (e) {
      setError((e as Error).message)
      setState('failed')
    } finally {
      creatingRef.current = false
      setCreating(false)
    }
  }, [blocks, localBookingId, localOrderGroupId, method, mode])

  // ── Create order on mount ─────────────────────────────────────────────────

  useEffect(() => {
    createOrder()
    return () => {
      creatingRef.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Countdown timer ────────────────────────────────────────────────────────

  useEffect(() => {
    if (state !== 'pending') {
      if (countdownRef.current) clearInterval(countdownRef.current)
      return
    }

    countdownRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(countdownRef.current!)
          // Expired — auto-regenerate
          setState('expired')
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current)
    }
  }, [state])

  // ── Poll for status ────────────────────────────────────────────────────────

  useEffect(() => {
    if (state !== 'pending' && state !== 'pending_confirmation') {
      if (pollRef.current) clearInterval(pollRef.current)
      return
    }

    // Need a bookingId to poll
    if (!localBookingId) return

    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/checkout/status?bookingId=${localBookingId}`)
        const json = await res.json()

        if (!res.ok) return

        if (json.status === 'confirmed' || json.providerStatus === 'success') {
          setState('pending_confirmation')
          // Brief buffer to let the webhook finish DB writes
          setTimeout(() => {
            setState('success')
            onSuccess()
          }, 1500)
          if (pollRef.current) clearInterval(pollRef.current)
        } else if (json.providerStatus === 'failed' || json.providerStatus === 'cancelled' || json.providerStatus === 'closed') {
          setState('failed')
          if (pollRef.current) clearInterval(pollRef.current)
        }
        // else: still pending — keep polling
      } catch {
        // Network error — retry on next interval
      }
    }, 3000)

    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [localBookingId, state, onSuccess])

  // ── Auto-regenerate on expiry ──────────────────────────────────────────────

  useEffect(() => {
    if (state === 'expired') {
      const timer = setTimeout(() => {
        createOrder()
      }, 1000)
      return () => clearTimeout(timer)
    }
  }, [state, createOrder])

  // ── Render helpers ─────────────────────────────────────────────────────────

  const formatCountdown = (seconds: number): string => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  const isUrgent = countdown <= 60

  // ── State screens ──────────────────────────────────────────────────────────

  if (state === 'success') {
    return (
      <div style={styles.card}>
        <div style={styles.iconWrap}>
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
            <circle cx="24" cy="24" r="22" stroke={GREEN_BRIGHT} strokeWidth="3" />
            <path d="M14 24l7 7 13-13" stroke={GREEN_BRIGHT} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <p style={styles.stateTitle}>{labels.success}</p>
        <p style={styles.stateDesc}>{labels.success_desc}</p>
      </div>
    )
  }

  if (state === 'pending_confirmation') {
    return (
      <div style={styles.card}>
        <div style={styles.spinner} />
        <p style={styles.stateTitle}>{labels.pending_confirmation}</p>
        <p style={styles.stateDesc}>{labels.pending_confirmation_desc}</p>
      </div>
    )
  }

  if (state === 'failed') {
    return (
      <div style={styles.card}>
        <div style={styles.iconWrap}>
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
            <circle cx="24" cy="24" r="22" stroke={DANGER} strokeWidth="3" />
            <path d="M16 16l16 16M32 16l-16 16" stroke={DANGER} strokeWidth="3" strokeLinecap="round" />
          </svg>
        </div>
        <p style={styles.stateTitle}>{labels.failed}</p>
        <p style={styles.stateDesc}>
          {error || labels.failed_desc}
        </p>
        <button type="button" onClick={createOrder} style={styles.primaryButton}>
          {labels.try_again}
        </button>
        <button type="button" onClick={onBackToMethods} style={styles.secondaryButton}>
          {labels.back_to_methods}
        </button>
      </div>
    )
  }

  if (state === 'expired') {
    return (
      <div style={styles.card}>
        <div style={styles.iconWrap}>
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
            <circle cx="24" cy="24" r="22" stroke={TEXT_FAINT} strokeWidth="3" />
            <path d="M24 12v12l8 4" stroke={TEXT_FAINT} strokeWidth="3" strokeLinecap="round" />
          </svg>
        </div>
        <p style={styles.stateTitle}>{labels.expired}</p>
        <p style={styles.stateDesc}>{labels.expired_desc}</p>
        <button type="button" onClick={createOrder} style={styles.primaryButton}>
          {labels.regenerate}
        </button>
      </div>
    )
  }

  // ── Pending (QR/H5) or idle/creating ───────────────────────────────────────

  if (state === 'idle' || creating) {
    return (
      <div style={styles.card}>
        <div style={styles.spinner} />
        <p style={styles.stateTitle}>{labels.processing}</p>
      </div>
    )
  }

  // QR mode
  if (mode === 'qr' && payInfo) {
    return (
      <div style={styles.card}>
        <p style={styles.qrTitle}>
          {labels.pending.replace('{method}', METHOD_NAMES[method])}
        </p>

        <div style={styles.qrWrap}>
          <QRCodeSVG
            value={payInfo}
            size={240}
            bgColor={BG}
            fgColor={TEXT}
            level="M"
            style={styles.qr}
          />
        </div>

        <p style={styles.countdownText}>
          {labels.countdown.replace('{time}', formatCountdown(countdown))}
        </p>

        {/* Countdown bar */}
        <div style={styles.countdownBarBg}>
          <div
            style={{
              ...styles.countdownBarFill,
              width: `${(countdown / expiresIn) * 100}%`,
              background: isUrgent ? DANGER : GREEN_BRIGHT,
              transition: `width 1s linear`,
            }}
          />
        </div>

        <p style={styles.stateDesc}>
          {labels.pending_desc.replace('{time}', formatCountdown(countdown))}
        </p>

        <p style={styles.helpText}>
          {labels.help}
          {' · '}
          <a
            href="https://wa.me/852"
            target="_blank"
            rel="noopener noreferrer"
            style={styles.helpLink}
          >
            {labels.support_whatsapp}
          </a>
        </p>
      </div>
    )
  }

  // H5 mode (should redirect, but show a fallback)
  return (
    <div style={styles.card}>
      <div style={styles.spinner} />
      <p style={styles.stateTitle}>
        {labels.pending.replace('{method}', METHOD_NAMES[method])}
      </p>
      <p style={styles.stateDesc}>{labels.pending_desc}</p>
    </div>
  )
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  card: {
    background: SURFACE,
    border: `1px solid ${BORDER}`,
    borderRadius: 20,
    padding: '32px 24px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 12,
    animation: `entrance ${EASE_SPRING} 300ms`,
  },
  iconWrap: {
    width: 64,
    height: 64,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  stateTitle: {
    fontSize: 20,
    fontWeight: 700,
    color: TEXT,
    margin: 0,
    textAlign: 'center',
  },
  stateDesc: {
    fontSize: 14,
    color: TEXT_MUTED,
    margin: 0,
    textAlign: 'center',
    lineHeight: 1.6,
    maxWidth: 280,
  },
  qrTitle: {
    fontSize: 16,
    fontWeight: 600,
    color: TEXT,
    margin: 0,
    textAlign: 'center',
    marginBottom: 8,
  },
  qrWrap: {
    padding: 16,
    background: BG,
    borderRadius: 16,
    border: `1px solid ${BORDER}`,
  },
  qr: {
    display: 'block',
    width: 240,
    height: 240,
  },
  countdownText: {
    fontSize: 14,
    fontWeight: 600,
    color: TEXT,
    margin: '8px 0 0',
    fontVariantNumeric: 'tabular-nums',
  },
  countdownBarBg: {
    width: 240,
    height: 4,
    background: 'rgba(255,255,255,0.1)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  countdownBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  helpText: {
    fontSize: 12,
    color: TEXT_FAINT,
    margin: 0,
    textAlign: 'center',
    marginTop: 8,
  },
  helpLink: {
    color: GREEN_BRIGHT,
    textDecoration: 'underline',
    textUnderlineOffset: 3,
  },
  primaryButton: {
    minHeight: 44,
    padding: '0 28px',
    border: 'none',
    borderRadius: 14,
    background: GREEN_BRIGHT,
    color: BG,
    fontWeight: 700,
    fontSize: 15,
    cursor: 'pointer',
    width: '100%',
    maxWidth: 280,
    animation: `entrance ${EASE_STANDARD} 250ms`,
  },
  secondaryButton: {
    minHeight: 44,
    padding: '0 28px',
    border: `1px solid ${BORDER}`,
    borderRadius: 14,
    background: 'transparent',
    color: TEXT_MUTED,
    fontWeight: 600,
    fontSize: 14,
    cursor: 'pointer',
    width: '100%',
    maxWidth: 280,
  },
  spinner: {
    width: 40,
    height: 40,
    border: `3px solid ${BORDER}`,
    borderTopColor: GREEN_BRIGHT,
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
    marginBottom: 8,
  },
}