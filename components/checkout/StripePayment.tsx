"use client"

import { useEffect, useRef, useState, useCallback } from 'react'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'
import type { Appearance, StripeElementLocale } from '@stripe/stripe-js'
import { getStripeClient } from '@/lib/stripe/client'
import { CircleCheck, CircleX, Clock3 } from 'lucide-react'
import { tokens } from '@/app/styles/tokens'
import { useTranslations } from 'next-intl'

const stripePromise = getStripeClient()

// ── Helper: Map Stripe Error Code to i18n Key ────────────────────────────────

/**
 * Maps Stripe error codes to localized error message keys.
 * Falls back to generic error if code is unknown.
 */
function getStripeErrorKey(code?: string | null): string {
  if (!code) return 'book.stripe_error_generic'

  switch (code) {
    case 'card_declined':
      return 'book.stripe_error_card_declined'
    case 'expired_card':
      return 'book.stripe_error_expired_card'
    case 'incorrect_cvc':
      return 'book.stripe_error_incorrect_cvc'
    case 'insufficient_funds':
      return 'book.stripe_error_insufficient_funds'
    case 'processing_error':
      return 'book.stripe_error_processing_error'
    default:
      return 'book.stripe_error_generic'
  }
}

// ── Types ────────────────────────────────────────────────────────────────────

export type StripePaymentMethod = 'card' | 'wechat_pay' | 'alipay' | 'google_pay' | 'apple_pay'

export type StripeState =
  | 'idle'          // initial — not yet created
  | 'pending'       // QR shown, awaiting customer payment
  | 'pending_confirmation' // Stripe succeeded, DB confirmation is pending
  | 'success'       // payment confirmed
  | 'failed'        // payment failed
  | 'cancelled'     // booking hold was cancelled
  | 'expired'       // QR expired

export type StripeBlock = {
  date: string
  startHour: number
  duration: number
  tableNumber: 1 | 2
}

export type StripeLabels = {
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
  waited: string
  cancelled: string
  cancelled_desc: string
  cancel: string
  processing: string
  terms_required: string
}

type Props = {
  blocks: StripeBlock[]
  bookingId?: string
  method: StripePaymentMethod
  labels: StripeLabels
  agreedToTerms: boolean
  returnUrl: string
  locale?: string
  onBackToMethods: () => void
  onSuccess: (bookingId?: string) => void
}

// ── SessionStorage key for refresh recovery ─────────────────────────────────
const STRIPE_SESSION_KEY = 'stripePayment'

type StripePersistedState = {
  bookingId: string
  clientSecret: string
  method: StripePaymentMethod
  agreedToTerms: boolean
  savedAt: number
}

function persistStripeState(state: StripePersistedState) {
  try {
    sessionStorage.setItem(STRIPE_SESSION_KEY, JSON.stringify(state))
  } catch {}
}

function getPersistedStripeState(): StripePersistedState | null {
  try {
    const raw = sessionStorage.getItem(STRIPE_SESSION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    // 30 min expiry
    if (Date.now() - parsed.savedAt > 30 * 60 * 1000) {
      sessionStorage.removeItem(STRIPE_SESSION_KEY)
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export function clearStripePersistedState() {
  try {
    sessionStorage.removeItem(STRIPE_SESSION_KEY)
  } catch {}
}

// ── Color tokens (Space8 design system) ──────────────────────────────────────

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

// ── Polling cadence (mirrors KPay) ───────────────────────────────────────────
const STRIPE_POLL_FAST_MS = 2_000
const STRIPE_POLL_SLOW_MS = 5_000
const STRIPE_POLL_FAST_PHASE_MS = 30_000
const STRIPE_POLL_TIMEOUT_MS = 60_000

// ── Stripe appearance ────────────────────────────────────────────────────────

const appearance: Appearance = {
  theme: "night",
  variables: {
    colorPrimary: GREEN_BRIGHT,
    colorBackground: SURFACE,
    colorText: TEXT,
    colorDanger: DANGER,
    fontFamily: 'system-ui, -apple-system, sans-serif',
    spacingUnit: '4px',
    borderRadius: '16px',
  },
  rules: {
    '.Input': {
      backgroundColor: BG,
      border: `1px solid ${BORDER}`,
      color: TEXT,
    },
    '.Input:focus': {
      border: `1px solid ${GREEN_BRIGHT}`,
      boxShadow: `0 0 0 2px rgba(34,184,107,0.2)`,
    },
    '.Label': {
      color: TEXT_MUTED,
      fontWeight: '500',
    },
  },
}

const STRIPE_LOCALES: Record<string, StripeElementLocale> = {
  'zh-HK': 'zh-HK',
  'zh-CN': 'zh',
  'en': 'en',
  'ja': 'ja',
}

const METHOD_NAMES: Record<StripePaymentMethod, string> = {
  card: '信用卡',
  wechat_pay: '微信支付',
  alipay: '支付寶',
  google_pay: 'Google Pay',
  apple_pay: 'Apple Pay',
}

// ── Component ────────────────────────────────────────────────────────────────

export default function StripePayment(props: Props) {
  const {
    blocks, bookingId, method, labels, agreedToTerms, returnUrl, locale,
    onBackToMethods, onSuccess,
  } = props

  const t = useTranslations('book')

  const [state, setState] = useState<StripeState>('idle')
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [qrUrl, setQrUrl] = useState<string | null>(null)
  const [localBookingId, setLocalBookingId] = useState<string | undefined>(bookingId)
  const [expiresIn, setExpiresIn] = useState<number>(0)
  const [countdown, setCountdown] = useState<number>(0)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [elapsedSec, setElapsedSec] = useState(0)

  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const creatingRef = useRef(false)
  const pollStartRef = useRef(Date.now())
  const stateRef = useRef<StripeState>(state)
  const onSuccessRef = useRef(onSuccess)

  useEffect(() => { stateRef.current = state }, [state])
  useEffect(() => { onSuccessRef.current = onSuccess }, [onSuccess])

  // ── Create PaymentIntent ─────────────────────────────────────────────────

  const createPaymentIntent = useCallback(async () => {
    if (!agreedToTerms) {
      setError(t('stripe_error_terms_required'))
      setState('failed')
      return
    }

    if (creatingRef.current) return
    creatingRef.current = true
    setCreating(true)
    setError(null)

    try {
      const res = await fetch('/api/stripe/create-payment-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          blocks,
          method,
        }),
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to create payment intent')
      }

      const json = await res.json()

      if (!json.clientSecret || !json.bookingId) {
        throw new Error('Invalid response from payment API')
      }

      setClientSecret(json.clientSecret)
      setLocalBookingId(json.bookingId)

      // Persist state for page refresh recovery
      persistStripeState({
        bookingId: json.bookingId,
        clientSecret: json.clientSecret,
        method,
        agreedToTerms: true,
        savedAt: Date.now(),
      })

      // For WeChat Pay, immediately confirm to get QR code
      if (method === 'wechat_pay') {
        await confirmWeChatPayment(json.clientSecret)
      } else {
        setState('idle') // Ready for user action (card input)
      }

    } catch (e) {
      console.error('[stripe] create_payment_intent_error', e)
      setError(t('stripe_error_generic'))
      setState('failed')
    } finally {
      setCreating(false)
      creatingRef.current = false
    }
  }, [blocks, method, agreedToTerms, labels.terms_required])

  // ── Initialize: create PaymentIntent or restore from session ────────────

  useEffect(() => {
    const persisted = getPersistedStripeState()
    if (persisted && persisted.method === method) {
      // Restore from refresh
      setClientSecret(persisted.clientSecret)
      setLocalBookingId(persisted.bookingId)
      if (method === 'wechat_pay') {
        setState('pending') // Will restart polling
        // Re-confirm to get QR code
        confirmWeChatPayment(persisted.clientSecret)
      } else {
        setState('idle')
      }
    } else {
      // Fresh start
      createPaymentIntent()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Confirm WeChat Pay and get QR code ──────────────────────────────────

  const confirmWeChatPayment = async (secret: string) => {
    if (!stripePromise) return

    try {
      const stripe = await stripePromise
      if (!stripe) throw new Error('Stripe not loaded')

      const { error, paymentIntent } = await stripe.confirmWechatPayPayment(
        secret,
        { payment_method_options: { wechat_pay: { client: 'web' } } },
        { handleActions: false }
      )

      if (error) {
        console.error('[stripe] wechat_confirm_error', error)
        const errorKey = getStripeErrorKey(error.code)
        setError(t(errorKey))
        setState('failed')
        return
      }

      if (paymentIntent?.next_action?.type === 'wechat_pay_display_qr_code') {
        const qrData = (paymentIntent.next_action as any).wechat_pay_display_qr_code?.data
        if (qrData) {
          setQrUrl(qrData)
          setExpiresIn(300) // 5 minutes
          setState('pending')
          pollStartRef.current = Date.now()
        } else {
          throw new Error('No QR code data returned')
        }
      } else {
        throw new Error('Unexpected payment intent state')
      }
    } catch (e) {
      console.error('[stripe] wechat_exception', e)
      setError(t('stripe_error_generic'))
      setState('failed')
    }
  }

  // ── QR Countdown ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (state === 'pending' && expiresIn > 0) {
      setCountdown(expiresIn)
      countdownRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            if (countdownRef.current) clearInterval(countdownRef.current)
            setState('expired')
            return 0
          }
          return prev - 1
        })
        setElapsedSec((prev) => prev + 1)
      }, 1000)

      return () => {
        if (countdownRef.current) {
          clearInterval(countdownRef.current)
          countdownRef.current = null
        }
      }
    }
  }, [state, expiresIn])

  // ── Polling for QR payment confirmation ──────────────────────────────────

  useEffect(() => {
    if (state !== 'pending' || !localBookingId) return

    const abortController = new AbortController()
    let timeoutId: ReturnType<typeof setTimeout>

    const poll = async () => {
      try {
        const res = await fetch(`/api/bookings/${localBookingId}`, {
          signal: abortController.signal,
        })
        if (!res.ok) return

        const booking = await res.json()

        if (booking.status === 'confirmed') {
          setState('success')
          onSuccessRef.current(localBookingId)
          return
        }

        if (booking.status === 'cancelled') {
          setState('cancelled')
          return
        }

        // Continue polling
        const elapsed = Date.now() - pollStartRef.current
        if (elapsed > STRIPE_POLL_TIMEOUT_MS) {
          // Timeout: stop polling, show "still checking" state
          setState('pending_confirmation')
          return
        }

        const interval = elapsed < STRIPE_POLL_FAST_PHASE_MS
          ? STRIPE_POLL_FAST_MS
          : STRIPE_POLL_SLOW_MS

        timeoutId = setTimeout(poll, interval)
      } catch (e) {
        if ((e as Error).name !== 'AbortError') {
          console.error('[stripe] polling_error', e)
        }
      }
    }

    poll()

    return () => {
      abortController.abort()
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [state, localBookingId])

  // ── Cancel booking ───────────────────────────────────────────────────────

  const handleCancel = async () => {
    if (!localBookingId || state === 'success') return

    const confirmed = window.confirm(labels.cancel || '確定要取消預訂嗎？')
    if (!confirmed) return

    try {
      await fetch(`/api/bookings/${localBookingId}/cancel`, { method: 'POST' })
      setState('cancelled')
      clearStripePersistedState()
    } catch (e) {
      console.error('[stripe] cancel_error', e)
    }
  }

  // ── Regenerate expired QR ────────────────────────────────────────────────

  const handleRegenerate = () => {
    setState('idle')
    setQrUrl(null)
    setCountdown(0)
    setElapsedSec(0)
    pollStartRef.current = Date.now()
    createPaymentIntent()
  }

  // ── Format countdown ─────────────────────────────────────────────────────

  function formatCountdown(seconds: number): string {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  const isUrgent = countdown > 0 && countdown <= 30

  // ── Styles ───────────────────────────────────────────────────────────────

  const styles = {
    card: {
      background: SURFACE,
      border: `1px solid ${BORDER}`,
      borderRadius: 16,
      padding: 24,
      marginBottom: 16,
    } as React.CSSProperties,
    qrTitle: {
      fontSize: 18,
      fontWeight: 700,
      color: TEXT,
      textAlign: 'center' as const,
      marginBottom: 24,
    } as React.CSSProperties,
    qrWrap: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20,
      background: '#ffffff',
      borderRadius: 12,
      marginBottom: 16,
    } as React.CSSProperties,
    countdownText: {
      fontSize: 14,
      fontWeight: 600,
      color: isUrgent ? DANGER : GREEN_BRIGHT,
      textAlign: 'center' as const,
      marginBottom: 8,
    } as React.CSSProperties,
    elapsedText: {
      fontSize: 12,
      color: TEXT_FAINT,
      textAlign: 'center' as const,
      marginBottom: 12,
    } as React.CSSProperties,
    countdownBarBg: {
      height: 4,
      background: 'rgba(255,255,255,0.1)',
      borderRadius: 999,
      overflow: 'hidden',
      marginBottom: 16,
    } as React.CSSProperties,
    countdownBarFill: {
      height: '100%',
      transformOrigin: 'left',
      borderRadius: 999,
    } as React.CSSProperties,
    stateDesc: {
      fontSize: 13,
      color: TEXT_MUTED,
      textAlign: 'center' as const,
      lineHeight: 1.5,
      marginBottom: 16,
    } as React.CSSProperties,
    helpText: {
      fontSize: 13,
      color: TEXT_FAINT,
      textAlign: 'center' as const,
      marginBottom: 16,
    } as React.CSSProperties,
    helpLink: {
      color: GREEN_BRIGHT,
      textDecoration: 'none',
      fontWeight: 600,
    } as React.CSSProperties,
    button: {
      width: '100%',
      height: 54,
      border: 'none',
      borderRadius: 14,
      fontWeight: 700,
      fontSize: 17,
      cursor: 'pointer',
      transition: 'all 0.2s ease',
      marginBottom: 12,
    } as React.CSSProperties,
    buttonPrimary: {
      background: GREEN_BRIGHT,
      color: '#000',
    } as React.CSSProperties,
    buttonSecondary: {
      background: 'rgba(255,255,255,0.1)',
      color: TEXT,
    } as React.CSSProperties,
    buttonDanger: {
      background: 'transparent',
      border: `1px solid ${DANGER}`,
      color: DANGER,
    } as React.CSSProperties,
  }

  // ── Render: Loading ──────────────────────────────────────────────────────

  if (creating || (state === 'idle' && !clientSecret)) {
    return (
      <div style={styles.card}>
        <div style={{ textAlign: 'center', padding: 40 }}>
          <Clock3 size={48} color={TEXT_MUTED} style={{ marginBottom: 16 }} />
          <p style={{ fontSize: 16, color: TEXT_MUTED, margin: 0 }}>
            {labels.processing || '處理中…'}
          </p>
        </div>
      </div>
    )
  }

  // ── Render: Success ──────────────────────────────────────────────────────

  if (state === 'success') {
    return (
      <div style={styles.card}>
        <div style={{ textAlign: 'center', padding: 40 }}>
          <CircleCheck size={64} color={GREEN_BRIGHT} style={{ marginBottom: 16 }} />
          <h3 style={{ fontSize: 20, fontWeight: 700, color: TEXT, marginBottom: 8 }}>
            {labels.success}
          </h3>
          <p style={{ fontSize: 14, color: TEXT_MUTED, margin: 0 }}>
            {labels.success_desc}
          </p>
        </div>
      </div>
    )
  }

  // ── Render: Failed ───────────────────────────────────────────────────────

  if (state === 'failed') {
    return (
      <div style={styles.card}>
        <div style={{ textAlign: 'center', padding: 40 }}>
          <CircleX size={64} color={DANGER} style={{ marginBottom: 16 }} />
          <h3 style={{ fontSize: 20, fontWeight: 700, color: TEXT, marginBottom: 8 }}>
            {labels.failed}
          </h3>
          <p style={{ fontSize: 14, color: TEXT_MUTED, marginBottom: 24 }}>
            {error || labels.failed_desc}
          </p>
          <button
            type="button"
            onClick={handleRegenerate}
            style={{ ...styles.button, ...styles.buttonPrimary }}
          >
            {labels.try_again}
          </button>
          <button
            type="button"
            onClick={onBackToMethods}
            style={{ ...styles.button, ...styles.buttonSecondary }}
          >
            {labels.back_to_methods}
          </button>
        </div>
      </div>
    )
  }

  // ── Render: Cancelled ────────────────────────────────────────────────────

  if (state === 'cancelled') {
    return (
      <div style={styles.card}>
        <div style={{ textAlign: 'center', padding: 40 }}>
          <CircleX size={64} color={TEXT_MUTED} style={{ marginBottom: 16 }} />
          <h3 style={{ fontSize: 20, fontWeight: 700, color: TEXT, marginBottom: 8 }}>
            {labels.cancelled}
          </h3>
          <p style={{ fontSize: 14, color: TEXT_MUTED, marginBottom: 24 }}>
            {labels.cancelled_desc}
          </p>
          <button
            type="button"
            onClick={onBackToMethods}
            style={{ ...styles.button, ...styles.buttonPrimary }}
          >
            {labels.back_to_methods}
          </button>
        </div>
      </div>
    )
  }

  // ── Render: Expired ──────────────────────────────────────────────────────

  if (state === 'expired') {
    return (
      <div style={styles.card}>
        <div style={{ textAlign: 'center', padding: 40 }}>
          <Clock3 size={64} color={DANGER} style={{ marginBottom: 16 }} />
          <h3 style={{ fontSize: 20, fontWeight: 700, color: TEXT, marginBottom: 8 }}>
            {labels.expired}
          </h3>
          <p style={{ fontSize: 14, color: TEXT_MUTED, marginBottom: 24 }}>
            {labels.expired_desc}
          </p>
          <button
            type="button"
            onClick={handleRegenerate}
            style={{ ...styles.button, ...styles.buttonPrimary }}
          >
            {labels.regenerate}
          </button>
          <button
            type="button"
            onClick={onBackToMethods}
            style={{ ...styles.button, ...styles.buttonSecondary }}
          >
            {labels.back_to_methods}
          </button>
        </div>
      </div>
    )
  }

  // ── Render: Pending confirmation ─────────────────────────────────────────

  if (state === 'pending_confirmation') {
    return (
      <div style={styles.card}>
        <div style={{ textAlign: 'center', padding: 40 }}>
          <Clock3 size={48} color={TEXT_MUTED} style={{ marginBottom: 16 }} />
          <h3 style={{ fontSize: 18, fontWeight: 700, color: TEXT, marginBottom: 8 }}>
            {labels.pending_confirmation}
          </h3>
          <p style={{ fontSize: 14, color: TEXT_MUTED, margin: 0 }}>
            {labels.pending_confirmation_desc}
          </p>
        </div>
      </div>
    )
  }

  // ── Render: QR payment (WeChat Pay) ──────────────────────────────────────

  if (method === 'wechat_pay' && state === 'pending' && qrUrl) {
    return (
      <div style={styles.card}>
        <p style={styles.qrTitle}>
          {labels.pending.replace('{method}', METHOD_NAMES[method])}
        </p>

        <div style={styles.qrWrap}>
          <img
            src={qrUrl}
            alt="WeChat Pay QR Code"
            style={{ width: 220, height: 220, display: 'block' }}
          />
        </div>

        <p style={styles.countdownText}>
          {labels.countdown.replace('{time}', formatCountdown(countdown))}
        </p>

        {elapsedSec > 0 && (
          <p style={styles.elapsedText}>
            {labels.waited.replace('{seconds}', String(elapsedSec))}
          </p>
        )}

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
          onClick={onBackToMethods}
          style={{ ...styles.button, ...styles.buttonSecondary }}
        >
          {labels.back_to_methods}
        </button>

        <button
          type="button"
          onClick={handleCancel}
          style={{ ...styles.button, ...styles.buttonDanger }}
        >
          {labels.cancel}
        </button>
      </div>
    )
  }

  // ── Render: Card payment (PaymentElement) ────────────────────────────────

  if (method === 'card' && clientSecret) {
    return (
      <div style={styles.card}>
        <Elements
          stripe={stripePromise}
          options={{
            clientSecret,
            appearance,
            locale: STRIPE_LOCALES[locale || 'zh-HK'] || 'auto',
          }}
        >
          <CardPaymentForm
            bookingId={localBookingId || ''}
            returnUrl={returnUrl}
            labels={labels}
            onBackToMethods={onBackToMethods}
          />
        </Elements>
      </div>
    )
  }

  // ── Fallback ─────────────────────────────────────────────────────────────

  return (
    <div style={styles.card}>
      <p style={{ fontSize: 14, color: TEXT_MUTED, textAlign: 'center' }}>
        Payment method not supported yet
      </p>
      <button
        type="button"
        onClick={onBackToMethods}
        style={{ ...styles.button, ...styles.buttonSecondary }}
      >
        {labels.back_to_methods}
      </button>
    </div>
  )
}

// ── Card Payment Form (uses Stripe PaymentElement) ──────────────────────────

function CardPaymentForm(props: {
  bookingId: string
  returnUrl: string
  labels: StripeLabels
  onBackToMethods: () => void
}) {
  const { bookingId, returnUrl, labels, onBackToMethods } = props
  const stripe = useStripe()
  const elements = useElements()
  const t = useTranslations('book')
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!stripe || !elements || submitting) return

    setSubmitting(true)
    setErr(null)

    try {
      const { error } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: returnUrl,
        },
      })

      if (error) {
        const errorKey = getStripeErrorKey(error.code)
        setErr(t(errorKey))
      }
    } catch (e) {
      setErr(t('stripe_error_generic'))
    } finally {
      setSubmitting(false)
    }
  }

  const styles = {
    button: {
      width: '100%',
      height: 54,
      border: 'none',
      borderRadius: 14,
      fontWeight: 700,
      fontSize: 17,
      cursor: submitting ? 'not-allowed' : 'pointer',
      transition: 'all 0.2s ease',
      marginBottom: 12,
    } as React.CSSProperties,
  }

  return (
    <form onSubmit={handleSubmit}>
      <PaymentElement />

      {err && (
        <div style={{ marginTop: 16, padding: 12, background: 'rgba(255,69,58,0.1)', borderRadius: 8 }}>
          <p style={{ fontSize: 13, color: DANGER, margin: 0 }}>{err}</p>
        </div>
      )}

      <button
        type="submit"
        disabled={!stripe || submitting}
        style={{
          ...styles.button,
          marginTop: 24,
          background: submitting ? 'rgba(255,255,255,0.15)' : GREEN_BRIGHT,
          color: submitting ? 'rgba(255,255,255,0.6)' : '#000',
        }}
      >
        {submitting ? labels.processing : `${labels.title}`}
      </button>

      <button
        type="button"
        onClick={onBackToMethods}
        style={{
          ...styles.button,
          background: 'rgba(255,255,255,0.1)',
          color: TEXT,
        }}
      >
        {labels.back_to_methods}
      </button>
    </form>
  )
}
