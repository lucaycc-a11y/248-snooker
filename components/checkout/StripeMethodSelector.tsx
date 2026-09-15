"use client"

// ────────────────────────────────────────────────────────────────
// StripeMethodSelector — Single-stage Stripe payment selector with
// inline expansion. Card methods show PaymentElement; QR methods
// (WeChat Pay) show QR code UI instead of PaymentElement.
// Ensures card input fields and QR UI are mutually exclusive.
// ────────────────────────────────────────────────────────────────

import { useState, useEffect } from "react"
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js"
import type { Appearance, StripeElementLocale } from "@stripe/stripe-js"
import { getStripeClient } from "@/lib/stripe/client"
import { tokens } from "@/app/styles/tokens"
import { Check, ChevronRight, Lock, QrCode } from "lucide-react"

const stripePromise = getStripeClient()

// ── Payment Method Definitions ─────────────────────────────────

type StripeMethodId = 'card' | 'alipay' | 'alipay_cn' | 'google_pay' | 'apple_pay' | 'wechat_pay'
type PaymentMethodType = 'card' | 'qr' // card: use PaymentElement, qr: show QR code

type MethodConfig = {
  id: StripeMethodId
  label: string
  sublabel: string
  enabled: boolean // Dashboard 已開通
  icon: React.ReactNode
  type: PaymentMethodType
}

const METHODS: MethodConfig[] = [
  {
    id: 'card',
    label: '信用卡',
    sublabel: 'Visa · Mastercard · UnionPay',
    enabled: true,
    icon: <span style={{ fontSize: 20 }}>💳</span>,
    type: 'card',
  },
  {
    id: 'alipay',
    label: '支付宝',
    sublabel: 'Alipay HK',
    enabled: false,
    icon: <span style={{ fontSize: 20 }}>🅰️</span>,
    type: 'qr',
  },
  {
    id: 'alipay_cn',
    label: '支付寶',
    sublabel: 'Alipay 中國內地帳戶',
    enabled: false,
    icon: <span style={{ fontSize: 20 }}>🇨🇳</span>,
    type: 'qr',
  },
  {
    id: 'google_pay',
    label: 'Google Pay',
    sublabel: '',
    enabled: false, // CHECK: verify in Stripe Dashboard
    icon: (
      <img
        src="/logos/payment/google.png"
        alt="Google Pay"
        style={{ height: 20, width: 'auto' }}
      />
    ),
    type: 'card', // Google Pay uses card network
  },
  {
    id: 'apple_pay',
    label: 'Apple Pay',
    sublabel: '',
    enabled: false, // CHECK: verify in Stripe Dashboard
    icon: (
      <img
        src="/logos/payment/apple.png"
        alt="Apple Pay"
        style={{ height: 20, width: 'auto' }}
      />
    ),
    type: 'card', // Apple Pay uses card network
  },
  {
    id: 'wechat_pay',
    label: '微信支付',
    sublabel: 'WeChat Pay',
    enabled: true,
    icon: <span style={{ fontSize: 20 }}>💬</span>,
    type: 'qr', // WeChat Pay shows QR code
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

// ── QR Code UI (for WeChat Pay / Alipay) ──────────────────────

function QRCodeUI({
  method,
  bookingId,
  clientSecret,
  returnPath,
  payLabel,
  processingLabel,
  qrInstructionLabel,
  payDisabled,
  onDisabledPayClick,
}: {
  method: StripeMethodId
  bookingId: string
  clientSecret: string
  returnPath: string
  payLabel: string
  processingLabel: string
  qrInstructionLabel: string
  payDisabled?: boolean
  onDisabledPayClick?: () => void
}) {
  const stripe = useStripe()
  const [qrUrl, setQrUrl] = useState<string | null>(null)
  const [redirectUrl, setRedirectUrl] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const handlePay = async () => {
    if (payDisabled) {
      onDisabledPayClick?.()
      return
    }
    if (!stripe) return
    setSubmitting(true)
    setErr(null)

    try {
      const returnUrl = `${window.location.origin}${returnPath}?bookingId=${bookingId}&redirect_status=succeeded`

      const { error, paymentIntent } = await stripe.confirmPayment({
        clientSecret,
        confirmParams: {
          return_url: returnUrl,
          payment_method_data: {
            billing_details: { address: { country: "HK" } },
          },
        },
        redirect: "if_required",
      })

      if (error) {
        console.error("[stripe] wechat_confirm_error", {
          bookingId,
          message: error.message,
          code: error.code,
        })
        setErr(error.message ?? "Payment failed")
        setSubmitting(false)
        return
      }

      // WeChat Pay requires user to scan QR or redirect
      if (paymentIntent?.next_action?.type === "wechat_pay_display_qr_code") {
        const nextAction = paymentIntent.next_action as any
        const qr = nextAction.wechat_pay_display_qr_code
        setQrUrl(qr?.data || null)
        console.log("[stripe] wechat_qr_ready", { bookingId, qrData: qr?.data })
      } else if (paymentIntent?.next_action?.type === "wechat_pay_redirect_to_android_app") {
        const nextAction = paymentIntent.next_action as any
        const redirect = nextAction.wechat_pay_redirect_to_android_app
        setRedirectUrl(redirect?.url || null)
        console.log("[stripe] wechat_redirect_ready", { bookingId, redirectUrl: redirect?.url })
      } else if (paymentIntent?.status === "succeeded") {
        // Rare: immediate success
        window.location.href = returnUrl
      } else {
        console.error("[stripe] unexpected_wechat_response", { paymentIntent })
        setErr("Unexpected response from payment provider")
      }

      setSubmitting(false)
    } catch (e) {
      console.error("[stripe] wechat_exception", { bookingId, error: e })
      setErr((e as Error).message)
      setSubmitting(false)
    }
  }

  return (
    <div style={{ padding: "16px 0 0" }}>
      {!qrUrl && !redirectUrl && (
        <>
          {/* Instruction text */}
          <div
            style={{
              padding: "20px",
              borderRadius: 12,
              background: "#161D2B",
              border: "1px solid rgba(255,255,255,0.1)",
              marginBottom: 16,
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
              <QrCode size={24} color="#22b86b" style={{ flexShrink: 0, marginTop: 2 }} />
              <p style={{ fontSize: 14, color: "rgba(255,255,255,0.85)", margin: 0, lineHeight: 1.5 }}>
                {qrInstructionLabel}
              </p>
            </div>
          </div>

          {err && (
            <div style={{ marginBottom: 16 }} role="alert" aria-live="polite">
              <p style={{ fontSize: 13, color: "#f87171", margin: 0 }}>{err}</p>
            </div>
          )}

          {/* Pay button */}
          <button
            type="button"
            onClick={handlePay}
            disabled={!stripe || submitting}
            aria-disabled={payDisabled || undefined}
            style={{
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
        </>
      )}

      {/* QR Code display */}
      {qrUrl && (
        <div
          style={{
            textAlign: "center",
            padding: "32px 20px",
            borderRadius: 12,
            background: "#fff",
          }}
        >
          <img
            src={qrUrl}
            alt="WeChat Pay QR Code"
            style={{ width: 240, height: 240, display: "inline-block" }}
          />
          <p style={{ fontSize: 14, color: "#0F131C", marginTop: 16, marginBottom: 0 }}>
            請使用微信掃描二維碼完成支付
          </p>
        </div>
      )}

      {/* Redirect link (H5) */}
      {redirectUrl && (
        <div style={{ textAlign: "center", padding: "24px 20px" }}>
          <a
            href={redirectUrl}
            style={{
              display: "inline-block",
              padding: "14px 28px",
              borderRadius: 9999,
              background: "#22c55e",
              color: "#000",
              fontWeight: 700,
              fontSize: 16,
              textDecoration: "none",
            }}
          >
            前往微信支付
          </a>
        </div>
      )}
    </div>
  )
}

// ── Card Payment Form (for card-based methods) ─────────────────

function CardPaymentForm({
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
      console.error("[stripe] card_confirm_error", {
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
      console.error("[stripe] unexpected_card_status", {
        bookingId,
        status: paymentIntent.status,
        id: paymentIntent.id,
      })
      setErr(paymentFailedLabel)
      setSubmitting(false)
      return
    }
    console.log("[stripe] card_confirm_success", {
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
  qrInstructionLabel: string
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

  const selectedMethod = METHODS.find((m) => m.id === selected)

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
            {isExpanded && clientSecret && bookingId && selectedMethod && (
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
                  {selectedMethod.type === 'card' ? (
                    <CardPaymentForm
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
                  ) : (
                    <QRCodeUI
                      method={method.id}
                      bookingId={bookingId}
                      clientSecret={clientSecret}
                      returnPath={props.returnPath}
                      payLabel={props.payLabel}
                      processingLabel={props.processingLabel}
                      qrInstructionLabel={props.qrInstructionLabel}
                      payDisabled={props.payDisabled}
                      onDisabledPayClick={props.onDisabledPayClick}
                    />
                  )}
                </Elements>
              </div>
            )}
          </div>
        )
      })}

      {/* Powered by Stripe branding */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          marginTop: 8,
          opacity: 0.4,
        }}
      >
        <img
          src="/logos/Powered by Stripe/Powered by Stripe - white.svg"
          alt="Powered by Stripe"
          style={{ height: 20, width: "auto" }}
        />
      </div>
    </div>
  )
}
