"use client"

import { useCallback, useState } from "react"
import { useTranslations } from "next-intl"
import { useOrderConfirmationPolling } from "@/lib/booking/useOrderConfirmationPolling"
import { PaymentRecoveryScreen, type PaymentRecoveryReason } from "@/components/checkout/PaymentRecoveryScreen"
import { LoadingGif } from "@/components/ui/LoadingGif"
import { tokens } from "@/app/styles/tokens"

type Props = { bookingId: string }

export default function ConfirmPageClient({ bookingId }: Props) {
  const t = useTranslations("book")
  const [retrying, setRetrying] = useState(false)
  const [retryError, setRetryError] = useState<string | null>(null)
  const result = useOrderConfirmationPolling(bookingId)

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

  if (reason) {
    return (
      <PaymentRecoveryScreen
        reason={reason}
        holdActive={result.hold.active}
        holdExpiresAt={result.hold.expiresAt}
        retrying={retrying}
        error={retryError}
        onRetry={handleRetry}
        onBackToSlots={() => { window.location.href = "/book" }}
        supportPhone={t("support_phone")}
        supportEmail={t("support_email")}
        labels={{
          title: t("recovery_title"),
          reasonFailed: t("recovery_reason_failed"),
          reasonCancelled: t("recovery_reason_cancelled"),
          reasonTimeout: t("recovery_reason_timeout"),
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
    )
  }

  if (result.status === "success") {
    return (
      <main style={styles.wrap}>
        <section style={styles.card} role="status" aria-live="polite">
          <div style={styles.successIcon} aria-hidden="true">✓</div>
          <h1 style={styles.title} data-cms-key="book.confirm.success_title">{t("kpay_success")}</h1>
          <p style={styles.text} data-cms-key="book.confirm.success_desc">{t("kpay_success_desc")}</p>
          <p style={styles.reference}>{bookingId}</p>
        </section>
      </main>
    )
  }

  return (
    <main style={styles.wrap}>
      <section style={styles.card} role="status" aria-live="polite">
        <LoadingGif />
        <h1 style={styles.title} data-cms-key="book.confirm.pending_title">{t("confirming")}</h1>
        <p style={styles.text} data-cms-key="book.confirm.pending_desc">{t("kpay_pending_confirmation_desc")}</p>
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
}
