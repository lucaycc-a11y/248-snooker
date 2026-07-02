"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import {
  Calendar as CalendarIcon,
  ChevronRight,
  ChevronLeft,
  Clock,
  Lock,
  CalendarPlus,
} from "lucide-react"
import { tokens } from "@/app/styles/tokens"
import { Button, Card, ProgressSteps, BackButton, Space8Loader } from "@/components/ui"
import { AuthCard } from "@/components/auth/AuthCard"
import StripePayment from "@/components/checkout/StripePayment"
import { TicketCard } from "@/components/booking/TicketCard"
import { createClient } from "@/lib/supabase/client"
import { useAvailabilityCache } from "@/lib/booking/useAvailabilityCache"
import { useMonthAvailability } from "@/lib/booking/useMonthAvailability"
import { quoteBlockTotal } from "@/lib/pricing"
import { DEFAULT_PERIODS, type PricingPeriod } from "@/lib/data/pricing"
import { useHaptic } from "@/lib/useHaptic"
import { useLocale, useTranslations } from "next-intl"
import { useRouter } from "@/i18n/navigation"
// @ts-ignore
import confetti from "canvas-confetti"

/* ─────────────────────────  Config  ───────────────────────── */
const CONFIG = {
  currency: "HKD",
  maxHours: 6,
  openHour: 6,  // Venue opens 06:00
  closeHour: 24, // Last slot starts 23:00, ends 00:00
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

// Venue time is Hong Kong (UTC+8) regardless of the user's device timezone.
// Deriving "today" and "current hour" from the browser's local clock caused a
// P0 bug where a device in another timezone (or the memoized snapshot) greyed
// out valid slots. Read the parts through Intl in the fixed venue zone instead.
const HK_TIME_ZONE = "Asia/Hong_Kong"

function getHongKongNow(date = new Date()): { date: string; hour: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: HK_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(date)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ""
  // Intl can emit "24" for midnight in some engines; normalise to 0.
  const rawHour = Number(get("hour"))
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    hour: rawHour % 24,
  }
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

// One selected slot block. The active selection (startHour/duration/selectedTable)
// plus any committed extra blocks form the order. A single-block order keeps
// `extraBlocks` empty and behaves exactly as before (Task 3).
type SelectedBlock = {
  date: string // 'YYYY-MM-DD'
  startHour: number
  duration: number
  tableNumber: number
}

// Minutes of gap between two blocks on the same date (0 if contiguous/overlapping).
// Used to drive the non-contiguous warning (Task 3). Blocks are sorted by start.
function gapMinutesBetween(blocks: SelectedBlock[]): number {
  if (blocks.length < 2) return 0
  const sorted = [...blocks].sort(
    (a, b) => new Date(`${a.date}T${padTime(a.startHour)}`).getTime() -
      new Date(`${b.date}T${padTime(b.startHour)}`).getTime(),
  )
  let maxGap = 0
  for (let i = 1; i < sorted.length; i++) {
    const prevEnd = new Date(`${sorted[i - 1].date}T00:00:00`)
    prevEnd.setHours(sorted[i - 1].startHour + sorted[i - 1].duration, 0, 0, 0)
    const curStart = new Date(`${sorted[i].date}T00:00:00`)
    curStart.setHours(sorted[i].startHour, 0, 0, 0)
    const gap = (curStart.getTime() - prevEnd.getTime()) / 60000
    if (gap > maxGap) maxGap = gap
  }
  return maxGap
}

// Time-slot grid is grouped into labelled periods. Venue hours: 06:00–24:00
// (last bookable slot starts at 23:00). Hours are inclusive-start.
const SLOT_GROUPS: { key: string; hours: number[] }[] = [
  { key: "morning", hours: [6, 7, 8, 9, 10, 11] },
  { key: "afternoon", hours: [12, 13, 14, 15, 16, 17] },
  { key: "evening", hours: [18, 19, 20, 21, 22, 23] },
]

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

/* ─────────────────────────  Time Slot Grid  ───────────────────────── */
function TimeSlotGrid({
  selectedDate,
  daySlots,
  dayLoading,
  startHour,
  duration,
  onSelect,
}: {
  selectedDate: Date
  daySlots: DaySlot[] | null
  dayLoading: boolean
  startHour: number
  duration: number
  onSelect: (start: number, dur: number) => void
}) {
  const t = useTranslations("book")
  const haptic = useHaptic()
  const [showToast, setShowToast] = useState(false)

  const dateStr = useMemo(() => {
    const y = selectedDate.getFullYear()
    const m = String(selectedDate.getMonth() + 1).padStart(2, "0")
    const d = String(selectedDate.getDate()).padStart(2, "0")
    return `${y}-${m}-${d}`
  }, [selectedDate])

  // All time comparisons use Hong Kong venue time, not the browser's clock.
  // `nowTick` re-reads it every minute so the grid doesn't stale across the
  // hour boundary while the page is open.
  const [nowTick, setNowTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setNowTick((n) => n + 1), 60_000)
    return () => clearInterval(id)
  }, [])
  const nowHK = useMemo(() => getHongKongNow(), [nowTick])
  const isTodayHK = dateStr === nowHK.date

  // Per-cell state:
  //  - hidden:   this hour is fully BOOKED on every table → don't render at all
  //  - disabled: past hour (venue time) OR all tables taken by locks/past
  //  - isLocked: at least one table is held by someone else's active 15-min lock
  const cellStates = useMemo(() => {
    const states = new Map<
      number,
      { hidden: boolean; disabled: boolean; isLocked: boolean }
    >()
    for (let h = 0; h < 24; h++) {
      const isPast = isTodayHK && h < nowHK.hour
      const tableState = daySlots ? tableStatesFor(daySlots, dateStr, h, 1) : null
      const bookedCount = tableState
        ? Array.from(tableState.values()).filter((s) => s === "booked").length
        : 0
      const availableCount = tableState
        ? Array.from(tableState.values()).filter((s) => s === "available").length
        : ALL_TABLES.length
      const isLocked = tableState
        ? Array.from(tableState.values()).some((s) => s === "locked")
        : false

      // Fully booked hours are removed from the grid entirely (Task 3).
      const hidden = bookedCount === ALL_TABLES.length
      // Disabled = in the past, or no free table left (remaining tables are
      // locked/booked). Hidden cells are also treated as disabled defensively.
      const disabled = hidden || isPast || (daySlots !== null && availableCount === 0)

      states.set(h, { hidden, disabled, isLocked })
    }
    return states
  }, [daySlots, dateStr, isTodayHK, nowHK.hour])

  // Is the entire day unusable? (every hour hidden or disabled)
  const fullyBooked = useMemo(() => {
    if (daySlots === null) return false
    for (let h = 0; h < 24; h++) {
      const s = cellStates.get(h)
      if (s && !s.hidden && !s.disabled) return false
    }
    return true
  }, [cellStates, daySlots])

  // Which cells are currently selected? (startHour, startHour+1, ..., startHour+duration-1)
  const isSelected = useCallback(
    (h: number) => {
      if (duration === 0) return false
      const runEnd = startHour + duration
      // Handle cross-midnight: if runEnd >= 24, the run wraps into the next day
      if (runEnd <= 24) {
        return h >= startHour && h < runEnd
      } else {
        // Wrapped case: selected if h >= startHour OR h < (runEnd % 24)
        return h >= startHour || h < (runEnd % 24)
      }
    },
    [startHour, duration]
  )

  // Does this cell show a "+1日" badge? (it's hour 0 and part of a cross-midnight run)
  const showNextDayBadge = useCallback(
    (h: number) => {
      if (h !== 0) return false
      if (duration === 0) return false
      const runEnd = startHour + duration
      // Badge shows when hour 0 is selected AND the run started late (>= 18) so it's clearly "tomorrow"
      return runEnd > 24 && startHour >= 18
    },
    [startHour, duration]
  )

  const handleCellTap = useCallback(
    (tappedHour: number) => {
      const cellState = cellStates.get(tappedHour)
      if (!cellState || cellState.disabled) return // disabled cell, do nothing

      haptic.vibrate(8)

      // No current selection: start a new 1-hour selection
      if (duration === 0) {
        onSelect(tappedHour, 1)
        return
      }

      const runEnd = startHour + duration
      const lastCellHour = ((startHour + duration - 1) % 24 + 24) % 24

      // Case 1: Re-tapping the run's last cell → shrink by 1
      if (tappedHour === lastCellHour) {
        if (duration === 1) {
          onSelect(tappedHour, 0) // deselect entirely
        } else {
          onSelect(startHour, duration - 1)
        }
        return
      }

      // Case 2: Tapping the cell immediately after the run's end → extend by 1
      const nextHour = runEnd % 24
      if (tappedHour === nextHour) {
        // Check constraints: max duration + availability
        if (duration + 1 > CONFIG.maxHours) {
          // Max duration reached, show toast and don't extend
          setShowToast(true)
          setTimeout(() => setShowToast(false), 2000)
          return
        }
        // Check if the extension is available (both tables free for the full new range)
        const freeForExtended = daySlots
          ? freeTablesFor(daySlots, dateStr, startHour, duration + 1)
          : []
        if (freeForExtended.length === 0) {
          // Can't extend, restart from tapped cell instead
          onSelect(tappedHour, 1)
          setShowToast(true)
          setTimeout(() => setShowToast(false), 2000)
          return
        }
        onSelect(startHour, duration + 1)
        return
      }

      // Case 3: Tapping a cell already inside the current run (not the last) → restart from tapped cell
      if (isSelected(tappedHour)) {
        onSelect(tappedHour, 1)
        return
      }

      // Case 4: Non-adjacent cell → show "contiguous slots required" toast and restart
      setShowToast(true)
      setTimeout(() => setShowToast(false), 2000)
      onSelect(tappedHour, 1)
    },
    [
      cellStates,
      duration,
      startHour,
      daySlots,
      dateStr,
      haptic,
      onSelect,
      isSelected,
    ]
  )

  // Skeleton: grey placeholder cells laid out as the real period groups, so an
  // out-of-window date reads as "loading this grid" rather than a blank/spinner.
  if (dayLoading || daySlots === null) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }} aria-busy="true">
        {SLOT_GROUPS.map((group) => (
          <div key={group.key}>
            <div
              style={{
                width: 72,
                height: 12,
                marginBottom: 10,
                borderRadius: 4,
                background: "rgba(255,255,255,0.06)",
              }}
              className="skeleton-pulse"
            />
            <div className="slot-grid">
              {group.hours.map((h) => (
                <div
                  key={h}
                  className="skeleton-pulse"
                  style={{
                    minHeight: 56,
                    borderRadius: tokens.radius.input,
                    border: `1px solid ${tokens.colors.border}`,
                    background: "rgba(255,255,255,0.04)",
                  }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (fullyBooked) {
    return (
      <div
        data-cms-key="book.fully_booked"
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
    )
  }

  const renderCell = (h: number) => {
    const state = cellStates.get(h)
    if (state?.hidden) return null
    const selected = isSelected(h)
    const disabled = state?.disabled ?? false
    const locked = state?.isLocked ?? false
    const showBadge = showNextDayBadge(h)

    return (
      <button
        key={h}
        type="button"
        disabled={disabled}
        onClick={() => handleCellTap(h)}
        style={{
          position: "relative",
          minHeight: 56,
          padding: "12px 8px",
          borderRadius: tokens.radius.input,
          border: `1px solid ${selected ? tokens.colors.brand : tokens.colors.border}`,
          background: selected
            ? tokens.colors.brand
            : disabled
              ? "rgba(255,255,255,0.02)"
              : "rgba(255,255,255,0.04)",
          color: disabled
            ? tokens.colors.textFaint
            : selected
              ? "#000"
              : tokens.colors.text,
          fontSize: 13,
          fontWeight: selected ? 600 : 400,
          opacity: disabled ? 0.4 : 1,
          cursor: disabled ? "not-allowed" : "pointer",
          transition: `all ${tokens.duration.fast}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 4,
        }}
        title={locked && disabled ? t("table_locked") : undefined}
      >
        {locked && disabled && <Lock size={12} style={{ flexShrink: 0 }} />}
        <span style={{ whiteSpace: "nowrap" }}>{padTime(h)}</span>
        {showBadge && (
          <span
            style={{
              position: "absolute",
              top: 4,
              right: 6,
              fontSize: 10,
              fontWeight: 600,
              color: selected ? "rgba(0,0,0,0.6)" : "rgba(255,255,255,0.5)",
              padding: "2px 4px",
              borderRadius: 4,
              background: selected ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.08)",
            }}
          >
            +1日
          </span>
        )}
      </button>
    )
  }

  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {SLOT_GROUPS.map((group) => {
          // Skip a whole period if every hour in it is hidden (all booked/na).
          const visibleHours = group.hours.filter((h) => !cellStates.get(h)?.hidden)
          if (visibleHours.length === 0) return null
          return (
            <div key={group.key}>
              <div
                data-cms-key={`book.slot_group_${group.key}`}
                style={{
                  fontSize: 12,
                  color: tokens.colors.textMuted,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  marginBottom: 10,
                }}
              >
                {t(`slot_group_${group.key}`)}
              </div>
              <div className="slot-grid">
                {visibleHours.map((h) => renderCell(h))}
              </div>
            </div>
          )
        })}
      </div>

      {/* Toast for "contiguous slots required" */}
      <AnimatePresence>
        {showToast && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            data-cms-key="book.contiguous_slots_required"
            style={{
              position: "fixed",
              top: 100,
              left: "50%",
              transform: "translateX(-50%)",
              background: tokens.colors.surfaceElevated,
              border: `1px solid ${tokens.colors.borderStrong}`,
              borderRadius: tokens.radius.button,
              padding: "12px 20px",
              fontSize: 14,
              color: tokens.colors.text,
              boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
              zIndex: 100,
              pointerEvents: "none",
            }}
          >
            {t("contiguous_slots_required")}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

/* ─────────────────────────  Table Chips (Tasks 2 & 5)  ───────────────────────── */
// Explicit per-table selection for the chosen slot window. Each chip reflects that
// table's REAL availability (tableStatesFor): a booked/locked table is disabled and
// greyed — never blanket-enabled just because the period is generally free.
function TableChips({
  daySlots,
  dateStr,
  startHour,
  duration,
  selectedTable,
  onSelect,
}: {
  daySlots: DaySlot[]
  dateStr: string
  startHour: number
  duration: number
  selectedTable: number | null
  onSelect: (table: number) => void
}) {
  const t = useTranslations("book")
  const haptic = useHaptic()
  const states = useMemo(
    () => tableStatesFor(daySlots, dateStr, startHour, duration),
    [daySlots, dateStr, startHour, duration],
  )

  return (
    <div style={{ marginBottom: 32 }}>
      <div
        data-cms-key="book.table.title"
        style={{
          fontSize: 13,
          color: tokens.colors.textMuted,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          marginBottom: 20,
        }}
      >
        {t("select_table")}
      </div>

      {/* One shared venue photo — both tables live in the same room, so a
          single hero image (Apple iPad-picker style) replaces the old
          two-large-cards layout. Selection happens via the pill row below. */}
      <div
        style={{
          width: "100%",
          aspectRatio: "16/9",
          borderRadius: tokens.radius.card,
          overflow: "hidden",
          border: `1px solid ${tokens.colors.border}`,
          marginBottom: 16,
        }}
      >
        <img
          src="/gallery/IMG_1511.jpg"
          alt={t("select_table")}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      </div>

      {/* Small pill buttons — outline → solid green fill on select, per the
          Apple color-picker reference. Availability/lock logic unchanged. */}
      <div style={{ display: "flex", gap: 12 }}>
        {ALL_TABLES.map((tn) => {
          const state = states.get(tn) ?? "available"
          const disabled = state !== "available"
          const selected = selectedTable === tn
          return (
            <button
              key={tn}
              type="button"
              disabled={disabled}
              onClick={() => {
                if (disabled) return
                haptic.vibrate(8)
                onSelect(tn)
              }}
              data-cms-key={`book.table.card_${tn}`}
              style={{
                flex: 1,
                minHeight: 44,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                padding: "10px 16px",
                borderRadius: 9999,
                border: selected
                  ? `2px solid ${tokens.colors.brand}`
                  : `1px solid ${tokens.colors.border}`,
                background: selected ? tokens.colors.brand : "transparent",
                color: selected
                  ? "#000"
                  : disabled
                    ? tokens.colors.textFaint
                    : tokens.colors.text,
                fontSize: 15,
                fontWeight: selected ? 700 : 500,
                cursor: disabled ? "not-allowed" : "pointer",
                opacity: disabled ? 0.5 : 1,
                transition: `all ${tokens.duration.fast}`,
              }}
            >
              {disabled && <Lock size={13} />}
              {t("table_label")} {tn}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/* ─────────────────────────  QR Code  ───────────────────────── */
/* ─────────────────────────  Table Select  ───────────────────────── */
type TableInfo = { id: number; name: string; type: string }

function useTables() {
  const t = useTranslations("book")
  return [
    { id: 1, name: `${t("table_label")} #1`, type: t("snooker") },
    { id: 2, name: `${t("table_label")} #2`, type: t("snooker") },
  ]
}

/* ─────────────────────────  Calendar  ───────────────────────── */
const DAY_NAMES = ["日", "一", "二", "三", "四", "五", "六"]

function fmtYMD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function Calendar({
  selected,
  onSelect,
  monthAvailability,
}: {
  selected: Date
  onSelect: (d: Date) => void
  monthAvailability: ReturnType<typeof useMonthAvailability>
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

  // Fetch this month's fully-booked dates on mount and whenever the viewed
  // month changes (prev/next navigation).
  useEffect(() => {
    monthAvailability.fetchMonth(year, month)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month])

  const fullyBookedDates = monthAvailability.getFullyBookedDates(year, month)

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
          const booked = !isPast && (fullyBookedDates?.has(fmtYMD(date)) ?? false)
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
                disabled={isPast || booked}
                aria-label={`${date.getMonth() + 1}月${date.getDate()}日`}
                aria-current={isSelected ? "date" : undefined}
                onClick={() => !isPast && !booked && onSelect(date)}
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
                  cursor: isPast || booked ? "default" : "pointer",
                  opacity: isPast || booked ? 0.3 : 1,
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
                    // Fully-booked days read as unavailable via a red-tinted,
                    // dimmed number (the small dot below is now reserved for
                    // "today", so booked can't use a dot without colliding).
                    color: isSelected
                      ? "#fff"
                      : booked
                        ? tokens.colors.danger
                        : tokens.colors.text,
                    opacity: booked && !isSelected ? 0.55 : 1,
                    textDecoration: booked && !isSelected ? "line-through" : "none",
                    border: "1px solid transparent",
                    transition: `background ${tokens.duration.fast}`,
                  }}
                >
                  {date.getDate()}
                  {/* Today marker — small dot under the number (calendar-1
                      demo's data-today treatment). Hidden when this cell is
                      selected (the solid fill already conveys state). */}
                  {isToday && !isSelected && (
                    <span
                      style={{
                        position: "absolute",
                        bottom: 4,
                        left: "50%",
                        transform: "translateX(-50%)",
                        width: 4,
                        height: 4,
                        borderRadius: "50%",
                        background: tokens.colors.brand,
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
  availability,
  monthAvailability,
  extraBlocks,
  setExtraBlocks,
  allBlocks,
  periods,
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
  availability: ReturnType<typeof useAvailabilityCache>
  monthAvailability: ReturnType<typeof useMonthAvailability>
  extraBlocks: SelectedBlock[]
  setExtraBlocks: (b: SelectedBlock[]) => void
  allBlocks: SelectedBlock[]
  periods: PricingPeriod[]
}) {
  const dateStr = useMemo(() => {
    const y = selectedDate.getFullYear()
    const m = String(selectedDate.getMonth() + 1).padStart(2, "0")
    const d = String(selectedDate.getDate()).padStart(2, "0")
    return `${y}-${m}-${d}`
  }, [selectedDate])

  const total = quoteBlockTotal(dateStr, startHour, duration, periods)
  const endHour = startHour + duration
  const crossDay = endHour >= 24
  const [displayTotal, setDisplayTotal] = useState(total)
  // If a persisted/restored selection already exists (duration > 0), reveal the
  // grid immediately instead of forcing the user to re-tap the calendar.
  const [dateChosen, setDateChosen] = useState(duration > 0)
  const timeRef = useRef<HTMLDivElement>(null)
  const tableRef = useRef<HTMLDivElement>(null)
  const t = useTranslations("book")

  // Read the day's slots from the shared prefetch cache. If the date is cached
  // (in the prefetched week, or fetched earlier) this is synchronous — no spinner.
  // Out-of-window dates trigger an on-demand fetch; the grid shows a skeleton
  // while availability.loadingDate matches. Fails OPEN (empty = everything free).
  const daySlots = dateChosen ? availability.getSlots(dateStr) : null

  useEffect(() => {
    if (!dateChosen) return
    // Not in cache yet and not already loading → fetch this single date on demand.
    if (availability.getSlots(dateStr) === null && availability.loadingDate !== dateStr) {
      availability.fetchDate(dateStr)
    }
    // getSlots identity changes with cache version, re-running this after prefetch.
  }, [dateChosen, dateStr, availability])

  const dayLoading = daySlots === null && availability.loadingDate === dateStr

  // Animate the live price total.
  useEffect(() => {
    const target = quoteBlockTotal(dateStr, startHour, duration, periods)
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
  }, [dateStr, startHour, duration, periods, displayTotal])

  const haptic = useHaptic()
  // "Ready" = at least one complete block in the order (committed extras or a
  // finished active selection).
  const ready = allBlocks.length > 0
  const canContinue = ready
  // Order total across every block (display only; server re-derives authoritatively).
  const orderTotal = allBlocks.reduce((sum, b) => sum + quoteBlockTotal(b.date, b.startHour, b.duration, periods), 0)

  // Active block is complete enough to commit as an extra slot.
  const activeComplete = duration > 0 && selectedTable !== null

  // Gap-warning modal state (Task 3): non-contiguous orders confirm before paying.
  const [showGapWarning, setShowGapWarning] = useState(false)
  const gapMinutes = useMemo(() => gapMinutesBetween(allBlocks), [allBlocks])

  // Commit the active selection as an extra block and reset for another pick.
  const addSlot = useCallback(() => {
    if (!activeComplete || selectedTable === null) return
    haptic.vibrate(10)
    setExtraBlocks([...extraBlocks, { date: dateStr, startHour, duration, tableNumber: selectedTable }])
    setDuration(0)
    setSelectedTable(null)
  }, [activeComplete, selectedTable, extraBlocks, dateStr, startHour, duration, haptic, setExtraBlocks, setDuration, setSelectedTable])

  const removeExtra = useCallback(
    (i: number) => {
      haptic.vibrate(8)
      setExtraBlocks(extraBlocks.filter((_, idx) => idx !== i))
    },
    [extraBlocks, haptic, setExtraBlocks],
  )

  // Continue: if the order is non-contiguous, confirm the gap first.
  const handleContinue = useCallback(() => {
    if (gapMinutes > 0) {
      setShowGapWarning(true)
      return
    }
    onContinue()
  }, [gapMinutes, onContinue])

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
                setDuration(0)
                setSelectedTable(null)
                scrollToRef(timeRef)
              }}
              monthAvailability={monthAvailability}
            />
          </div>

          {/* Step 2 — Time Slot Grid (revealed after date chosen) */}
          <AnimatePresence>
            {dateChosen && (
              <motion.div
                ref={timeRef}
                key="time-grid"
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              >
                <div style={{ marginBottom: 24 }}>
                  {sectionLabel(t("start_time"), "book.time.title")}
                  <TimeSlotGrid
                    selectedDate={selectedDate}
                    daySlots={daySlots}
                    dayLoading={dayLoading}
                    startHour={startHour}
                    duration={duration}
                    onSelect={(start, dur) => {
                      // Auto-scroll to the table picker the moment a slot is
                      // first picked (duration 0 → >0) — Task 4. Only fires on
                      // that initial pick, not on every subsequent
                      // extend/shrink tap, so the view doesn't keep jumping
                      // while the user is still adjusting duration.
                      if (duration === 0 && dur > 0) {
                        scrollToRef(tableRef)
                      }
                      setStartHour(start)
                      setDuration(dur)
                      // Keep the current table if it's still free for the new
                      // time window — only auto-assign a default when there's
                      // no selection yet or the prior pick just became
                      // unavailable. Previously this always overwrote the
                      // selection with the first free table, so a manually
                      // chosen Table 2 would silently flip back to Table 1 the
                      // moment the user adjusted the time/duration.
                      if (dur > 0 && daySlots) {
                        const free = freeTablesFor(daySlots, dateStr, start, dur)
                        if (selectedTable === null || !free.includes(selectedTable)) {
                          setSelectedTable(free.length > 0 ? free[0] : null)
                        }
                      } else {
                        setSelectedTable(null)
                      }
                    }}
                  />
                </div>

                {/* Live price summary (relocated below grid) */}
                {duration > 0 && (
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
                )}

                {/* Table chips — explicit per-table selection (Tasks 2 & 5) */}
                {duration > 0 && daySlots && (
                  <div ref={tableRef}>
                    <TableChips
                      daySlots={daySlots}
                      dateStr={dateStr}
                      startHour={startHour}
                      duration={duration}
                      selectedTable={selectedTable}
                      onSelect={setSelectedTable}
                    />
                  </div>
                )}

                {/* Committed extra blocks (non-contiguous order — Task 3) */}
                {extraBlocks.length > 0 && (
                  <div
                    className="glass-panel"
                    style={{
                      marginBottom: 16,
                      padding: 16,
                      borderRadius: tokens.radius.card,
                      display: "flex",
                      flexDirection: "column",
                      gap: 10,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "baseline",
                        justifyContent: "space-between",
                      }}
                    >
                      <div
                        data-cms-key="book.slots_selected"
                        style={{
                          fontSize: 12,
                          color: tokens.colors.textMuted,
                          textTransform: "uppercase",
                          letterSpacing: "0.08em",
                        }}
                      >
                        {t("slots_selected", { count: allBlocks.length })}
                      </div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: tokens.colors.brand }}>
                        HK${orderTotal}
                      </div>
                    </div>
                    {extraBlocks.map((b, i) => (
                      <div
                        key={`${b.date}-${b.startHour}-${b.tableNumber}`}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "10px 14px",
                          borderRadius: tokens.radius.input,
                          border: `1px solid ${tokens.colors.brand}`,
                          background: "rgba(34,197,94,0.08)",
                          fontSize: 14,
                        }}
                      >
                        <span>
                          {padTime(b.startHour)} – {padTime(b.startHour + b.duration)} · {t("table_label")} #{b.tableNumber}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeExtra(i)}
                          data-cms-key="book.remove_slot"
                          style={{
                            fontSize: 13,
                            color: tokens.colors.textMuted,
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            minHeight: 44,
                            padding: "0 8px",
                          }}
                        >
                          {t("remove_slot")}
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add another (non-contiguous) slot */}
                {activeComplete && (
                  <button
                    type="button"
                    onClick={addSlot}
                    data-cms-key="book.add_slot"
                    className="glass-panel"
                    style={{
                      width: "100%",
                      minHeight: 52,
                      marginBottom: 8,
                      borderRadius: tokens.radius.button,
                      border: `1px solid ${tokens.colors.border}`,
                      color: tokens.colors.text,
                      fontSize: 15,
                      fontWeight: 500,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 10,
                    }}
                  >
                    <span
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: "50%",
                        background: tokens.colors.brand,
                        color: "#000",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <CalendarPlus size={13} />
                    </span>
                    {t("add_slot")}
                  </button>
                )}
                {(extraBlocks.length > 0 || activeComplete) && (
                  <div
                    data-cms-key="book.multi_slot_hint"
                    style={{ fontSize: 12, color: tokens.colors.textMuted, marginBottom: 16 }}
                  >
                    {t("multi_slot_hint")}
                  </div>
                )}
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
          total={orderTotal}
          canContinue={canContinue}
          onContinue={handleContinue}
          ctaLabel={t("continue")}
          ready={ready}
        />
      </div>

      {/* Mobile sticky price bar */}
      <MobilePriceBar
        ctaLabel={t("continue")}
        onContinue={handleContinue}
        canContinue={canContinue}
      />

      {/* Non-contiguous gap warning (Task 3) */}
      <AnimatePresence>
        {showGapWarning && (
          <motion.div
            className="fixed inset-0 z-[70] flex items-center justify-center p-6"
            style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowGapWarning(false)}
          >
            <motion.div
              onClick={(e) => e.stopPropagation()}
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              style={{
                background: tokens.colors.surfaceElevated,
                border: `1px solid ${tokens.colors.borderStrong}`,
                borderRadius: 24,
                padding: 28,
                maxWidth: 400,
                width: "100%",
              }}
            >
              <h3
                data-cms-key="book.gap_warning_title"
                style={{ fontSize: 20, fontWeight: 700, color: tokens.colors.text, marginBottom: 12 }}
              >
                {t("gap_warning_title")}
              </h3>
              <p
                data-cms-key="book.gap_warning_body"
                style={{ fontSize: 15, lineHeight: 1.5, color: tokens.colors.textMuted, marginBottom: 24 }}
              >
                {t("gap_warning_body", { gap: gapMinutes })}
              </p>
              <div style={{ display: "flex", gap: 12 }}>
                <button
                  type="button"
                  onClick={() => setShowGapWarning(false)}
                  data-cms-key="book.gap_warning_cancel"
                  style={{
                    flex: 1,
                    minHeight: 48,
                    borderRadius: tokens.radius.button,
                    border: `1px solid ${tokens.colors.border}`,
                    background: "transparent",
                    color: tokens.colors.text,
                    fontSize: 15,
                    cursor: "pointer",
                  }}
                >
                  {t("gap_warning_cancel")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowGapWarning(false)
                    onContinue()
                  }}
                  data-cms-key="book.gap_warning_confirm"
                  style={{
                    flex: 1,
                    minHeight: 48,
                    borderRadius: tokens.radius.button,
                    border: "none",
                    background: tokens.colors.brand,
                    color: "#000",
                    fontSize: 15,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {t("gap_warning_confirm")}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
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
          className="glass-panel"
          style={{
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
  blocks,
  onBackToSlots,
  periods,
}: {
  selectedDate: Date
  startHour: number
  duration: number
  tableName: string
  tableNumber: number
  blocks: SelectedBlock[]
  onBackToSlots?: () => void
  periods: PricingPeriod[]
}) {
  const t = useTranslations("book")
  const locale = useLocale()

  const dateStr = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, "0")}-${String(selectedDate.getDate()).padStart(2, "0")}`

  // Order total across every block (grouped, non-contiguous orders sum them).
  const total = blocks.length > 0
    ? blocks.reduce((sum, b) => sum + quoteBlockTotal(b.date, b.startHour, b.duration, periods), 0)
    : quoteBlockTotal(dateStr, startHour, duration, periods)
  const endHour = startHour + duration
  const crossDay = endHour >= 24

  // The user is already authenticated + profile_complete by the time they reach
  // this step (Screen2 gates on it), so `users` already has display_name/email/
  // phone — read it once here rather than asking the Payment Element to collect
  // it again. RLS lets a user select their own row via the cookie-bound browser
  // client (same pattern as AuthCard/AccountMenu).
  const [profile, setProfile] = useState<{ name: string; email: string; phone: string } | null>(null)
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user || cancelled) return
      const { data } = await supabase
        .from("users")
        .select("display_name, email, phone")
        .eq("id", user.id)
        .maybeSingle()
      if (cancelled) return
      setProfile({
        name: (data?.display_name as string) ?? "",
        email: (data?.email as string) ?? user.email ?? "",
        phone: (data?.phone as string) ?? "",
      })
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="screen-content">
      <div style={{ maxWidth: 480, margin: "0 auto" }}>
        {/* Order summary */}
        <Card
          className="glass-panel"
          style={{ marginBottom: 24, borderRadius: 20 }}
        >
          {blocks.length > 1 ? (
            /* Multi-block order (non-contiguous or cross-day) — itemize every
               block so the displayed total is visibly traceable to its parts,
               matching the sum Stripe's PaymentIntent.amount actually charges
               (Task 8). Each block gets its own row with breathing room and a
               hairline divider so a 3+ slot order doesn't read as one jammed
               paragraph (Task 1). */
            <div style={{ marginBottom: 16, display: "flex", flexDirection: "column" }}>
              {blocks.map((b, i) => {
                const [, m, d] = b.date.split("-")
                const blockTotal = quoteBlockTotal(b.date, b.startHour, b.duration, periods)
                return (
                  <div
                    key={`${b.date}-${b.startHour}-${b.tableNumber}`}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      fontSize: 13,
                      padding: "10px 0",
                      borderBottom: i < blocks.length - 1 ? `1px solid ${tokens.colors.border}` : "none",
                    }}
                  >
                    <span style={{ color: tokens.colors.textMuted }}>
                      {Number(m)}月{Number(d)}日 {padTime(b.startHour)}–{padTime(b.startHour + b.duration)}
                      {" · "}
                      {t("table_label")} #{b.tableNumber}
                    </span>
                    <span>HK${blockTotal}</span>
                  </div>
                )
              })}
            </div>
          ) : (
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
          )}
          <div
            data-cms-key="book.pay.venue"
            style={{ fontSize: 13, color: tokens.colors.textMuted, marginBottom: profile ? 12 : 16, paddingTop: blocks.length > 1 ? 4 : 0 }}
          >
            Space8 · {tableName}
          </div>
          {profile && (profile.name || profile.email || profile.phone) && (
            <>
              <div style={{ height: 1, background: tokens.colors.border, marginBottom: 12 }} />
              <div style={{ marginBottom: 16 }}>
                {profile.name && (
                  <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 2 }}>{profile.name}</div>
                )}
                {(profile.email || profile.phone) && (
                  <div style={{ fontSize: 13, color: tokens.colors.textMuted }}>
                    {[profile.email, profile.phone].filter(Boolean).join(" · ")}
                  </div>
                )}
              </div>
            </>
          )}
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
            icons, and confirms via redirect (return to /book). The glass surface
            + entrance animation are purely visual; the <StripePayment> element and
            all Stripe logic inside it are untouched. */}
        <motion.div
          className="glass-panel"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          style={{ borderRadius: 20, padding: 20 }}
        >
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
            blocks={blocks.map((b) => ({
              date: b.date,
              startHour: b.startHour,
              duration: b.duration,
              tableNumber: b.tableNumber,
            }))}
            total={total}
            locale={locale as "en" | "zh-HK" | "zh-CN" | "ja"}
            returnPath="/book"
            payLabel={`${t("pay_now")} · HK$${total}`}
            processingLabel={t("processing")}
            errorLabel={t("pay_error")}
            slotTakenLabel={t("slot_taken")}
            loadingLabel={t("pay_loading")}
            lockHoldLabel={t("lock_hold")}
            paymentFailedLabel={t("pay_declined")}
            whatsappSupportLabel={t("whatsapp_support")}
            retryPaymentLabel={t("retry_payment")}
            billingDetails={profile ?? undefined}
            onBackToSlots={onBackToSlots}
            backToSlotsLabel={t("back_to_slots")}
          />

          <div
            data-cms-key="book.payment_reminder"
            style={{
              fontSize: 13,
              color: tokens.colors.textMuted,
              textAlign: "center",
              marginTop: 20,
              padding: "0 16px",
              lineHeight: 1.5,
            }}
          >
            {t("payment_reminder")}
          </div>

          {/* Stripe secure */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 14 }}>
            <Lock size={12} style={{ color: tokens.colors.textMuted }} />
            <span data-cms-key="book.pay.secure" style={{ fontSize: 12, color: tokens.colors.textMuted }}>
              {t("stripe_secure")}
            </span>
          </div>
        </motion.div>
      </div>
    </div>
  )
}

/* ─────────────────────────  Screen 4: Confirmation Tickets  ───────────────────────── */
type ConfirmationTicket = {
  date: string
  startHour: number
  duration: number
  tableNumber: number
  bookingRef: string
  qrData?: string
  totalPrice: number
  paymentMethod?: string | null
}

// Renders one TicketCard per booking from the checkout (Task 8 — a
// non-contiguous multi-slot order produces N booking rows sharing an
// order_group_id, so it must produce N independent, individually-scannable
// tickets, not one screen that only shows the first). The first ticket opens
// expanded so the confetti/QR reveal reads as "your booking is confirmed";
// any additional tickets start collapsed to avoid a wall of QR codes.
function Screen4({ tickets }: { tickets: ConfirmationTicket[] }) {
  const t = useTranslations("book")
  const t_ticket = useTranslations("ticket")

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

  return (
    <div
      className="screen-content"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        minHeight: "calc(100dvh - 80px)",
        position: "relative",
        padding: "24px 20px",
      }}
    >
      <div style={{ width: "100%", maxWidth: 400, margin: "0 auto" }}>
        {/* Header — logo + confirmed pill, shared across all tickets */}
        <motion.div
          initial={{ y: "40%", opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: "spring", damping: 20, stiffness: 120, duration: 1.2 }}
          style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}
        >
          <img src="/logos/Space8_full_icon_white_black_bkg.svg" alt="Space8" style={{ height: 24, width: "auto" }} />
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 500, damping: 20, delay: 1.2 }}
            style={{ background: tokens.colors.brand, padding: "4px 12px", borderRadius: 999 }}
          >
            <span data-cms-key="book.ticket.confirmed" style={{ fontSize: 12, fontWeight: 700, color: "#000" }}>
              {t_ticket("confirmed")}
            </span>
          </motion.div>
        </motion.div>

        {/* One collapsible card per booking */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 24 }}>
          {tickets.map((ticket, i) => (
            <TicketCard
              key={ticket.bookingRef + i}
              date={ticket.date}
              startHour={ticket.startHour}
              duration={ticket.duration}
              tableNumber={ticket.tableNumber}
              bookingRef={ticket.bookingRef}
              qrData={ticket.qrData}
              totalPrice={ticket.totalPrice}
              paymentMethod={ticket.paymentMethod}
              defaultExpanded={i === 0}
            />
          ))}
        </div>

        {/* Go to member center (Task 10). Plain <a>, not the locale-aware
            router — /member lives outside app/[locale]/ (non-localized route,
            same convention as AccountMenu.tsx), so router.push("/member")
            would prefix the active locale (e.g. /en/member) and 404. */}
        <motion.a
          href="/member"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 2.2, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          data-cms-key="book.ticket.member_cta"
          style={{
            width: "100%",
            height: 52,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: tokens.colors.brand,
            color: "#000",
            border: "none",
            borderRadius: 14,
            fontSize: 16,
            fontWeight: 700,
            cursor: "pointer",
            marginBottom: 16,
            textDecoration: "none",
          }}
        >
          {t("go_to_member")}
        </motion.a>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2.4, duration: 0.4 }}
          style={{ textAlign: "center" }}
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
  id?: string
  status: string
  booking_reference: string | null
  qr_code: string | null
  date: string
  start_time: string
  end_time: string
  duration_hours: number
  table_number: number
  total_price: number
  payment_method: string | null
  order_group_id: string | null
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
          <Space8Loader size={40} theme="dark" />
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
  const [duration, setDuration] = useState(0)
  const [selectedTable, setSelectedTable] = useState<number | null>(null)
  // Committed extra blocks for a non-contiguous order (Task 3). The active
  // selection above is the block currently being edited; these are the ones the
  // user already locked in via "add another slot". Empty for a normal single order.
  const [extraBlocks, setExtraBlocks] = useState<SelectedBlock[]>([])
  const [bookingRef] = useState(() => genRef())
  const paymentRef = useRef<HTMLDivElement>(null)
  // Stripe redirect-return confirmation state.
  const [confirmBookingId, setConfirmBookingId] = useState<string | null>(null)
  const [confirmedBooking, setConfirmedBooking] = useState<ConfirmedBooking | null>(null)
  // Every ticket from the same checkout (order_group_id), primary first — a
  // single-booking order is just a 1-element array (Task 8).
  const [confirmedBookings, setConfirmedBookings] = useState<ConfirmedBooking[]>([])
  const [confirmError, setConfirmError] = useState(false)

  // Durable in-session selection persistence. Unlike `pendingBooking` (written
  // only on the auth step and consumed once), this survives back/return/reload:
  // it's written on every Screen1 selection change and only cleared when the
  // booking is confirmed. Restored on mount BEFORE the pendingBooking fallback.
  const bookingRestored = useRef(false)
  useEffect(() => {
    if (typeof window === "undefined" || bookingRestored.current) return
    bookingRestored.current = true
    try {
      const saved = sessionStorage.getItem("bookingSelection")
      if (!saved) return
      const s = JSON.parse(saved)
      if (typeof s.date === "string") {
        const d = new Date(`${s.date}T00:00:00`)
        if (!Number.isNaN(d.getTime())) {
          setSelectedDate(d)
        }
      }
      if (typeof s.startHour === "number") setStartHour(s.startHour)
      if (typeof s.duration === "number") setDuration(s.duration)
      if (typeof s.tableNumber === "number") setSelectedTable(s.tableNumber)
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Persist selection whenever it's a real (duration > 0) Screen1 selection.
  useEffect(() => {
    if (typeof window === "undefined") return
    if (duration <= 0) return
    const y = selectedDate.getFullYear()
    const m = String(selectedDate.getMonth() + 1).padStart(2, "0")
    const d = String(selectedDate.getDate()).padStart(2, "0")
    try {
      sessionStorage.setItem(
        "bookingSelection",
        JSON.stringify({
          date: `${y}-${m}-${d}`,
          startHour,
          duration,
          tableNumber: selectedTable,
          updatedAt: Date.now(),
        }),
      )
    } catch {}
  }, [selectedDate, startHour, duration, selectedTable])

  // Clear the persisted selection once a booking is confirmed, so a stale
  // future selection doesn't resurface on the next visit.
  useEffect(() => {
    if (confirmedBooking && typeof window !== "undefined") {
      try {
        sessionStorage.removeItem("bookingSelection")
        sessionStorage.removeItem("pendingBooking")
      } catch {}
    }
  }, [confirmedBooking])

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
          const { booking, bookings } = await res.json()
          if (booking?.status === "confirmed") {
            if (!cancelled) {
              setConfirmedBooking(booking)
              setConfirmedBookings(Array.isArray(bookings) && bookings.length > 0 ? bookings : [booking])
            }
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

  // Shared availability cache: prefetches today + 7 days so date-switching in
  // Screen1 is instant, and exposes invalidate() for post-payment refresh (Task 4).
  const availability = useAvailabilityCache()
  const monthAvailability = useMonthAvailability()

  // Task 4: once a booking confirms, drop the cached availability for its date(s)
  // and clear any committed extra blocks, so returning to /book in the same session
  // shows the just-booked slot/table as taken — no hard refresh.
  useEffect(() => {
    if (!confirmedBooking) return
    if (confirmedBooking.date) availability.invalidate(confirmedBooking.date)
    for (const b of extraBlocks) availability.invalidate(b.date)
    setExtraBlocks([])
    // Only react to a new confirmation; availability/extraBlocks are stable enough here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirmedBooking])

  // Full ordered block list = committed extras + the active selection (if valid).
  const activeDateStr = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, "0")}-${String(selectedDate.getDate()).padStart(2, "0")}`
  const allBlocks: SelectedBlock[] = useMemo(() => {
    const list = [...extraBlocks]
    if (duration > 0 && selectedTable !== null) {
      list.push({ date: activeDateStr, startHour, duration, tableNumber: selectedTable })
    }
    return list
  }, [extraBlocks, duration, selectedTable, activeDateStr, startHour])

  // Live pricing periods (afternoon/evening/latenight) — read straight from the
  // public `config` table (RLS allows anon SELECT). Falls back to DEFAULT_PERIODS
  // until this resolves or if it fails, same fallback contract as getConfig().
  const [periods, setPeriods] = useState<PricingPeriod[]>(DEFAULT_PERIODS)
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from("config")
        .select("value")
        .eq("key", "pricing")
        .single()
      const fetched = (data?.value as { periods?: PricingPeriod[] } | null)?.periods
      if (!cancelled && !error && fetched?.length) setPeriods(fetched)
    })()
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
      <div className="book-container">
        {/* Progress — back arrow (hidden on the confirmation screen; booking is
            done, Screen4 offers a deliberate "Back to Home" instead) shares the
            same row as the stepper so it never overlaps it. */}
        <div className="progress-bar-wrap">
          {screen < 3 && (
            <BackButton
              variant="inline"
              onClick={handleBack}
              ariaLabel={t("back")}
              cmsKey="book.back"
              color={tokens.colors.text}
            />
          )}
          <div style={{ flex: 1 }}>
            <ProgressSteps steps={STEPS} current={screen} onStepClick={goToStep} />
          </div>
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
                  availability={availability}
                  monthAvailability={monthAvailability}
                  extraBlocks={extraBlocks}
                  setExtraBlocks={setExtraBlocks}
                  allBlocks={allBlocks}
                  periods={periods}
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
                  blocks={allBlocks}
                  periods={periods}
                  onBackToSlots={() => {
                    availability.invalidate(activeDateStr)
                    for (const b of extraBlocks) availability.invalidate(b.date)
                    setExtraBlocks([])
                    setSelectedTable(null)
                    setDuration(0)
                    setScreen(0)
                  }}
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
                    tickets={confirmedBookings.map((b) => ({
                      date: b.date,
                      startHour: parseInt(b.start_time.slice(0, 2), 10),
                      duration: Number(b.duration_hours),
                      tableNumber: b.table_number,
                      bookingRef: b.booking_reference ?? bookingRef,
                      qrData: b.qr_code ?? undefined,
                      totalPrice: b.total_price,
                      paymentMethod: b.payment_method,
                    }))}
                  />
                ) : (
                  // Defensive fallback — the normal flow always sets confirmBookingId
                  // via the Stripe redirect-return effect before screen reaches 3, so
                  // this branch shouldn't render in practice.
                  <Screen4
                    tickets={[
                      {
                        date: activeDateStr,
                        startHour,
                        duration,
                        tableNumber: selectedTable ?? 0,
                        bookingRef,
                        totalPrice: quoteBlockTotal(activeDateStr, startHour, duration, periods),
                      },
                    ]}
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
          display: flex;
          align-items: center;
          gap: 16px;
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
        .slot-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
        }
        .skeleton-pulse {
          animation: skeleton-pulse 1.4s ease-in-out infinite;
        }
        @keyframes skeleton-pulse {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }
        @media (min-width: 480px) {
          .slot-grid {
            grid-template-columns: repeat(4, 1fr);
          }
        }
        @media (min-width: 768px) {
          .slot-grid {
            grid-template-columns: repeat(6, 1fr);
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
