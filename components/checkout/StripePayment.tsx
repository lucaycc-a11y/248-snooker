"use client"

import { useEffect, useState } from "react"
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js"
import type { Appearance, StripeElementLocale } from "@stripe/stripe-js"
import { getStripeClient } from "@/lib/stripe/client"
import { getDeclineMessage, getWhatsAppSupportUrl } from "@/lib/stripe/decline-codes"

const stripePromise = getStripeClient()

// Internal sentinel: the lock effect throws this exact string when the slot was
// lost to a concurrent booker (409 + reason 'unavailable'), so the render can
// swap in the clear "someone just took this" copy instead of the generic
// lock-failure detail. Not user-facing text — matched by reference, never shown.
const SLOT_TAKEN = "__slot_taken__"

// Match the booking page's black + brand-green + pill design language.
// PaymentElement renders official, licensed method icons + native Apple/Google
// Pay buttons, so no brand assets to source ourselves. `rules` targets the
// sub-elements (method tabs, card/phone inputs) that the top-level `variables`
// don't reach on their own.
const appearance: Appearance = {
  theme: "night",
  variables: {
    colorPrimary: "#22c55e",
    colorBackground: "#000000",
    colorText: "#ffffff",
    colorTextSecondary: "#a3a3a3",
    borderRadius: "9999px",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', system-ui, sans-serif",
    spacingUnit: "4px",
  },
  rules: {
    ".Tab": {
      border: "1px solid #333333",
      borderRadius: "9999px",
      backgroundColor: "#111111",
    },
    ".Tab--selected": {
      backgroundColor: "#22c55e",
      borderColor: "#22c55e",
      color: "#000000",
    },
    ".Input": {
      borderRadius: "9999px",
      backgroundColor: "#111111",
      border: "1px solid #333333",
    },
    ".Input:focus": {
      borderColor: "#22c55e",
    },
  },
}

// next-intl locale -> closest Stripe Elements locale ('zh-CN' isn't a distinct
// Stripe locale; 'zh' covers simplified Chinese).
const STRIPE_LOCALES: Record<string, StripeElementLocale> = {
  "zh-HK": "zh-HK",
  "zh-CN": "zh",
  en: "en",
  ja: "ja",
}

type Labels = {
  payLabel: string
  processingLabel: string
  errorLabel: string
  loadingLabel: string
  lockHoldLabel: string
  /** Shown when the slot lock is lost to a concurrent booker (409/unavailable
   * from find_or_lock_slot) — a clear "someone just took this, pick another"
   * message, distinct from the generic "couldn't start payment" errorLabel. */
  slotTakenLabel: string
  /** Generic fallback shown under the Payment Element when Stripe returns no
   * message of its own (declines/validation almost always include one, but
   * some edge cases don't) — must be CMS/i18n text, never a bare English string. */
  paymentFailedLabel: string
  /** WhatsApp support call-to-action for suspected double-charge scenarios */
  whatsappSupportLabel: string
  retryPaymentLabel: string
}

/** Pre-fill for the Payment Element's billing-details fields — already known
 * from the user's profile (Screen2 gates on profile_complete), so we never
 * ask for it again. Passed through to `defaultValues` + used to disable the
 * corresponding `fields`. */
type BillingDetails = {
  name: string
  email: string
  phone: string
}

type Props = Labels & {
  date: string // 'YYYY-MM-DD'
  startHour: number
  duration: number
  tableNumber: number
  total: number
  /** Active next-intl locale — drives the Payment Element's own copy (Stripe's
   * "Pay", card-field labels, decline messages, etc.), not just our labels. */
  locale: 'zh-HK' | 'zh-CN' | 'en' | 'ja'
  /** Path Stripe returns to after a redirect method (Alipay/WeChat/3DS). */
  returnPath?: string
  billingDetails?: BillingDetails
}

function PayForm({
  bookingId,
  returnPath,
  payLabel,
  processingLabel,
  paymentFailedLabel,
  whatsappSupportLabel,
  retryPaymentLabel,
  billingDetails,
  locale,
  date,
  startHour,
  total,
}: {
  bookingId: string
  returnPath: string
  payLabel: string
  processingLabel: string
  paymentFailedLabel: string
  whatsappSupportLabel: string
  retryPaymentLabel: string
  billingDetails?: BillingDetails
  locale: 'zh-HK' | 'zh-CN' | 'en' | 'ja'
  date: string
  startHour: number
  total: number
}) {
  const stripe = useStripe()
  const elements = useElements()
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [showWhatsApp, setShowWhatsApp] = useState(false)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!stripe || !elements) return
    setSubmitting(true)
    setErr(null)
    const returnUrl = `${window.location.origin}${returnPath}?bookingId=${bookingId}`

    // We opt the Payment Element OUT of collecting any billing field we already
    // have (name/email/phone -> `fields.billingDetails.* = 'never'` below). Stripe's
    // contract: whatever you set to 'never' on the Element, you MUST supply back
    // here in confirmParams.payment_method_data.billing_details — otherwise
    // confirmPayment() throws a synchronous IntegrationError, the promise never
    // resolves, and the button hangs on "處理中" forever. Build this object to mirror
    // the `fields` config EXACTLY: include a field here iff we set it to 'never'
    // there (i.e. iff we have a non-empty value for it).
    const prefilledBilling: {
      name?: string
      email?: string
      phone?: string
    } = {}
    if (billingDetails?.name) prefilledBilling.name = billingDetails.name
    if (billingDetails?.email) prefilledBilling.email = billingDetails.email
    if (billingDetails?.phone) prefilledBilling.phone = billingDetails.phone

    // redirect: 'if_required' means Stripe only navigates away when the method
    // actually needs it (Alipay/WeChat/wallets). For 3DS on card, Stripe.js opens
    // the challenge modal in-page and confirmPayment() stays pending until the
    // user completes it — we must NOT race it against a fixed timer, or a
    // legitimately in-progress 3DS challenge gets killed and the payment hangs at
    // 'requires_action'. Stripe.js manages the challenge lifecycle and rejects on
    // its own (network/card errors surface via `error` below).
    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: returnUrl,
        ...(Object.keys(prefilledBilling).length > 0
          ? { payment_method_data: { billing_details: prefilledBilling } }
          : {}),
      },
      redirect: "if_required",
    })

    if (error) {
      // error.message is already localized by Stripe (Elements' `locale`
      // option, set below) — the fallback only fires on the rare error with
      // no message, so it must be CMS text too.
      console.error("[payment] confirm_error", {
        bookingId,
        message: error.message,
        type: error.type,
        code: error.code,
        decline_code: (error as { decline_code?: string }).decline_code,
      })

      // Map decline_code to user-friendly message
      const declineInfo = getDeclineMessage(
        (error as { decline_code?: string }).decline_code,
        locale,
        error.message ?? paymentFailedLabel
      )

      setErr(declineInfo.message)
      setShowWhatsApp(declineInfo.showWhatsApp)
      setSubmitting(false)
      return
    }
    if (paymentIntent && paymentIntent.status !== "succeeded" && paymentIntent.status !== "processing") {
      // Resolved without redirecting and without erroring, but not in a
      // terminal-success state either (e.g. requires_action edge case) —
      // treat as failed rather than silently navigating on to a
      // confirmation screen for a booking that isn't actually paid.
      console.error("[payment] unexpected_status", {
        bookingId,
        status: paymentIntent.status,
        id: paymentIntent.id,
      })
      setErr(paymentFailedLabel)
      setSubmitting(false)
      return
    }
    // Succeeded (or processing, e.g. some redirect-less async methods)
    // without a browser-navigating redirect — drive the same return_url the
    // redirect methods use, so the parent page's existing poll-for-
    // 'confirmed' logic (keyed off ?bookingId&redirect_status) is the single
    // code path for every payment method.
    console.log("[payment] confirm_success", {
      bookingId,
      status: paymentIntent?.status,
      id: paymentIntent?.id,
    })
    window.location.href = returnUrl
  }

  return (
    <form onSubmit={onSubmit}>
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
        <div style={{ marginTop: 12 }}>
          <p style={{ fontSize: 13, color: "#f87171", margin: 0 }}>{err}</p>
          {showWhatsApp && (
            <div style={{ marginTop: 16, padding: "12px 16px", backgroundColor: "#0a0a0a", borderRadius: 12, border: "1px solid #262626" }}>
              <p style={{ fontSize: 13, color: "#a3a3a3", margin: "0 0 10px" }}>
                {whatsappSupportLabel}
              </p>
              <a
                href={getWhatsAppSupportUrl({
                  locale,
                  date,
                  time: `${String(startHour).padStart(2, '0')}:00`,
                  amount: total,
                })}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 16px",
                  fontSize: 14,
                  fontWeight: 600,
                  color: "#000",
                  backgroundColor: "#22c55e",
                  borderRadius: 8,
                  textDecoration: "none",
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                </svg>
                WhatsApp
              </a>
            </div>
          )}
        </div>
      )}
      <button
        type="submit"
        disabled={!stripe || submitting}
        style={{
          marginTop: 20,
          width: "100%",
          height: 54,
          border: "none",
          borderRadius: 14,
          background: submitting ? "rgba(255,255,255,0.15)" : "#22c55e",
          color: submitting ? "rgba(255,255,255,0.6)" : "#000",
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

/** mm:ss countdown to `until`. Ticks every second; clamps at 0. */
function useCountdown(until: string | null): string | null {
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
  return `${mm}:${ss}`
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

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const lockRes = await fetch("/api/booking/lock", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            date: props.date,
            startHour: props.startHour,
            duration: props.duration,
            tableNumber: props.tableNumber,
          }),
        })
        const lockJson = await lockRes.json()
        if (!lockRes.ok) {
          // A 409 with reason 'unavailable' means we lost the slot to a
          // concurrent booker (find_or_lock_slot's advisory-lock path). Surface
          // the clear "someone just took this" copy rather than the generic
          // lock-failure detail, so the losing user knows to pick another time.
          if (lockRes.status === 409 && lockJson?.reason === "unavailable") {
            throw new Error(SLOT_TAKEN)
          }
          throw new Error(lockJson.detail || lockJson.error || "lock failed")
        }
        if (!cancelled) setLockedUntil(lockJson.lockedUntil ?? null)

        const intentRes = await fetch("/api/payment/create-intent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slotId: lockJson.slotId }),
        })
        const intentJson = await intentRes.json()
        if (!intentRes.ok) throw new Error(intentJson.detail || intentJson.error || "intent failed")

        if (!cancelled) {
          setClientSecret(intentJson.clientSecret)
          setBookingId(intentJson.bookingId)
        }
      } catch (e) {
        if (!cancelled) setError((e as Error).message)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [props.date, props.startHour, props.duration, props.tableNumber])

  if (error) {
    // Slot lost to a concurrent booker: show ONLY the clear "pick another time"
    // message — no generic errorLabel, no raw detail (there's nothing to
    // diagnose, the slot is simply gone).
    if (error === SLOT_TAKEN) {
      return (
        <div style={{ textAlign: "center", padding: "16px 0" }}>
          <p style={{ fontSize: 14, color: "#f87171" }}>{props.slotTakenLabel}</p>
        </div>
      )
    }
    return (
      <div style={{ textAlign: "center", padding: "16px 0" }}>
        <p style={{ fontSize: 14, color: "#f87171" }}>{props.errorLabel}</p>
        {/* Show the REAL captured cause (lock expired / not authenticated / Stripe
            error / pricing misconfig) beneath the friendly label, so a failure is
            diagnosable instead of a dead-end "couldn't start payment". */}
        <p style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", marginTop: 6 }}>{error}</p>
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
            color: "rgba(255,255,255,0.55)",
            marginBottom: 12,
          }}
        >
          {props.lockHoldLabel.replace("{time}", countdown)}
        </p>
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
        total={props.total}
      />
    </Elements>
  )
}
