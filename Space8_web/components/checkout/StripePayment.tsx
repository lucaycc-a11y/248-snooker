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
  /** Link text ("Contact Us") appended after whatsappSupportLabel's sentence. */
  contactUsLabel: string
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

export type BookingBlock = {
  date: string // 'YYYY-MM-DD'
  startHour: number
  duration: number
  tableNumber: number
}

type Props = Labels & {
  date: string // 'YYYY-MM-DD'
  startHour: number
  duration: number
  tableNumber: number
  /** Non-contiguous multi-slot order (Task 3). When set with >1 entry, the whole
   * group is locked atomically and paid with one PaymentIntent. Omitted/1-entry
   * orders use the single-slot path unchanged. Includes the primary block. */
  blocks?: BookingBlock[]
  total: number
  /** Active next-intl locale — drives the Payment Element's own copy (Stripe's
   * "Pay", card-field labels, decline messages, etc.), not just our labels. */
  locale: 'zh-HK' | 'zh-CN' | 'en'
  /** Path Stripe returns to after a redirect method (Alipay/WeChat/3DS). */
  returnPath?: string
  billingDetails?: BillingDetails
  /** Called when the slot lock is lost to a concurrent booker, or on any other
   * unrecoverable lock/intent failure — sends the user back to slot selection
   * with stale availability invalidated, instead of leaving them on a dead-end
   * error screen with no way forward except the browser back button. */
  onBackToSlots?: () => void
  backToSlotsLabel: string
  /** Gates the submit button: the page renders its own consent checkbox
   * (linked to /legal) above this component and must confirm it's checked
   * before payment can be submitted. Defaults to true so existing callers
   * that don't pass it keep working unblocked. */
  consentGiven?: boolean
}

function PayForm({
  bookingId,
  returnPath,
  payLabel,
  processingLabel,
  paymentFailedLabel,
  whatsappSupportLabel,
  contactUsLabel,
  billingDetails,
  locale,
  date,
  startHour,
  total,
  consentGiven = true,
}: {
  bookingId: string
  returnPath: string
  payLabel: string
  processingLabel: string
  paymentFailedLabel: string
  whatsappSupportLabel: string
  contactUsLabel: string
  billingDetails?: BillingDetails
  locale: 'zh-HK' | 'zh-CN' | 'en'
  date: string
  startHour: number
  total: number
  consentGiven?: boolean
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
    // Keyed off ?bookingId&redirect_status so the parent page's poll-for-
    // 'confirmed' effect (app/[locale]/book/page.tsx) recognizes this as a
    // completed payment return — omitting redirect_status here silently
    // skipped that effect and left a stale sessionStorage `pendingBooking`
    // entry to force the screen back to the login step (Screen2) instead of
    // confirmation, even though the booking was already paid and confirmed.
    const returnUrl = `${window.location.origin}${returnPath}?bookingId=${bookingId}&redirect_status=succeeded`

    // We opt the Payment Element OUT of collecting billing fields (fields.
    // billingDetails.* = 'never' below). Stripe's contract: EVERY field set to
    // 'never' on the Element MUST be supplied back here in confirmParams.
    // payment_method_data.billing_details — otherwise confirmPayment() throws a
    // synchronous IntegrationError, the promise never resolves, and the button
    // hangs on "處理中" forever. This object must mirror the `fields` config EXACTLY.
    //
    // address.postalCode + address.country are UNCONDITIONALLY 'never', so we
    // ALWAYS supply the address. Stripe requires BOTH keys be present in
    // confirmParams when set to 'never', even if the field value is optional for
    // this region — an empty string satisfies the contract when we don't collect it.
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
        // Always sent: prefilledBilling always carries at least address.country
        // (unconditionally 'never' on the Element), plus name/email/phone when known.
        payment_method_data: { billing_details: prefilledBilling },
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
            // Plain text, no card/button chrome — a suspected double-charge is a
            // sensitive, slightly alarming moment; a bright green CTA pill read as
            // over-designed for it. A single sentence with an inline link matches
            // the WhatsApp copy's own tone everywhere else on the site.
            <p style={{ marginTop: 10, fontSize: 13, color: "#a3a3a3", lineHeight: 1.6 }}>
              {whatsappSupportLabel}{" "}
              <a
                href={getWhatsAppSupportUrl({
                  locale,
                  date,
                  time: `${String(startHour).padStart(2, '0')}:00`,
                  amount: total,
                })}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "#22c55e", textDecoration: "underline" }}
              >
                {contactUsLabel}
              </a>
            </p>
          )}
        </div>
      )}
      <button
        type="submit"
        disabled={!stripe || submitting || !consentGiven}
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
          cursor: submitting || !consentGiven ? "not-allowed" : "pointer",
          opacity: !consentGiven ? 0.5 : 1,
        }}
      >
        {submitting ? processingLabel : payLabel}
      </button>
    </form>
  )
}

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
        const intentBody = blocks
          ? { slotIds: lockJson.slotIds, orderGroupId: lockJson.orderGroupId }
          : { slotId: lockJson.slotId }
        const intentRes = await fetch("/api/payment/create-intent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(intentBody),
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
    return (
      <div className="glass-panel" style={{ textAlign: "center", padding: "24px 20px", borderRadius: 16 }}>
        <p style={{ fontSize: 14, color: "#f87171" }}>{props.errorLabel}</p>
        {/* Show the REAL captured cause (lock expired / not authenticated / Stripe
            error / pricing misconfig) beneath the friendly label, so a failure is
            diagnosable instead of a dead-end "couldn't start payment". */}
        <p style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", marginTop: 6, marginBottom: props.onBackToSlots ? 16 : 0 }}>
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
            color: countdown.urgent ? "#FF6B4A" : "rgba(255,255,255,0.55)",
            marginBottom: 12,
            transition: "color 0.3s ease",
          }}
        >
          {props.lockHoldLabel.replace("{time}", countdown.text)}
        </p>
      )}
      <PayForm
        bookingId={bookingId}
        returnPath={props.returnPath ?? "/book"}
        payLabel={props.payLabel}
        processingLabel={props.processingLabel}
        paymentFailedLabel={props.paymentFailedLabel}
        whatsappSupportLabel={props.whatsappSupportLabel}
        contactUsLabel={props.contactUsLabel}
        billingDetails={props.billingDetails}
        locale={props.locale}
        date={props.date}
        startHour={props.startHour}
        total={props.total}
        consentGiven={props.consentGiven}
      />
    </Elements>
  )
}
