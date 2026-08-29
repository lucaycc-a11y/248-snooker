"use client"

import { useEffect, useRef, useState, useCallback } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { CircleCheck, CircleX, Clock3 } from 'lucide-react'
import { tokens } from '@/app/styles/tokens'

// ── Types ────────────────────────────────────────────────────────────────────

export type KPayMethod = 'card' | 'fps' | 'payme' | 'octopus' | 'alipay' | 'alipayhk' | 'wechat' | 'unionpay_qp'

export type KPayState =
  | 'idle'          // initial — not yet created
  | 'pending'       // QR/H5 shown, awaiting customer payment
  | 'pending_confirmation' // provider succeeded, DB confirmation is pending
  | 'success'       // payment confirmed
  | 'failed'        // payment failed
  | 'cancelled'     // booking hold was cancelled
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
  cancelled: string
  cancelled_desc: string
  cancel: string
  processing: string
  terms_required: string
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
  agreedToTerms: boolean
  /** Member points to redeem, 0 = none. Re-validated and reserved server-side by
   * prepare_checkout; the amount KPay charges comes back from that RPC, never
   * from this component. */
  pointsAmount?: number
  onBackToMethods: () => void
  onSuccess: (bookingId?: string) => void
}

// ── Gateway form POST (Alipay H5) ────────────────────────────────────────────

/**
 * Submit a JSON parameter map to a payment gateway as an HTML form submit.
 *
 * Alipay H5 returns its parameters as JSON rather than a URL; the gateway
 * expects them as form fields, with the target URL and HTTP method carried
 * INSIDE the JSON itself (`action` / `method`) — not assumed by us. Assigning
 * the JSON to location.href yields https://site/{"service":...}, which is
 * the bug this branch prevents.
 *
 * Returns false when payInfo cannot be parsed or carries no usable action,
 * so the caller can surface an error instead of leaving the user stalled.
 */
function submitGatewayForm(payInfo: string): boolean {
  let fields: Record<string, unknown>
  try {
    const parsed: unknown = JSON.parse(payInfo)
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return false
    fields = parsed as Record<string, unknown>
  } catch {
    return false
  }

  const action = fields.action
  console.log('[Alipay form-post] fields:', JSON.stringify(fields))
  if (typeof action !== 'string' || !/^https:\/\//i.test(action)) return false

  const form = document.createElement('form')
  // Trust the gateway's own method field; default to POST only when it does
  // not explicitly say GET (KPay's docs show payloads with either).
  form.method = typeof fields.method === 'string' && fields.method.toUpperCase() === 'GET' ? 'GET' : 'POST'
  form.action = action
  form.style.display = 'none'

  // `action`/`method` address the form — they are not fields the gateway
  // expects back as form data.
  let fieldCount = 0
  for (const [key, value] of Object.entries(fields)) {
    if (key === 'action' || key === 'method') continue
    if (value === null || value === undefined) continue
    if (typeof value === 'object') continue

    const input = document.createElement('input')
    input.type = 'hidden'
    input.name = key
    input.value = String(value)
    form.appendChild(input)
    fieldCount++
  }

  if (fieldCount === 0) return false

  document.body.appendChild(form)
  form.submit()
  return true
}

// ── Method display names ─────────────────────────────────────────────────────

const METHOD_NAMES: Record<KPayMethod, string> = {
  card: '信用卡',
  fps: 'FPS 轉數快',
  payme: 'PayMe',
  octopus: '八達通',
  alipay: '支付寶',
  alipayhk: 'AlipayHK',
  wechat: '微信支付',
  unionpay_qp: '雲閃付',
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
  const { blocks, bookingId, orderGroupId, method, mode, labels, agreedToTerms, onBackToMethods, onSuccess } = props
  const pointsAmount = props.pointsAmount ?? 0

  const [state, setState] = useState<KPayState>('idle')
  const [payInfo, setPayInfo] = useState<string | null>(null)
  // Server-decided payInfo shape (see getPayInfoKind in lib/payments/kpay.ts) —
  // authoritative over the `mode` prop, since e.g. unionpay_qp has no real H5
  // variant and always comes back as 'qr' regardless of the requested mode.
  const [kind, setKind] = useState<string | null>(null)
  const [providerOrderNo, setProviderOrderNo] = useState<string | null>(null)
  const [localBookingId, setLocalBookingId] = useState<string | undefined>(bookingId)
  const [localOrderGroupId, setLocalOrderGroupId] = useState<string | undefined>(orderGroupId)
  const [expiresIn, setExpiresIn] = useState<number>(0)
  const [countdown, setCountdown] = useState<number>(0)
  const [error, setError] = useState<string | null>(null)
  const [failureReason, setFailureReason] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [actionBusy, setActionBusy] = useState(false)

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const creatingRef = useRef(false)
  const attemptRef = useRef(0)

  // ── Create order (idempotent) ──────────────────────────────────────────────

  const createOrder = useCallback(async () => {
    if (!agreedToTerms) {
      setError('請先同意條款與細則')
      setState('failed')
      return
    }
    if (creatingRef.current) return
    creatingRef.current = true
    setCreating(true)
    setError(null)
    setFailureReason(null)

    try {
      const body: Record<string, unknown> = {
        method,
        mode,
        agreedToTerms,
      }
      if (pointsAmount > 0) {
        body.pointsAmount = pointsAmount
      }

      // Mode A: blocks[] — the KPay path creates bookings server-side
      if (blocks && blocks.length > 0 && !localBookingId) {
        body.blocks = blocks.map((b) => ({
          date: b.date,
          startHour: b.startHour,
          duration: b.duration,
          tableNumber: b.tableNumber,
        }))
      } else {
        // Mode B: existing bookingId (re-create after expiry or retry)
        body.bookingId = localBookingId
        body.orderGroupId = localOrderGroupId
      }

      const res = await fetch('/api/checkout/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        let message = '付款初始化失敗，請重試'
        try {
          const errBody = await res.json()
          message = errBody.error || message
        } catch {
          // non-JSON response (e.g. unexpected HTML error page) — use default
        }
        setError(message)
        setState('failed')
        return
      }

      const json = await res.json()

      // Redirect responses must leave the page before committing pending UI
      // state; card/CNP Hosted must never briefly render the QR screen.
      if ((json.kind === 'redirect' || json.kind === 'link') && json.payInfo) {
        if (!/^(https?:\/\/|[a-z][a-z0-9+.-]*:)/i.test(json.payInfo.trim())) {
          setError('付款閘道回應格式錯誤，請重試或改用其他付款方式')
          setState('failed')
          return
        }
        window.location.href = json.payInfo
        return
      }

      setProviderOrderNo(json.providerOrderNo)
      setPayInfo(json.payInfo)
      setKind(json.kind)
      setExpiresIn(json.expiresInSeconds)
      setCountdown(json.expiresInSeconds)
      // Mode A returns bookingId/orderGroupId — remember them so re-creates
      // (after expiry) use Mode B on the SAME booking instead of re-locking.
      if (json.bookingId) setLocalBookingId(String(json.bookingId))
      if (json.orderGroupId) setLocalOrderGroupId(String(json.orderGroupId))
      setState('pending')

      // 'form-post' payInfo is a JSON field map, not a URL — it must be POSTed
      // as a form instead of assigned to location.href.
      if (json.kind === 'form-post') {
        if (!submitGatewayForm(json.payInfo)) {
          setError('付款閘道回應格式錯誤，請重試或改用其他付款方式')
          setState('failed')
        }
        return
      }
    } catch (e) {
      setError((e as Error).message)
      setState('failed')
    } finally {
      creatingRef.current = false
      setCreating(false)
    }
  }, [agreedToTerms, blocks, localBookingId, localOrderGroupId, method, mode, pointsAmount])

  const cancelBooking = useCallback(async () => {
    if (actionBusy) return
    if (!localBookingId) {
      onBackToMethods()
      return
    }

    setActionBusy(true)
    try {
      const res = await fetch('/api/checkout/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId: localBookingId }),
      })
      const payload: unknown = await res.json().catch(() => null)
      if (!res.ok) {
        const message = payload && typeof payload === 'object' && !Array.isArray(payload)
          ? (payload as Record<string, unknown>).error
          : undefined
        setError(typeof message === 'string' ? message : labels.cancelled_desc)
        return
      }
      attemptRef.current += 1
      if (pollRef.current) clearInterval(pollRef.current)
      if (countdownRef.current) clearInterval(countdownRef.current)
      setState('cancelled')
    } catch {
      setError(labels.cancelled_desc)
    } finally {
      setActionBusy(false)
    }
  }, [actionBusy, labels.cancelled_desc, localBookingId, onBackToMethods])

  const retryPayment = useCallback(async () => {
    if (actionBusy || !localBookingId) return
    setActionBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/checkout/retry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId: localBookingId }),
      })
      const payload: unknown = await res.json().catch(() => null)
      if (!res.ok) {
        const message = payload && typeof payload === 'object' && !Array.isArray(payload)
          ? (payload as Record<string, unknown>).error
          : undefined
        setError(typeof message === 'string' ? message : labels.failed_desc)
        setState('failed')
        return
      }
      attemptRef.current += 1
      setPayInfo(null)
      setKind(null)
      setProviderOrderNo(null)
      setCountdown(0)
      setState('idle')
      await createOrder()
    } catch {
      setError(labels.failed_desc)
      setState('failed')
    } finally {
      setActionBusy(false)
    }
  }, [actionBusy, createOrder, labels.failed_desc, localBookingId])

  // ── Create order on mount ─────────────────────────────────────────────────

  useEffect(() => {
    if (agreedToTerms) createOrder()
    return () => {
      creatingRef.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agreedToTerms])

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

    if (!localBookingId) return

    if (pollRef.current) clearInterval(pollRef.current)
      pollRef.current = setInterval(async () => {
        const attempt = attemptRef.current
        try {
          const res = await fetch(`/api/checkout/status?bookingId=${encodeURIComponent(localBookingId)}`, { cache: 'no-store' })
          const raw: unknown = await res.json()
          if (!res.ok || attempt !== attemptRef.current) return
          const json = raw && typeof raw === 'object' && !Array.isArray(raw)
            ? raw as Record<string, unknown>
            : {}
          const status = typeof json.status === 'string' ? json.status : undefined
          const providerStatus = typeof json.providerStatus === 'string' ? json.providerStatus : undefined
          const reason = typeof json.failureReason === 'string' ? json.failureReason : undefined
          const code = typeof json.failureCode === 'string' ? json.failureCode : undefined

          if (reason || code) setFailureReason([code, reason].filter(Boolean).join(' · '))
          if (status === 'confirmed') {
            if (pollRef.current) clearInterval(pollRef.current)
            setState('success')
            onSuccess(localBookingId)
          } else if (status === 'pending_confirmation' || providerStatus === 'success') {
            setState('pending_confirmation')
          } else if (status === 'expired' || providerStatus === 'expired') {
            if (pollRef.current) clearInterval(pollRef.current)
            setState('expired')
          } else if (status === 'cancelled' || providerStatus === 'cancelled') {
            if (pollRef.current) clearInterval(pollRef.current)
            setState('cancelled')
          } else if (status === 'failed' || status === 'payment_failed' || providerStatus === 'failed' || providerStatus === 'closed') {
            if (pollRef.current) clearInterval(pollRef.current)
            setState('failed')
          }
        } catch {
          // Network error — retry on the next interval.
        }
      }, 3000)

    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [localBookingId, onSuccess, state])

  // ── Retry the current booking after an expired or failed provider attempt ──

  const formatCountdown = (seconds: number): string => {
    if (seconds >= 60) {
      const minutes = Math.floor(seconds / 60)
      const remainder = seconds % 60
      return remainder === 0 ? `${minutes} 分鐘` : `${minutes} 分 ${remainder} 秒`
    }
    return `${seconds} 秒`
  }

  const isUrgent = countdown <= 60

  // ── State screens ──────────────────────────────────────────────────────────

  if (!agreedToTerms) {
    return (
      <div style={styles.card}>
        <p style={styles.stateTitle}>{labels.terms_required}</p>
      </div>
    )
  }

  if (state === 'success') {
    return (
      <div style={styles.card}>
        <div style={styles.iconWrap}>
          <CircleCheck size={48} color={GREEN_BRIGHT} aria-hidden />
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
          <CircleX size={48} color={DANGER} aria-hidden />
        </div>
        <p style={styles.stateTitle}>{labels.failed}</p>
        <p style={styles.stateDesc}>
          {error || labels.failed_desc}
        </p>
        {failureReason && <p style={styles.failureReason}>{failureReason}</p>}
        <button type="button" onClick={retryPayment} disabled={actionBusy} style={styles.primaryButton}>
          {actionBusy ? labels.processing : labels.try_again}
        </button>
        <button type="button" onClick={cancelBooking} disabled={actionBusy} style={styles.secondaryButton}>
          {labels.cancel}
        </button>
      </div>
    )
  }

  if (state === 'cancelled') {
    return (
      <div style={styles.card}>
        <div style={styles.iconWrap}>
          <CircleX size={48} color={TEXT_FAINT} aria-hidden />
        </div>
        <p style={styles.stateTitle}>{labels.cancelled}</p>
        <p style={styles.stateDesc}>{labels.cancelled_desc}</p>
        <button type="button" onClick={onBackToMethods} style={styles.primaryButton}>
          {labels.back_to_methods}
        </button>
      </div>
    )
  }

  if (state === 'expired') {
    return (
      <div style={styles.card}>
        <div style={styles.iconWrap}>
          <Clock3 size={48} color={TEXT_FAINT} aria-hidden />
        </div>
        <p style={styles.stateTitle}>{labels.expired}</p>
        <p style={styles.stateDesc}>{labels.expired_desc}</p>
        <button type="button" onClick={retryPayment} disabled={actionBusy} style={styles.primaryButton}>
          {actionBusy ? labels.processing : labels.regenerate}
        </button>
        <button
          type="button"
          onClick={cancelBooking}
          disabled={actionBusy}
          style={styles.secondaryButton}
        >
          {labels.cancel}
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

  // QR payload — the server-decided kind is authoritative. In particular,
  // card/CNP Hosted may be requested with desktop mode "qr" but returns a
  // redirect URL and must never render the QR screen.
  if (kind === 'qr' && payInfo) {
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
              transform: `scaleX(${countdown / expiresIn})`,
              background: isUrgent ? DANGER : GREEN_BRIGHT,
              transition: `transform 1s linear, background 0.3s ease`,
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

        <button
          type="button"
          onClick={cancelBooking}
          disabled={actionBusy}
          style={styles.secondaryButton}
        >
          {labels.cancel}
        </button>
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
  failureReason: {
    fontSize: 12,
    color: TEXT_FAINT,
    margin: 0,
    textAlign: 'center',
    lineHeight: 1.5,
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
    width: '100%',
    borderRadius: 2,
    transformOrigin: 'left',
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