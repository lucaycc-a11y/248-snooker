"use client"

import { useEffect, useState } from "react"
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js"
import type { Appearance } from "@stripe/stripe-js"
import { getStripeClient } from "@/lib/stripe/client"

const stripePromise = getStripeClient()

// Match the booking page's night/green brand. PaymentElement renders official,
// licensed method icons + native Apple/Google Pay buttons, so no brand assets to
// source ourselves.
const appearance: Appearance = {
  theme: "night",
  variables: {
    colorPrimary: "#22c55e",
    colorBackground: "#0a1a0f",
    colorText: "#ffffff",
    borderRadius: "12px",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', system-ui, sans-serif",
  },
}

type Labels = {
  payLabel: string
  processingLabel: string
  errorLabel: string
  loadingLabel: string
  lockHoldLabel: string
}

type Props = Labels & {
  date: string // 'YYYY-MM-DD'
  startHour: number
  duration: number
  tableNumber: number
  total: number
  /** Path Stripe returns to after a redirect method (Alipay/WeChat/3DS). */
  returnPath?: string
}

function PayForm({
  bookingId,
  returnPath,
  payLabel,
  processingLabel,
}: {
  bookingId: string
  returnPath: string
  payLabel: string
  processingLabel: string
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
    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: returnUrl },
    })
    // Reaching here means confirmation failed BEFORE any redirect (e.g. card
    // declined, validation). On success Stripe redirects to return_url and the
    // page reloads, so this line never runs.
    if (error) {
      setErr(error.message ?? "Payment failed")
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={onSubmit}>
      <PaymentElement />
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
    <Elements stripe={stripePromise} options={{ clientSecret, appearance }}>
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
      />
    </Elements>
  )
}
