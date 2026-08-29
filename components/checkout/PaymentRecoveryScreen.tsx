"use client"

import { useEffect, useState } from "react"
import { AlertTriangle } from "lucide-react"
import { tokens } from "@/app/styles/tokens"

/**
 * Why the payment didn't complete. All three land on the SAME screen — only
 * the reason line at the top differs — so a customer never gets three
 * inconsistent dead ends for what is, to them, one situation: "I tried to pay
 * and I'm not sure what happened."
 */
export type PaymentRecoveryReason = "payment_failed" | "cancelled" | "timeout"

export type PaymentRecoveryLabels = {
  title: string
  reasonFailed: string
  reasonCancelled: string
  reasonTimeout: string
  /** Shown for `timeout` only — warns against paying twice. */
  timeoutDoubleChargeWarning: string
  holdActive: string
  holdActiveWithTime: string
  holdExpired: string
  retry: string
  retryBusy: string
  backToSlots: string
  supportPhone: string
  supportEmail: string
}

type Props = {
  reason: PaymentRecoveryReason
  /** True while every slot in the order is still held for this user. */
  holdActive: boolean
  /** ISO deadline of the earliest slot hold, for the countdown. */
  holdExpiresAt: string | null
  /** Re-runs retry_payment_failed_booking and re-creates the provider order. */
  onRetry: () => void
  /** Sends the user back to slot selection to pick again. */
  onBackToSlots: () => void
  retrying?: boolean
  /** Surfaced verbatim when a retry attempt fails (e.g. hold_expired). */
  error?: string | null
  labels: PaymentRecoveryLabels
  supportPhone?: string
  supportEmail?: string
}

function formatClock(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""
  return date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
}

/** Live "mm:ss remaining", recomputed each second from the ISO deadline. */
function useRemaining(expiresAt: string | null): number | null {
  const [remaining, setRemaining] = useState<number | null>(null)

  useEffect(() => {
    if (!expiresAt) {
      setRemaining(null)
      return
    }
    const deadline = new Date(expiresAt).getTime()
    if (Number.isNaN(deadline)) {
      setRemaining(null)
      return
    }
    const tick = () => setRemaining(Math.max(0, Math.floor((deadline - Date.now()) / 1000)))
    tick()
    const timer = setInterval(tick, 1_000)
    return () => clearInterval(timer)
  }, [expiresAt])

  return remaining
}

function formatRemaining(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${String(secs).padStart(2, "0")}`
}

/**
 * The single recovery screen for every non-success payment outcome.
 *
 * Deliberately terminal: it never auto-navigates. A `timeout` in particular
 * must NOT be resolved as success (or bounced to /member) — the provider result
 * is genuinely unknown, so only the customer can decide between retrying and
 * contacting support. Leaving requires pressing a button.
 */
export function PaymentRecoveryScreen({
  reason,
  holdActive,
  holdExpiresAt,
  onRetry,
  onBackToSlots,
  retrying = false,
  error = null,
  labels,
  supportPhone,
  supportEmail,
}: Props) {
  const remaining = useRemaining(holdExpiresAt)
  const holdLapsed = !holdActive || (remaining !== null && remaining <= 0)

  const reasonText =
    reason === "cancelled"
      ? labels.reasonCancelled
      : reason === "timeout"
        ? labels.reasonTimeout
        : labels.reasonFailed

  const holdText = holdLapsed
    ? labels.holdExpired
    : holdExpiresAt && remaining !== null
      ? labels.holdActiveWithTime
          .replace("{time}", formatClock(holdExpiresAt))
          .replace("{remaining}", formatRemaining(remaining))
      : labels.holdActive

  return (
    <div style={styles.wrap} role="alert" aria-live="polite">
      <div style={styles.card}>
        <div style={styles.iconWrap}>
          <AlertTriangle size={44} color={tokens.colors.danger} aria-hidden />
        </div>

        <h2 data-cms-key="book.recovery.title" style={styles.title}>
          {labels.title}
        </h2>

        <p data-cms-key={`book.recovery.reason_${reason}`} style={styles.reason}>
          {reasonText}
        </p>

        {/* A timeout can mean the payment DID go through. Warn before the
            customer presses retry and pays a second time. */}
        {reason === "timeout" && (
          <p data-cms-key="book.recovery.timeout_warning" style={styles.warning}>
            {labels.timeoutDoubleChargeWarning}
          </p>
        )}

        <div style={holdLapsed ? styles.holdBoxLapsed : styles.holdBox}>
          <p data-cms-key="book.recovery.hold" style={holdLapsed ? styles.holdTextLapsed : styles.holdText}>
            {holdText}
          </p>
        </div>

        {error && <p style={styles.error}>{error}</p>}

        {/* Retry is hidden once the hold lapses: the slots may already belong
            to someone else, so re-creating an order would sell them twice. */}
        {!holdLapsed && (
          <button
            type="button"
            onClick={onRetry}
            disabled={retrying}
            data-cms-key="book.recovery.retry"
            style={retrying ? styles.primaryButtonBusy : styles.primaryButton}
          >
            {retrying ? labels.retryBusy : labels.retry}
          </button>
        )}

        <button
          type="button"
          onClick={onBackToSlots}
          data-cms-key="book.recovery.back_to_slots"
          style={holdLapsed ? styles.primaryButton : styles.secondaryButton}
        >
          {labels.backToSlots}
        </button>

        {(supportPhone || supportEmail) && (
          <div style={styles.support}>
            {supportPhone && (
              <a href={`tel:${supportPhone.replace(/\s+/g, "")}`} style={styles.supportLink}>
                {labels.supportPhone.replace("{phone}", supportPhone)}
              </a>
            )}
            {supportEmail && (
              <a href={`mailto:${supportEmail}`} style={styles.supportLink}>
                {labels.supportEmail.replace("{email}", supportEmail)}
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "calc(100dvh - 80px)",
    padding: "24px 20px",
  },
  card: {
    width: "100%",
    maxWidth: 380,
    background: tokens.colors.surface,
    border: `1px solid ${tokens.colors.border}`,
    borderRadius: 20,
    padding: "32px 24px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 12,
  },
  iconWrap: {
    width: 56,
    height: 56,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 20,
    fontWeight: 700,
    color: tokens.colors.text,
    margin: 0,
    textAlign: "center",
  },
  reason: {
    fontSize: 14,
    color: tokens.colors.textMuted,
    margin: 0,
    textAlign: "center",
    lineHeight: 1.6,
  },
  warning: {
    fontSize: 13,
    color: tokens.colors.text,
    background: "rgba(255,69,58,0.12)",
    border: `1px solid rgba(255,69,58,0.32)`,
    borderRadius: 12,
    padding: "10px 12px",
    margin: 0,
    textAlign: "center",
    lineHeight: 1.6,
  },
  holdBox: {
    width: "100%",
    background: tokens.colors.brandDim,
    border: `1px solid rgba(37,211,102,0.32)`,
    borderRadius: 12,
    padding: "10px 12px",
    marginTop: 4,
  },
  holdBoxLapsed: {
    width: "100%",
    background: "rgba(255,255,255,0.04)",
    border: `1px solid ${tokens.colors.border}`,
    borderRadius: 12,
    padding: "10px 12px",
    marginTop: 4,
  },
  holdText: {
    fontSize: 13,
    color: tokens.colors.text,
    margin: 0,
    textAlign: "center",
    lineHeight: 1.5,
  },
  holdTextLapsed: {
    fontSize: 13,
    color: tokens.colors.textFaint,
    margin: 0,
    textAlign: "center",
    lineHeight: 1.5,
  },
  error: {
    fontSize: 12,
    color: tokens.colors.danger,
    margin: 0,
    textAlign: "center",
    lineHeight: 1.5,
  },
  primaryButton: {
    width: "100%",
    height: 52,
    marginTop: 8,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: tokens.colors.brand,
    color: tokens.colors.brandText,
    border: "none",
    borderRadius: 14,
    fontSize: 16,
    fontWeight: 700,
    cursor: "pointer",
  },
  primaryButtonBusy: {
    width: "100%",
    height: 52,
    marginTop: 8,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: tokens.colors.brandHover,
    color: tokens.colors.brandText,
    border: "none",
    borderRadius: 14,
    fontSize: 16,
    fontWeight: 700,
    cursor: "wait",
    opacity: 0.7,
  },
  secondaryButton: {
    width: "100%",
    height: 48,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "transparent",
    color: tokens.colors.text,
    border: `1px solid ${tokens.colors.borderStrong}`,
    borderRadius: 14,
    fontSize: 15,
    fontWeight: 600,
    cursor: "pointer",
  },
  support: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },
  supportLink: {
    fontSize: 13,
    color: tokens.colors.link,
    textDecoration: "none",
  },
}
