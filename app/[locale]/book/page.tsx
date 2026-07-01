"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import {
  Calendar as CalendarIcon,
  ChevronRight,
  ChevronLeft,
  Clock,
  Lock,
  CheckCircle,
  CalendarPlus,
  Share2,
} from "lucide-react"
import { tokens } from "@/app/styles/tokens"
import { Button, Card, ProgressSteps, BackButton } from "@/components/ui"
import { VisaLogo } from "@/components/brand"
import { AuthCard } from "@/components/auth/AuthCard"
import StripePayment from "@/components/checkout/StripePayment"
import { useHaptic } from "@/lib/useHaptic"
import { useLocale, useTranslations } from "next-intl"
import { useRouter } from "@/i18n/navigation"
// @ts-ignore
import confetti from "canvas-confetti"
import QRCodeLib from "qrcode"

/* ─────────────────────────  Config  ───────────────────────── */
// TODO: connect Supabase — use getConfig() server-side and pass as prop
const CONFIG = {
  pricePerHour: 120,
  currency: "HKD",
  maxHours: 6,
  openHour: 0,
  closeHour: 24,
}

const BEBAS = "'Bebas Neue', system-ui, sans-serif"
const STEPS = ["選擇時段", "登入", "付款", "確認"]

/* ─────────────────────────  Helpers  ───────────────────────── */
function genRef(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  const block = (n: number) =>
    Array.from(
      { length: n },
      () => chars[Math.floor(Math.random() * chars.length)]
    ).join("")
  return "248-" + block(4) + "-" + block(4)
}

function padTime(h: number): string {
  return String(((h % 24) + 24) % 24).padStart(2, "0") + ":00"
}

type DaySlot = {
  table_number: number
  date: string
  start_time: string
  duration_hours: number
  status: string
  locked_until: string | null
}

const ALL_TABLES = [1, 2]

type TableState = "available" | "locked" | "booked"

// Per-table state for [startHour, startHour+duration) on `dateStr`, given the
// day's booked/active-locked slots. Pure + client-side so it drives both the wheel
// greying (Step 2) and the table list (Step 3) without extra API calls.
// "locked" = someone else has an active 15-min hold; "booked" = confirmed.
function tableStatesFor(
  daySlots: DaySlot[],
  dateStr: string,
  startHour: number,
  duration: number
): Map<number, TableState> {
  const reqStart = new Date(`${dateStr}T00:00:00`)
  reqStart.setHours(startHour, 0, 0, 0)
  const reqEnd = new Date(reqStart)
  reqEnd.setHours(reqEnd.getHours() + duration)
  const now = new Date()
  const states = new Map<number, TableState>(ALL_TABLES.map((tn) => [tn, "available"]))
  for (const s of daySlots) {
    // Expired locks don't count as taken.
    if (s.status === "locked" && (!s.locked_until || new Date(s.locked_until) <= now)) {
      continue
    }
    const eStart = new Date(`${s.date}T${s.start_time}`)
    const eEnd = new Date(eStart)
    eEnd.setHours(eEnd.getHours() + Number(s.duration_hours))
    if (eStart < reqEnd && reqStart < eEnd) {
      states.set(s.table_number, s.status === "booked" ? "booked" : "locked")
    }
  }
  return states
}

function freeTablesFor(
  daySlots: DaySlot[],
  dateStr: string,
  startHour: number,
  duration: number
): number[] {
  const states = tableStatesFor(daySlots, dateStr, startHour, duration)
  return ALL_TABLES.filter((tn) => states.get(tn) === "available")
}

// Smoothly scroll a revealed section into view (desktop and mobile alike).
// The booking page scrolls the window (the left column is overflow:visible),
// so window.scrollTo works on every breakpoint. The short delay lets the
// section mount/expand before we measure.
function scrollToRef(ref: React.RefObject<HTMLElement>) {
  if (typeof window === "undefined") return
  setTimeout(() => {
    if (!ref.current) return
    const y = ref.current.getBoundingClientRect().top + window.scrollY - 80
    window.scrollTo({ top: y, behavior: "smooth" })
  }, 150)
}

/* ─────────────────────────  QR Code  ───────────────────────── */
// Real, scannable QR rendered from `data` (the signed booking JWT) via the
// `qrcode` library. Dark modules on a white tile for reliable scanning — the
// ESP32 door reader validates the JWT signature offline. Generated client-side
// to a data URL (the JWT is long, so this is a denser QR than a short code).
const QR_PX = 126
function QRCode({ data }: { data: string }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    let cancelled = false
    QRCodeLib.toDataURL(data, {
      margin: 2,
      width: 240,
      errorCorrectionLevel: "M",
      color: { dark: "#0a0a0a", light: "#ffffff" },
    })
      .then((u) => {
        if (!cancelled) setUrl(u)
      })
      .catch(() => {
        /* leave placeholder on failure */
      })
    return () => {
      cancelled = true
    }
  }, [data])

  if (!url) {
    return (
      <div
        aria-hidden
        style={{ width: QR_PX, height: QR_PX, background: "#ffffff", borderRadius: 8 }}
      />
    )
  }
  return (
    <img
      src={url}
      width={QR_PX}
      height={QR_PX}
      alt="Booking QR code"
      style={{ borderRadius: 8, display: "block" }}
    />
  )
}

/* ─────────────────────────  Table Select  ───────────────────────── */
type TableInfo = { id: number; name: string; type: string }

function useTables() {
  const t = useTranslations("book")
  return [
    { id: 1, name: `${t("table_label")} #1`, type: t("snooker") },
    { id: 2, name: `${t("table_label")} #2`, type: t("snooker") },
  ]
}

// Availability is resolved server-side via /api/booking/availability and passed
// in as `tableStates`. A `booked` table is removed entirely (nothing left to do
// with it); a `locked` table stays visible but disabled with a lock icon + tooltip,
// so the user learns "someone else is mid-checkout" at selection time instead of
// only discovering it after tapping Continue.
function TableSelect({
  tableStates,
  selected,
  onSelect,
}: {
  tableStates: Map<number, TableState>
  selected: number | null
  onSelect: (id: number) => void
}) {
  const t = useTranslations("book")
  const tables = useTables().filter((tb) => tableStates.get(tb.id) !== "booked")
  return (
    <div>
      <div className="grid grid-cols-2 gap-3">
        {tables.map((table) => {
          const state = tableStates.get(table.id) ?? "available"
          const isLocked = state === "locked"
          const isSelected = !isLocked && selected === table.id
          return (
            <motion.button
              key={table.id}
              type="button"
              disabled={isLocked}
              onClick={() => !isLocked && onSelect(table.id)}
              whileTap={isLocked ? undefined : { scale: 0.96 }}
              title={isLocked ? t("table_locked_tooltip") : undefined}
              aria-label={`${table.name} ${isLocked ? t("table_locked_tooltip") : t("available")}`}
              aria-disabled={isLocked || undefined}
              data-cms-key={`book.table.${table.id}`}
              className="group relative min-h-11 overflow-hidden rounded-2xl border text-left transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]"
              style={{
                aspectRatio: "3 / 4",
                borderColor: isSelected ? "#22C55E" : "rgba(255,255,255,0.12)",
                backgroundImage: `linear-gradient(180deg, rgba(10,26,15,0.12), rgba(0,0,0,0.76)), url(/images/table-${table.id}.jpg)`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                filter: isLocked ? "grayscale(1)" : "none",
                opacity: isLocked ? 0.5 : isSelected ? 1 : 0.72,
                transform: isSelected ? "scale(1)" : "scale(0.96)",
                cursor: isLocked ? "not-allowed" : "pointer",
                outline: isSelected ? "2px solid #22C55E" : "none",
                outlineOffset: isSelected ? "3px" : "0",
              }}
            >
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(34,197,94,0.22),transparent_38%)]" />
              {isLocked && (
                <div className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-black/65">
                  <Lock size={12} color="rgba(255,255,255,0.7)" />
                </div>
              )}
              <div className="absolute inset-x-0 bottom-0 p-3">
                <div className="rounded-full border border-white/10 bg-black/55 px-3 py-2 backdrop-blur-xl">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[13px] font-semibold text-white">
                      {table.name}
                    </span>
                    {!isLocked && (
                      <span
                        aria-hidden="true"
                        className="flex h-5 w-5 items-center justify-center rounded-full border"
                        style={{
                          borderColor: isSelected ? "#22C55E" : "rgba(255,255,255,0.36)",
                          background: isSelected ? "#22C55E" : "rgba(255,255,255,0.08)",
                        }}
                      >
                        {isSelected && <CheckCircle size={12} color="#000" strokeWidth={2.5} />}
                      </span>
                    )}
                  </div>
                  <div
                    className="mt-1 text-[11px] text-white/55"
                    data-cms-key={`book.table.${table.id}.status`}
                  >
                    {isLocked ? t("table_locked") : t("available")}
                  </div>
                </div>
              </div>
            </motion.button>
          )
        })}
      </div>
      <div
        data-cms-key="book.table.hint"
        style={{
          fontSize: 13,
          color: tokens.colors.textMuted,
          marginTop: 12,
        }}
      >
        {t("hint")}
      </div>
    </div>
  )
}

/* ─────────────────────────  Calendar  ───────────────────────── */
const DAY_NAMES = ["日", "一", "二", "三", "四", "五", "六"]

// Mock — dates fully booked (red dot). TODO: swap to Supabase availability.
function isFullyBooked(_d: Date): boolean {
  return false
}

function Calendar({
  selected,
  onSelect,
}: {
  selected: Date
  onSelect: (d: Date) => void
}) {
  const today = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  }, [])

  const [view, setView] = useState(() => ({
    year: selected.getFullYear(),
    month: selected.getMonth(),
  }))

  const { year, month } = view
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  // 42 cells = 6 rows × 7 cols, leading blanks then dates
  const cells: (Date | null)[] = useMemo(() => {
    const arr: (Date | null)[] = Array(firstDay).fill(null)
    for (let d = 1; d <= daysInMonth; d++) arr.push(new Date(year, month, d))
    while (arr.length < 42) arr.push(null)
    return arr
  }, [firstDay, daysInMonth, year, month])

  const canGoPrev =
    year > today.getFullYear() ||
    (year === today.getFullYear() && month > today.getMonth())

  const shiftMonth = (delta: number) =>
    setView((v) => {
      const m = v.month + delta
      return {
        year: v.year + Math.floor(m / 12),
        month: ((m % 12) + 12) % 12,
      }
    })

  return (
    <div>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 14,
        }}
      >
        <button
          type="button"
          aria-label="上一個月"
          disabled={!canGoPrev}
          onClick={() => shiftMonth(-1)}
          style={{
            width: 44,
            height: 44,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "none",
            border: "none",
            color: canGoPrev ? tokens.colors.text : tokens.colors.textFaint,
            cursor: canGoPrev ? "pointer" : "not-allowed",
          }}
        >
          <ChevronLeft size={20} />
        </button>
        <span style={{ fontSize: 16, fontWeight: 600 }}>
          {year}年{month + 1}月
        </span>
        <button
          type="button"
          aria-label="下一個月"
          onClick={() => shiftMonth(1)}
          style={{
            width: 44,
            height: 44,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "none",
            border: "none",
            color: tokens.colors.text,
            cursor: "pointer",
          }}
        >
          <ChevronRight size={20} />
        </button>
      </div>

      {/* Weekday row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          marginBottom: 4,
        }}
      >
        {DAY_NAMES.map((d) => (
          <div
            key={d}
            style={{
              textAlign: "center",
              fontSize: 12,
              color: tokens.colors.textMuted,
              padding: "4px 0",
            }}
          >
            {d}
          </div>
        ))}
      </div>

      {/* Date grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          gap: 2,
        }}
      >
        {cells.map((date, i) => {
          if (!date) return <div key={`b${i}`} />
          const isPast = date.getTime() < today.getTime()
          const isToday = date.getTime() === today.getTime()
          const isSelected = date.toDateString() === selected.toDateString()
          const booked = !isPast && isFullyBooked(date)
          return (
            <div
              key={date.toISOString()}
              style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                aspectRatio: "1 / 1",
              }}
            >
              <button
                type="button"
                disabled={isPast}
                aria-label={`${date.getMonth() + 1}月${date.getDate()}日`}
                aria-current={isSelected ? "date" : undefined}
                onClick={() => !isPast && onSelect(date)}
                style={{
                  // Tap target fills the whole grid cell (maximised to ~44px+);
                  // the visual circle inside stays 40px.
                  width: "100%",
                  height: "100%",
                  minHeight: 40,
                  padding: 0,
                  border: "none",
                  background: "transparent",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: isPast ? "default" : "pointer",
                  opacity: isPast ? 0.3 : 1,
                }}
              >
                <span
                  style={{
                    position: "relative",
                    width: 40,
                    height: 40,
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 15,
                    fontWeight: isSelected ? 600 : 400,
                    background: isSelected ? tokens.colors.link : "transparent",
                    color: isSelected ? "#fff" : tokens.colors.text,
                    border:
                      isToday && !isSelected
                        ? `1px solid ${tokens.colors.text}`
                        : "1px solid transparent",
                    transition: `background ${tokens.duration.fast}`,
                  }}
                >
                  {date.getDate()}
                  {booked && (
                    <span
                      style={{
                        position: "absolute",
                        bottom: 4,
                        left: "50%",
                        transform: "translateX(-50%)",
                        width: 4,
                        height: 4,
                        borderRadius: "50%",
                        background: tokens.colors.danger,
                      }}
                    />
                  )}
                </span>
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ─────────────────────────  Drum Roll Wheel (iOS)  ───────────────────────── */
const WHEEL_ITEM_H = 48
const WHEEL_VISIBLE = 5
const WHEEL_PAD = Math.floor(WHEEL_VISIBLE / 2) * WHEEL_ITEM_H // 2 items

function DrumWheel({
  items,
  selected,
  onChange,
  labelFn,
  ariaLabel,
  isDisabled,
}: {
  items: number[]
  selected: number
  onChange: (val: number) => void
  labelFn: (val: number) => string
  ariaLabel: string
  // Optional predicate — disabled values render greyed/struck-through, are never
  // emitted via onChange, and the wheel snaps away from them when scrolling stops.
  isDisabled?: (val: number) => boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  const haptic = useHaptic()
  const n = items.length
  const baseIdx = Math.max(0, items.indexOf(selected))
  const lastRealRef = useRef(baseIdx)
  const initedRef = useRef(false)
  const rafRef = useRef<number | null>(null)
  const touchingRef = useRef(false)
  const pendingRecenterRef = useRef(false)
  const endTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Triplicate for a seamless infinite loop; start on the middle copy.
  const loop = useMemo(() => [...items, ...items, ...items], [items])
  const [centerLoopIdx, setCenterLoopIdx] = useState(n + baseIdx)

  // Position on the selected item in the MIDDLE copy at mount (no animation).
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const startLoop = n + Math.max(0, items.indexOf(selected))
    const prev = el.style.scrollBehavior
    el.style.scrollBehavior = "auto"
    el.scrollTop = startLoop * WHEEL_ITEM_H
    lastRealRef.current = startLoop % n
    setCenterLoopIdx(startLoop)
    requestAnimationFrame(() => {
      el.style.scrollBehavior = prev || "smooth"
      initedRef.current = true
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Silently jump by one copy-length toward the middle whenever the scroll
  // position drifts into an outer copy, so the user can never reach the real
  // top/bottom — even mid-fling. Skipped while a finger is down (we'd teleport
  // under it); the pending jump then runs on touchend.
  const recenter = useCallback(() => {
    const el = ref.current
    if (!el) return
    const copyH = n * WHEEL_ITEM_H
    const loopIdx = Math.round(el.scrollTop / WHEEL_ITEM_H)
    if (loopIdx >= n && loopIdx < 2 * n) return // already in the middle copy
    if (touchingRef.current) {
      pendingRecenterRef.current = true
      return
    }
    const prev = el.style.scrollBehavior
    el.style.scrollBehavior = "auto"
    el.scrollTop += loopIdx < n ? copyH : -copyH
    pendingRecenterRef.current = false
    requestAnimationFrame(() => {
      el.style.scrollBehavior = prev || "smooth"
    })
  }, [n])

  const settle = useCallback(() => {
    const el = ref.current
    if (!el) return
    const loopIdx = Math.round(el.scrollTop / WHEEL_ITEM_H)
    setCenterLoopIdx(loopIdx)
    const realIdx = ((loopIdx % n) + n) % n
    if (realIdx !== lastRealRef.current) {
      lastRealRef.current = realIdx
      haptic.vibrate(8)
      // Don't emit a disabled value; the scroll-end redirect snaps away from it.
      if (!isDisabled?.(items[realIdx])) onChange(items[realIdx])
    }
    // Recenter continuously (not just on idle) so fast flings never hit a wall.
    recenter()
  }, [items, n, onChange, haptic, recenter, isDisabled])

  const stepTo = useCallback((loopIdx: number) => {
    const el = ref.current
    if (!el) return
    el.scrollTop = loopIdx * WHEEL_ITEM_H // smooth (behavior restored post-mount)
  }, [])

  // When scrolling stops on a DISABLED item, snap to the nearest enabled one
  // (searched outward in scroll space so the wheel moves minimally). No-op when
  // there is no predicate or every item is disabled.
  const redirectIfDisabled = useCallback(() => {
    const el = ref.current
    if (!el || !isDisabled) return
    const loopIdx = Math.round(el.scrollTop / WHEEL_ITEM_H)
    if (!isDisabled(items[((loopIdx % n) + n) % n])) return
    for (let off = 1; off < n; off++) {
      for (const cand of [loopIdx - off, loopIdx + off]) {
        if (!isDisabled(items[((cand % n) + n) % n])) {
          stepTo(cand)
          return
        }
      }
    }
  }, [isDisabled, items, n, stepTo])

  const handleScroll = useCallback(() => {
    if (!initedRef.current) return // ignore the mount-time scroll assignment
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(settle)
    // Debounced scroll-end check: snap off a disabled item once the fling stops.
    if (endTimerRef.current) clearTimeout(endTimerRef.current)
    endTimerRef.current = setTimeout(redirectIfDisabled, 160)
  }, [settle, redirectIfDisabled])

  const handleTouchStart = useCallback(() => {
    touchingRef.current = true
  }, [])

  const handleTouchEnd = useCallback(() => {
    touchingRef.current = false
    if (pendingRecenterRef.current) recenter()
  }, [recenter])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault()
        stepTo(centerLoopIdx + 1)
      } else if (e.key === "ArrowUp") {
        e.preventDefault()
        stepTo(centerLoopIdx - 1)
      }
    },
    [centerLoopIdx, stepTo]
  )

  return (
    <div style={{ position: "relative", height: WHEEL_VISIBLE * WHEEL_ITEM_H }}>
      {/* Selection indicator lines */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: 0,
          right: 0,
          height: WHEEL_ITEM_H,
          transform: "translateY(-50%)",
          borderTop: "1px solid rgba(255,255,255,0.2)",
          borderBottom: "1px solid rgba(255,255,255,0.2)",
          pointerEvents: "none",
          zIndex: 1,
        }}
      />
      <div
        ref={ref}
        onScroll={handleScroll}
        onKeyDown={handleKeyDown}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        tabIndex={0}
        role="listbox"
        aria-label={ariaLabel}
        aria-activedescendant={`wheel-${ariaLabel}-${items[((centerLoopIdx % n) + n) % n]}`}
        className="no-scrollbar drum-wheel"
        style={{
          height: "100%",
          overflowY: "scroll",
          scrollSnapType: "y mandatory",
          scrollBehavior: "smooth",
          WebkitOverflowScrolling: "touch",
          outline: "none",
          maskImage:
            "linear-gradient(to bottom, transparent 0%, black 25%, black 75%, transparent 100%)",
          WebkitMaskImage:
            "linear-gradient(to bottom, transparent 0%, black 25%, black 75%, transparent 100%)",
        }}
      >
        {/* Top spacer */}
        <div style={{ height: WHEEL_PAD }} aria-hidden="true" />
        {loop.map((val, i) => {
          const dist = Math.abs(i - centerLoopIdx)
          const fontSize = dist === 0 ? 36 : dist === 1 ? 22 : 18
          const realIdx = ((i % n) + n) % n
          const disabled = isDisabled?.(items[realIdx]) ?? false
          const opacity = disabled
            ? 0.25
            : dist === 0
              ? 1
              : dist === 1
                ? 0.7
                : 0.35
          return (
            <div
              key={i}
              id={i === n ? `wheel-${ariaLabel}-${val}` : undefined}
              role="option"
              aria-selected={dist === 0}
              aria-disabled={disabled || undefined}
              style={{
                height: WHEEL_ITEM_H,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                scrollSnapAlign: "center",
                fontSize,
                fontWeight: dist === 0 ? 600 : 400,
                color: disabled ? tokens.colors.textFaint : tokens.colors.text,
                opacity,
                textDecoration: disabled ? "line-through" : "none",
                transition: "font-size 120ms ease-out, opacity 120ms ease-out",
              }}
            >
              {labelFn(items[realIdx])}
            </div>
          )
        })}
        {/* Bottom spacer */}
        <div style={{ height: WHEEL_PAD }} aria-hidden="true" />
      </div>
    </div>
  )
}

/* ─────────────────────────  Summary Card (Desktop)  ───────────────────────── */
function SummaryCard({
  selectedDate,
  startHour,
  duration,
  total,
  canContinue,
  onContinue,
  ctaLabel,
  loading,
  ready = true,
}: {
  selectedDate: Date
  startHour: number
  duration: number
  total: number
  canContinue: boolean
  onContinue: () => void
  ctaLabel: string
  loading?: boolean
  ready?: boolean
}) {
  const endHour = startHour + duration
  const crossDay = endHour >= 24
  const dash = "—"
  const t = useTranslations("book")

  return (
    <div className="desktop-card">
      <Card variant="elevated">
        <div
          data-cms-key="book.card.title"
          style={{
            fontSize: 12,
            color: tokens.colors.textMuted,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            marginBottom: 20,
          }}
        >
          {t("your_booking")}
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 14,
            marginBottom: 24,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: 14, color: tokens.colors.textMuted }}>
              {t("date")}
            </span>
            <span style={{ fontSize: 15, fontWeight: 500 }}>
              {ready
                ? `${selectedDate.getFullYear()}年${selectedDate.getMonth() + 1}月${selectedDate.getDate()}日`
                : dash}
            </span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: 14, color: tokens.colors.textMuted }}>
              {t("time_slot")}
            </span>
            <span style={{ fontSize: 15, fontWeight: 500 }}>
              {ready
                ? `${padTime(startHour)} – ${padTime(endHour)}${crossDay ? " +1日" : ""}`
                : dash}
            </span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: 14, color: tokens.colors.textMuted }}>
              {t("duration")}
            </span>
            <span style={{ fontSize: 15, fontWeight: 500 }}>
              {ready ? `${duration}${t("hours")}` : dash}
            </span>
          </div>
        </div>
        <div
          style={{
            height: 1,
            background: tokens.colors.border,
            marginBottom: 24,
          }}
        />
        <div
          style={{
            fontFamily: BEBAS,
            fontSize: 40,
            textAlign: "center",
            marginBottom: 28,
            color: tokens.colors.brand,
          }}
        >
          {ready ? `HK$${total}` : "HK$—"}
        </div>
        <Button
          variant="primary"
          size="lg"
          fullWidth
          disabled={!canContinue}
          loading={loading}
          onClick={onContinue}
          rightIcon={<ChevronRight size={18} />}
        >
          {ctaLabel}
        </Button>
      </Card>
    </div>
  )
}

/* ─────────────────────────  Mobile CTA Bar  ───────────────────────── */
function MobilePriceBar({
  ctaLabel,
  onContinue,
  canContinue,
  loading,
}: {
  ctaLabel: string
  onContinue: () => void
  canContinue: boolean
  loading?: boolean
}) {
  const disabled = !canContinue || !!loading
  return (
    <div className="mobile-cta">
      <button
        type="button"
        onClick={onContinue}
        disabled={disabled}
        style={{
          width: "100%",
          height: 54,
          border: "none",
          borderRadius: 14,
          background: disabled ? "rgba(255,255,255,0.15)" : tokens.colors.brand,
          color: disabled ? tokens.colors.textMuted : "#000",
          fontWeight: 700,
          fontSize: 17,
          cursor: disabled ? "not-allowed" : "pointer",
          transition: `background ${tokens.duration.fast}`,
        }}
      >
        {loading ? "處理中…" : ctaLabel}
      </button>
    </div>
  )
}

/* ─────────────────────────  Screen 1: Select  ───────────────────────── */
function Screen1({
  selectedTable,
  setSelectedTable,
  selectedDate,
  setSelectedDate,
  startHour,
  setStartHour,
  duration,
  setDuration,
  onContinue,
}: {
  selectedTable: number | null
  setSelectedTable: (id: number | null) => void
  selectedDate: Date
  setSelectedDate: (d: Date) => void
  startHour: number
  setStartHour: (h: number) => void
  duration: number
  setDuration: (d: number) => void
  onContinue: () => void
}) {
  const total = CONFIG.pricePerHour * duration
  const endHour = startHour + duration
  const crossDay = endHour >= 24
  const [displayTotal, setDisplayTotal] = useState(total)
  const [dateChosen, setDateChosen] = useState(false)
  const [daySlots, setDaySlots] = useState<DaySlot[] | null>(null)
  const [dayLoading, setDayLoading] = useState(false)
  const timeRef = useRef<HTMLDivElement>(null)
  const tableRef = useRef<HTMLDivElement>(null)
  const t = useTranslations("book")

  const dateStr = useMemo(() => {
    const y = selectedDate.getFullYear()
    const m = String(selectedDate.getMonth() + 1).padStart(2, "0")
    const d = String(selectedDate.getDate()).padStart(2, "0")
    return `${y}-${m}-${d}`
  }, [selectedDate])

  // Animate the live price total.
  useEffect(() => {
    const target = CONFIG.pricePerHour * duration
    if (target === displayTotal) return
    const step = target > displayTotal ? 10 : -10
    const id = setInterval(() => {
      setDisplayTotal((prev) => {
        const next = prev + step
        if ((step > 0 && next >= target) || (step < 0 && next <= target)) {
          clearInterval(id)
          return target
        }
        return next
      })
    }, 20)
    return () => clearInterval(id)
  }, [duration, displayTotal])

  // Fetch the day's booked/locked slots once per date; per-hour and per-duration
  // greying (Step 2) + the table list (Step 3) are then computed locally, so wheel
  // scrolling triggers no extra requests. Fails OPEN (empty = everything free) —
  // the slot lock at payment is the authoritative guard against double-booking.
  useEffect(() => {
    if (!dateChosen) {
      setDaySlots(null)
      return
    }
    let cancelled = false
    setDayLoading(true)
    ;(async () => {
      try {
        const res = await fetch("/api/booking/availability", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ date: dateStr }),
        })
        if (!res.ok) throw new Error("availability")
        const json = await res.json()
        if (!cancelled) setDaySlots(Array.isArray(json.slots) ? json.slots : [])
      } catch {
        if (!cancelled) setDaySlots([]) // fail open
      } finally {
        if (!cancelled) setDayLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [dateChosen, dateStr])

  // Tables free for the CURRENT start+duration (drives Step 3 + the live summary).
  const tableStates = useMemo(
    () => (daySlots ? tableStatesFor(daySlots, dateStr, startHour, duration) : null),
    [daySlots, dateStr, startHour, duration]
  )
  const availableTables = useMemo(
    () =>
      tableStates
        ? ALL_TABLES.filter((tn) => tableStates.get(tn) === "available")
        : null,
    [tableStates]
  )

  // Wheel greying: a start hour is full if no table fits the current duration; a
  // duration is full if no table fits it at the current start hour.
  const isStartDisabled = useCallback(
    (h: number) =>
      daySlots ? freeTablesFor(daySlots, dateStr, h, duration).length === 0 : false,
    [daySlots, dateStr, duration]
  )
  const isDurationDisabled = useCallback(
    (d: number) =>
      daySlots ? freeTablesFor(daySlots, dateStr, startHour, d).length === 0 : false,
    [daySlots, dateStr, startHour]
  )

  // Drop a selected table if a time change made it unavailable.
  useEffect(() => {
    if (
      availableTables &&
      selectedTable !== null &&
      !availableTables.includes(selectedTable)
    ) {
      setSelectedTable(null)
    }
  }, [availableTables, selectedTable, setSelectedTable])

  // Once tables resolve for a date, bring the table-selection section into view
  // (it sits below the fold under the time wheels). Once per date — not on every
  // wheel tick — so we don't fight the user while they adjust the time.
  const scrolledForDate = useRef<string | null>(null)
  useEffect(() => {
    if (!dateChosen || dayLoading || availableTables === null) return
    if (scrolledForDate.current === dateStr) return
    scrolledForDate.current = dateStr
    scrollToRef(tableRef)
  }, [dateChosen, dayLoading, availableTables, dateStr])

  const startItems = useMemo(() => Array.from({ length: 24 }, (_, i) => i), [])
  const durationItems = useMemo(
    () => Array.from({ length: CONFIG.maxHours }, (_, i) => i + 1),
    []
  )

  const fullyBooked =
    dateChosen && availableTables !== null && availableTables.length === 0
  const ready =
    dateChosen &&
    selectedTable !== null &&
    (availableTables?.includes(selectedTable) ?? false)
  const canContinue = ready

  const sectionLabel = (text: string, cmsKey: string) => (
    <div
      data-cms-key={cmsKey}
      style={{
        fontSize: 13,
        color: tokens.colors.textMuted,
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        marginBottom: 14,
      }}
    >
      {text}
    </div>
  )

  return (
    <div className="screen-content">
      <div className="two-col">
        <div className="col-left">
          {/* Step 1 — Date */}
          <div style={{ marginBottom: 28 }}>
            {sectionLabel(t("select_date"), "book.date.title")}
            <Calendar
              selected={selectedDate}
              onSelect={(d) => {
                setSelectedDate(d)
                setDateChosen(true)
                scrollToRef(timeRef)
              }}
            />
          </div>

          {/* Step 2 — Time + duration (revealed after date chosen) */}
          <AnimatePresence>
            {dateChosen && (
              <motion.div
                ref={timeRef}
                key="time"
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              >
                <div style={{ marginBottom: 24 }}>
                  <div style={{ display: "flex", gap: 24 }}>
                    <div style={{ flex: 1 }}>
                      <div
                        data-cms-key="book.time.title"
                        style={{
                          fontSize: 12,
                          color: tokens.colors.textMuted,
                          textAlign: "center",
                          marginBottom: 8,
                        }}
                      >
                        {t("start_time")}
                      </div>
                      <div
                        style={{
                          background: "rgba(255,255,255,0.03)",
                          border: "1px solid rgba(255,255,255,0.08)",
                          borderRadius: 16,
                        }}
                      >
                        <DrumWheel
                          items={startItems}
                          selected={startHour}
                          onChange={setStartHour}
                          labelFn={(h) => padTime(h)}
                          ariaLabel={t("start_time")}
                          isDisabled={isStartDisabled}
                        />
                      </div>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div
                        data-cms-key="book.duration.title"
                        style={{
                          fontSize: 12,
                          color: tokens.colors.textMuted,
                          textAlign: "center",
                          marginBottom: 8,
                        }}
                      >
                        {t("duration")}
                      </div>
                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: 8,
                          alignContent: "center",
                          justifyContent: "center",
                          minHeight: WHEEL_VISIBLE * WHEEL_ITEM_H,
                          background: "rgba(255,255,255,0.03)",
                          border: "1px solid rgba(255,255,255,0.08)",
                          borderRadius: 16,
                          padding: 12,
                        }}
                      >
                        {durationItems.map((d) => {
                          const isSelected = d === duration
                          const disabled = isDurationDisabled(d)
                          return (
                            <button
                              key={d}
                              type="button"
                              disabled={disabled}
                              onClick={() => setDuration(d)}
                              aria-pressed={isSelected}
                              className="transition-all duration-150"
                              style={{
                                minWidth: 56,
                                height: 40,
                                padding: "0 14px",
                                borderRadius: tokens.radius.pill,
                                border: `1px solid ${isSelected ? tokens.colors.brand : tokens.colors.border}`,
                                background: isSelected
                                  ? tokens.colors.brand
                                  : "rgba(255,255,255,0.04)",
                                color: disabled
                                  ? tokens.colors.textFaint
                                  : isSelected
                                    ? "#000"
                                    : tokens.colors.text,
                                fontSize: 14,
                                fontWeight: isSelected ? 700 : 500,
                                textDecoration: disabled ? "line-through" : "none",
                                opacity: disabled ? 0.4 : 1,
                                cursor: disabled ? "not-allowed" : "pointer",
                              }}
                            >
                              {d}
                              {t("hours")}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Live price preview */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  style={{
                    background: tokens.colors.surface,
                    border: `1px solid ${tokens.colors.border}`,
                    borderRadius: tokens.radius.input,
                    padding: "16px 20px",
                    marginBottom: 20,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: 8,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Clock size={14} style={{ color: tokens.colors.textMuted }} />
                    <span style={{ fontSize: 15 }}>
                      {padTime(startHour)} – {padTime(endHour)}
                      {crossDay ? " (+1日)" : ""} · {duration}{t("hours")}
                    </span>
                  </div>
                  <span
                    style={{
                      fontFamily: BEBAS,
                      fontSize: 24,
                      color: tokens.colors.brand,
                    }}
                  >
                    HK${displayTotal}
                  </span>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Step 3 — Table (revealed after date; a fully BOOKED table is removed
              entirely, a LOCKED (someone else mid-checkout) table stays visible but
              disabled with a tooltip — see TableSelect). */}
          <AnimatePresence>
            {dateChosen && (
              <motion.div
                ref={tableRef}
                key="tables"
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              >
                <div style={{ marginBottom: 28 }}>
                  {sectionLabel(t("select_table"), "book.table.title")}
                  {dayLoading || tableStates === null ? (
                    <div
                      data-cms-key="book.checking"
                      style={{ fontSize: 13, color: tokens.colors.textMuted }}
                    >
                      {t("checking")}
                    </div>
                  ) : fullyBooked ? (
                    <div
                      data-cms-key="book.fullybooked"
                      style={{
                        fontSize: 14,
                        color: tokens.colors.textMuted,
                        padding: "16px 20px",
                        border: `1px solid ${tokens.colors.border}`,
                        borderRadius: tokens.radius.input,
                        textAlign: "center",
                      }}
                    >
                      {t("fully_booked")}
                    </div>
                  ) : (
                    <>
                      {availableTables !== null && availableTables.length > 0 && (
                        <div
                          data-cms-key="book.table.remaining"
                          style={{
                            fontSize: 12,
                            color: tokens.colors.brand,
                            marginBottom: 10,
                          }}
                        >
                          {t("tables_remaining", { count: availableTables.length })}
                        </div>
                      )}
                      <TableSelect
                        tableStates={tableStates}
                        selected={selectedTable}
                        onSelect={(id) => setSelectedTable(id)}
                      />
                    </>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Hint */}
          <div
            data-cms-key="book.hint"
            style={{
              fontSize: 13,
              color: tokens.colors.textMuted,
              textAlign: "center",
              marginBottom: 16,
            }}
          >
            {t("instant_confirm")}
          </div>
        </div>

        {/* Desktop summary */}
        <SummaryCard
          selectedDate={selectedDate}
          startHour={startHour}
          duration={duration}
          total={total}
          canContinue={canContinue}
          onContinue={onContinue}
          ctaLabel={t("continue")}
          ready={ready}
        />
      </div>

      {/* Mobile sticky price bar */}
      <MobilePriceBar
        ctaLabel={t("continue")}
        onContinue={onContinue}
        canContinue={canContinue}
      />
    </div>
  )
}

/* ─────────────────────────  Screen 2: Auth  ───────────────────────── */
function Screen2({
  onSuccess,
  selectedDate,
  startHour,
  duration,
  selectedTable,
}: {
  onSuccess: () => void
  selectedDate: Date
  startHour: number
  duration: number
  selectedTable: number | null
}) {
  const t = useTranslations("book")

  // Persist the in-progress booking before any auth redirect (the Google fallback
  // flow leaves the page). On return, BookPage restores this and re-lands on the
  // login step so AuthCard resolves the now-active session. Refreshed on every
  // selection change so a redirect at any moment is covered.
  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      sessionStorage.setItem(
        "pendingBooking",
        JSON.stringify({
          tableNumber: selectedTable,
          date: selectedDate.toISOString(),
          startHour,
          duration,
        }),
      )
    } catch {}
  }, [selectedDate, startHour, duration, selectedTable])

  // Single source of truth for sign-in: the shared AuthCard (Apple placeholder,
  // official Google, real Supabase SMS OTP) + the mandatory profile gate. No more
  // fake onClick={onSuccess} advances — onSuccess fires only on a real session.
  return (
    <div className="screen-content auth-screen">
      <div style={{ maxWidth: 400, margin: "0 auto" }}>
        <div
          style={{
            background: "rgba(255,255,255,0.05)",
            backdropFilter: "blur(20px) saturate(180%)",
            WebkitBackdropFilter: "blur(20px) saturate(180%)",
            borderRadius: 24,
            border: "1px solid rgba(255,255,255,0.1)",
            padding: 32,
          }}
        >
          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <h2
              data-cms-key="book.auth.title"
              style={{
                fontFamily: '"Bebas Neue", sans-serif',
                fontSize: 30,
                letterSpacing: "0.02em",
                color: "#fff",
                marginBottom: 6,
              }}
            >
              {t("login_title")}
            </h2>
            <p
              data-cms-key="book.auth.subtitle"
              style={{ fontSize: 13, color: "rgba(255,255,255,0.55)" }}
            >
              {t("login_subtitle")}
            </p>
          </div>
          <AuthCard returnUrl="/book" onAuthComplete={onSuccess} />
        </div>
      </div>
    </div>
  )
}

/* ─────────────────────────  Screen 3: Payment  ───────────────────────── */
function Screen3({
  selectedDate,
  startHour,
  duration,
  tableName,
  tableNumber,
}: {
  selectedDate: Date
  startHour: number
  duration: number
  tableName: string
  tableNumber: number
}) {
  const t = useTranslations("book")
  const locale = useLocale()

  const total = CONFIG.pricePerHour * duration
  const endHour = startHour + duration
  const crossDay = endHour >= 24

  const dateStr = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, "0")}-${String(selectedDate.getDate()).padStart(2, "0")}`

  return (
    <div className="screen-content">
      <div style={{ maxWidth: 480, margin: "0 auto" }}>
        {/* Order summary */}
        <Card style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <CalendarIcon size={14} style={{ color: tokens.colors.textMuted }} />
              <span style={{ fontSize: 14 }}>
                {selectedDate.getMonth() + 1}月{selectedDate.getDate()}日
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Clock size={14} style={{ color: tokens.colors.textMuted }} />
              <span style={{ fontSize: 14 }}>
                {padTime(startHour)} – {padTime(endHour)}
                {crossDay ? " +1日" : ""}
              </span>
            </div>
          </div>
          <div
            data-cms-key="book.pay.venue"
            style={{ fontSize: 13, color: tokens.colors.textMuted, marginBottom: 16 }}
          >
            248 Snooker · {tableName}
          </div>
          <div style={{ height: 1, background: tokens.colors.border, marginBottom: 12 }} />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, marginBottom: 8 }}>
            <span data-cms-key="book.pay.subtotal" style={{ color: tokens.colors.textMuted }}>{t("subtotal")}</span>
            <span>HK${total}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, marginBottom: 12 }}>
            <span data-cms-key="book.pay.fee" style={{ color: tokens.colors.textMuted }}>{t("service_fee")}</span>
            <span>HK$0</span>
          </div>
          <div style={{ height: 1, background: tokens.colors.border, marginBottom: 12 }} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span data-cms-key="book.pay.total" style={{ fontSize: 15, fontWeight: 600 }}>{t("total")}</span>
            <span style={{ fontFamily: BEBAS, fontSize: 28, color: tokens.colors.brand }}>HK${total}</span>
          </div>
        </Card>

        {/* Payment — Stripe Payment Element rendered under our own chrome. It
            shows cards + Apple/Google Pay + Alipay/WeChat with officially-licensed
            icons, and confirms via redirect (return to /book). */}
        <div
          data-cms-key="book.pay.method"
          style={{ fontSize: 13, color: tokens.colors.textMuted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 14 }}
        >
          {t("payment_title")}
        </div>

        <StripePayment
          date={dateStr}
          startHour={startHour}
          duration={duration}
          tableNumber={tableNumber}
          total={total}
          locale={locale}
          returnPath="/book"
          payLabel={`${t("pay_now")} · HK$${total}`}
          processingLabel={t("processing")}
          errorLabel={t("pay_error")}
          loadingLabel={t("pay_loading")}
          lockHoldLabel={t("lock_hold")}
          paymentFailedLabel={t("pay_declined")}
        />

        {/* Stripe secure */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 14 }}>
          <Lock size={12} style={{ color: tokens.colors.textMuted }} />
          <span data-cms-key="book.pay.secure" style={{ fontSize: 12, color: tokens.colors.textMuted }}>
            {t("stripe_secure")}
          </span>
        </div>
      </div>
    </div>
  )
}

/* ─────────────────────────  Screen 4: Confirmation Ticket  ───────────────────────── */
function Screen4({
  selectedDate,
  startHour,
  duration,
  tableName,
  bookingRef,
  qrData,
}: {
  selectedDate: Date
  startHour: number
  duration: number
  tableName: string
  bookingRef: string
  // The signed QR JWT from the confirmed booking; falls back to the ref for the
  // (decorative) code rendering when absent.
  qrData?: string
}) {
  const t = useTranslations("book")
  const t_ticket = useTranslations("ticket")

  const total = CONFIG.pricePerHour * duration
  const endHour = startHour + duration
  const crossDay = endHour >= 24
  const dateStr = `${selectedDate.getFullYear()}年${selectedDate.getMonth() + 1}月${selectedDate.getDate()}日 星期${DAY_NAMES[selectedDate.getDay()]}`

  // canvas-confetti burst after ticket springs in
  useEffect(() => {
    const timer = setTimeout(() => {
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.6 },
        colors: ["#22c55e", "#ffffff", "#16a34a"],
      })
    }, 2000)
    return () => clearTimeout(timer)
  }, [])

  // Add-to-calendar — generate a downloadable .ics file
  const handleAddCalendar = () => {
    const start = new Date(selectedDate)
    start.setHours(startHour, 0, 0, 0)
    const end = new Date(start)
    end.setHours(start.getHours() + duration)
    const fmt = (d: Date) =>
      d
        .toISOString()
        .replace(/[-:]/g, "")
        .replace(/\.\d{3}/, "")
    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "BEGIN:VEVENT",
      `DTSTART:${fmt(start)}`,
      `DTEND:${fmt(end)}`,
      `SUMMARY:248 Snooker · ${tableName}`,
      `DESCRIPTION:預訂編號 ${bookingRef}`,
      "LOCATION:248 Snooker",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n")
    const url = URL.createObjectURL(
      new Blob([ics], { type: "text/calendar" })
    )
    const a = document.createElement("a")
    a.href = url
    a.download = `248-${bookingRef}.ics`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleShare = async () => {
    const text = `我的 248 Snooker 預訂 · ${tableName} · 編號 ${bookingRef}`
    if (navigator.share) {
      try {
        await navigator.share({ title: "248 Snooker", text })
      } catch {
        /* user cancelled */
      }
    } else if (navigator.clipboard) {
      await navigator.clipboard.writeText(text)
    }
  }

  return (
    <div
      className="screen-content"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "calc(100dvh - 80px)",
        position: "relative",
        padding: "24px 20px",
      }}
    >
      {/* Ticket spring slide-up */}
      <div style={{ width: "100%", maxWidth: 384, margin: "0 auto", position: "relative" }}>
        <motion.div
          initial={{ y: "80%", opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: "spring", damping: 20, stiffness: 120, duration: 1.5 }}
          style={{
            background: "linear-gradient(160deg, #111111 0%, #1a1a1a 100%)",
            borderRadius: 24,
            border: "1px solid rgba(255,255,255,0.1)",
            overflowY: "auto",
            maxHeight: "85vh",
            WebkitOverflowScrolling: "touch",
            position: "relative",
          }}
        >
        {/* Top section */}
        <div style={{ padding: 20 }}>
          {/* Header row */}
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
            <img src="/logos/248_logo_white_bg.svg" alt="248 Snooker" style={{ height: 24, width: "auto" }} />
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 500, damping: 20, delay: 1.2 }}
              style={{
                background: tokens.colors.brand,
                padding: "4px 12px",
                borderRadius: 999,
              }}
            >
              <span data-cms-key="book.ticket.confirmed" style={{ fontSize: 12, fontWeight: 700, color: "#000" }}>{t_ticket("confirmed")}</span>
            </motion.div>
          </div>

          {/* Time display — flex row, shrink-safe so it never clips */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexWrap: "nowrap",
              margin: 0,
            }}
          >
            <span
              style={{
                fontSize: "clamp(28px, 7vw, 48px)",
                fontWeight: 800,
                letterSpacing: "-0.03em",
                lineHeight: 1.05,
                color: tokens.colors.text,
              }}
            >
              {padTime(startHour)}
            </span>
            <span
              style={{
                fontSize: "clamp(20px, 4vw, 32px)",
                opacity: 0.6,
                color: tokens.colors.text,
              }}
            >
              →
            </span>
            <span
              style={{
                fontSize: "clamp(28px, 7vw, 48px)",
                fontWeight: 800,
                letterSpacing: "-0.03em",
                lineHeight: 1.05,
                color: tokens.colors.text,
              }}
            >
              {padTime(endHour)}
            </span>
            {crossDay && (
              <span style={{ fontSize: 13, fontWeight: 500, color: "rgba(255,255,255,0.4)", marginLeft: 4 }}>
                +1日
              </span>
            )}
          </div>

          {/* Date */}
          <div style={{ fontSize: 15, color: "rgba(255,255,255,0.7)", marginTop: 6 }}>
            {dateStr}
          </div>

          {/* Venue */}
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>
            248 Snooker · {tableName}
          </div>
        </div>

        {/* Perforation line */}
        <div style={{ position: "relative", height: 20, margin: "20px 0" }}>
          {/* Left notch */}
          <div
            style={{
              position: "absolute",
              left: -10,
              top: "50%",
              transform: "translateY(-50%)",
              width: 20,
              height: 20,
              borderRadius: "50%",
              background: tokens.colors.bg,
            }}
          />
          {/* Right notch */}
          <div
            style={{
              position: "absolute",
              right: -10,
              top: "50%",
              transform: "translateY(-50%)",
              width: 20,
              height: 20,
              borderRadius: "50%",
              background: tokens.colors.bg,
            }}
          />
          {/* Dashed line — animated width */}
          <motion.div
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ delay: 1.0, duration: 0.6, ease: "linear" }}
            style={{
              transformOrigin: "left center",
              position: "absolute",
              top: "50%",
              left: 20,
              right: 20,
              height: 0,
              borderTop: "2px dashed rgba(255,255,255,0.15)",
            }}
          />
        </div>

        {/* Bottom stub */}
        <div style={{ padding: "0 20px 20px" }}>
          {/* Info row — 3 columns, stagger in */}
          <motion.div
            initial="hidden"
            animate="visible"
            variants={{
              hidden: {},
              visible: { transition: { staggerChildren: 0.08, delayChildren: 1.4 } }
            }}
            style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 16 }}
          >
            <motion.div variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0 } }}>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>{t_ticket("duration")}</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: "#fff" }}>{duration}{t("hours")}</div>
            </motion.div>
            <motion.div variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0 } }}>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>{t_ticket("paid")}</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: tokens.colors.brand }}>HK${total}</div>
            </motion.div>
            <motion.div variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0 } }}>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>{t_ticket("payment")}</div>
              <VisaLogo className="h-4" />
            </motion.div>
          </motion.div>

          {/* QR Code — reveal with clip-path wipe + scan line */}
          <motion.div
            initial={{ clipPath: "inset(0 0 100% 0)" }}
            animate={{ clipPath: "inset(0 0 0% 0)" }}
            transition={{ delay: 1.6, duration: 0.8, ease: "linear" }}
            style={{
              position: "relative",
              background: "#0a0a0a",
              borderRadius: 16,
              border: "1px solid rgba(255,255,255,0.15)",
              padding: 16,
              display: "flex",
              justifyContent: "center",
              marginTop: 12,
              marginBottom: 10,
            }}
          >
            <QRCode data={qrData ?? bookingRef} />
            {/* Scan line */}
            <motion.div
              initial={{ top: "0%" }}
              animate={{ top: "100%" }}
              transition={{ delay: 1.6, duration: 0.8, ease: "linear" }}
              style={{
                position: "absolute",
                left: 0,
                width: "100%",
                height: 2,
                background: "linear-gradient(to right, transparent, rgba(255,255,255,0.8), transparent)",
                pointerEvents: "none",
                zIndex: 3,
              }}
            />
          </motion.div>

          {/* Booking ref */}
          <div
            style={{
              fontFamily: "'SF Mono', 'Courier New', monospace",
              fontSize: 13,
              color: "rgba(255,255,255,0.6)",
              letterSpacing: "0.15em",
              textAlign: "center",
              marginBottom: 6,
            }}
          >
            {bookingRef}
          </div>

          {/* Helper text */}
          <div
            data-cms-key="book.ticket.footer"
            style={{
              fontSize: 11,
              color: "rgba(255,255,255,0.3)",
              textAlign: "center",
            }}
          >
            {t("qr_hint")}
          </div>
        </div>
        </motion.div>
      </div>

      {/* Actions below ticket — stagger in after ticket lands */}
      <div style={{ marginTop: 24, width: "100%", maxWidth: 400 }}>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 2.2, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          style={{ display: "flex", gap: 12 }}
        >
          <button
            type="button"
            onClick={handleAddCalendar}
            data-cms-key="book.ticket.add-calendar"
            style={{
              flex: 1,
              height: 48,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              background: "transparent",
              border: "1px solid rgba(255,255,255,0.15)",
              borderRadius: 12,
              color: tokens.colors.text,
              fontSize: 15,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            <CalendarPlus size={16} />
            {t("add_calendar")}
          </button>
          <button
            type="button"
            onClick={handleShare}
            data-cms-key="book.ticket.share"
            style={{
              flex: 1,
              height: 48,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              background: "transparent",
              border: "1px solid rgba(255,255,255,0.15)",
              borderRadius: 12,
              color: tokens.colors.text,
              fontSize: 15,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            <Share2 size={16} />
            {t("share")}
          </button>
        </motion.div>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2.4, duration: 0.4 }}
          style={{ textAlign: "center", marginTop: 16 }}
        >
          <button
            type="button"
            onClick={() => (window.location.href = "/")}
            data-cms-key="book.ticket.home"
            style={{
              background: "none",
              border: "none",
              color: "rgba(255,255,255,0.4)",
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            {t("back_home")}
          </button>
        </motion.div>
      </div>
    </div>
  )
}

/* ─────────────────────────  Confirming (Stripe redirect return)  ───────────────────────── */
type ConfirmedBooking = {
  status: string
  booking_reference: string | null
  qr_code: string | null
  date: string
  start_time: string
  end_time: string
  duration_hours: number
  table_number: number
  total_price: number
}

// Shown after the Stripe redirect returns to /book while we poll the booking
// status until the webhook flips it to 'confirmed'. `failed` covers a declined
// redirect or a poll that timed out.
function ConfirmingPayment({ failed }: { failed: boolean }) {
  const t = useTranslations("book")
  return (
    <div
      className="screen-content"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "calc(100dvh - 80px)",
        textAlign: "center",
        gap: 16,
        padding: "24px 20px",
      }}
    >
      {failed ? (
        <>
          <p data-cms-key="book.pay.confirm_failed" style={{ fontSize: 16, color: tokens.colors.text, maxWidth: 320 }}>
            {t("confirm_failed")}
          </p>
          <button
            type="button"
            onClick={() => (window.location.href = "/")}
            data-cms-key="book.pay.confirm_failed_home"
            style={{ background: "none", border: "none", color: tokens.colors.brand, fontSize: 15, cursor: "pointer" }}
          >
            {t("back_home")}
          </button>
        </>
      ) : (
        <>
          <motion.div
            aria-hidden
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 0.9, ease: "linear" }}
            style={{
              width: 40,
              height: 40,
              borderRadius: "50%",
              border: "3px solid rgba(255,255,255,0.15)",
              borderTopColor: tokens.colors.brand,
            }}
          />
          <p data-cms-key="book.pay.confirming" style={{ fontSize: 16, color: tokens.colors.text }}>
            {t("confirming")}
          </p>
        </>
      )}
    </div>
  )
}

/* ─────────────────────────  Root  ───────────────────────── */
export default function BookPage() {
  const t = useTranslations("book")
  const router = useRouter()
  const [screen, setScreen] = useState(0)
  // Leave-booking confirm. On step 0 the back arrow exits straight home; on any
  // later step we ask first, since the user has invested effort (and, once the
  // slot-lock RPC ships, a hold may be active).
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false)

  const handleBack = useCallback(() => {
    if (screen === 0) {
      router.push("/")
    } else {
      setShowLeaveConfirm(true)
    }
  }, [screen, router])
  const today = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  }, [])
  const [selectedDate, setSelectedDate] = useState<Date>(today)
  const [startHour, setStartHour] = useState(() => {
    const now = new Date()
    return (now.getHours() + 1) % 24
  })
  const [duration, setDuration] = useState(1)
  const [selectedTable, setSelectedTable] = useState<number | null>(null)
  const [bookingRef] = useState(() => genRef())
  const paymentRef = useRef<HTMLDivElement>(null)
  // Stripe redirect-return confirmation state.
  const [confirmBookingId, setConfirmBookingId] = useState<string | null>(null)
  const [confirmedBooking, setConfirmedBooking] = useState<ConfirmedBooking | null>(null)
  const [confirmError, setConfirmError] = useState(false)

  // Detect a Stripe redirect return (?bookingId&payment_intent&redirect_status).
  // The page reloaded fresh, so we jump to the confirmation screen and poll the
  // booking status until the webhook marks it 'confirmed' (then Screen4 renders
  // from the real booking row). Capped retries → failure state on timeout.
  useEffect(() => {
    if (typeof window === "undefined") return
    const params = new URLSearchParams(window.location.search)
    const bId = params.get("bookingId")
    if (!bId || !(params.get("redirect_status") || params.get("payment_intent"))) return

    setConfirmBookingId(bId)
    setScreen(3)
    if (params.get("redirect_status") === "failed") {
      setConfirmError(true)
      return
    }

    let cancelled = false
    let tries = 0
    const poll = async () => {
      tries++
      try {
        const res = await fetch(`/api/booking/status?bookingId=${bId}`)
        if (res.ok) {
          const { booking } = await res.json()
          if (booking?.status === "confirmed") {
            if (!cancelled) setConfirmedBooking(booking)
            return
          }
        }
      } catch {
        /* transient — keep polling */
      }
      if (cancelled) return
      if (tries < 25) setTimeout(poll, 1500)
      else setConfirmError(true)
    }
    poll()
    return () => {
      cancelled = true
    }
  }, [])

  const tables = useTables()
  const tableName =
    tables.find((t) => t.id === selectedTable)?.name ?? `枱號 #1`

  const direction = useRef(1)

  const advance = useCallback(() => {
    direction.current = 1
    setScreen((s) => Math.min(s + 1, 3))
  }, [])

  // Backward-only step navigation from the progress bar. Forward jumps are never
  // allowed (can't skip to payment from time-select). Not available once the
  // booking is confirmed (screen 3) — that flow is terminal. Going back from
  // payment does NOT release the slot lock here; the lock simply expires on its
  // own cron if the user abandons, and create-intent re-validates it on return.
  const goToStep = useCallback((target: number) => {
    setScreen((s) => {
      if (target >= s || s >= 3) return s // backward only, and never from confirmation
      direction.current = -1
      return target
    })
  }, [])

  // When the wizard advances to a new screen (login → payment → confirm),
  // bring the new screen's top into view rather than keeping the prior scroll.
  useEffect(() => {
    if (typeof window === "undefined") return
    window.scrollTo({ top: 0, behavior: "smooth" })
  }, [screen])

  // Restore an in-progress booking after returning from an auth redirect (the
  // Google fallback leaves the page). We re-land on the login step (screen 1);
  // AuthCard there detects the now-active session and resolves the mandatory
  // profile gate → onAuthComplete=advance. The profile gate lives entirely in
  // AuthCard now — no page-level optional modal, no page-level auth listener
  // (in-page sign-ins drive onAuthComplete directly).
  useEffect(() => {
    if (typeof window === "undefined") return
    const saved = sessionStorage.getItem("pendingBooking")
    if (!saved) return
    try {
      const state = JSON.parse(saved)
      if (state.tableNumber) setSelectedTable(state.tableNumber)
      if (state.date) setSelectedDate(new Date(state.date))
      if (typeof state.startHour === "number") setStartHour(state.startHour)
      if (typeof state.duration === "number") setDuration(state.duration)
    } catch {}
    sessionStorage.removeItem("pendingBooking")
    // Jump to the login step so AuthCard can resolve the returning session.
    setScreen((s) => (s < 1 ? 1 : s))
  }, [])

  const variants = {
    enter: (d: number) => ({
      x: d > 0 ? "100%" : "-100%",
      opacity: 0,
    }),
    center: { x: 0, opacity: 1 },
    exit: (d: number) => ({
      x: d > 0 ? "-100%" : "100%",
      opacity: 0,
    }),
  }

  return (
    <main
      style={{
        background: tokens.colors.bg,
        minHeight: "100dvh",
        color: tokens.colors.text,
        display: "flex",
        justifyContent: "center",
      }}
    >
      {/* Back arrow — fixed top-left across selection/login/payment. Hidden on
          the confirmation screen (booking is done; Screen4 offers a deliberate
          "Back to Home" instead, so users can't navigate back into a finished flow). */}
      {screen < 3 && (
        <BackButton onClick={handleBack} ariaLabel={t("back")} cmsKey="book.back" color={tokens.colors.text} />
      )}

      <div className="book-container">
        {/* Progress */}
        <div className="progress-bar-wrap">
          <ProgressSteps steps={STEPS} current={screen} onStepClick={goToStep} />
        </div>

        {/* Screen content — overflow-x:clip hides the horizontal wizard slide
            without creating a scroll container (which would trap position:sticky). */}
        <div style={{ position: "relative", overflowX: "clip", flex: 1 }}>
          <AnimatePresence mode="wait" custom={direction.current} initial={false}>
            {screen === 0 && (
              <motion.div
                key="s0"
                custom={direction.current}
                variants={variants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
              >
                <Screen1
                  selectedTable={selectedTable}
                  setSelectedTable={setSelectedTable}
                  selectedDate={selectedDate}
                  setSelectedDate={setSelectedDate}
                  startHour={startHour}
                  setStartHour={setStartHour}
                  duration={duration}
                  setDuration={setDuration}
                  onContinue={advance}
                />
              </motion.div>
            )}
            {screen === 1 && (
              <motion.div
                key="s1"
                custom={direction.current}
                variants={variants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
              >
                <Screen2
                  onSuccess={advance}
                  selectedDate={selectedDate}
                  startHour={startHour}
                  duration={duration}
                  selectedTable={selectedTable}
                />
              </motion.div>
            )}
            {screen === 2 && (
              <motion.div
                ref={paymentRef}
                key="s2"
                custom={direction.current}
                variants={variants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
              >
                <Screen3
                  selectedDate={selectedDate}
                  startHour={startHour}
                  duration={duration}
                  tableName={tableName}
                  tableNumber={selectedTable ?? 0}
                />
              </motion.div>
            )}
            {screen === 3 && (
              <motion.div
                key="s3"
                custom={direction.current}
                variants={variants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
              >
                {confirmBookingId && !confirmedBooking ? (
                  <ConfirmingPayment failed={confirmError} />
                ) : confirmedBooking ? (
                  <Screen4
                    selectedDate={new Date(`${confirmedBooking.date}T00:00:00`)}
                    startHour={parseInt(confirmedBooking.start_time.slice(0, 2), 10)}
                    duration={Number(confirmedBooking.duration_hours)}
                    tableName={`${t("table_label")} #${confirmedBooking.table_number}`}
                    bookingRef={confirmedBooking.booking_reference ?? bookingRef}
                    qrData={confirmedBooking.qr_code ?? undefined}
                  />
                ) : (
                  <Screen4
                    selectedDate={selectedDate}
                    startHour={startHour}
                    duration={duration}
                    tableName={tableName}
                    bookingRef={bookingRef}
                  />
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>


      {/* Leave-booking confirm — shown when the back arrow is tapped on step 1+.
          "Stay" is the emphasised (green) default so an accidental tap keeps the
          user in the flow; "Leave" is the quieter outline action. */}
      {showLeaveConfirm && (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 110,
            background: "rgba(0,0,0,0.85)", backdropFilter: "blur(10px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: "24px",
          }}
          onClick={() => setShowLeaveConfirm(false)}
        >
          <motion.div
            initial={{ scale: 0.92, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            transition={{ type: "spring", damping: 22, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#111",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 20,
              padding: "32px 24px",
              width: "100%",
              maxWidth: 360,
              textAlign: "center",
            }}
          >
            <h3
              data-cms-key="book.leave.title"
              style={{ fontSize: 18, fontWeight: 600, color: tokens.colors.text, marginBottom: 8 }}
            >
              {t("leave_title")}
            </h3>
            <p
              data-cms-key="book.leave.body"
              style={{ fontSize: 14, color: tokens.colors.textMuted, marginBottom: 24 }}
            >
              {t("leave_body")}
            </p>
            <div style={{ display: "flex", gap: 12 }}>
              <button
                type="button"
                onClick={() => router.push("/")}
                data-cms-key="book.leave.confirm"
                style={{
                  flex: 1, height: 48, background: "transparent",
                  color: tokens.colors.text, border: `1px solid ${tokens.colors.border}`,
                  borderRadius: tokens.radius.button, fontWeight: 500, fontSize: 16, cursor: "pointer",
                }}
              >
                {t("leave_confirm")}
              </button>
              <button
                type="button"
                onClick={() => setShowLeaveConfirm(false)}
                data-cms-key="book.leave.stay"
                style={{
                  flex: 1, height: 48, background: tokens.colors.brand, color: "#000",
                  border: "none", borderRadius: tokens.radius.button,
                  fontWeight: 600, fontSize: 16, cursor: "pointer",
                }}
              >
                {t("leave_stay")}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      <style jsx global>{`
        @font-face {
          font-family: "Bebas Neue";
          src: local("Bebas Neue"), local("BebasNeue");
          font-display: swap;
        }

        .book-container {
          width: 100%;
          max-width: 480px;
          min-height: 100dvh;
          display: flex;
          flex-direction: column;
          position: relative;
        }
        .progress-bar-wrap {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          background: ${tokens.colors.bg};
          border-bottom: 1px solid ${tokens.colors.border};
          padding: 16px 24px;
          z-index: 50;
        }
        .screen-content {
          padding: 76px 16px calc(110px + env(safe-area-inset-bottom, 0px));
        }
        .auth-screen {
          display: flex;
          flex-direction: column;
          justify-content: center;
          min-height: calc(100dvh - 76px);
        }
        .table-grid {
          grid-template-columns: 1fr;
        }
        @media (min-width: 480px) {
          .table-grid {
            grid-template-columns: 1fr 1fr;
          }
        }
        .two-col {
          display: flex;
          flex-direction: column;
        }
        .col-left {
          flex: 1;
          overflow: visible;
        }
        .desktop-card {
          display: none;
        }
        .mobile-cta {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          padding: 12px 16px calc(12px + env(safe-area-inset-bottom, 0px));
          background: rgba(0,0,0,0.92);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border-top: 1px solid rgba(255,255,255,0.08);
          z-index: 40;
        }

        .otp-input:focus {
          border-color: ${tokens.colors.brand} !important;
        }
        .drum-wheel:focus-visible {
          box-shadow: inset 0 0 0 2px ${tokens.colors.brand};
          border-radius: 16px;
        }
        .pay-input:focus,
        .pay-input-wrap:focus-within {
          border-color: ${tokens.colors.brand} !important;
        }
        .phone-input-row:focus-within {
          border-color: ${tokens.colors.brand} !important;
        }

        @keyframes confetti-fall {
          0% { transform: translate(0, 0) rotate(0); opacity: 1; }
          80% { opacity: 1; }
          100% { transform: translate(var(--tx), var(--ty)) rotate(var(--rot)); opacity: 0; }
        }

        @media (min-width: 768px) {
          .book-container {
            max-width: 1024px;
            padding: 0 48px;
          }
          .progress-bar-wrap {
            position: relative;
            top: auto;
            left: auto;
            right: auto;
            border-bottom: none;
            padding: 24px 0 16px;
          }
          .screen-content {
            padding: 0 0 48px;
          }
          .auth-screen {
            min-height: calc(100dvh - 200px);
            justify-content: center;
          }
          .two-col {
            display: grid;
            grid-template-columns: 1fr 300px;
            gap: 32px;
            align-items: start;
          }
          .col-left {
            min-width: 0;
          }
          .desktop-card {
            display: block;
            position: sticky;
            top: 88px;
            align-self: start;
            height: fit-content;
          }
          .mobile-cta {
            display: none;
          }
        }
      `}</style>
    </main>
  )
}
