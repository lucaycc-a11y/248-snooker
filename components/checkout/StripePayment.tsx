"use client"

import { useEffect, useRef, useState, useCallback } from 'react'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'
import type { Appearance, StripeElementLocale } from '@stripe/stripe-js'
import { getStripeClient } from '@/lib/stripe/client'
import { CircleCheck, CircleX, Clock3 } from 'lucide-react'
import { tokens } from '@/app/styles/tokens'
import { useTranslations } from 'next-intl'
import { isMobileClient } from '@/lib/device'

const stripePromise = getStripeClient()

// ── Helper: Map Stripe Error Code to i18n Key ────────────────────────────────

/**
 * Maps Stripe error codes to localized error message keys.
 * Falls back to generic error if code is unknown.
 */
function getStripeErrorKey(code?: string | null): string {
  if (!code) return 'stripe_error_generic'

  switch (code) {
    case 'card_declined':
      return 'stripe_error_card_declined'
    case 'expired_card':
      return 'stripe_error_expired_card'
    case 'incorrect_cvc':
      return 'stripe_error_incorrect_cvc'
    case 'insufficient_funds':
      return 'stripe_error_insufficient_funds'
    case 'processing_error':
      return 'stripe_error_processing_error'
    default:
      return 'stripe_error_generic'
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
// Match booking summary card background: tokens.colors.depth.elevated
// = rgba(255,255,255,0.06) on graphite #14161A → composite #222428
const BG = '#222428'
const SURFACE = '#222428'
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

// Match KPayPayment's deep black + brand-green design language.
// PaymentElement renders official, licensed method icons + native Apple/Google
// Pay buttons, so no brand assets to source ourselves. `rules` targets the
// sub-elements (method tabs, card/phone inputs) that the top-level `variables`
// don't reach on their own.
//
// Color tokens from KPayPayment.tsx (Space8 design system):
// - GREEN = '#1a9d5c', GREEN_BRIGHT = '#22b86b'
// - SURFACE = '#111111', BG = '#000000'
// - BORDER = 'rgba(255,255,255,0.1)'
const appearance: Appearance = {
  theme: "night",
  variables: {
    colorPrimary: "#22b86b",        // GREEN_BRIGHT (KPay 品牌綠)
    colorBackground: "#000000",      // BG (深黑背景)
    colorText: "#ffffff",
    colorTextSecondary: "rgba(255,255,255,0.72)", // TEXT_MUTED (KPay)
    borderRadius: "16px",            // 跟 KPay 卡片圓角 (16-20px)
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', system-ui, sans-serif",
    spacingUnit: "4px",
  },
  rules: {
    ".Tab": {
      border: "1px solid rgba(255,255,255,0.1)", // BORDER (KPay)
      borderRadius: "16px",
      backgroundColor: "#111111",     // SURFACE (KPay)
      padding: "12px 16px",
    },
    ".Tab--selected": {
      backgroundColor: "#1a9d5c",     // GREEN (KPay 選中背景)
      borderColor: "#22b86b",         // GREEN_BRIGHT (KPay 選中邊框)
      color: "#ffffff",
    },
    ".Tab:hover": {
      borderColor: "rgba(255,255,255,0.2)",
      backgroundColor: "rgba(255,255,255,0.04)",
    },
    ".Input": {
      borderRadius: "16px",
      backgroundColor: "#111111",     // SURFACE (KPay)
      border: "1px solid rgba(255,255,255,0.1)", // BORDER (KPay)
      padding: "12px 16px",
    },
    ".Input:focus": {
      borderColor: "#22b86b",         // GREEN_BRIGHT (KPay)
      boxShadow: "0 0 0 1px #22b86b",
    },
    ".Label": {
      color: "rgba(255,255,255,0.72)", // TEXT_MUTED (KPay)
      fontSize: "14px",
      fontWeight: "600",
    },
  },
}

const STRIPE_LOCALES: Record<string, StripeElementLocale> = {
  'zh-HK': 'zh-TW',  // Use zh-TW for traditional Chinese to avoid simplified chars
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
  // The authoritative amount in cents, as re-derived by the server. Rendered on
  // the pay button so a mismatch is visible to the customer before confirming.
  const [serverAmount, setServerAmount] = useState<number | null>(null)

  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const creatingRef = useRef(false)
  const pollStartRef = useRef(Date.now())
  const stateRef = useRef<StripeState>(state)
  const onSuccessRef = useRef(onSuccess)

  useEffect(() => { stateRef.current = state }, [state])
  useEffect(() => { onSuccessRef.current = onSuccess }, [onSuccess])

  // ── Create PaymentIntent ─────────────────────────────────────────────────

  const createPaymentIntent = useCallback(async () => {
    // Problem 3 fix: Remove pre-flight terms check here. The user should see
    // the Stripe Payment Element immediately (matching KPay's flow where the
    // user sees payment methods first). The terms agreement is enforced at
    // the moment they click "Pay" inside CardPaymentForm.handleSubmit().

    if (creatingRef.current) return
    creatingRef.current = true
    setCreating(true)
    setError(null)

    try {
      // Lock the slots first. /api/booking/lock returns the slot ids that
      // /api/payment/create-intent re-prices server-side from the `config`
      // table via calculatePrice(). The client never supplies an amount —
      // /api/stripe/create-payment-intent used to derive one from a
      // non-existent `config.hourly_rate` column and silently fell back to
      // HK$100/hour, charging HK$100 for a HK$5 booking.
      const lockRes = await fetch('/api/booking/lock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blocks }),
      })
      const lockJson = await lockRes.json().catch(() => ({}))
      if (!lockRes.ok) {
        throw new Error(lockJson.detail || lockJson.error || 'lock failed')
      }

      const intentBody: Record<string, unknown> =
        Array.isArray(lockJson.slotIds) && lockJson.slotIds.length > 1
          ? { slotIds: lockJson.slotIds, orderGroupId: lockJson.orderGroupId }
          : { slotId: lockJson.slotId ?? lockJson.slotIds?.[0] }

      const res = await fetch('/api/payment/create-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(intentBody),
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
      setServerAmount(typeof json.amount === 'number' ? json.amount : null)

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

  // ── Confirm WeChat Pay and get QR code or H5 redirect ──────────────────────

  const confirmWeChatPayment = async (secret: string) => {
    if (!stripePromise) return

    const isMobile = isMobileClient()

    try {
      const stripe = await stripePromise
      if (!stripe) throw new Error('Stripe not loaded')

      // Mobile: use H5 mode (redirects to WeChat app)
      // Desktop: use QR mode (displays QR code)
      const { error, paymentIntent } = await stripe.confirmWechatPayPayment(
        secret,
        {
          payment_method_options: {
            wechat_pay: {
              // @ts-expect-error - Stripe types are outdated; mobile_web is valid per API docs
              client: isMobile ? 'mobile_web' : 'web'
            }
          },
          return_url: isMobile ? returnUrl : undefined,
        },
        { handleActions: false }
      )

      if (error) {
        console.error('[stripe] wechat_confirm_error', error)
        const errorKey = getStripeErrorKey(error.code)
        setError(t(errorKey))
        setState('failed')
        return
      }

      // Mobile H5: redirect to WeChat app
      if (isMobile && paymentIntent?.next_action?.type === 'wechat_pay_redirect_to_android_app') {
        const redirectUrl = (paymentIntent.next_action as any).wechat_pay_redirect_to_android_app?.url
        if (redirectUrl) {
          window.location.href = redirectUrl
          return
        }
      }

      if (isMobile && paymentIntent?.next_action?.type === 'wechat_pay_redirect_to_ios_app') {
        const redirectUrl = (paymentIntent.next_action as any).wechat_pay_redirect_to_ios_app?.url
        if (redirectUrl) {
          window.location.href = redirectUrl
          return
        }
      }

      // Desktop: display QR code
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
        // /api/bookings/:id does not exist — every poll 404'd and `return`ed
        // without rescheduling, so the QR flow never saw `confirmed` OR
        // `cancelled`. /api/checkout/status queries Stripe live and is the
        // authority on terminal state.
        const res = await fetch(
          `/api/checkout/status?bookingId=${encodeURIComponent(localBookingId)}`,
          { signal: abortController.signal, cache: 'no-store' },
        )
        if (!res.ok) {
          // Reschedule rather than silently stopping — a transient 5xx must not
          // strand the customer on a QR that will never resolve.
          const elapsedOnError = Date.now() - pollStartRef.current
          if (elapsedOnError > STRIPE_POLL_TIMEOUT_MS) {
            setState('pending_confirmation')
            return
          }
          timeoutId = setTimeout(poll, STRIPE_POLL_SLOW_MS)
          return
        }

        const payload = await res.json()
        const status: string | undefined = payload?.status

        if (status === 'confirmed') {
          setState('success')
          onSuccessRef.current(localBookingId)
          return
        }

        if (status === 'cancelled') {
          setState('cancelled')
          return
        }

        if (status === 'payment_failed' || status === 'failed') {
          setError(t('stripe_error_generic'))
          setState('failed')
          return
        }

        if (status === 'expired') {
          setState('expired')
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
  }, [state, localBookingId, t])

  // ── Cancel booking ───────────────────────────────────────────────────────

  const handleCancel = async () => {
    if (!localBookingId || state === 'success') return

    const confirmed = window.confirm(labels.cancel || '確定要取消預訂嗎？')
    if (!confirmed) return

    // /api/bookings/:id/cancel does not exist — that POST 404'd, the catch
    // swallowed it, and setState('cancelled') below still ran, so an unpaid
    // WeChat hold stayed `pending` in the DB while the UI claimed cancelled.
    // /api/checkout/cancel calls cancel_pending_booking, releasing the slot.
    try {
      const res = await fetch('/api/checkout/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId: localBookingId }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        console.error('[stripe] cancel_rejected', { status: res.status, error: body?.error })
        setError(t('stripe_error_generic'))
        return
      }
      setState('cancelled')
      clearStripePersistedState()
    } catch (e) {
      console.error('[stripe] cancel_error', e)
      setError(t('stripe_error_generic'))
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

  // Processing overlay removed per Change 2 - payment frame renders directly
  // when clientSecret is ready. No intermediate loading placeholder.
  if (creating || (state === 'idle' && !clientSecret)) {
    // Return null instead of loading overlay - let the payment frame appear as soon as ready
    return null
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
            style={{
              ...styles.button,
              background: 'rgba(255,255,255,0.15)',
              color: TEXT,
              fontWeight: 600,
            }}
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
    // Stripe appends `payment_intent` + `redirect_status` to this URL after a
    // redirect-based method (3DS, wallet redirect). The booking page's return
    // effect requires a real `bookingId` to start its status poll — it was
    // previously given `blocks[0].date`, so the poll had no resolvable booking
    // and always ran to its 60s timeout instead of reporting the failure.
    const resolvedReturnUrl = localBookingId
      ? `${returnUrl.split('?')[0]}?bookingId=${encodeURIComponent(localBookingId)}`
      : returnUrl

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
            returnUrl={resolvedReturnUrl}
            amountInCents={serverAmount}
            labels={labels}
            agreedToTerms={agreedToTerms}
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
  amountInCents: number | null
  labels: StripeLabels
  agreedToTerms: boolean
  onBackToMethods: () => void
}) {
  const { bookingId, returnUrl, amountInCents, labels, agreedToTerms, onBackToMethods } = props
  const stripe = useStripe()
  const elements = useElements()
  const t = useTranslations('book')
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!stripe || !elements || submitting) return

    // Block submission if terms are not agreed — the "failed" screen is reserved
    // for genuine payment failures (card declined, Stripe error), not for a
    // missing checkbox tick. Stay on the form and show the inline error.
    if (!agreedToTerms) {
      setErr(labels.terms_required)
      return
    }

    setSubmitting(true)
    setErr(null)

    try {
      // confirmPayment resolves immediately for non-redirect methods (declines,
      // wallet cancellations) — only redirect flows navigate away. `redirect:
      // 'if_required'` is what makes `paymentIntent` available in that immediate
      // case; without it Stripe resolves with `{ error }` only and a decline
      // leaves the button spinning until the caller's poll times out. Methods
      // that genuinely need a redirect still get one, via return_url.
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: returnUrl,
        },
        redirect: 'if_required',
      })

      if (error) {
        const errorKey = getStripeErrorKey(error.code)
        setErr(t(errorKey))
        return
      }

      if (paymentIntent) {
        if (paymentIntent.status === 'succeeded' || paymentIntent.status === 'processing') {
          // Hand off to the page's status poll, which is the only authority on
          // whether the booking got confirmed.
          window.location.href = `/book?bookingId=${encodeURIComponent(bookingId)}&redirect_status=succeeded`
          return
        }
        // requires_payment_method / requires_action / canceled — the customer
        // dismissed the wallet sheet or the method was rejected. Report it now.
        setErr(t('stripe_error_generic'))
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
        {submitting
          ? labels.processing
          : amountInCents !== null
            ? `${labels.title} HK$${(amountInCents / 100).toLocaleString('en-HK', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
            : `${labels.title}`}
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

      {/* Stripe security badge */}
      <p style={{
        fontSize: 12,
        color: TEXT_FAINT,
        textAlign: 'center',
        marginTop: 16,
        marginBottom: 0,
      }}>
        Stripe 加密支付・資料安全傳輸
      </p>
    </form>
  )
}
<<<<<<< HEAD

/** mm:ss countdown to `until`, plus an `urgent` flag for the final 2 minutes
 *  (Loss Aversion: the reminder should read as more urgent as the deadline
 *  approaches, not stay a flat static color the whole 15 minutes). */
function useCountdown(until: string | null): { text: string; urgent: boolean } | null {
  const [remainingMs, setRemainingMs] = useState<number | null>(null)

  useEffect(() => {
    if (!until) {
      setRemainingMs(null)
      return
    }
    const target = new Date(until).getTime()
    const tick = () => setRemainingMs(Math.max(0, target - Date.now()))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [until])

  if (remainingMs === null) return null
  const totalSeconds = Math.floor(remainingMs / 1000)
  const mm = String(Math.floor(totalSeconds / 60)).padStart(2, "0")
  const ss = String(totalSeconds % 60).padStart(2, "0")
  return { text: `${mm}:${ss}`, urgent: totalSeconds <= 120 }
}

/**
 * Embedded Stripe payment: locks the slot (now that the user is logged in),
 * creates the PaymentIntent, and renders the themed Payment Element under the
 * page's own checkout chrome. Redirect-based confirmation (return to returnPath)
 * so Alipay / WeChat / wallets all work.
 */
export default function StripePayment(props: Props) {
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [bookingId, setBookingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [lockedUntil, setLockedUntil] = useState<string | null>(null)
  const countdown = useCountdown(lockedUntil)

  const promoCode = props.promoCode
  const pointsAmount = props.pointsAmount ?? 0
  const displayTotal = promoCode ? promoCode.final_amount : props.total

  // Grouped when more than one block was selected (Task 3).
  const blocks = props.blocks && props.blocks.length > 1 ? props.blocks : null
  const blocksKey = blocks
    ? blocks.map((b) => `${b.date}|${b.startHour}|${b.duration}|${b.tableNumber}`).join(",")
    : `${props.date}|${props.startHour}|${props.duration}|${props.tableNumber}`

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        // Lock: multi-block sends { blocks[] } (atomic all-or-nothing), single
        // sends the flat form. Response gives slotId(s) [+ orderGroupId].
        const lockBody = blocks
          ? { blocks }
          : {
              date: props.date,
              startHour: props.startHour,
              duration: props.duration,
              tableNumber: props.tableNumber,
            }
        const lockRes = await fetch("/api/booking/lock", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(lockBody),
        })
        const lockJson = await lockRes.json()
        if (!lockRes.ok) {
          // A 409 with reason 'unavailable' means we lost a slot to a concurrent
          // booker (advisory-lock path; for groups, ANY block being taken rolls
          // the whole lock back). Surface the clear "someone just took this" copy.
          if (lockRes.status === 409 && lockJson?.reason === "unavailable") {
            throw new Error(SLOT_TAKEN)
          }
          throw new Error(lockJson.detail || lockJson.error || "lock failed")
        }
        if (!cancelled) setLockedUntil(lockJson.lockedUntil ?? null)

        // Create intent: multi sends { slotIds, orderGroupId }, single sends { slotId }.
        // Include promo code if applied — re-validated server-side.
        const intentBody: Record<string, unknown> = blocks
          ? { slotIds: lockJson.slotIds, orderGroupId: lockJson.orderGroupId }
          : { slotId: lockJson.slotId }
        if (promoCode) {
          intentBody.promoCode = promoCode.code
        } else if (pointsAmount > 0) {
          // Never both: prepare_checkout rejects the combination outright.
          intentBody.pointsAmount = pointsAmount
        }
        const intentRes = await fetch("/api/payment/create-intent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(intentBody),
        })

        // Safe JSON parsing: the API guarantees JSON, but a proxy/nginx/vercel
        // edge error could produce HTML. Never raw-parse response.json().
        let intentJson: Record<string, unknown>
        try {
          intentJson = await intentRes.json()
        } catch {
          throw new Error("intent_failed")
        }

        if (!intentRes.ok) {
          // 409 + booking_expired = the slot lock expired before the user paid.
          if (intentRes.status === 409 && intentJson?.error === "booking_expired") {
            throw new Error(BOOKING_EXPIRED)
          }
          throw new Error(
            typeof intentJson?.detail === "string"
              ? intentJson.detail
              : typeof intentJson?.error === "string"
                ? intentJson.error
                : "intent_failed",
          )
        }

        if (!cancelled) {
          setClientSecret(typeof intentJson.clientSecret === "string" ? intentJson.clientSecret : null)
          setBookingId(typeof intentJson.bookingId === "string" ? intentJson.bookingId : null)
        }
      } catch (e) {
        if (!cancelled) setError((e as Error).message)
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocksKey])

  if (error) {
    // Slot lost to a concurrent booker: show ONLY the clear "pick another time"
    // message — no generic errorLabel, no raw detail (there's nothing to
    // diagnose, the slot is simply gone).
    if (error === SLOT_TAKEN) {
      return (
        <div className="glass-panel" style={{ textAlign: "center", padding: "24px 20px", borderRadius: 16 }}>
          <p style={{ fontSize: 14, color: "#f87171", marginBottom: props.onBackToSlots ? 16 : 0 }}>
            {props.slotTakenLabel}
          </p>
          {props.onBackToSlots && (
            <button
              type="button"
              onClick={props.onBackToSlots}
              style={{
                minHeight: 44,
                padding: "0 24px",
                borderRadius: 9999,
                border: "none",
                background: "#22c55e",
                color: "#000",
                fontWeight: 700,
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              {props.backToSlotsLabel}
            </button>
          )}
        </div>
      )
    }

    // Slot lock expired before payment: show a dedicated "booking expired"
    // screen with a clock icon, clear explanation, and a CTA to rebook.
    if (error === BOOKING_EXPIRED) {
      return (
        <div className="glass-panel" style={{ textAlign: "center", padding: "32px 20px", borderRadius: 16 }}>
          <div style={{ fontSize: 36, marginBottom: 12, lineHeight: 1, opacity: 0.7 }}>⏳</div>
          <p style={{ fontSize: 17, fontWeight: 700, color: tokens.colors.text, margin: "0 0 8px" }}>
            {props.bookingExpiredLabel}
          </p>
          <p style={{ fontSize: 13, color: tokens.colors.textMuted, margin: "0 0 24px", lineHeight: 1.6, maxWidth: 320, marginLeft: "auto", marginRight: "auto" }}>
            {props.bookingExpiredDescLabel}
          </p>
          {props.onBackToSlots && (
            <button
              type="button"
              onClick={props.onBackToSlots}
              style={{
                minHeight: 44,
                padding: "0 28px",
                borderRadius: 9999,
                border: "none",
                background: "#22c55e",
                color: "#000",
                fontWeight: 700,
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              {props.backToSlotsLabel}
            </button>
          )}
        </div>
      )
    }
    return (
      <div className="glass-panel" style={{ textAlign: "center", padding: "24px 20px", borderRadius: 16 }}>
        <p style={{ fontSize: 14, color: "#f87171" }}>{props.errorLabel}</p>
        {/* Show the REAL captured cause (lock expired / not authenticated / Stripe
            error / pricing misconfig) beneath the friendly label, so a failure is
            diagnosable instead of a dead-end "couldn't start payment". */}
        <p style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", marginTop: 6, marginBottom: props.onBackToSlots ? 16 : 0 }}>
          {error}
        </p>
        {props.onBackToSlots && (
          <button
            type="button"
            onClick={props.onBackToSlots}
            style={{
              minHeight: 44,
              padding: "0 24px",
              borderRadius: 9999,
              border: "none",
              background: "#22c55e",
              color: "#000",
              fontWeight: 700,
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            {props.backToSlotsLabel}
          </button>
        )}
      </div>
    )
  }
  if (!clientSecret || !bookingId) {
    return (
      <p style={{ fontSize: 14, color: "rgba(255,255,255,0.6)", textAlign: "center", padding: "16px 0" }}>
        {props.loadingLabel}
      </p>
    )
  }

  return (
    <Elements
      stripe={stripePromise}
      options={{ clientSecret, appearance, locale: STRIPE_LOCALES[props.locale] ?? "auto" }}
    >
      {countdown && (
        <p
          style={{
            textAlign: "center",
            fontSize: 13,
            fontWeight: countdown.urgent ? 700 : 400,
            color: countdown.urgent ? "#FF453A" : "rgba(255,255,255,0.55)", // DANGER (KPay)
            marginBottom: 12,
            transition: "color 0.3s ease",
          }}
          aria-live="polite"
        >
          {props.lockHoldLabel.replace("{time}", countdown.text)}
        </p>
      )}
      {/* Promo code input — placed above the Payment Element so users can
          apply a discount before entering payment details. */}
      <PromoCodeInput
        originalTotal={props.total}
        activeCode={promoCode}
        onApply={props.onPromoChange}
        onRemove={() => props.onPromoChange(null)}
      />
      {/* Show discounted total when promo is applied */}
      {promoCode && (
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '12px 0', borderTop: '1px solid rgba(255,255,255,0.08)',
          marginBottom: 8,
        }}>
          <span style={{ fontSize: 13, color: '#A1A1A6' }}>Total after discount</span>
          <div style={{ textAlign: 'right' }}>
            <s style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', marginRight: 8 }}>
              HK${props.total}
            </s>
            <span style={{ fontSize: 18, fontWeight: 700, color: '#22c55e' }}>
              HK${promoCode.final_amount}
            </span>
          </div>
        </div>
      )}
      <PayForm
        bookingId={bookingId}
        returnPath={props.returnPath ?? "/book"}
        payLabel={props.payLabel}
        processingLabel={props.processingLabel}
        paymentFailedLabel={props.paymentFailedLabel}
        whatsappSupportLabel={props.whatsappSupportLabel}
        retryPaymentLabel={props.retryPaymentLabel}
        billingDetails={props.billingDetails}
        locale={props.locale}
        date={props.date}
        startHour={props.startHour}
        total={displayTotal}
        payDisabled={props.payDisabled}
        onDisabledPayClick={props.onDisabledPayClick}
      />
      {/* Powered by Stripe branding - required by Stripe brand guidelines
          https://stripe.com/newsroom/information
          https://stripe.com/marks/legal */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: 14, opacity: 0.5 }}>
        <span style={{ fontSize: 11, color: '#A1A1A6' }}>Powered by</span>
        <img
          src="https://cdn.brandfolder.io/KGT2DTA4/at/8vbr8k4mr5xjwk4hxq4t9vs/Stripe_wordmark_-_blurple.svg"
          alt="Stripe"
          style={{ height: 12, marginLeft: 6 }}
        />
      </div>
    </Elements>
  )
}
=======
>>>>>>> origin/main
