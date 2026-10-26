"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useTranslations } from "next-intl"
import { useOrderConfirmationPolling } from "@/lib/booking/useOrderConfirmationPolling"
import { trackBookingConversion } from "@/lib/analytics/gtag"
import { PaymentRecoveryScreen, type PaymentRecoveryReason } from "@/components/checkout/PaymentRecoveryScreen"
import { LoadingGif } from "@/components/shared/LoadingGif"
import { PaymentReferencePanel } from "@/components/checkout/PaymentReferencePanel"
import { submitGatewayForm, takeGatewayHandoff } from "@/lib/checkout/gateway-handoff"
import { tokens } from "@/app/styles/tokens"

export type ConfirmBookingSummary = {
  humanCode: string | null
  date: string
  startTime: string
  endTime: string
  tableNumber: number | null
}

type Props = { bookingId: string; summary?: ConfirmBookingSummary[] }

export default function ConfirmPageClient({ bookingId, summary = [] }: Props) {
  const t = useTranslations("book")
  const tCommon = useTranslations("common")
  const [retrying, setRetrying] = useState(false)
  const [retryError, setRetryError] = useState<string | null>(null)
  const result = useOrderConfirmationPolling(bookingId)
  // Confirm-page-first handoff: the payment page navigated here instead of opening the
  // gateway itself. Open the gateway from this page, so the history entry the customer
  // returns to is this read-only page, never the payment-method picker.
  const [handingOff, setHandingOff] = useState(false)
  useEffect(() => {
    const handoff = takeGatewayHandoff(bookingId)
    if (handoff) {
      setHandingOff(true)
      if (handoff.kind === "form-post") {
        if (!submitGatewayForm(handoff.payInfo)) setHandingOff(false)
      } else {
        window.location.href = handoff.payInfo
      }
    }
    // Coming back via the browser Back button can restore this page from the
    // back/forward cache with the "going to payment" state still set.
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) setHandingOff(false)
    }
    window.addEventListener("pageshow", onPageShow)
    return () => window.removeEventListener("pageshow", onPageShow)
  }, [bookingId])
  const conversionFired = useRef(false)
  // Coming back from the gateway never cancels or fails anything by itself: this page
  // only reads. KPay gives no "customer backed out" signal, and the order may still be
  // paid, so the page keeps waiting for KPay's final answer. After 20 s a NON-destructive
  // way back to the payment methods is offered (the booking, slot and holds stay as they
  // are; a paid order is still confirmed in the background).
  const [showEscape, setShowEscape] = useState(false)
  // Customers outside the freeze rollout keep the previous 3 s escape.
  const escapeDelayMs = result.freeze ? 20000 : 3000
  useEffect(() => {
    const timer = setTimeout(() => setShowEscape(true), escapeDelayMs)
    return () => clearTimeout(timer)
  }, [escapeDelayMs])
  const handleLeave = useCallback(async () => {
    // Never cancel a booking that has actually been paid: ask the server first.
    try {
      const res = await fetch(`/api/checkout/status?bookingId=${encodeURIComponent(bookingId)}`, { cache: "no-store" })
      const json: unknown = await res.json().catch(() => null)
      if (json && typeof json === "object" && (json as Record<string, unknown>).status === "confirmed") {
        window.location.reload()
        return
      }
    } catch {}
    void fetch("/api/checkout/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookingId }),
      keepalive: true,
    }).catch(() => {})
    try { sessionStorage.removeItem("kpayPayment") } catch {}
    window.location.href = "/book"
  }, [bookingId])

  // Fire only when the webhook has committed bookings.status = confirmed —
  // never on the "book" click, where payment can still fail. Strict Mode can
  // mount twice and the poll can tick past success, so guard with a ref;
  // Google Ads also dedupes on transaction_id as a second line of defence.
  useEffect(() => {
    if (result.status !== "success") return
    if (conversionFired.current) return
    conversionFired.current = true

    trackBookingConversion({
      transactionId: bookingId,
      value: result.totalPrice ?? 0,
    })
  }, [result.status, result.totalPrice, bookingId])

  const reason: PaymentRecoveryReason | null =
    result.status === "failed" ? "payment_failed" :
      result.status === "cancelled" || result.status === "expired" ? "cancelled" :
        result.status === "timeout" ? "timeout" : null

  const handleRetry = useCallback(async () => {
    if (retrying) return
    setRetrying(true)
    setRetryError(null)
    try {
      const response = await fetch("/api/checkout/retry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId }),
      })
      const payload: unknown = await response.json().catch(() => null)
      if (!response.ok) {
        const message = payload && typeof payload === "object" && !Array.isArray(payload)
          ? (payload as Record<string, unknown>).error
          : undefined
        setRetryError(typeof message === "string" ? message : t("recovery_retry"))
        return
      }
      const orderGroupId = payload && typeof payload === "object" && !Array.isArray(payload)
        ? (payload as Record<string, unknown>).orderGroupId
        : undefined
      try {
        sessionStorage.setItem("kpayRetry", JSON.stringify({ bookingId, orderGroupId: orderGroupId ?? null }))
      } catch {}
      window.location.href = `/book?bookingId=${encodeURIComponent(bookingId)}&redirect_status=retry`
    } catch {
      setRetryError(t("recovery_retry"))
    } finally {
      setRetrying(false)
    }
  }, [bookingId, retrying, t])

  // Rollout customers never see "not received" just because they came back; others keep it.
  const shownReason: PaymentRecoveryReason | null =
    reason ?? (!result.freeze && showEscape && result.status !== "success" ? "not_received" : null)

  if (shownReason) {
    return (
      <>
      <PaymentRecoveryScreen
        reason={shownReason}
        holdActive={result.hold.active}
        holdExpiresAt={result.hold.expiresAt}
        retrying={retrying}
        error={retryError}
        onRetry={handleRetry}
        onBackToSlots={() => {
          if (shownReason === "not_received") {
            void handleLeave()
            return
          }
          // Re-enter the payment selector while preserving the durable slot
          // selection; this is distinct from abandoning the booking flow.
          window.location.href = `/book?redirect_status=methods&bookingId=${encodeURIComponent(bookingId)}`
        }}
        supportPhone={t("support_phone")}
        supportEmail={t("support_email")}
        labels={{
          title: t("recovery_title"),
          reasonFailed: t("recovery_reason_failed"),
          reasonCancelled: t("recovery_reason_cancelled"),
          reasonTimeout: t("recovery_reason_timeout"),
          reasonNotReceived: t("recovery_reason_not_received"),
          notReceivedNote: t("recovery_not_received_note"),
          cancelBooking: t("recovery_cancel_booking"),
          timeoutDoubleChargeWarning: t("recovery_timeout_warning"),
          holdActive: t("recovery_hold_active"),
          holdActiveWithTime: t("recovery_hold_active_time"),
          holdExpired: t("recovery_hold_expired"),
          retry: t("recovery_retry"),
          retryBusy: t("recovery_retry_busy"),
          backToSlots: t("recovery_back_to_slots"),
          supportPhone: t("recovery_support_phone"),
          supportEmail: t("recovery_support_email"),
        }}
      />
      {result.freeze ? (
        <div style={{ maxWidth: 380, margin: "0 auto", padding: "0 20px 24px" }}>
          <PaymentReferencePanel reference={result.ref} stateCode={result.stateCode} bookingId={bookingId} />
        </div>
      ) : null}
      </>
    )
  }

  if (result.status === "payment_review") {
    return (
      <main style={styles.wrap}>
        <section style={styles.card} role="status" aria-live="polite">
          <h1 style={styles.title}>{t("review_title")}</h1>
          <p style={styles.text}>{t("review_desc")}</p>
          <PaymentReferencePanel reference={result.ref} stateCode={result.stateCode} bookingId={bookingId} />
        </section>
      </main>
    )
  }

  if (result.status === "success") {
    return (
      <main style={styles.wrap}>
        <section style={styles.card} role="status" aria-live="polite">
          <div style={styles.successIcon} aria-hidden="true">✓</div>
          <h1 style={styles.title} data-cms-key="book.confirm.success_title">{t("kpay_success")}</h1>
          <p style={styles.text} data-cms-key="book.confirm.success_desc">{t("kpay_success_desc")}</p>
          {summary.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 4 }}>
              {summary.map((b, i) => (
                <div key={b.humanCode ?? i}>
                  <div style={{ color: tokens.colors.text, fontSize: 15, fontWeight: 600 }}>
                    {b.date} · {b.startTime}–{b.endTime}
                    {b.tableNumber !== null ? ` · #${b.tableNumber}` : ""}
                  </div>
                  {b.humanCode && <div style={styles.reference}>{b.humanCode}</div>}
                </div>
              ))}
            </div>
          ) : (
            <p style={styles.reference}>{bookingId}</p>
          )}
          <a
            href="/member"
            style={styles.memberLink}
            data-cms-key="book.confirm.view_member_area"
          >
            {t("view_member_area")}
          </a>
        </section>
      </main>
    )
  }

  if (handingOff) {
    return (
      <main style={styles.wrap}>
        <section style={styles.card} role="status" aria-live="polite">
          <LoadingGif label={tCommon("loading")} />
          <h1 style={styles.title}>{t("confirm_going_to_pay")}</h1>
        </section>
      </main>
    )
  }

  return (
    <main style={styles.wrap}>
      <section style={styles.card} role="status" aria-live="polite">
        <LoadingGif label={tCommon("loading")} />
        <h1 style={styles.title} data-cms-key="book.confirm.pending_title">{t("confirming")}</h1>
        <p style={styles.text} data-cms-key="book.confirm.pending_desc">{t("kpay_pending_confirmation_desc")}</p>
        {result.freeze ? <p style={styles.text}>{t("confirm_waiting_note")}</p> : null}
        {showEscape && (
          <button
            type="button"
            onClick={result.freeze
              ? () => { window.location.href = `/book?redirect_status=methods&bookingId=${encodeURIComponent(bookingId)}` }
              : handleLeave}
            style={{ marginTop: 8, minHeight: 44, padding: "0 20px", borderRadius: 12, border: `1px solid ${tokens.colors.border}`, background: "transparent", color: tokens.colors.text, fontSize: 14, fontWeight: 600, cursor: "pointer" }}
          >
            {result.freeze ? t("confirm_back_to_methods") : t("recovery_back_to_slots")}
          </button>
        )}
        {result.freeze ? <PaymentReferencePanel reference={result.ref} stateCode={result.stateCode} bookingId={bookingId} /> : null}
      </section>
    </main>
  )
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { display: "flex", alignItems: "center", justifyContent: "center", minHeight: "calc(100dvh - 80px)", padding: "24px 20px" },
  card: { width: "100%", maxWidth: 380, background: tokens.colors.surface, border: `1px solid ${tokens.colors.border}`, borderRadius: 20, padding: "32px 24px", display: "flex", flexDirection: "column", alignItems: "center", gap: 12, textAlign: "center" },
  successIcon: { width: 56, height: 56, borderRadius: "50%", display: "grid", placeItems: "center", background: tokens.colors.link, color: "#000", fontSize: 34, fontWeight: 700 },
  title: { margin: 0, color: tokens.colors.text, fontSize: 22, fontWeight: 700 },
  text: { margin: 0, color: tokens.colors.textMuted, fontSize: 14, lineHeight: 1.6 },
  reference: { margin: "8px 0 0", color: tokens.colors.textFaint, fontSize: 11, wordBreak: "break-all" },
  memberLink: {
    marginTop: 16,
    padding: "12px 24px",
    borderRadius: 12,
    background: tokens.colors.link,
    color: "#000",
    fontSize: 15,
    fontWeight: 600,
    textDecoration: "none",
    display: "inline-block",
    transition: "all 0.2s ease",
  },
}
