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
  /** Wall-clock seconds since polling started — the UI can display "已等待 XX 秒". */
  elapsedSec: number
}

// Fast phase: poll every 2s for the first 30s (KPay webhooks are near-instant).
// Slow phase: 5s intervals until the 60s timeout — avoids hammering the API
// while still catching delayed KPay status transitions.
const FAST_POLL_MS = 2_000
const FAST_PHASE_MS = 30_000
const SLOW_POLL_MS = 5_000
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
  const [elapsedSec, setElapsedSec] = useState(0)

  useEffect(() => {
    if (!enabled || !bookingId) {
      setStatus("pending")
      setElapsedSec(0)
      return
    }

    let cancelled = false
    const startedAt = Date.now()
    const timeoutMs = resolveTimeoutMs()
    let timer: ReturnType<typeof setTimeout> | null = null
    let elapsedTimer: ReturnType<typeof setInterval> | null = null

    const elapsedMs = () => Date.now() - startedAt

    // Smooth per-second "已等待 XX 秒" counter, independent of poll cadence.
    elapsedTimer = setInterval(() => {
      if (cancelled) return
      setElapsedSec(Math.min(Math.floor(elapsedMs() / 1000), Math.floor(timeoutMs / 1000)))
    }, 1_000)

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

        console.log("[KPay] pollResult", {
          bookingId,
          elapsedMs: elapsedMs(),
          status: statusValue,
          providerStatus,
        })

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
        console.error("[KPay] pollResult error", { bookingId, elapsedMs: elapsedMs(), error })
      }

      if (cancelled) return
      if (elapsedMs() >= timeoutMs) {
        // Timeout means "no definitive answer", never "paid" or "not paid".
        // The caller must park the user on the recovery screen and let them
        // choose; it must not fall through to a success view or /member.
        console.log("[KPay] pollTimeout", { bookingId, elapsedMs: elapsedMs(), timeoutMs })
        finish("timeout")
        return
      }
      // Fast phase for the first 30s (webhooks are near-instant), then back off.
      const interval = elapsedMs() < FAST_PHASE_MS ? FAST_POLL_MS : SLOW_POLL_MS
      timer = setTimeout(poll, interval)
    }

    console.log("[KPay] pollStart", { bookingId, timeoutMs })
    setStatus("pending")
    setElapsedSec(0)
    void poll()

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
      if (elapsedTimer) clearInterval(elapsedTimer)
    }
  }, [bookingId, enabled])

  return { status, hold, elapsedSec }
}
