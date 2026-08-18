"use client"

import { useEffect, useState } from "react"

export type OrderConfirmationStatus = "pending" | "success" | "failed" | "timeout"

const POLL_INTERVAL_MS = 3_000
const TIMEOUT_MS = 60_000

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
        const result = data as { status?: unknown; providerStatus?: unknown }
        const statusValue = result.status
        const providerStatus = result.providerStatus

        if (statusValue === "confirmed" || providerStatus === "success") {
          finish("success")
          return
        }
        if (
          statusValue === "failed" ||
          statusValue === "cancelled" ||
          providerStatus === "failed" ||
          providerStatus === "cancelled" ||
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
