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

const stripePromise = getStripeClient()

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
  /** Generic fallback shown under the Payment Element when Stripe returns no
   * message of its own (declines/validation almost always include one, but
   * some edge cases don't) — must be CMS/i18n text, never a bare English string. */
  paymentFailedLabel: string
  /** Shown if confirmPayment() hasn't resolved after 15s, instead of an
   * infinite spinner (e.g. a hung network request). */
  timeoutLabel: string
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
  locale: string
  /** Path Stripe returns to after a redirect method (Alipay/WeChat/3DS). */
  returnPath?: string
  billingDetails?: BillingDetails
}

const CONFIRM_TIMEOUT_MS = 15_000

function PayForm({
  bookingId,
  returnPath,
  payLabel,
  processingLabel,
  paymentFailedLabel,
  timeoutLabel,
  billingDetails,
}: {
  bookingId: string
  returnPath: string
  payLabel: string
  processingLabel: string
  paymentFailedLabel: string
  timeoutLabel: string
  billingDetails?: BillingDetails
}) {
  const stripe = useStripe()
  const elements = useElements()
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!stripe || !elements) return
    setSubmitting(true)
    setErr(null)
    const returnUrl = `${window.location.origin}${returnPath}?bookingId=${bookingId}`

    // redirect: 'if_required' means Stripe only navigates away when the
    // method actually needs it (Alipay/WeChat/wallets/3DS) — a plain card
    // with no extra verification resolves right here instead of a full-page
    // redirect round-trip. A 15s watchdog guards against confirmPayment()
    // hanging (e.g. a stalled network request) so the button never spins
    // forever with no feedback.
    let timedOut = false
    const timeout = new Promise<"timeout">((resolve) =>
      setTimeout(() => {
        timedOut = true
        resolve("timeout")
      }, CONFIRM_TIMEOUT_MS),
    )
    const confirm = stripe.confirmPayment({
      elements,
      confirmParams: { return_url: returnUrl },
      redirect: "if_required",
    })
    const result = await Promise.race([confirm, timeout])

    if (result === "timeout") {
      setErr(timeoutLabel)
      setSubmitting(false)
      return
    }
    // confirmPayment() resolved after the watchdog already fired — the
    // timeout message is already showing; let it be rather than overwrite
    // with a stale success/error from the slow call.
    if (timedOut) return

    const { error, paymentIntent } = result
    if (error) {
      // error.message is already localized by Stripe (Elements' `locale`
      // option, set below) — the fallback only fires on the rare error with
      // no message, so it must be CMS text too.
      setErr(error.message ?? paymentFailedLabel)
      setSubmitting(false)
      return
    }
    if (paymentIntent && paymentIntent.status !== "succeeded" && paymentIntent.status !== "processing") {
      // Resolved without redirecting and without erroring, but not in a
      // terminal-success state either (e.g. requires_action edge case) —
      // treat as failed rather than silently navigating on to a
      // confirmation screen for a booking that isn't actually paid.
      setErr(paymentFailedLabel)
      setSubmitting(false)
      return
    }
    // Succeeded (or processing, e.g. some redirect-less async methods)
    // without a browser-navigating redirect — drive the same return_url the
    // redirect methods use, so the parent page's existing poll-for-
    // 'confirmed' logic (keyed off ?bookingId&redirect_status) is the single
    // code path for every payment method.
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
        <p style={{ marginTop: 12, fontSize: 13, color: "#f87171" }}>{err}</p>
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
        if (!lockRes.ok) throw new Error(lockJson.detail || lockJson.error || "lock failed")
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
        timeoutLabel={props.timeoutLabel}
        billingDetails={props.billingDetails}
      />
    </Elements>
  )
}
