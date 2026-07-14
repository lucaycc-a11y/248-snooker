"use client"

import { useCallback, useEffect, useRef, useState } from "react"

function monthKey(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}`
}

/**
 * Client cache for the /book calendar's month-level "fully booked" dates
 * (see get_fully_booked_dates() migration + /api/booking/available-dates).
 * Mirrors useAvailabilityCache.ts's fetch-and-cache style, but keyed by
 * 'YYYY-MM' instead of 'YYYY-MM-DD' since this is a month-view concern.
 */
export function useMonthAvailability() {
  const cacheRef = useRef<Map<string, Set<string>>>(new Map())
  const [version, setVersion] = useState(0)
  const [loadingMonth, setLoadingMonth] = useState<string | null>(null)

  const getFullyBookedDates = useCallback(
    (year: number, month: number): Set<string> | null => {
      return cacheRef.current.get(monthKey(year, month)) ?? null
    },
    // version is a dependency so consumers recompute after new data lands.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [version],
  )

  const fetchMonth = useCallback(async (year: number, month: number) => {
    const key = monthKey(year, month)
    if (cacheRef.current.has(key)) return
    setLoadingMonth(key)
    try {
      const res = await fetch("/api/booking/available-dates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month: key }),
      })
      if (!res.ok) throw new Error("available-dates")
      const json = await res.json()
      const dates: string[] = Array.isArray(json.fullyBookedDates) ? json.fullyBookedDates : []
      cacheRef.current.set(key, new Set(dates))
    } catch {
      cacheRef.current.set(key, new Set()) // fail open
    } finally {
      setLoadingMonth(null)
      setVersion((v) => v + 1)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { getFullyBookedDates, fetchMonth, loadingMonth }
}
