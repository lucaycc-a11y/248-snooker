"use client"

import { useCallback, useEffect, useRef, useState } from "react"

export type DaySlot = {
  table_number: number
  date: string
  start_time: string
  duration_hours: number
  status: string
  locked_until: string | null
}

// How many days to prefetch on /book mount (today + next 7).
const PREFETCH_DAYS = 8

function fmt(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

/**
 * Client availability cache (Task 1). On mount it prefetches today + 7 days in one
 * request and buckets the rows by date. Switching to a cached date returns rows
 * synchronously (no spinner). A date outside the window is fetched on demand and
 * merged in (the caller shows a skeleton while `loadingDate` matches).
 *
 * Availability math (tableStatesFor / freeTablesFor) is overlap-based and
 * date-aware, so it's safe to hand it a superset of rows — far-away rows never
 * overlap the requested window. We therefore serve, for a given date, that date's
 * rows plus its immediate neighbours (for cross-midnight bookings).
 */
export function useAvailabilityCache() {
  // date string -> that date's booked/locked rows
  const cacheRef = useRef<Map<string, DaySlot[]>>(new Map())
  const [version, setVersion] = useState(0) // bump to notify consumers of new data
  const [loadingDate, setLoadingDate] = useState<string | null>(null)
  const [prefetched, setPrefetched] = useState(false)

  const bucket = useCallback((rows: DaySlot[]) => {
    const map = cacheRef.current
    for (const r of rows) {
      const arr = map.get(r.date)
      if (arr) arr.push(r)
      else map.set(r.date, [r])
    }
  }, [])

  // Prefetch today + next 7 days once on mount.
  useEffect(() => {
    let cancelled = false
    const today = new Date()
    ;(async () => {
      try {
        const res = await fetch("/api/booking/availability", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ startDate: fmt(today), days: PREFETCH_DAYS }),
        })
        if (!res.ok) throw new Error("prefetch")
        const json = await res.json()
        const rows: DaySlot[] = Array.isArray(json.slots) ? json.slots : []
        if (cancelled) return
        // Seed every in-window date so a date with zero rows still reads as "cached"
        // (empty = fully open) rather than triggering an on-demand fetch.
        for (let i = 0; i < PREFETCH_DAYS; i++) {
          const d = new Date(today)
          d.setDate(d.getDate() + i)
          if (!cacheRef.current.has(fmt(d))) cacheRef.current.set(fmt(d), [])
        }
        bucket(rows)
        setPrefetched(true)
        setVersion((v) => v + 1)
      } catch {
        // Fail open: consumers fetch per-date on demand if the prefetch missed.
        if (!cancelled) setPrefetched(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [bucket])

  // Rows for a date + its neighbours (cross-midnight), or null if not cached yet.
  const getSlots = useCallback(
    (dateStr: string): DaySlot[] | null => {
      const map = cacheRef.current
      if (!map.has(dateStr)) return null
      const base = new Date(`${dateStr}T00:00:00`)
      const prev = new Date(base)
      prev.setDate(prev.getDate() - 1)
      const next = new Date(base)
      next.setDate(next.getDate() + 1)
      return [
        ...(map.get(fmt(prev)) ?? []),
        ...(map.get(dateStr) ?? []),
        ...(map.get(fmt(next)) ?? []),
      ]
    },
    // version is a dependency so consumers recompute after new data lands.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [version],
  )

  // Fetch a single out-of-window date on demand and merge it in.
  const fetchDate = useCallback(async (dateStr: string) => {
    setLoadingDate(dateStr)
    try {
      const res = await fetch("/api/booking/availability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: dateStr }),
      })
      if (!res.ok) throw new Error("availability")
      const json = await res.json()
      const rows: DaySlot[] = Array.isArray(json.slots) ? json.slots : []
      // Overwrite this date's bucket (and its neighbours, which the single-date
      // endpoint also returns) so re-fetches don't duplicate rows.
      const base = new Date(`${dateStr}T00:00:00`)
      const prev = fmt(new Date(base.getFullYear(), base.getMonth(), base.getDate() - 1))
      const next = fmt(new Date(base.getFullYear(), base.getMonth(), base.getDate() + 1))
      cacheRef.current.set(dateStr, [])
      cacheRef.current.set(prev, [])
      cacheRef.current.set(next, [])
      bucket(rows)
    } catch {
      cacheRef.current.set(dateStr, []) // fail open
    } finally {
      setLoadingDate(null)
      setVersion((v) => v + 1)
    }
  }, [bucket])

  // Task 4: drop cached rows for a date (and neighbours) so the next read refetches
  // — used after a payment succeeds so the just-booked slot shows as taken.
  const invalidate = useCallback((dateStr: string) => {
    const base = new Date(`${dateStr}T00:00:00`)
    const prev = fmt(new Date(base.getFullYear(), base.getMonth(), base.getDate() - 1))
    const next = fmt(new Date(base.getFullYear(), base.getMonth(), base.getDate() + 1))
    cacheRef.current.delete(dateStr)
    cacheRef.current.delete(prev)
    cacheRef.current.delete(next)
    setVersion((v) => v + 1)
  }, [])

  return { getSlots, fetchDate, invalidate, loadingDate, prefetched, version }
}
