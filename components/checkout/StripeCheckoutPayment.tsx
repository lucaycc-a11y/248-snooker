"use client"

// ──────────────────────────────────────────────────────────────────────────
// StripeCheckoutPayment — unified checkout flow for Stripe provider
// Uses /api/checkout/create (same as KPay) to create PaymentIntent with
// client_secret, then renders Stripe Payment Element.
//
// Wallet fallback behavior:
// - PaymentMethodList always shows Apple Pay / Google Pay options
// - When user selects a wallet, Payment Element renders with that method
// - If device doesn't support the wallet, Payment Element automatically
//   falls back to card input (Stripe's native behavior)
// - A lightweight toast notification informs the user of the fallback
// ──────────────────────────────────────────────────────────────────────────

import { useEffect, useState, useCallback } from "react"
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js"
import type { Appearance, StripeElementLocale } from "@stripe/stripe-js"
import { loadStripe } from "@stripe/stripe-js"
import { tokens } from "@/app/styles/tokens"

// Initialize Stripe with publishable key
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "")

// Match booking page's design (black + green)
const appearance: Appearance = {
  theme: "night",
  variables: {
    colorPrimary: "#22c55e",
    colorBackground: "#000000",
    colorText: "#ffffff",
    colorTextSecondary: "#a3a3a3",
    borderRadius: "12px",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', system-ui, sans-serif",
    spacingUnit: "4px",
  },
  rules: {
    ".Tab": {
      border: "1px solid #333333",
      borderRadius: "12px",
      backgroundColor: "#111111",
    },
    ".Tab--selected": {
      backgroundColor: "#22c55e",
      borderColor: "#22c55e",
      color: "#000000",
    },
    ".Input": {
      borderRadius: "12px",
      backgroundColor: "#111111",
      border: "1px solid #333333",
    },
    ".Input:focus": {
      borderColor: "#22c55e",
    },
  },
}

const STRIPE_LOCALES: Record<string, StripeElementLocale> = {
  "zh-HK": "zh-HK",
  "zh-CN": "zh",
  en: "en",
  ja: "ja",
}

export type PaymentMethodType = 'card' | 'alipay' | 'apple_pay' | 'google_pay'

type Block = { date: string; startHour: number; duration: number; tableNumber: 1 | 2 }

type Labels = {
  processing: string
  payButton: string
  error: string
  loading: string
  walletFallback: string // "此裝置不支援 {wallet}，已切換至信用卡付款"
}

type Props = Labels & {
  blocks: Block[]
  method: PaymentMethodType
  agreedToTerms: boolean
  pointsAmount?: number
  promoCode?: string | null
  locale: 'zh-HK' | 'zh-CN' | 'en' | 'ja'
  onBackToMethods: () => void
  onSuccess: (bookingId?: string) => void
}

function PaymentForm({
  clientSecret,
  bookingId,
  method,
  labels,
  locale,
  onSuccess,
}: {
  clientSecret: string
  bookingId: string
  method: PaymentMethodType
  labels: Labels
  locale: 'zh-HK' | 'zh-CN' | 'en' | 'ja'
  onSuccess: (bookingId?: string) => void
}) {
  const stripe = useStripe()
  const elements = useElements()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [walletFallbackNotice, setWalletFallbackNotice] = useState<string | null>(null)

  // Detect if wallet is not supported and show fallback notice
  useEffect(() => {
    if (!stripe || (method !== 'apple_pay' && method !== 'google_pay')) return

    const checkWalletSupport = async () => {
      try {
        const paymentRequest = stripe.paymentRequest({
          country: 'HK',
          currency: 'hkd',
          total: { label: 'Test', amount: 100 },
          requestPayerName: false,
          requestPayerEmail: false,
        })

        const result = await paymentRequest.canMakePayment()
        if (!result) {
          // Wallet not supported — show fallback notice
          const walletName = method === 'apple_pay' ? 'Apple Pay' : 'Google Pay'
          setWalletFallbackNotice(labels.walletFallback.replace('{wallet}', walletName))
        }
      } catch (err) {
        console.warn('[StripeCheckout] wallet detection failed', err)
        // Fallback silently — Payment Element will handle it
      }
    }

    void checkWalletSupport()
  }, [stripe, method, labels.walletFallback])

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (!stripe || !elements || submitting) return

    setSubmitting(true)
    setError(null)

    const localePrefix = window.location.pathname.match(/^\/(zh-HK|zh-CN|en|ja)(?=\/|$)/)?.[1]
    const returnUrl = `${window.location.origin}${localePrefix ? `/${localePrefix}` : ''}/book/confirm?bookingId=${encodeURIComponent(bookingId)}&redirect_status=succeeded`

    const { error: submitError } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: returnUrl,
      },
      redirect: 'if_required',
    })

    if (submitError) {
      console.error('[StripeCheckout] confirm error', submitError)
      setError(submitError.message ?? labels.error)
      setSubmitting(false)
      return
    }

    // Success without redirect (e.g. card)
    console.log('[StripeCheckout] payment succeeded', { bookingId })
    onSuccess(bookingId)
  }, [stripe, elements, submitting, bookingId, labels.error, onSuccess])

  return (
    <form onSubmit={handleSubmit}>
      {walletFallbackNotice && (
        <div style={{
          padding: '10px 14px',
          marginBottom: 12,
          borderRadius: 8,
          background: 'rgba(34, 197, 94, 0.1)',
          border: '1px solid rgba(34, 197, 94, 0.3)',
        }}>
          <p style={{ fontSize: 12, color: '#22c55e', margin: 0, lineHeight: 1.5 }}>
            ℹ️ {walletFallbackNotice}
          </p>
        </div>
      )}
      <PaymentElement />
      {error && (
        <div style={{ marginTop: 12 }} role="alert">
          <p style={{ fontSize: 13, color: '#f87171', margin: 0 }}>{error}</p>
        </div>
      )}
      <button
        type="submit"
        disabled={!stripe || submitting}
        style={{
          marginTop: 20,
          width: '100%',
          height: 54,
          border: 'none',
          borderRadius: 14,
          background: submitting ? 'rgba(255,255,255,0.15)' : '#22c55e',
          color: submitting ? 'rgba(255,255,255,0.6)' : '#000',
          fontWeight: 700,
          fontSize: 17,
          cursor: submitting ? 'not-allowed' : 'pointer',
          transition: 'all 0.2s ease',
        }}
      >
        {submitting ? labels.processing : labels.payButton}
      </button>
    </form>
  )
}

export default function StripeCheckoutPayment(props: Props) {
  const {
    blocks, method, agreedToTerms, pointsAmount, promoCode, locale,
    onBackToMethods, onSuccess, ...labels
  } = props

  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [bookingId, setBookingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    if (!agreedToTerms) return

    let cancelled = false
    setCreating(true)
    setError(null)

    const createCheckout = async () => {
      try {
        const localePrefix = window.location.pathname.match(/^\/(zh-HK|zh-CN|en|ja)(?=\/|$)/)?.[1]
        const confirmPath = `${localePrefix ? `/${localePrefix}` : ''}/book/confirm`

        const body: Record<string, unknown> = {
          method,
          mode: 'h5', // Not used by Stripe, but required by API
          agreedToTerms: true,
          returnUrl: `${window.location.origin}${confirmPath}`,
          blocks: blocks.map((b) => ({
            date: b.date,
            startHour: b.startHour,
            duration: b.duration,
            tableNumber: b.tableNumber,
          })),
        }

        if (pointsAmount && pointsAmount > 0) {
          body.pointsAmount = pointsAmount
        }
        if (promoCode) {
          body.promoCode = promoCode
        }

        const res = await fetch('/api/checkout/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })

        if (!res.ok) {
          const errBody = await res.json().catch(() => null)
          throw new Error(errBody?.error ?? 'Checkout creation failed')
        }

        const json = await res.json()

        if (cancelled) return

        // Stripe returns kind='client_secret'
        if (json.kind === 'client_secret' && json.payInfo) {
          setClientSecret(json.payInfo)
          setBookingId(json.bookingId)
        } else {
          throw new Error('Invalid response from checkout API')
        }
      } catch (err) {
        if (!cancelled) {
          console.error('[StripeCheckout] create error', err)
          setError((err as Error).message)
        }
      } finally {
        if (!cancelled) setCreating(false)
      }
    }

    void createCheckout()

    return () => {
      cancelled = true
    }
  }, [agreedToTerms, blocks, method, pointsAmount, promoCode])

  if (error) {
    return (
      <div style={{
        padding: '24px 20px',
        textAlign: 'center',
        borderRadius: 16,
        background: tokens.colors.surface,
        border: `1px solid ${tokens.colors.border}`,
      }}>
        <p style={{ fontSize: 14, color: '#f87171', margin: '0 0 16px' }}>
          {error}
        </p>
        <button
          type="button"
          onClick={onBackToMethods}
          style={{
            minHeight: 44,
            padding: '0 24px',
            borderRadius: 9999,
            border: 'none',
            background: '#22c55e',
            color: '#000',
            fontWeight: 700,
            fontSize: 14,
            cursor: 'pointer',
          }}
        >
          返回付款方式
        </button>
      </div>
    )
  }

  if (creating || !clientSecret || !bookingId) {
    return (
      <div style={{ padding: '32px 0', textAlign: 'center' }}>
        <div style={{
          width: 40,
          height: 40,
          border: '3px solid rgba(255,255,255,0.1)',
          borderTopColor: '#22c55e',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
          margin: '0 auto 12px',
        }} />
        <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', margin: 0 }}>
          {labels.loading}
        </p>
      </div>
    )
  }

  return (
    <Elements
      stripe={stripePromise}
      options={{
        clientSecret,
        appearance,
        locale: STRIPE_LOCALES[locale] ?? 'auto',
      }}
    >
      <PaymentForm
        clientSecret={clientSecret}
        bookingId={bookingId}
        method={method}
        labels={labels}
        locale={locale}
        onSuccess={onSuccess}
      />
    </Elements>
  )
}
