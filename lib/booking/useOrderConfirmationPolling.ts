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
}

const POLL_INTERVAL_MS = 3_000
const TIMEOUT_MS = 60_000

function parseStatusResponse(value: unknown): CheckoutStatusResponse {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {}
  const record = value as Record<string, unknown>
  return {
    status: typeof record.status === "string" ? record.status : undefined,
    providerStatus: typeof record.providerStatus === "string" ? record.providerStatus : undefined,
  }
}

/** Poll the provider-aware checkout status after an external payment return. */
export function useOrderConfirmationPolling(
  bookingId: string | null,
  enabled = true,
): OrderConfirmationStatus {
  const [status, setStatus] = useState<OrderConfirmationStatus>("pending")

  useEffect(() => {
    if (!enabled || !bookingId) {
      setStatus("pending")
      return
    }

    let cancelled = false
    const startedAt = Date.now()
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
      if (Date.now() - startedAt >= TIMEOUT_MS) {
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

  return status
}
