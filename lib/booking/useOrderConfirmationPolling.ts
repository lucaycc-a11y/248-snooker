"use client"

import { useEffect, useState } from "react"

export type OrderConfirmationStatus =
  | "pending"
  | "pending_confirmation"
  | "success"
  | "failed"
  | "cancelled"
  | "expired"
  | "timeout"

type CheckoutStatusResponse = {
  status?: string
  providerStatus?: string
  holdActive?: boolean
  holdExpiresAt?: string | null
}

/** Slot-hold state reported alongside the payment status. */
export type OrderHoldState = {
  /** True while every slot in the order is still held by this user. */
  active: boolean
  /** ISO deadline of the earliest hold, for the recovery-screen countdown. */
  expiresAt: string | null
}

export type OrderConfirmationResult = {
  status: OrderConfirmationStatus
  hold: OrderHoldState
}

const POLL_INTERVAL_MS = 3_000
const DEFAULT_TIMEOUT_MS = 60_000

/**
 * Timeout override for manual testing (e.g. `?confirmTimeoutMs=3000` to watch
 * the timeout screen without waiting a minute). Clamped, and ignored in
 * production so a crafted URL can't shorten a real customer's confirmation
 * window into a false timeout.
 */
function resolveTimeoutMs(): number {
  if (typeof window === "undefined") return DEFAULT_TIMEOUT_MS
  if (process.env.NODE_ENV === "production") return DEFAULT_TIMEOUT_MS
  const raw = new URLSearchParams(window.location.search).get("confirmTimeoutMs")
  if (!raw) return DEFAULT_TIMEOUT_MS
  const parsed = Number(raw)
  if (!Number.isFinite(parsed)) return DEFAULT_TIMEOUT_MS
  return Math.min(Math.max(parsed, 1_000), DEFAULT_TIMEOUT_MS)
}

function parseStatusResponse(value: unknown): CheckoutStatusResponse {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {}
  const record = value as Record<string, unknown>
  return {
    status: typeof record.status === "string" ? record.status : undefined,
    providerStatus: typeof record.providerStatus === "string" ? record.providerStatus : undefined,
    holdActive: typeof record.holdActive === "boolean" ? record.holdActive : undefined,
    holdExpiresAt: typeof record.holdExpiresAt === "string" ? record.holdExpiresAt : null,
  }
}

/** Poll the provider-aware checkout status after an external payment return. */
export function useOrderConfirmationPolling(
  bookingId: string | null,
  enabled = true,
): OrderConfirmationResult {
  const [status, setStatus] = useState<OrderConfirmationStatus>("pending")
  const [hold, setHold] = useState<OrderHoldState>({ active: false, expiresAt: null })

  useEffect(() => {
    if (!enabled || !bookingId) {
      setStatus("pending")
      return
    }

    let cancelled = false
    const startedAt = Date.now()
    const timeoutMs = resolveTimeoutMs()
    let timer: ReturnType<typeof setTimeout> | null = null

    const finish = (next: OrderConfirmationStatus) => {
      if (!cancelled) setStatus(next)
    }

    const poll = async () => {
      if (cancelled) return

      try {
        const response = await fetch(
          `/api/checkout/status?bookingId=${encodeURIComponent(bookingId)}`,
          { cache: "no-store" },
        )
        const data: unknown = await response.json()
        const result = parseStatusResponse(data)
        const statusValue = result.status
        const providerStatus = result.providerStatus

        if (!cancelled && result.holdActive !== undefined) {
          setHold({ active: result.holdActive, expiresAt: result.holdExpiresAt ?? null })
        }

        // Provider success only means KPay accepted the payment. The webhook
        // still has to commit bookings.status = confirmed before this hook can
        // advance to the ticket screen.
        if (statusValue === "confirmed") {
          finish("success")
          return
        }
        if (statusValue === "pending_confirmation") {
          finish("pending_confirmation")
        } else if (statusValue === "expired" || providerStatus === "expired") {
          finish("expired")
          return
        } else if (statusValue === "cancelled" || providerStatus === "cancelled") {
          finish("cancelled")
          return
        } else if (
          statusValue === "failed" ||
          statusValue === "payment_failed" ||
          providerStatus === "failed" ||
          providerStatus === "closed"
        ) {
          finish("failed")
          return
        }
      } catch (error) {
        console.error("[checkout polling] status check failed", error)
      }

      if (cancelled) return
      if (Date.now() - startedAt >= timeoutMs) {
        // Timeout means "no definitive answer", never "paid" or "not paid".
        // The caller must park the user on the recovery screen and let them
        // choose; it must not fall through to a success view or /member.
        finish("timeout")
        return
      }
      timer = setTimeout(poll, POLL_INTERVAL_MS)
    }

    setStatus("pending")
    void poll()

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [bookingId, enabled])

  return { status, hold }
}
