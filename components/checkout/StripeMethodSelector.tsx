"use client"

// ────────────────────────────────────────────────────────────────
// StripeMethodSelector — Single-stage Stripe payment selector with
// inline PaymentElement expansion. 6-row list where clicking an
// enabled method expands the Stripe payment interface below that row.
// ────────────────────────────────────────────────────────────────

import { useState, useEffect } from "react"
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js"
import type { Appearance, StripeElementLocale } from "@stripe/stripe-js"
import { getStripeClient } from "@/lib/stripe/client"
import { tokens } from "@/app/styles/tokens"
import { Check, ChevronRight, Lock } from "lucide-react"

const stripePromise = getStripeClient()

// ── Payment Method Definitions ─────────────────────────────────

type StripeMethodId = 'card' | 'alipay' | 'alipay_cn' | 'google_pay' | 'apple_pay' | 'wechat_pay'

type MethodConfig = {
  id: StripeMethodId
  label: string
  sublabel: string
  enabled: boolean // Dashboard 已開通
  icon: React.ReactNode
}

const METHODS: MethodConfig[] = [
  {
    id: 'card',
    label: '信用卡',
    sublabel: 'Visa · Mastercard · UnionPay',
    enabled: true,
    icon: <span style={{ fontSize: 20 }}>💳</span>,
  },
  {
    id: 'alipay',
    label: '支付宝',
    sublabel: 'Alipay HK',
    enabled: false,
    icon: <span style={{ fontSize: 20 }}>🅰️</span>,
  },
  {
    id: 'alipay_cn',
    label: '支付寶',
    sublabel: 'Alipay 中國內地帳戶',
    enabled: false,
    icon: <span style={{ fontSize: 20 }}>🇨🇳</span>,
  },
  {
    id: 'google_pay',
    label: 'Google Pay',
    sublabel: '',
    enabled: false,
    icon: (
      <img
        src="/logos/payment/google.png"
        alt="Google Pay"
        style={{ height: 20, width: 'auto' }}
      />
    ),
  },
  {
    id: 'apple_pay',
    label: 'Apple Pay',
    sublabel: '',
    enabled: false,
    icon: (
      <img
        src="/logos/payment/apple.png"
        alt="Apple Pay"
        style={{ height: 20, width: 'auto' }}
      />
    ),
  },
  {
    id: 'wechat_pay',
    label: '微信支付',
    sublabel: 'WeChat Pay',
    enabled: true,
    icon: <span style={{ fontSize: 20 }}>💬</span>,
  },
]

// ── Stripe PaymentElement Appearance (深色主題，圓角 16px) ───

const appearance: Appearance = {
  theme: "night",
  variables: {
    colorPrimary: "#22b86b",
    colorBackground: "#0F131C",
    colorText: "#ffffff",
    colorTextSecondary: "rgba(255,255,255,0.72)",
    borderRadius: "16px",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', system-ui, sans-serif",
    spacingUnit: "4px",
  },
  rules: {
    ".Tab": {
      display: "none", // 隱藏 tabs，因為我哋喺上面 row 已經揀咗 method
    },
    ".Input": {
      borderRadius: "16px",
      backgroundColor: "#0F131C",
      border: "1px solid rgba(255,255,255,0.1)",
      padding: "12px 16px",
    },
    ".Input:focus": {
      borderColor: "#22b86b",
      boxShadow: "0 0 0 1px #22b86b",
    },
    ".Label": {
      color: "rgba(255,255,255,0.72)",
      fontSize: "14px",
      fontWeight: "600",
    },
  },
}

const STRIPE_LOCALES: Record<string, StripeElementLocale> = {
  "zh-HK": "zh-HK",
  "zh-CN": "zh",
  en: "en",
}

// ── PaymentForm (inline expansion below selected row) ─────────

function PaymentForm({
  method,
  bookingId,
  clientSecret,
  returnPath,
  locale,
  billingDetails,
  payLabel,
  processingLabel,
  paymentFailedLabel,
  payDisabled,
  onDisabledPayClick,
}: {
  method: StripeMethodId
  bookingId: string
  clientSecret: string
  returnPath: string
  locale: 'zh-HK' | 'zh-CN' | 'en'
  billingDetails?: { name: string; email: string; phone: string }
  payLabel: string
  processingLabel: string
  paymentFailedLabel: string
  payDisabled?: boolean
  onDisabledPayClick?: () => void
}) {
  const stripe = useStripe()
  const elements = useElements()
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (payDisabled) {
      onDisabledPayClick?.()
      return
    }
    if (!stripe || !elements) return
    setSubmitting(true)
    setErr(null)

    const returnUrl = `${window.location.origin}${returnPath}?bookingId=${bookingId}&redirect_status=succeeded`

    const prefilledBilling: {
      name?: string
      email?: string
      phone?: string
      address: { country: string; postal_code: string }
    } = {
      address: { country: "HK", postal_code: "" },
    }
    if (billingDetails?.name) prefilledBilling.name = billingDetails.name
    if (billingDetails?.email) prefilledBilling.email = billingDetails.email
    if (billingDetails?.phone) prefilledBilling.phone = billingDetails.phone

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: returnUrl,
        payment_method_data: { billing_details: prefilledBilling },
      },
      redirect: "if_required",
    })

    if (error) {
      console.error("[stripe] confirm_error", {
        bookingId,
        message: error.message,
        type: error.type,
        code: error.code,
      })
      setErr(error.message ?? paymentFailedLabel)
      setSubmitting(false)
      return
    }
    if (paymentIntent && paymentIntent.status !== "succeeded" && paymentIntent.status !== "processing") {
      console.error("[stripe] unexpected_status", {
        bookingId,
        status: paymentIntent.status,
        id: paymentIntent.id,
      })
      setErr(paymentFailedLabel)
      setSubmitting(false)
      return
    }
    console.log("[stripe] confirm_success", {
      bookingId,
      status: paymentIntent?.status,
      id: paymentIntent?.id,
    })
    window.location.href = returnUrl
  }

  return (
    <form onSubmit={onSubmit} style={{ padding: "16px 0 0" }}>
      <PaymentElement
        options={{
          layout: "tabs",
          fields: {
            billingDetails: {
              address: { postalCode: "never", country: "never" },
              name: billingDetails?.name ? "never" : "auto",
              email: billingDetails?.email ? "never" : "auto",
              phone: billingDetails?.phone ? "never" : "auto",
            },
          },
          defaultValues: billingDetails
            ? {
                billingDetails: {
                  name: billingDetails.name || undefined,
                  email: billingDetails.email || undefined,
                  phone: billingDetails.phone || undefined,
                },
              }
            : undefined,
        }}
      />
      {err && (
        <div style={{ marginTop: 12 }} role="alert" aria-live="polite">
          <p style={{ fontSize: 13, color: "#f87171", margin: 0 }}>{err}</p>
        </div>
      )}
      <button
        type="submit"
        disabled={!stripe || submitting}
        aria-disabled={payDisabled || undefined}
        style={{
          marginTop: 20,
          width: "100%",
          height: 54,
          border: "none",
          borderRadius: 14,
          background: submitting || payDisabled ? "rgba(255,255,255,0.15)" : "#22c55e",
          color: submitting || payDisabled ? "rgba(255,255,255,0.6)" : "#000",
          fontWeight: 700,
          fontSize: 17,
          cursor: submitting ? "not-allowed" : "pointer",
        }}
      >
        {submitting ? processingLabel : payLabel}
      </button>
    </form>
  )
}

// ── Main Component ─────────────────────────────────────────────

export type BookingBlock = {
  date: string // 'YYYY-MM-DD'
  startHour: number
  duration: number
  tableNumber: number
}

export type PromoResult = {
  code: string
  discount_type: 'percentage' | 'fixed_amount'
  discount_value: number
  discount_amount: number
  final_amount: number
}

type Props = {
  date: string
  startHour: number
  duration: number
  tableNumber: number
  blocks?: BookingBlock[]
  total: number
  promoCode: PromoResult | null
  onPromoChange: (promo: PromoResult | null) => void
  pointsAmount?: number
  locale: 'zh-HK' | 'zh-CN' | 'en'
  returnPath: string
  billingDetails?: { name: string; email: string; phone: string }
  onBackToSlots?: () => void
  payLabel: string
  processingLabel: string
  errorLabel: string
  loadingLabel: string
  comingSoonLabel: string
  lockHoldLabel: string
  slotTakenLabel: string
  bookingExpiredLabel: string
  bookingExpiredDescLabel: string
  paymentFailedLabel: string
  whatsappSupportLabel: string
  retryPaymentLabel: string
  backToSlotsLabel: string
  payDisabled?: boolean
  onDisabledPayClick?: () => void
}

// Internal sentinels (same as StripePayment.tsx)
const SLOT_TAKEN = "__slot_taken__"
const BOOKING_EXPIRED = "__booking_expired__"

export default function StripeMethodSelector(props: Props) {
  const [selected, setSelected] = useState<StripeMethodId | null>(null)
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [bookingId, setBookingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [lockedUntil, setLockedUntil] = useState<string | null>(null)

  const promoCode = props.promoCode
  const pointsAmount = props.pointsAmount ?? 0
  const displayTotal = promoCode ? promoCode.final_amount : props.total

  const blocks = props.blocks && props.blocks.length > 1 ? props.blocks : null
  const blocksKey = blocks
    ? blocks.map((b) => `${b.date}|${b.startHour}|${b.duration}|${b.tableNumber}`).join(",")
    : `${props.date}|${props.startHour}|${props.duration}|${props.tableNumber}`

  // Lock + create intent when method is selected
  useEffect(() => {
    if (!selected) {
      setClientSecret(null)
      setBookingId(null)
      return
    }

    let cancelled = false
    ;(async () => {
      try {
        // Lock
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
          if (lockRes.status === 409 && lockJson?.reason === "unavailable") {
            throw new Error(SLOT_TAKEN)
          }
          throw new Error(lockJson.detail || lockJson.error || "lock failed")
        }
        if (!cancelled) setLockedUntil(lockJson.lockedUntil ?? null)

        // Create intent
        const intentBody: Record<string, unknown> = blocks
          ? { slotIds: lockJson.slotIds, orderGroupId: lockJson.orderGroupId }
          : { slotId: lockJson.slotId }
        if (promoCode) {
          intentBody.promoCode = promoCode.code
        } else if (pointsAmount > 0) {
          intentBody.pointsAmount = pointsAmount
        }
        const intentRes = await fetch("/api/payment/create-intent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(intentBody),
        })

        let intentJson: Record<string, unknown>
        try {
          intentJson = await intentRes.json()
        } catch {
          throw new Error("intent_failed")
        }

        if (!intentRes.ok) {
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
  }, [selected, blocksKey])

  const handleSelect = (method: MethodConfig) => {
    if (!method.enabled) {
      // Toast: 即將推出
      if (typeof window !== 'undefined' && (window as any).showToast) {
        (window as any).showToast(props.comingSoonLabel, 'info')
      }
      return
    }
    setError(null)
    setSelected(method.id === selected ? null : method.id)
  }

  // Error states
  if (error) {
    if (error === SLOT_TAKEN) {
      return (
        <div style={{ textAlign: "center", padding: "24px 20px", borderRadius: 16, background: "#0F131C", border: "1px solid rgba(255,255,255,0.1)" }}>
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

    if (error === BOOKING_EXPIRED) {
      return (
        <div style={{ textAlign: "center", padding: "32px 20px", borderRadius: 16, background: "#0F131C", border: "1px solid rgba(255,255,255,0.1)" }}>
          <div style={{ fontSize: 36, marginBottom: 12, lineHeight: 1, opacity: 0.7 }}>⏳</div>
          <p style={{ fontSize: 17, fontWeight: 700, color: "#fff", margin: "0 0 8px" }}>
            {props.bookingExpiredLabel}
          </p>
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", margin: "0 0 24px", lineHeight: 1.6, maxWidth: 320, marginLeft: "auto", marginRight: "auto" }}>
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
      <div style={{ textAlign: "center", padding: "24px 20px", borderRadius: 16, background: "#0F131C", border: "1px solid rgba(255,255,255,0.1)" }}>
        <p style={{ fontSize: 14, color: "#f87171" }}>{props.errorLabel}</p>
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

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {METHODS.map((method) => {
        const isSelected = selected === method.id
        const isExpanded = isSelected && method.enabled

        return (
          <div key={method.id}>
            {/* Row */}
            <button
              type="button"
              onClick={() => handleSelect(method)}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "16px 20px",
                background: isSelected ? "#161D2B" : "#0F131C",
                border: isSelected ? "1px solid #22b86b" : "1px solid rgba(255,255,255,0.1)",
                borderRadius: 16,
                cursor: method.enabled ? "pointer" : "not-allowed",
                transition: "all 0.2s ease",
                boxShadow: isSelected ? "0 0 0 2px rgba(34,184,107,0.2)" : "none",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                {/* Radio circle */}
                <div
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 999,
                    border: `2px solid ${isSelected ? "#22b86b" : "rgba(255,255,255,0.3)"}`,
                    background: isSelected ? "#22b86b" : "transparent",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  {isSelected && <Check size={12} color="#000" strokeWidth={3} />}
                </div>
                {/* Icon */}
                <div style={{ flexShrink: 0 }}>{method.icon}</div>
                {/* Label */}
                <div style={{ textAlign: "left" }}>
                  <div style={{ fontSize: 16, fontWeight: 600, color: "#fff" }}>
                    {method.label}
                  </div>
                  {method.sublabel && (
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)" }}>
                      {method.sublabel}
                    </div>
                  )}
                </div>
              </div>
              {/* Right indicator */}
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {!method.enabled && (
                  <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", display: "flex", alignItems: "center", gap: 4 }}>
                    <Lock size={12} />
                    即將推出
                  </span>
                )}
                {method.enabled && (
                  <ChevronRight
                    size={20}
                    color="rgba(255,255,255,0.4)"
                    style={{
                      transform: isSelected ? "rotate(90deg)" : "rotate(0deg)",
                      transition: "transform 0.2s ease",
                    }}
                  />
                )}
              </div>
            </button>

            {/* Expanded payment form */}
            {isExpanded && clientSecret && bookingId && (
              <div
                style={{
                  marginTop: -8,
                  padding: "24px 20px 20px",
                  background: "#0A0D12",
                  borderBottomLeftRadius: 16,
                  borderBottomRightRadius: 16,
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderTop: "none",
                }}
              >
                <Elements
                  stripe={stripePromise}
                  options={{
                    clientSecret: clientSecret,
                    appearance,
                    locale: STRIPE_LOCALES[props.locale] ?? "auto",
                  }}
                >
                  <PaymentForm
                    method={method.id}
                    bookingId={bookingId}
                    clientSecret={clientSecret}
                    returnPath={props.returnPath}
                    locale={props.locale}
                    billingDetails={props.billingDetails}
                    payLabel={props.payLabel}
                    processingLabel={props.processingLabel}
                    paymentFailedLabel={props.paymentFailedLabel}
                    payDisabled={props.payDisabled}
                    onDisabledPayClick={props.onDisabledPayClick}
                  />
                </Elements>
              </div>
            )}
          </div>
        )
      })}

      {/* Powered by Stripe branding */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: 14, opacity: 0.5 }}>
        <span style={{ fontSize: 11, color: '#A1A1A6' }}>Powered by</span>
        <img
          src="/logos/Powered by Stripe/Powered by Stripe - white.svg"
          alt="Stripe"
          style={{ height: 12, marginLeft: 6 }}
          onError={(e) => {
            // Fallback 去 blurple 版本
            const target = e.target as HTMLImageElement
            if (target.src.includes('white.svg')) {
              target.src = "/logos/Powered by Stripe/Powered by Stripe - blurple.svg"
            }
          }}
        />
      </div>
    </div>
  )
}
