"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import {
  ChevronRight,
  ChevronLeft,
  Lock,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react"
import { tokens } from "@/app/styles/tokens"
import { isSlotStillBookable, slotStartInHongKong } from "@/lib/booking/slot-cutoff"
import { Button, Card, ProgressSteps, BackButton } from "@/components/ui"
import { LoadingGif } from "@/components/ui/LoadingGif"
import { Starfield } from "@/app/[locale]/Starfield"
import { AuthCard } from "@/components/auth/AuthCard"
import StripePayment from "@/components/checkout/StripePayment"
import KPayPayment from "@/components/checkout/KPayPayment"
import { readKPayPersistedState, clearKPayPersistedState } from "@/components/checkout/KPayPayment"
import PaymentMethodList from "@/components/checkout/PaymentMethodList"
import type { PaymentMethodId } from "@/components/checkout/PaymentMethodList"
import type { KPayMethod, KPayMode } from "@/components/checkout/KPayPayment"
import { paymentMethodLabel } from "@/components/checkout/PaymentMethodList"
import type { PromoResult } from "@/components/checkout/StripePayment"
import { TicketCard } from "@/components/booking/TicketCard"
import { TicketPrinter } from "@/components/checkout/TicketPrinter"
import { getTableName, TABLE_NAMES } from "@/lib/booking/constants"
import { createClient } from "@/lib/supabase/client"
import { useAvailabilityCache } from "@/lib/booking/useAvailabilityCache"
import { useMonthAvailability } from "@/lib/booking/useMonthAvailability"
import { useOrderConfirmationPolling, type OrderHoldState } from "@/lib/booking/useOrderConfirmationPolling"
import { PaymentRecoveryScreen, type PaymentRecoveryReason } from "@/components/checkout/PaymentRecoveryScreen"
import { quoteBlockTotal, quoteBlockDetail, quoteBlockMinPoints } from "@/lib/pricing"
import { DEFAULT_PERIODS, pricingRatesToPeriods, type PricingPeriod } from "@/lib/data/pricing"
import { useHaptic } from "@/lib/useHaptic"
import { useLocale, useTranslations } from "next-intl"
import { useRouter } from "@/i18n/navigation"
import { useSearchParams } from "next/navigation"
import LegalDocumentRenderer from "@/components/legal/LegalDocumentRenderer"
import { getLegalDocument } from "@/content/legal"
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

const legalLinkStyle: React.CSSProperties = {
  appearance: "none",
  border: "none",
  padding: 0,
  background: "transparent",
  color: tokens.colors.link,
  textDecoration: "underline",
  textUnderlineOffset: 3,
  font: "inherit",
  cursor: "pointer",
}

const modalOverlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 100,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 16,
  background: "rgba(0,0,0,0.78)",
}

const modalStyle: React.CSSProperties = {
  width: "min(100%, 680px)",
  maxHeight: "min(88vh, 760px)",
  display: "flex",
  flexDirection: "column",
  background: "#000",
  border: `1px solid ${tokens.colors.borderStrong}`,
  borderRadius: 20,
  overflow: "hidden",
}

const modalHeaderStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  padding: "16px 16px 16px 20px",
  borderBottom: `1px solid ${tokens.colors.border}`,
  flexShrink: 0,
}

const modalCloseStyle: React.CSSProperties = {
  width: 44,
  height: 44,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  border: `1px solid ${tokens.colors.borderStrong}`,
  borderRadius: "50%",
  background: "transparent",
  color: tokens.colors.text,
  fontSize: 28,
  lineHeight: 1,
  cursor: "pointer",
}

const modalContentStyle: React.CSSProperties = {
  minHeight: 0,
  overflowY: "auto",
  padding: "24px 20px 8px",
  WebkitOverflowScrolling: "touch",
}

const modalBottomCloseStyle: React.CSSProperties = {
  minHeight: 44,
  margin: "8px 20px 16px",
  border: `1px solid ${tokens.colors.borderStrong}`,
  borderRadius: tokens.radius.button,
  background: "transparent",
  color: tokens.colors.text,
  fontWeight: 600,
  cursor: "pointer",
  flexShrink: 0,
}

/* ─────────────────────────  Helpers  ───────────────────────── */
function isDesktopDevice(): boolean {
  if (typeof navigator === "undefined") return false
  const userAgent = navigator.userAgent
  const isDesktop = !/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(userAgent)
  console.log("[KPay] device check:", { userAgent, isDesktop })
  return isDesktop
}

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

function getHongKongNow(date = new Date()): { date: string; hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: HK_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ""
  // Intl can emit "24" for midnight in some engines; normalise to 0.
  const rawHour = Number(get("hour"))
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    hour: rawHour % 24,
    minute: Number(get("minute")) || 0,
  }
}

type DaySlot = {
  table_number: number
  date: string
  start_time: string
  duration_hours: number
  status: string
  locked_until: string | null
  locked_by_you: boolean
}

const ALL_TABLES = [1, 2]

// Shared empty-Set sentinel — avoids allocating a fresh object every render
// when a date has no entry in selectedSlotsByDate. Never mutated directly;
// every write site copies it into a new Set first.
const EMPTY_SET: Set<string> = new Set()

// One selected slot block (a contiguous run of hours on one date, one table).
// The order is the union of every run across every (date, table) the user has
// picked slots on (selectedSlotsByDate), grouped via groupHoursIntoRuns().
type SelectedBlock = {
  date: string // 'YYYY-MM-DD'
  startHour: number
  duration: number
  tableNumber: number
}

// Selection entries are keyed per (table, hour) so one order can mix tables
// (e.g. Table 1's 09:00 + Table 2's 14:00) — the multi-block lock RPC and
// create-intent already handle per-block table numbers.
type SlotKey = string // `${table}:${hour}`

function slotKey(table: number, hour: number): SlotKey {
  return `${table}:${hour}`
}

function parseSlotKey(key: SlotKey): { table: number; hour: number } {
  const [t, h] = key.split(":")
  return { table: Number(t), hour: Number(h) }
}

// Collapse a set of selected hours (one date) into contiguous runs. Pure —
// sorts ascending, merges adjacent hours into a single run each.
function groupHoursIntoRuns(
  hours: Iterable<number>,
  date: string,
  tableNumber: number,
): SelectedBlock[] {
  const sorted = Array.from(hours).sort((a, b) => a - b)
  const runs: SelectedBlock[] = []
  for (const h of sorted) {
    const last = runs[runs.length - 1]
    if (last && last.startHour + last.duration === h) {
      last.duration += 1
    } else {
      runs.push({ date, startHour: h, duration: 1, tableNumber })
    }
  }
  return runs
}

// Time-slot grid is grouped into labelled periods. Venue hours: 06:00–24:00
// (last bookable slot starts at 23:00). Hours are inclusive-start.
const SLOT_GROUPS: { key: string; hours: number[] }[] = [
  { key: "morning", hours: [6, 7, 8, 9, 10, 11] },
  { key: "afternoon", hours: [12, 13, 14, 15, 16, 17] },
  { key: "evening", hours: [18, 19, 20, 21, 22, 23] },
]

type TableState = "available" | "locked_by_you" | "locked" | "booked"

// Per-table state for [startHour, startHour+duration) on `dateStr`, given the
// day's booked/active-locked slots. Pure + client-side so it drives both the wheel
// greying (Step 2) and the table list (Step 3) without extra API calls.
// "locked_by_you" = the caller's OWN active hold (e.g. an abandoned checkout) —
// clickable, resumes straight to payment (see onResumeLocked). "locked" =
// someone else's active 15-min hold; "booked" = confirmed.
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
      states.set(
        s.table_number,
        s.status === "booked" ? "booked" : s.locked_by_you ? "locked_by_you" : "locked",
      )
    }
  }
  return states
}

// Worst (most-restrictive) state for ONE table across one hour on one date.
// Wrapper over tableStatesFor for per-cell rendering in the dual-table grid.
function cellStateFor(
  daySlots: DaySlot[],
  dateStr: string,
  hour: number,
  table: number,
): TableState {
  return tableStatesFor(daySlots, dateStr, hour, 1).get(table) ?? "available"
}

// Shared parser for the persisted-selection JSON shape (both the durable
// bookingSelection key and the one-shot pendingBooking key use this).
// Entries carry per-(table, hour) slot keys: { date, slots: ['1:9','2:14'] }.
// Older persisted shapes ({ date, hours: [...] }) are ignored — they predate
// mixed-table orders and can't be mapped to a table safely.
function parseSelectionEntries(entries: unknown): Map<string, Set<string>> {
  const restored = new Map<string, Set<string>>()
  if (!Array.isArray(entries)) return restored
  for (const e of entries) {
    if (typeof (e as { date?: unknown })?.date !== "string") continue
    const { date, slots } = e as { date: string; slots: unknown }
    const valid = Array.isArray(slots)
      ? slots.filter((s): s is string => typeof s === "string" && /^[12]:\d{1,2}$/.test(s))
      : []
    if (valid.length > 0) restored.set(date, new Set(valid))
  }
  return restored
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

/* ─────────────────────────  Dual-Table Slot Grid  ───────────────────────── */
// Both tables' availability side by side — no tab switching. One row per hour
// (grouped under the 上午/下午/晚上 period labels), one cell per table. A cell
// is one bookable (table, hour) slot with three visual states: available
// (transparent + border), selected (solid brand green), booked (danger tint,
// non-interactive "已被預約"). A third-party 15-min lock renders like booked
// but with a lock icon; the caller's OWN lock stays clickable and resumes
// straight to payment (same behaviour the old TableChips had).
type CellState = {
  state: TableState
  past: boolean
  disabled: boolean
}

function DualTableGrid({
  selectedDate,
  daySlots,
  dayLoading,
  slotsForDate,
  totalSelectedHours,
  onToggle,
  onResumeLocked,
}: {
  selectedDate: Date
  daySlots: DaySlot[] | null
  dayLoading: boolean
  slotsForDate: Set<string>
  totalSelectedHours: number
  onToggle: (table: number, hour: number) => void
  onResumeLocked: (date: string, startHour: number, duration: number, tableNumber: number) => void
}) {
  const t = useTranslations("book")
  const locale = useLocale()
  const haptic = useHaptic()
  const [showToast, setShowToast] = useState(false)
  const [galleryRoom, setGalleryRoom] = useState<number | null>(null)
  const galleryTrackRef = useRef<HTMLDivElement>(null)
  const [galleryIdx, setGalleryIdx] = useState(0)

  // Room gallery images — per-room photo sets from /public/gallery/
  const roomGalleryImages = useMemo(
    () =>
      ({
        1: [
          { src: "/gallery/Space_Infinity.PNG", alt: "Space Infinity — interior view" },
          { src: "/gallery/S2/part3_table_wide_room.png", alt: "Space Infinity — wide angle" },
          { src: "/gallery/S2/part2_table_closeup.png", alt: "Space Infinity — table closeup" },
        ],
        2: [
          { src: "/gallery/Space_Enternity.PNG", alt: "Space Eternity — interior view" },
          { src: "/gallery/Space_Infinity.PNG", alt: "Space Eternity — alternate angle" },
          { src: "/gallery/S2/part1_tap_to_enter.png", alt: "Space Eternity — entrance" },
        ],
      } as const),
    [],
  )

  const galleryImages = galleryRoom ? (roomGalleryImages[galleryRoom as 1 | 2] ?? []) : []

  // Track gallery scroll position for dot indicators
  const onGalleryScroll = useCallback(() => {
    const el = galleryTrackRef.current
    if (!el || galleryImages.length === 0) return
    const cardWidth = el.scrollWidth / galleryImages.length
    setGalleryIdx(Math.round(el.scrollLeft / cardWidth))
  }, [galleryImages.length])

  const scrollToGalleryCard = useCallback(
    (i: number) => {
      const el = galleryTrackRef.current
      if (!el || galleryImages.length === 0) return
      const cardWidth = el.scrollWidth / galleryImages.length
      el.scrollTo({ left: i * cardWidth, behavior: "smooth" })
    },
    [galleryImages.length],
  )

  // Close gallery on ESC key
  useEffect(() => {
    if (galleryRoom === null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setGalleryRoom(null)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [galleryRoom])

  // Room name formatter: "Space Infinity（無限空間球室）" style
  const formatRoomName = useCallback(
    (tableNumber: number) => {
      const names = TABLE_NAMES[tableNumber as 1 | 2]
      if (!names) return `${t("table_label")} ${tableNumber}`
      const enName = names["en"] ?? `Table ${tableNumber}`
      const zhName =
        names[locale] ?? names["zh-HK"] ?? names["zh-CN"] ?? `球室${tableNumber}`
      return `${enName}（${zhName}）`
    },
    [locale, t],
  )

  // Split room name into English + Chinese parts for two-line display
  const getRoomNameParts = useCallback(
    (tableNumber: number): { en: string; zh: string } => {
      const names = TABLE_NAMES[tableNumber as 1 | 2]
      if (!names) return { en: `Table ${tableNumber}`, zh: "" }
      const en = names["en"] ?? `Table ${tableNumber}`
      const zh = names[locale] ?? names["zh-HK"] ?? names["zh-CN"] ?? ""
      return { en, zh }
    },
    [locale],
  )

  const dateStr = useMemo(() => fmtYMD(selectedDate), [selectedDate])

  // All time comparisons use Hong Kong venue time, not the browser's clock.
  // `nowTick` re-reads it every minute so the grid doesn't stale across the
  // hour boundary while the page is open.
  const [nowTick, setNowTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setNowTick((n) => n + 1), 60_000)
    return () => clearInterval(id)
  }, [])
  const now = useMemo(() => new Date(), [nowTick])

  const bookableHours = useMemo(
    () => SLOT_GROUPS.flatMap((g) => g.hours),
    [],
  )

  // Per-(table, hour) cell state for the whole day.
  const cellStates = useMemo(() => {
    const states = new Map<SlotKey, CellState>()
    for (const h of bookableHours) {
      const slotStart = slotStartInHongKong(dateStr, h)
      const past = !isSlotStillBookable(slotStart, now)
      const perTable = daySlots ? tableStatesFor(daySlots, dateStr, h, 1) : null
      for (const tn of ALL_TABLES) {
        const state: TableState = perTable?.get(tn) ?? "available"
        // locked_by_you stays interactive (resumes to payment); everything
        // else that isn't plain-available is dead.
        const disabled = past || state === "booked" || state === "locked"
        states.set(slotKey(tn, h), { state, past, disabled })
      }
    }
    return states
  }, [bookableHours, daySlots, dateStr, now])

  // Header stats + mini rail per table: free = neither past nor taken.
  const tableStats = useMemo(() => {
    const stats = new Map<number, { free: number; cells: boolean[] }>()
    for (const tn of ALL_TABLES) {
      const cells = bookableHours.map((h) => {
        const c = cellStates.get(slotKey(tn, h))
        return !!c && !c.disabled
      })
      stats.set(tn, { free: cells.filter(Boolean).length, cells })
    }
    return stats
  }, [bookableHours, cellStates])

  // Is the entire day unusable?
  const fullyBooked = useMemo(() => {
    if (daySlots === null) return false
    for (const [, c] of cellStates) if (!c.disabled) return false
    return true
  }, [cellStates, daySlots])

  const toggle = useCallback(
    (tn: number, h: number) => {
      const cell = cellStates.get(slotKey(tn, h))
      if (!cell || cell.disabled) return
      if (cell.state === "locked_by_you" && daySlots) {
        // Resume the caller's own abandoned hold instead of re-selecting.
        const own = daySlots.find((s) => s.table_number === tn && s.locked_by_you)
        if (own) {
          onResumeLocked(own.date, parseInt(own.start_time.slice(0, 2), 10), Number(own.duration_hours), tn)
          return
        }
      }
      haptic.vibrate(8)
      const willAdd = !slotsForDate.has(slotKey(tn, h))
      if (willAdd && totalSelectedHours >= CONFIG.maxHours) {
        setShowToast(true)
        setTimeout(() => setShowToast(false), 2000)
        return
      }
      onToggle(tn, h)
    },
    [cellStates, daySlots, slotsForDate, totalSelectedHours, haptic, onToggle, onResumeLocked],
  )

  // Skeleton laid out as the real dual-column rows.
  if (dayLoading || daySlots === null) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }} aria-busy="true">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="dual-row">
            <div
              className="skeleton-pulse"
              style={{ height: 16, borderRadius: 4, background: "rgba(255,255,255,0.06)", alignSelf: "center" }}
            />
            {ALL_TABLES.map((tn) => (
              <div
                key={tn}
                className="skeleton-pulse"
                style={{
                  minHeight: 44,
                  borderRadius: tokens.radius.input,
                  border: `1px solid ${tokens.colors.border}`,
                  background: "rgba(255,255,255,0.04)",
                }}
              />
            ))}
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

  const renderCell = (tn: number, h: number) => {
    const cell = cellStates.get(slotKey(tn, h))!
    const selected = slotsForDate.has(slotKey(tn, h))
    const { state, past, disabled } = cell
    const booked = state === "booked"
    const locked = state === "locked"
    const lockedByYou = state === "locked_by_you"

    return (
      <button
        key={tn}
        type="button"
        disabled={disabled}
        onClick={() => toggle(tn, h)}
        aria-label={`${t("table_label")} ${tn} ${padTime(h)}`}
        title={lockedByYou ? t("table_locked_by_you") : locked ? t("table_locked") : undefined}
        style={{
          minHeight: 44,
          padding: "10px 6px",
          borderRadius: tokens.radius.input,
          border: `1px solid ${
            selected || lockedByYou
              ? tokens.colors.link
              : booked
                ? "rgba(255,69,58,0.35)"
                : tokens.colors.border
          }`,
          background: selected
            ? tokens.colors.link
            : booked
              ? "rgba(255,69,58,0.08)"
              : tokens.colors.depth.recessed,
          color: selected
            ? "#000"
            : booked
              ? "rgba(255,99,89,0.85)"
              : past || locked
                ? tokens.colors.textFaint
                : lockedByYou
                  ? tokens.colors.link
                  : tokens.colors.text,
          fontSize: 13,
          fontWeight: selected ? 700 : 400,
          opacity: past ? 0.35 : 1,
          cursor: disabled ? "not-allowed" : "pointer",
          transition: `all ${tokens.duration.fast} ${tokens.easing.spring}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 4,
        }}
      >
        {(locked || lockedByYou) && (
          <Lock size={12} style={{ flexShrink: 0, color: lockedByYou ? tokens.colors.link : undefined }} />
        )}
        <span style={{ whiteSpace: "nowrap" }} data-cms-key={booked ? "book.slot_booked" : undefined}>
          {booked ? t("slot_booked") : lockedByYou ? t("table_resume") : padTime(h)}
        </span>
      </button>
    )
  }

  return (
    <>
      {/* Legend */}
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 14 }}>
        {[
          { key: "legend_available", swatch: { background: tokens.colors.depth.recessed, border: `1.5px solid ${tokens.colors.border}` } },
          { key: "legend_selected", swatch: { background: tokens.colors.link } },
          { key: "legend_booked", swatch: { background: "rgba(255,69,58,0.15)", border: "1.5px solid rgba(255,69,58,0.4)" } },
        ].map(({ key, swatch }) => (
          <div key={key} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 12, height: 12, borderRadius: 3, flex: "none", ...swatch }} />
            <span data-cms-key={`book.${key}`} style={{ fontSize: 12, color: tokens.colors.textMuted }}>
              {t(key)}
            </span>
          </div>
        ))}
      </div>

      <div
        style={{
          background: tokens.colors.depth.flat,
          border: `1px solid ${tokens.colors.border}`,
          borderRadius: tokens.radius.card,
          overflow: "hidden",
        }}
      >
        {/* Table heads: name + free-count + mini availability rail */}
        <div className="dual-row" style={{ borderBottom: `1px solid ${tokens.colors.border}` }}>
          <div />
          {ALL_TABLES.map((tn) => {
            const stat = tableStats.get(tn)!
            return (
              <div key={tn} style={{ padding: "12px 10px 14px" }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    justifyContent: "space-between",
                    marginBottom: 8,
                  }}
                >
                  <button
                    type="button"
                    data-cms-key={`book.room_name_${tn}`}
                    aria-label={`View photos of ${formatRoomName(tn)}`}
                    onClick={() => setGalleryRoom(tn)}
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      fontFamily: "'Good Times', sans-serif",
                      letterSpacing: "0.02em",
                      color: tokens.colors.text,
                      background: "transparent",
                      border: "none",
                      padding: 0,
                      cursor: "pointer",
                      textDecoration: "underline",
                      textUnderlineOffset: 3,
                      textDecorationColor: "rgba(255,255,255,0.25)",
                      textAlign: "left",
                      lineHeight: 1.3,
                    }}
                  >
                    <span style={{ display: "block" }}>
                      {getRoomNameParts(tn).en}
                    </span>
                    <span
                      style={{
                        display: "block",
                        fontSize: 12,
                        fontFamily: "system-ui, -apple-system, sans-serif",
                        fontWeight: 400,
                        color: tokens.colors.textMuted,
                        letterSpacing: "0.01em",
                      }}
                    >
                      {getRoomNameParts(tn).zh}
                    </span>
                  </button>
                  <span style={{ fontSize: 12, color: tokens.colors.textMuted }}>
                    <b style={{ color: tokens.colors.link, fontWeight: 600 }}>{stat.free}</b>
                    {` / ${stat.cells.length} `}
                    <span data-cms-key="book.free_suffix">{t("free_suffix")}</span>
                  </span>
                </div>
                <div style={{ display: "flex", gap: 2, height: 5, borderRadius: 3, overflow: "hidden" }}>
                  {stat.cells.map((free, i) => (
                    <span
                      key={i}
                      style={{
                        flex: 1,
                        background: free ? tokens.colors.link : "rgba(255,69,58,0.35)",
                      }}
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        {/* Period-grouped hour rows */}
        {SLOT_GROUPS.map((group) => (
          <div key={group.key}>
            <div
              data-cms-key={`book.slot_group_${group.key}`}
              className="font-label"
              style={{
                padding: "10px 12px 6px",
                fontSize: 11,
                color: tokens.colors.textMuted,
                background: tokens.colors.depth.recessed,
                borderTop: `1px solid ${tokens.colors.border}`,
                borderBottom: `1px solid ${tokens.colors.border}`,
              }}
            >
              {t(`slot_group_${group.key}`)}
            </div>
            {group.hours.map((h) => (
              <div key={h} className="dual-row" style={{ padding: "3px 6px" }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 12,
                    color: tokens.colors.textMuted,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {padTime(h)}
                </div>
                {ALL_TABLES.map((tn) => renderCell(tn, h))}
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Toast for the max-hours-per-order cap */}
      <AnimatePresence>
        {showToast && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            data-cms-key="book.max_hours_reached"
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
              zIndex: 100,
              pointerEvents: "none",
            }}
          >
            {t("max_hours_reached")}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Room gallery popup — swipeable photos, dismiss on outside tap / ESC / close */}
      <AnimatePresence>
        {galleryRoom !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={modalOverlayStyle}
            onClick={() => setGalleryRoom(null)}
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              style={modalStyle}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={modalHeaderStyle}>
                <span
                  className="font-label"
                  style={{ fontSize: 12, color: tokens.colors.textMuted }}
                >
                  {formatRoomName(galleryRoom)}
                </span>
                <button
                  type="button"
                  aria-label={t("close")}
                  onClick={() => setGalleryRoom(null)}
                  style={modalCloseStyle}
                >
                  ×
                </button>
              </div>

              <div
                ref={galleryTrackRef}
                onScroll={onGalleryScroll}
                className="gallery-track"
              >
                {galleryImages.map((img, i) => (
                  <div key={img.src} className="gallery-slide">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={img.src}
                      alt={img.alt}
                      draggable={false}
                      loading="lazy"
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  </div>
                ))}
              </div>

              {galleryImages.length > 1 && (
                <div className="gallery-dots">
                  {galleryImages.map((img, i) => (
                    <button
                      key={img.src}
                      type="button"
                      aria-label={`Photo ${i + 1}`}
                      aria-current={i === galleryIdx ? "true" : undefined}
                      onClick={() => scrollToGalleryCard(i)}
                      className="gallery-dot"
                      style={{ background: i === galleryIdx ? tokens.colors.text : tokens.colors.border }}
                    />
                  ))}
                </div>
              )}

              <button
                type="button"
                data-cms-key="book.close"
                onClick={() => setGalleryRoom(null)}
                style={modalBottomCloseStyle}
              >
                {t("close")}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

/* ─────────────────────────  Selected Picks Card  ───────────────────────── */
// The sidebar's "已揀時段" card: every run in the order (across every date),
// each individually removable, with an empty-state hint when nothing's picked.
function SelectedPicksCard({
  runs,
  removeRun,
  periods,
}: {
  runs: SelectedBlock[]
  removeRun: (run: SelectedBlock) => void
  periods: PricingPeriod[]
}) {
  const t = useTranslations("book")
  const locale = useLocale()
  const multiDate = new Set(runs.map((r) => r.date)).size > 1

  return (
    <div
      style={{
        background: tokens.colors.depth.raised,
        border: `1px solid ${tokens.colors.border}`,
        borderRadius: tokens.radius.card,
        padding: "18px 18px 12px",
      }}
    >
      <div
        data-cms-key="book.selected_slots_title"
        className="font-label"
        style={{
          fontSize: 12,
          color: tokens.colors.textMuted,
          marginBottom: 12,
        }}
      >
        {t("selected_slots_title")}
      </div>
      {runs.length === 0 ? (
        <div
          data-cms-key="book.empty_picks"
          style={{ fontSize: 13, color: tokens.colors.textMuted, paddingBottom: 8, lineHeight: 1.5 }}
        >
          {t("empty_picks")}
        </div>
      ) : (
        runs.map((r) => {
          const [, m, d] = r.date.split("-")
          const dateLabel = multiDate ? `${Number(m)}月${Number(d)}日 ` : ""
          // Apple-style discount display: when the contiguous block earns the
          // 2h+ rate, show the undiscounted price struck through next to the
          // charged price, plus a "you save" line — never just the final number.
          const detail = quoteBlockDetail(r.date, r.startHour, r.duration, periods)
          return (
            <div
              key={`${r.date}-${r.tableNumber}-${r.startHour}`}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
                border: `1px solid ${tokens.colors.link}`,
                background: "rgba(34,197,94,0.08)",
                borderRadius: tokens.radius.input,
                padding: "10px 12px",
                marginBottom: 10,
                fontSize: 13,
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ color: tokens.colors.link, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                  {dateLabel}
                  {padTime(r.startHour)} – {padTime(r.startHour + r.duration)}
                </div>
                <div style={{ color: tokens.colors.textMuted, fontSize: 12, marginTop: 2 }}>
                  {getTableName(r.tableNumber, locale)} ·{" "}
                  {detail.saved > 0 && (
                    <s style={{ color: tokens.colors.textFaint, fontVariantNumeric: "tabular-nums" }}>
                      HK${detail.baseTotal}
                    </s>
                  )}{detail.saved > 0 && " "}
                  <span style={{ color: "#fff", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                    HK${detail.total}
                  </span>
                </div>
                {detail.saved > 0 && (
                  <div
                    data-cms-key="book.block_saved_badge"
                    style={{ color: tokens.colors.textMuted, fontSize: 12, marginTop: 2 }}
                  >
                    {t("block_saved_badge", { hours: r.duration, saved: detail.saved })}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => removeRun(r)}
                data-cms-key="book.remove_slot"
                style={{
                  fontSize: 13,
                  color: tokens.colors.textMuted,
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  textDecoration: "underline",
                  minHeight: 44,
                  padding: "0 4px",
                }}
              >
                {t("remove_slot")}
              </button>
            </div>
          )
        })
      )}
    </div>
  )
}
/* ─────────────────────────  QR Code  ───────────────────────── */
/* ─────────────────────────  Table Select  ───────────────────────── */
type TableInfo = { id: number; name: string; type: string }

function useTables() {
  const t = useTranslations("book")
  const locale = useLocale()
  return [
    { id: 1, name: getTableName(1, locale), type: t("snooker") },
    { id: 2, name: getTableName(2, locale), type: t("snooker") },
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
  datesWithSelections,
}: {
  selected: Date
  onSelect: (d: Date) => void
  monthAvailability: ReturnType<typeof useMonthAvailability>
  datesWithSelections: Set<string>
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
                  {/* Cross-date order indicator — a dot marking dates that
                      already have picked hours elsewhere in the order.
                      Positioned at top (vs. the today-dot's bottom) so the
                      two never collide on a date that is both today and has
                      a selection. Passive only — no modal/count. */}
                  {!isSelected && datesWithSelections.has(fmtYMD(date)) && (
                    <span
                      style={{
                        position: "absolute",
                        top: 4,
                        left: "50%",
                        transform: "translateX(-50%)",
                        width: 4,
                        height: 4,
                        borderRadius: "50%",
                        background: tokens.colors.link,
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
  runs,
  total,
  canContinue,
  onContinue,
  ctaLabel,
  loading,
  ready = true,
  periods,
}: {
  selectedDate: Date
  runs: SelectedBlock[]
  total: number
  canContinue: boolean
  onContinue: () => void
  ctaLabel: string
  loading?: boolean
  ready?: boolean
  periods: PricingPeriod[]
}) {
  const dash = "—"
  const t = useTranslations("book")
  const totalHours = runs.reduce((sum, r) => sum + r.duration, 0)
  const single = runs.length === 1 ? runs[0] : null
  const endHour = single ? single.startHour + single.duration : 0
  const crossDay = endHour >= 24

  // Order-wide multi-hour savings — sum of each block's (base − discounted).
  const totalSaved = runs.reduce(
    (sum, r) => sum + quoteBlockDetail(r.date, r.startHour, r.duration, periods).saved,
    0,
  )

  return (
    <Card
      variant="elevated"
      style={{ backgroundColor: tokens.colors.depth.elevated }}
    >
        <div
          data-cms-key="book.card.title"
          className="font-label"
          style={{
            fontSize: 12,
            color: tokens.colors.textMuted,
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
            <span style={{ fontSize: 15, fontWeight: 500, color: ready ? undefined : tokens.colors.textFaint }}>
              {ready
                ? `${selectedDate.getFullYear()}年${selectedDate.getMonth() + 1}月${selectedDate.getDate()}日`
                : dash}
            </span>
          </div>
          {single ? (
            <>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 14, color: tokens.colors.textMuted }}>
                  {t("time_slot")}
                </span>
                <span style={{ fontSize: 15, fontWeight: 500, color: ready ? undefined : tokens.colors.textFaint }}>
                  {ready
                    ? `${padTime(single.startHour)} – ${padTime(endHour)}${crossDay ? " +1日" : ""}`
                    : dash}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 14, color: tokens.colors.textMuted }}>
                  {t("duration")}
                </span>
                <span style={{ fontSize: 15, fontWeight: 500, color: ready ? undefined : tokens.colors.textFaint }}>
                  {ready ? `${single.duration}${t("hours")}` : dash}
                </span>
              </div>
            </>
          ) : (
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: 14, color: tokens.colors.textMuted }}>
                {t("time_slot")}
              </span>
              <span style={{ fontSize: 15, fontWeight: 500, color: ready ? undefined : tokens.colors.textFaint }}>
                {ready ? t("slots_selected", { count: runs.length }) + ` · ${totalHours}${t("hours")}` : dash}
              </span>
            </div>
          )}
        </div>
        <div
          style={{
            height: 1,
            background: tokens.colors.border,
            marginBottom: 24,
          }}
        />
        {/* Apple-style "was / now / you save": strike the pre-discount total
            above the hero price whenever the 2h+ rate kicked in. */}
        {ready && totalSaved > 0 && (
          <div style={{ textAlign: "center", marginBottom: 6 }}>
            <s
              style={{
                fontFamily: BEBAS,
                fontSize: 22,
                color: tokens.colors.textFaint,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              HK${total + totalSaved}
            </s>
          </div>
        )}
        <div
          style={{
            fontFamily: BEBAS,
            fontSize: 40,
            textAlign: "center",
            marginBottom: ready && totalSaved > 0 ? 10 : 28,
            color: tokens.colors.link,
          }}
        >
          {ready ? `HK$${total}` : ""}
        </div>
        {ready && totalSaved > 0 && (
          <div
            data-cms-key="book.total_saved"
            style={{
              textAlign: "center",
              fontSize: 13,
              fontWeight: 600,
              color: "#fff",
              marginBottom: 22,
            }}
          >
            {t("total_saved", { saved: totalSaved })}
          </div>
        )}
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
          background: disabled ? "rgba(255,255,255,0.15)" : tokens.colors.link,
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
  selectedDate,
  setSelectedDate,
  slotsForDate,
  onToggleSlot,
  onPruneSlots,
  selectedSlotsByDate,
  totalSelectedHours,
  runs,
  orderTotal,
  removeRun,
  onContinue,
  onResumeLocked,
  availability,
  monthAvailability,
  periods,
}: {
  selectedDate: Date
  setSelectedDate: (d: Date) => void
  slotsForDate: Set<string>
  onToggleSlot: (date: string, table: number, hour: number) => void
  onPruneSlots: (date: string, updater: (prev: Set<string>) => Set<string>) => void
  selectedSlotsByDate: Map<string, Set<string>>
  totalSelectedHours: number
  runs: SelectedBlock[]
  orderTotal: number
  removeRun: (run: SelectedBlock) => void
  onContinue: () => void
  onResumeLocked: (date: string, startHour: number, duration: number, tableNumber: number) => void
  availability: ReturnType<typeof useAvailabilityCache>
  monthAvailability: ReturnType<typeof useMonthAvailability>
  periods: PricingPeriod[]
}) {
  const dateStr = useMemo(() => fmtYMD(selectedDate), [selectedDate])
  const timeRef = useRef<HTMLDivElement>(null)
  const t = useTranslations("book")

  // Read the day's slots from the shared prefetch cache. If the date is cached
  // (in the prefetched week, or fetched earlier) this is synchronous — no spinner.
  // Out-of-window dates trigger an on-demand fetch; the grid shows a skeleton
  // while availability.loadingDate matches. Fails OPEN (empty = everything free).
  const daySlots = availability.getSlots(dateStr)

  useEffect(() => {
    // Not in cache yet and not already loading → fetch this single date on demand.
    if (availability.getSlots(dateStr) === null && availability.loadingDate !== dateStr) {
      availability.fetchDate(dateStr)
    }
    // getSlots identity changes with cache version, re-running this after prefetch.
  }, [dateStr, availability])

  // Ensure every OTHER date present in the order (besides the one currently
  // being viewed) is also cached, so pruning across the whole order can be
  // computed without a stale/missing daySlots gap.
  useEffect(() => {
    for (const date of selectedSlotsByDate.keys()) {
      if (date === dateStr) continue
      if (availability.getSlots(date) === null && availability.loadingDate !== date) {
        availability.fetchDate(date)
      }
    }
  }, [selectedSlotsByDate, dateStr, availability])

  const dayLoading = daySlots === null && availability.loadingDate === dateStr

  const [cutoffTick, setCutoffTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setCutoffTick((n) => n + 1), 60_000)
    return () => clearInterval(id)
  }, [])

  // Prune selected slots on the viewed date that have since become unavailable
  // (including the hard start + 15-minute cutoff).
  useEffect(() => {
    if (!daySlots) return
    const now = new Date()
    onPruneSlots(dateStr, (prevSlots) => {
      let changed = false
      const next = new Set(prevSlots)
      for (const key of prevSlots) {
        const { table, hour } = parseSlotKey(key)
        if (
          !isSlotStillBookable(slotStartInHongKong(dateStr, hour), now) ||
          cellStateFor(daySlots, dateStr, hour, table) !== "available"
        ) {
          next.delete(key)
          changed = true
        }
      }
      return changed ? next : prevSlots
    })
  }, [daySlots, dateStr, onPruneSlots, cutoffTick])

  const ready = runs.length > 0
  const canContinue = ready

  const datesWithSelections = useMemo(
    () => new Set(selectedSlotsByDate.keys()),
    [selectedSlotsByDate],
  )

  const sectionLabel = (text: string, cmsKey: string) => (
    <div
      data-cms-key={cmsKey}
      className="font-label"
      style={{
        fontSize: 13,
        color: tokens.colors.textMuted,
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
          {/* Date */}
          <div
            style={{
              background: tokens.colors.depth.recessed,
              border: `1px solid ${tokens.colors.border}`,
              borderRadius: tokens.radius.card,
              padding: "16px 18px 18px",
              marginBottom: 24,
            }}
          >
            {sectionLabel(t("select_date"), "book.date.title")}
            <Calendar
              selected={selectedDate}
              onSelect={(d) => {
                setSelectedDate(d)
                scrollToRef(timeRef)
                // Deliberately NOT clearing selectedSlotsByDate here —
                // cross-date orders must survive a calendar switch.
              }}
              monthAvailability={monthAvailability}
              datesWithSelections={datesWithSelections}
            />
          </div>

          {/* Dual-table slot grid — both tables side by side, no reveal gate:
              the calendar defaults to today so the grid is always meaningful. */}
          <div ref={timeRef} style={{ marginBottom: 24 }}>
            {sectionLabel(t("start_time"), "book.time.title")}
            <div
              data-cms-key="book.multi_slot_hint"
              style={{ fontSize: 13, color: tokens.colors.textMuted, marginBottom: 14 }}
            >
              {t("multi_slot_hint")}
            </div>
            <DualTableGrid
              selectedDate={selectedDate}
              daySlots={daySlots}
              dayLoading={dayLoading}
              slotsForDate={slotsForDate}
              totalSelectedHours={totalSelectedHours}
              onToggle={(table, hour) => onToggleSlot(dateStr, table, hour)}
              onResumeLocked={onResumeLocked}
            />
          </div>

          {/* Selected picks — mobile/inline position (desktop shows the same
              card inside the sticky sidebar instead). */}
          <div className="mobile-picks" style={{ marginBottom: 16 }}>
            <SelectedPicksCard runs={runs} removeRun={removeRun} periods={periods} />
          </div>

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

        {/* Desktop sticky sidebar: summary + picks */}
        <div className="desktop-card">
          <SummaryCard
            selectedDate={selectedDate}
            runs={runs}
            total={orderTotal}
            canContinue={canContinue}
            onContinue={onContinue}
            ctaLabel={t("continue")}
            ready={ready}
            periods={periods}
          />
          <div style={{ marginTop: 16 }}>
            <SelectedPicksCard runs={runs} removeRun={removeRun} periods={periods} />
          </div>
        </div>
      </div>

      {/* Mobile sticky price bar */}
      <MobilePriceBar
        ctaLabel={ready ? `${t("continue")} · HK$${orderTotal}` : t("continue")}
        onContinue={onContinue}
        canContinue={canContinue}
      />
    </div>
  )
}

/* ─────────────────────────  Screen 2: Auth  ───────────────────────── */
function Screen2({
  onSuccess,
  runs,
}: {
  onSuccess: () => void
  runs: SelectedBlock[]
}) {
  const t = useTranslations("book")
  const tables = useTables()

  // IKEA effect: name the actual held slot ("07:00–08:00, Table #2") instead
  // of a generic "your slot is held" — the user just made this specific
  // choice, so losing it reads as a bigger loss than losing an abstract one.
  const holdSummary = useMemo(() => {
    const first = runs[0]
    if (!first) return null
    const tableName = tables.find((tb) => tb.id === first.tableNumber)?.name
    return tableName
      ? t("login_subtitle_specific", {
          start: padTime(first.startHour),
          end: padTime(first.startHour + first.duration),
          table: tableName,
        })
      : null
  }, [runs, tables, t])

  // Persist the in-progress booking before any auth redirect (the Google fallback
  // flow leaves the page). On return, BookPage restores this and re-lands on the
  // login step so AuthCard resolves the now-active session. Refreshed on every
  // selection change so a redirect at any moment is covered. Same per-(table,
  // hour) slot-key shape as the durable bookingSelection entry.
  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      const byDate = new Map<string, string[]>()
      for (const r of runs) {
        const list = byDate.get(r.date) ?? []
        for (let h = r.startHour; h < r.startHour + r.duration; h++) {
          list.push(slotKey(r.tableNumber, h))
        }
        byDate.set(r.date, list)
      }
      const entries = Array.from(byDate.entries()).map(([date, slots]) => ({ date, slots }))
      sessionStorage.setItem("pendingBooking", JSON.stringify({ entries }))
    } catch {}
  }, [runs])

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
              style={{ fontSize: 13, color: "rgba(255,255,255,0.7)" }}
            >
              {holdSummary ?? t("login_subtitle")}
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
  blocks,
  onBackToSlots,
  periods,
  promoCode,
  onPromoChange,
  resumeBookingId,
  resumeOrderNo,
}: {
  blocks: SelectedBlock[]
  onBackToSlots?: () => void
  periods: PricingPeriod[]
  promoCode: PromoResult | null
  onPromoChange: (p: PromoResult | null) => void
  resumeBookingId?: string
  resumeOrderNo?: string
}) {
  const t = useTranslations("book")
  const locale = useLocale()

  // Terms-agreement gate
  const [agreedToTerms, setAgreedToTerms] = useState(false)
  const [termsError, setTermsError] = useState(false)
  const [termsShake, setTermsShake] = useState(0)
  const [openModal, setOpenModal] = useState<'venue-rules' | 'terms' | null>(null)
  const termsRef = useRef<HTMLDivElement>(null)
  const flagTermsRequired = useCallback(() => {
    setTermsError(true)
    setTermsShake((n) => n + 1)
    termsRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })
  }, [])

  useEffect(() => {
    if (!openModal) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenModal(null)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [openModal])

  // Admin test mode
  const [isAdmin, setIsAdmin] = useState(false)
  const [testMode, setTestMode] = useState(false)
  const [testConfirming, setTestConfirming] = useState(false)
  const [testError, setTestError] = useState<string | null>(null)

  // KPay payment method selection
  const [kpayMethod, setKpayMethod] = useState<KPayMethod | null>(null)
  const [kpayMode, setKpayMode] = useState<KPayMode>('qr')
  const [showKpayMethods, setShowKpayMethods] = useState(false)
  // Two-step rail choice. `paymentMethod` is the highlighted card; `confirmed`
  // is the commitment that actually creates the order. Tapping a card used to
  // fire the payment immediately, which gave no chance to check the amount or
  // switch rails — the CTA at the bottom is now the only thing that charges.
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodId | null>(null)
  const [confirmed, setConfirmed] = useState(false)
  const [paymentError, setPaymentError] = useState<string | null>(null)

  // ── UAT-only PayMe simulation modal ──────────────────────────────────────
  // Pop-up before checkout to select .81 (success) / .82 (fail) / normal.
  // Only appears for PayMe method — other methods are unaffected.
  const [showPaymeUatModal, setShowPaymeUatModal] = useState(false)

  // ── KPay resume: restore Screen3's internal payment state when the page
  // was refreshed mid-payment. BookPage detected the persisted session and
  // passed the resume identifiers; here we hydrate the payment method state
  // so KPayPayment receives its resume props on first render.
  const resumeHandled = useRef(false)
  useEffect(() => {
    if (!resumeBookingId || resumeHandled.current) return
    resumeHandled.current = true
    try {
      const persisted = readKPayPersistedState()
      if (!persisted) return
      setConfirmed(true)
      setPaymentMethod(persisted.method as PaymentMethodId)
      setKpayMethod(persisted.method as KPayMethod)
      setKpayMode(persisted.mode)
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resumeBookingId])

  // UAT-only: track which PayMe simulation mode was selected (.81/.82/undefined)
  const [paymeUatSim, setPaymeUatSim] = useState<'success' | 'fail' | undefined>(undefined)

  const handleConfirmPay = useCallback(() => {
    if (!agreedToTerms) {
      flagTermsRequired()
      return
    }
    if (!paymentMethod) return
    setPaymentError(null)

    // UAT-only PayMe simulation pop-up before checkout
    if (
      paymentMethod === 'payme' &&
      process.env.NODE_ENV !== 'production'
    ) {
      setShowPaymeUatModal(true)
      return
    }

    setConfirmed(true)
  }, [agreedToTerms, flagTermsRequired, paymentMethod])
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch("/api/booking/admin-test-confirm")
        const { isAdmin: admin } = await res.json()
        if (!cancelled) setIsAdmin(!!admin)
      } catch {}
    })()
    return () => { cancelled = true }
  }, [])

  // Venue line label — display names instead of table numbers
  const tableName = Array.from(new Set(blocks.map((b) => b.tableNumber)))
    .sort()
    .map((tn) => getTableName(tn, locale) ?? `${t("table_label")} #${tn}`)
    .join(" + ")

  const primary = blocks[0]
  const dateStr = primary?.date ?? ""
  const startHour = primary?.startHour ?? 0
  const duration = primary?.duration ?? 0
  const tableNumber = primary?.tableNumber ?? 0

  const total = blocks.reduce((sum, b) => sum + quoteBlockTotal(b.date, b.startHour, b.duration, periods), 0)
  const totalSaved = blocks.reduce(
    (sum, b) => sum + quoteBlockDetail(b.date, b.startHour, b.duration, periods).saved,
    0,
  )

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
    return () => { cancelled = true }
  }, [])

  // Admin test confirm handler
  const handleTestConfirm = useCallback(async () => {
    if (!agreedToTerms) {
      flagTermsRequired()
      return
    }
    setTestConfirming(true)
    setTestError(null)
    try {
      const body = blocks.length > 1
        ? { blocks: blocks.map((b) => ({ date: b.date, startHour: b.startHour, duration: b.duration, tableNumber: b.tableNumber })) }
        : { date: dateStr, startHour, duration, tableNumber }
      const res = await fetch("/api/booking/admin-test-confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) {
        setTestError(json.detail || json.error || "Test booking failed")
        setTestConfirming(false)
        return
      }
      // Navigate to confirmation — same as Stripe redirect return
      window.location.href = `/book?bookingId=${json.primaryBookingId}&redirect_status=succeeded`
    } catch (e) {
      setTestError((e as Error).message)
      setTestConfirming(false)
    }
  }, [blocks, dateStr, startHour, duration, tableNumber, agreedToTerms, flagTermsRequired])

  return (
    <div className={`screen-content${!testMode && !confirmed ? " pay-screen" : ""}`}>
      {/* Back button */}
      {onBackToSlots && (
        <button
          type="button"
          onClick={onBackToSlots}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            minHeight: 44,
            marginBottom: 16,
            padding: 0,
            background: "none",
            border: "none",
            color: tokens.colors.textMuted,
            fontSize: 14,
            cursor: "pointer",
          }}
        >
          <ChevronLeft size={18} />
          {t("back_to_slots")}
        </button>
      )}

      {/* Left-right layout */}
      <div className="checkout-layout">
        {/* ── LEFT: Order Summary ── */}
        <div className="checkout-summary">
          {/* Venue header */}
          <div style={{ marginBottom: 24 }}>
            <div
              data-cms-key="book.pay.venue"
              className="font-label"
              style={{ fontSize: 12, fontWeight: 600, color: tokens.colors.link, marginBottom: 8 }}
            >
              {t("venue") || "SPACE8"}
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 4 }}>
              {tableName}
            </div>
            <div style={{ fontSize: 14, color: tokens.colors.textMuted }}>
              {t("snooker")}
            </div>
          </div>

          {/* Booked slots */}
          <div
            style={{
              background: tokens.colors.depth.flat,
              border: `1px solid ${tokens.colors.border}`,
              borderRadius: tokens.radius.card,
              padding: 24,
              marginBottom: 16,
            }}
          >
            {blocks.map((b) => {
              const [, m, d] = b.date.split("-")
              const detail = quoteBlockDetail(b.date, b.startHour, b.duration, periods)
              const blockEnd = b.startHour + b.duration
              const displayName = getTableName(b.tableNumber, locale) ?? `${t("table_label")} #${b.tableNumber}`
              return (
                <div
                  key={`${b.date}-${b.startHour}-${b.tableNumber}`}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: 16,
                    padding: blocks.length > 1 && blocks.indexOf(b) < blocks.length - 1 ? "0 0 16px" : 0,
                    marginBottom: blocks.length > 1 && blocks.indexOf(b) < blocks.length - 1 ? 16 : 0,
                    borderBottom: blocks.length > 1 && blocks.indexOf(b) < blocks.length - 1 ? `1px solid ${tokens.colors.border}` : "none",
                  }}
                >
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 700, fontVariantNumeric: "tabular-nums", marginBottom: 4 }}>
                      {Number(m)}/{Number(d)} · {padTime(b.startHour)}–{padTime(blockEnd)}{blockEnd >= 24 ? " +1" : ""}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: tokens.colors.textMuted, flexWrap: "wrap" }}>
                      <span>{displayName}</span>
                      <span style={{ color: tokens.colors.textFaint }}>·</span>
                      <span>{b.duration}{t("hours")}</span>
                    </div>
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 700, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
                    {detail.saved > 0 && (
                      <s style={{ fontSize: 14, fontWeight: 400, color: tokens.colors.textFaint, marginRight: 6 }}>HK${detail.baseTotal}</s>
                    )}
                    HK${detail.total}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Contact info */}
          {profile && (profile.name || profile.email || profile.phone) && (
            <div
              style={{
                background: tokens.colors.depth.flat,
                border: `1px solid ${tokens.colors.border}`,
                borderRadius: tokens.radius.card,
                padding: 20,
                marginBottom: 16,
                display: "flex",
                alignItems: "center",
                gap: 14,
              }}
            >
              <div
                style={{
                  width: 42, height: 42, borderRadius: "50%",
                  background: `linear-gradient(135deg, ${tokens.colors.link}, #0f7845)`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontWeight: 700, fontSize: 15, flexShrink: 0,
                }}
              >
                {(profile.name || "?").charAt(0).toUpperCase()}
              </div>
              <div>
                {profile.name && <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 2 }}>{profile.name}</div>}
                {(profile.email || profile.phone) && (
                  <div style={{ fontSize: 13, color: tokens.colors.textMuted }}>
                    {[profile.email, profile.phone].filter(Boolean).join(" · ")}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Price breakdown — NO service fee row */}
          <div
            style={{
              background: tokens.colors.depth.flat,
              border: `1px solid ${tokens.colors.border}`,
              borderRadius: tokens.radius.card,
              padding: 24,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, color: tokens.colors.textMuted, marginBottom: 12 }}>
              <span data-cms-key="book.pay.subtotal">{t("subtotal")}</span>
              <span style={{ color: tokens.colors.text, fontWeight: 500, fontVariantNumeric: "tabular-nums" }}>HK${total + totalSaved}</span>
            </div>
            {totalSaved > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, color: tokens.colors.textMuted, marginBottom: 12 }}>
                <span data-cms-key="book.pay.discount">{t("discount_label")}</span>
                <span style={{ color: "#fff", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>−HK${totalSaved}</span>
              </div>
            )}
            {/* Points earned row */}
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, color: tokens.colors.textMuted, marginBottom: 12 }}>
              <span data-cms-key="book.points_earned_label">{t("points_earned_label")}</span>
              <span style={{ color: tokens.colors.link, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>+{total} {t("points")}</span>
            </div>
            <div style={{ borderTop: `1px dashed ${tokens.colors.borderStrong}`, margin: "16px 0" }} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span style={{ fontSize: 15, fontWeight: 700 }}>{t("total")}</span>
              <span style={{ fontFamily: BEBAS, fontSize: 30, color: tokens.colors.link, fontVariantNumeric: "tabular-nums" }}>
                <span style={{ fontSize: 16, opacity: 0.7, marginRight: 2 }}>HK$</span>{total}
              </span>
            </div>
          </div>

          {/* Trust strip */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 20, fontSize: 12.5, color: tokens.colors.textFaint }}>
            <Lock size={14} style={{ color: tokens.colors.link, flexShrink: 0 }} />
            <span data-cms-key="book.pay.secure">{t("kpay_secure")}</span>
          </div>
        </div>

        {/* ── RIGHT: Payment ── */}
        <div className="checkout-payment">
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>{t("payment_title")}</div>
            <div style={{ fontSize: 13, color: tokens.colors.textMuted }}>{t("payment_subtitle") || "Choose your payment method"}</div>
          </div>

          {/* Admin Test Mode banner */}
          {isAdmin && (
            <div
              style={{
                background: "rgba(255,159,10,0.08)",
                border: "1px solid rgba(255,159,10,0.3)",
                borderRadius: tokens.radius.input,
                padding: "12px 16px",
                marginBottom: 20,
              }}
            >
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  cursor: "pointer",
                  minHeight: 44,
                }}
              >
                <input
                  type="checkbox"
                  checked={testMode}
                  onChange={(e) => setTestMode(e.target.checked)}
                  style={{
                    width: 18, height: 18,
                    accentColor: "#FF9F0A",
                    cursor: "pointer",
                    flexShrink: 0,
                  }}
                />
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 600, color: "#FF9F0A" }}>
                    <AlertTriangle size={16} />
                    TEST · {t("test_mode_label") || "不記入營收"}
                  </div>
                  <div style={{ fontSize: 12, color: tokens.colors.textMuted, marginTop: 2 }}>
                    {t("test_mode_desc") || "直接確認訂單，唔經 Stripe 付款"}
                  </div>
                </div>
              </label>
            </div>
          )}

          {/* Payment method selection — hidden when test mode is active */}
          {!testMode && (
            <>
              {!confirmed ? (
                /* ── PaymentMethodList (full method selector) ── */
                /* Selecting only highlights. The bottom CTA commits. */
                <PaymentMethodList
                  collapsed
                  selected={paymentMethod}
                  onSelect={(method) => {
                    setPaymentError(null)
                    setPaymentMethod(method)
                    const kpayMethods: KPayMethod[] = ['card', 'fps', 'payme', 'octopus', 'alipay', 'alipayhk', 'wechat', 'unionpay_qp']
                    if (kpayMethods.includes(method as KPayMethod)) {
                      setKpayMethod(method as KPayMethod)
                      setKpayMode(isDesktopDevice() ? "qr" : "h5")
                    }
                  }}
                />
              ) : paymentMethod !== null && (['card', 'fps', 'payme', 'octopus', 'alipay', 'alipayhk', 'wechat', 'unionpay_qp'] as const).includes(paymentMethod as any) ? (
                /* ── KPay payment (card via CNP Hosted + all direct-connect methods) ── */
                <>
                  <KPayPayment
                    blocks={blocks.map((b) => ({
                      date: b.date,
                      startHour: b.startHour,
                      duration: b.duration,
                      tableNumber: b.tableNumber as 1 | 2,
                    }))}
                    method={kpayMethod ?? "fps"}
                    mode={kpayMode}
                    agreedToTerms={agreedToTerms}
                    uatPaymeSimulation={paymeUatSim}
                    resumeBookingId={resumeBookingId}
                    resumeOrderNo={resumeOrderNo}
                    labels={{
                      title: t("kpay_title"),
                      pending: t("kpay_qr_scan") || `請用 ${kpayMethod === "fps" ? "FPS 轉數快" : kpayMethod === "payme" ? "PayMe" : kpayMethod === "octopus" ? "八達通" : kpayMethod === "alipay" ? "支付寶" : kpayMethod === "alipayhk" ? "AlipayHK" : kpayMethod === "wechat" ? "微信支付" : kpayMethod === "card" ? "信用卡" : "雲閃付"} 掃描以下二維碼`,
                      pending_desc: t("kpay_pending_desc") || "請在手機上完成付款，二維碼將於 {time} 後過期",
                      pending_confirmation: t("kpay_pending_confirmation") || "確認付款中",
                      pending_confirmation_desc: t("kpay_pending_confirmation_desc") || "系統正在確認你的付款，請稍候…",
                      success: t("kpay_success") || "付款成功",
                      success_desc: t("kpay_success_desc") || "你的預訂已確認",
                      failed: t("kpay_failed") || "付款失敗",
                      failed_desc: t("kpay_failed_desc") || "交易未能完成，請重試或選擇其他付款方式",
                      expired: t("kpay_expired") || "二維碼已過期",
                      expired_desc: t("kpay_expired_desc") || "此二維碼已過期，新二維碼即將自動生成",
                      regenerate: t("kpay_regenerate") || "重新生成",
                      try_again: t("kpay_try_again") || "重試",
                      countdown: t("kpay_countdown") || "二維碼將於 {time} 後過期",
                      help: t("kpay_help") || "需要幫助？",
                      support_whatsapp: t("kpay_support_whatsapp") || "WhatsApp 客服",
                      back_to_methods: t("kpay_back_to_methods") || "返回付款方式",
                      waited: t("kpay_waited") || "已等待 {seconds} 秒",
                      cancelled: t("kpay_cancelled") || "付款已取消",
                      cancelled_desc: t("kpay_cancelled_desc") || "此預訂已取消，已釋放時段。",
                      cancel: t("kpay_cancel") || "取消預訂",
                      processing: t("kpay_processing") || "處理中…",
                      terms_required: t("terms_required_hint"),
                    }}
                    onBackToMethods={() => {
                      // Drop the commitment too, or the list would re-confirm
                      // and charge again on the next render.
                      setConfirmed(false)
                      setPaymentMethod(null)
                    }}
                    onSuccess={(returnedBookingId) => {
                      if (returnedBookingId) {
                        window.location.href = `/book?bookingId=${encodeURIComponent(returnedBookingId)}&redirect_status=returned`
                      }
                    }}
                  />
                  {/* Powered by KPay */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", marginTop: 14, opacity: 0.5 }}>
                    <img src="/logos/kpay-logo.svg" alt="Powered by KPay" style={{ height: 18, width: "auto", display: "block" }} />
                  </div>
                </>
              ) : null}
            </>
          )}

          {/* Test mode: show admin confirm button */}
          {testMode && (
            <div
              style={{
                background: "rgba(255,159,10,0.05)",
                border: "1px solid rgba(255,159,10,0.2)",
                borderRadius: tokens.radius.card,
                padding: 24,
                marginBottom: 20,
              }}
            >
              <div
                data-cms-key="book.pay.test_title"
                style={{ fontSize: 14, fontWeight: 600, color: "#FF9F0A", marginBottom: 8 }}
              >
                {t("test_mode_title") || "管理員測試模式"}
              </div>
              <div style={{ fontSize: 13, color: tokens.colors.textMuted, marginBottom: 16, lineHeight: 1.5 }}>
                {t("test_mode_confirm_detail") || "此訂單會直接標記為已付款，不會產生支付交易。適合開發測試使用。"}
              </div>
              {testError && (
                <div style={{ fontSize: 13, color: tokens.colors.danger, marginBottom: 12, padding: "8px 12px", background: "rgba(255,69,58,0.08)", borderRadius: tokens.radius.input }}>
                  {testError}
                </div>
              )}
              <button
                type="button"
                onClick={handleTestConfirm}
                disabled={testConfirming}
                style={{
                  width: "100%",
                  height: 54,
                  border: "none",
                  borderRadius: tokens.radius.button,
                  background: testConfirming ? "rgba(255,255,255,0.15)" : "#FF9F0A",
                  color: testConfirming ? "rgba(255,255,255,0.6)" : "#000",
                  fontWeight: 700,
                  fontSize: 17,
                  cursor: testConfirming ? "not-allowed" : "pointer",
                  transition: `background ${tokens.duration.fast}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                }}
              >
                {testConfirming ? (
                  <>{t("processing")}</>
                ) : (
                  <>{t("confirm_test_booking") || "TEST 確認訂單"} · HK${total}</>
                )}
              </button>
            </div>
          )}

          {/* Terms agreement */}
          <motion.div
            key={termsShake}
            ref={termsRef}
            animate={termsShake > 0 ? { x: [0, -8, 8, -6, 6, -3, 3, 0] } : false}
            transition={{ duration: 0.45 }}
            style={{
              border: `1px solid ${termsError && !agreedToTerms ? tokens.colors.danger : "transparent"}`,
              borderRadius: tokens.radius.input,
              padding: "8px 10px",
              transition: "border-color 0.2s ease",
              marginBottom: 16,
            }}
          >
            <label
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
                cursor: confirmed ? "default" : "pointer",
                minHeight: 44,
              }}
            >
              <input
                type="checkbox"
                checked={agreedToTerms}
                disabled={confirmed}
                onChange={(e) => {
                  setAgreedToTerms(e.target.checked)
                  if (e.target.checked) setTermsError(false)
                }}
                style={{
                  width: 18,
                  height: 18,
                  marginTop: 1,
                  flexShrink: 0,
                  accentColor: tokens.colors.link,
                  cursor: confirmed ? "default" : "pointer",
                  opacity: confirmed ? 0.7 : 1,
                }}
              />
              <span
                data-cms-key="book.terms_agree"
                style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", lineHeight: 1.5 }}
              >
                {t("terms_agree_prefix")}{" "}
                <button type="button" onClick={() => setOpenModal("venue-rules")} style={legalLinkStyle}>
                  {t("venue_rules_label")}
                </button>
                {" "}{t("terms_agree_connector")}{" "}
                <button type="button" onClick={() => setOpenModal("terms")} style={legalLinkStyle}>
                  {t("terms_label")}
                </button>
              </span>
            </label>
            <div
              data-cms-key={termsError && !agreedToTerms ? "book.terms_required_error" : "book.terms_required_hint"}
              role={termsError && !agreedToTerms ? "alert" : undefined}
              style={{
                fontSize: 12,
                color: termsError && !agreedToTerms ? tokens.colors.danger : tokens.colors.textMuted,
                marginTop: 2,
                paddingLeft: 28,
                lineHeight: 1.5,
              }}
            >
              {termsError && !agreedToTerms ? t("terms_required_error") : t("terms_required_hint")}
            </div>
          </motion.div>

          {openModal && (
            <motion.div
              role="presentation"
              onClick={() => setOpenModal(null)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={modalOverlayStyle}
            >
              <motion.div
                role="dialog"
                aria-modal="true"
                aria-labelledby="checkout-legal-modal-title"
                onClick={(event) => event.stopPropagation()}
                initial={{ opacity: 0, scale: 0.96, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: 12 }}
                transition={{ type: "spring", stiffness: 380, damping: 30 }}
                style={modalStyle}
              >
                <div style={modalHeaderStyle}>
                  <h2 id="checkout-legal-modal-title" style={{ margin: 0, fontSize: 19, fontWeight: 700 }}>
                    {openModal === "venue-rules" ? t("venue_rules_label") : t("terms_label")}
                  </h2>
                  <button type="button" aria-label={t("legal_modal_close")} onClick={() => setOpenModal(null)} style={modalCloseStyle}>×</button>
                </div>
                <div style={modalContentStyle}>
                  <LegalDocumentRenderer
                    document={getLegalDocument("terms", locale as import("@/i18n/routing").Locale)}
                    locale={locale as import("@/i18n/routing").Locale}
                    compact
                  />
                </div>
                <button type="button" onClick={() => setOpenModal(null)} style={modalBottomCloseStyle}>
                  {t("legal_modal_close")}
                </button>
              </motion.div>
            </motion.div>
          )}

          {/* ── UAT-only PayMe simulation modal ─────────────────────────── */}
          {showPaymeUatModal && (
            <motion.div
              role="presentation"
              onClick={() => setShowPaymeUatModal(false)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={modalOverlayStyle}
            >
              <motion.div
                role="dialog"
                aria-modal="true"
                aria-labelledby="payme-uat-modal-title"
                onClick={(event) => event.stopPropagation()}
                initial={{ opacity: 0, scale: 0.96, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: 12 }}
                transition={{ type: "spring", stiffness: 380, damping: 30 }}
                style={{ ...modalStyle, maxHeight: "min(80vh, 520px)" }}
              >
                <div style={modalHeaderStyle}>
                  <h2 id="payme-uat-modal-title" style={{ margin: 0, fontSize: 19, fontWeight: 700 }}>
                    UAT PayMe 模擬
                  </h2>
                  <button type="button" aria-label="Close" onClick={() => setShowPaymeUatModal(false)} style={modalCloseStyle}>×</button>
                </div>
                <div style={{ ...modalContentStyle, padding: "24px 20px 0" }}>
                  <p style={{ color: tokens.colors.textMuted, fontSize: 14, marginBottom: 20 }}>
                    選擇模擬付款結果（僅限測試環境，正式版不受影響）：
                  </p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <button
                      type="button"
                      onClick={() => {
                        setPaymeUatSim('success')
                        setShowPaymeUatModal(false)
                        setConfirmed(true)
                      }}
                      style={{
                        padding: "14px 16px",
                        borderRadius: tokens.radius.button,
                        border: `1px solid ${tokens.colors.borderStrong}`,
                        background: "rgba(0, 200, 83, 0.08)",
                        color: "#00c853",
                        fontWeight: 600,
                        fontSize: 15,
                        cursor: "pointer",
                        textAlign: "left",
                      }}
                    >
                      ✓ 模擬付款成功（金額尾數 .81）
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPaymeUatSim('fail')
                        setShowPaymeUatModal(false)
                        setConfirmed(true)
                      }}
                      style={{
                        padding: "14px 16px",
                        borderRadius: tokens.radius.button,
                        border: `1px solid ${tokens.colors.borderStrong}`,
                        background: "rgba(255, 82, 82, 0.08)",
                        color: "#ff5252",
                        fontWeight: 600,
                        fontSize: 15,
                        cursor: "pointer",
                        textAlign: "left",
                      }}
                    >
                      ✗ 模擬付款失敗（金額尾數 .82）
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPaymeUatSim(undefined)
                        setShowPaymeUatModal(false)
                        setConfirmed(true)
                      }}
                      style={{
                        padding: "14px 16px",
                        borderRadius: tokens.radius.button,
                        border: `1px solid ${tokens.colors.borderStrong}`,
                        background: "transparent",
                        color: tokens.colors.text,
                        fontWeight: 600,
                        fontSize: 15,
                        cursor: "pointer",
                        textAlign: "left",
                      }}
                    >
                      唔使模擬，用正常金額
                    </button>
                  </div>
                </div>
                <button type="button" onClick={() => setShowPaymeUatModal(false)} style={modalBottomCloseStyle}>
                  {t("legal_modal_close")}
                </button>
              </motion.div>
            </motion.div>
          )}

        </div>
      </div>

      {/* ── Sticky confirm-pay CTA ──────────────────────────────────────────
          The final commitment, named after the chosen rail ("以 AlipayHK 付款")
          so the customer sees what they are about to be charged with. Pinned to
          the bottom on phone AND desktop, mirroring the slot-picker's continue
          bar. Hidden once confirmed — from then on the payment component owns
          the screen and has its own actions. */}
      {!testMode && !confirmed && (
        <div className="pay-cta">
          <div className="pay-cta-inner">
            <button
              type="button"
              onClick={handleConfirmPay}
              disabled={!paymentMethod}
              style={{
                width: "100%",
                height: 54,
                border: "none",
                borderRadius: 14,
                background: !paymentMethod ? "rgba(255,255,255,0.15)" : tokens.colors.link,
                color: !paymentMethod ? tokens.colors.textMuted : "#000",
                fontWeight: 700,
                fontSize: 17,
                cursor: !paymentMethod ? "not-allowed" : "pointer",
                transition: `background ${tokens.duration.fast}`,
              }}
            >
              {paymentMethod
                ? `${t("pay_with", { method: paymentMethodLabel(paymentMethod) })} · HK$${total}`
                : t("select_payment_method")}
            </button>
          </div>
        </div>
      )}
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
  humanCode?: string
  /** Universal member identifier — the value encoded in every QR code. */
  memberCode: string
  holderName: string | null
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
  const locale = useLocale()

  useEffect(() => {
    const timer = setTimeout(() => {
      confetti({
        particleCount: 80,
        spread: 70,
        scalar: 0.7,
        shapes: ["star", "circle"],
        origin: { y: 0.6 },
        colors: [tokens.colors.brand, "#ffffff", "#b8f5c9"],
      })
    }, 4200)
    const meteorTimer = setTimeout(() => {
      confetti({
        particleCount: 18,
        startVelocity: 55,
        angle: 55,
        spread: 8,
        scalar: 0.5,
        gravity: 0.4,
        decay: 0.94,
        shapes: ["circle"],
        origin: { x: 0.1, y: 0.15 },
        colors: [tokens.colors.brand, "#ffffff"],
      })
    }, 4800)
    return () => {
      clearTimeout(timer)
      clearTimeout(meteorTimer)
    }
  }, [])

  const firstTicket = tickets[0]

  return (
    <div className="screen-content" style={{ display: "flex", flexDirection: "column", alignItems: "center", minHeight: "calc(100dvh - 80px)", position: "relative", padding: "24px 20px" }}>
      <div style={{ width: "100%", maxWidth: 400, margin: "0 auto" }}>
        <motion.div initial={{ y: "40%", opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ type: "spring", damping: 20, stiffness: 120, duration: 1.2 }} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <img src="/logos/logo-white-horizontal.svg" alt="Space8" style={{ height: 39, width: "auto" }} />
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 500, damping: 20, delay: 1.1 }} style={{ background: tokens.colors.brand, padding: "4px 12px", borderRadius: 999 }}>
            <span data-cms-key="book.ticket.confirmed" style={{ fontSize: 12, fontWeight: 700, color: "#000" }}>{t_ticket("confirmed")}</span>
          </motion.div>
        </motion.div>

        {firstTicket ? (
          <TicketPrinter
            date={firstTicket.date}
            startHour={firstTicket.startHour}
            duration={firstTicket.duration}
            tableNumber={firstTicket.tableNumber}
            bookingRef={firstTicket.bookingRef}
            humanCode={firstTicket.humanCode}
            memberCode={firstTicket.memberCode}
            totalPrice={firstTicket.totalPrice}
            paymentMethod={firstTicket.paymentMethod}
          />
        ) : (
          <div style={{ height: 420 }} />
        )}

        {tickets.length > 1 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 24 }}>
            {tickets.slice(1).map((ticket, i) => (
              <TicketCard
                key={ticket.bookingRef + i}
                date={ticket.date}
                startHour={ticket.startHour}
                duration={ticket.duration}
                tableNumber={ticket.tableNumber}
                bookingRef={ticket.bookingRef}
                humanCode={ticket.humanCode}
                memberCode={ticket.memberCode}
                totalPrice={ticket.totalPrice}
                paymentMethod={ticket.paymentMethod}
              />
            ))}
          </div>
        )}

        <motion.a href="/member" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 4.7, duration: 0.4, ease: [0.16, 1, 0.3, 1] }} data-cms-key="book.ticket.member_cta" style={{ width: "100%", height: 52, display: "flex", alignItems: "center", justifyContent: "center", background: tokens.colors.brand, color: "#000", border: "none", borderRadius: 14, fontSize: 16, fontWeight: 700, cursor: "pointer", marginBottom: 16, textDecoration: "none" }}>
          {t("go_to_member")}
        </motion.a>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 4.9, duration: 0.4 }} style={{ textAlign: "center" }}>
          <button type="button" onClick={() => (window.location.href = "/")} data-cms-key="book.ticket.home" style={{ background: "none", border: "none", color: "rgba(255,255,255,0.6)", fontSize: 14, cursor: "pointer" }}>
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
  date: string
  start_time: string
  end_time: string
  duration_hours: number
  table_number: number
  total_price: number
  payment_method: string | null
  order_group_id: string | null
  human_code?: string
  /** Injected by /api/booking/status — the universal member QR identifier. */
  member_code?: string
  holder_name?: string | null
}

// Shown after an external payment return while the webhook commits the booking.
// Provider success alone remains a checking state; `success` means DB-confirmed.
//
// Every non-success outcome (failed / cancelled / timeout) renders the shared
// PaymentRecoveryScreen, so the customer gets one consistent screen with real
// actions instead of three different dead ends. Timeout notably does NOT offer
// "view order" any more: an unknown provider result must not be presented as a
// completed booking, so the user stays here until they choose.
function ConfirmingPayment({
  reason,
  hold,
  retrying,
  retryError,
  onRetry,
  onBackToSlots,
}: {
  reason: PaymentRecoveryReason | null
  hold: OrderHoldState
  retrying: boolean
  retryError: string | null
  onRetry: () => void
  onBackToSlots: () => void
}) {
  const t = useTranslations("book")

  if (reason) {
    return (
      <PaymentRecoveryScreen
        reason={reason}
        holdActive={hold.active}
        holdExpiresAt={hold.expiresAt}
        retrying={retrying}
        error={retryError}
        onRetry={onRetry}
        onBackToSlots={onBackToSlots}
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
      <LoadingGif />
      <p data-cms-key="book.pay.confirming" style={{ fontSize: 16, color: tokens.colors.text }}>
        {t("confirming")}
      </p>
    </div>
  )
}

/**
 * Stateful wrapper that owns the retry lifecycle so the BookPage root doesn't
 * carry ephemeral retry/retrying state. The retry endpoint calls the DB RPC
 * `retry_payment_failed_booking` and then re-creates the KPay order by
 * redirecting back to /book with the same booking.
 */
function ConfirmingPaymentContainer({
  bookingId,
  reason,
  hold,
  onBackToSlots,
}: {
  bookingId: string
  reason: PaymentRecoveryReason | null
  hold: OrderHoldState
  onBackToSlots: () => void
}) {
  const [retrying, setRetrying] = useState(false)
  const [retryError, setRetryError] = useState<string | null>(null)

  const handleRetry = useCallback(async () => {
    if (retrying) return
    setRetrying(true)
    setRetryError(null)

    try {
      const res = await fetch("/api/checkout/retry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId }),
      })
      const payload: unknown = await res.json().catch(() => null)
      if (!res.ok) {
        const message =
          payload && typeof payload === "object" && !Array.isArray(payload)
            ? (payload as Record<string, unknown>).error
            : undefined
        setRetryError(typeof message === "string" ? message : "Unable to retry payment")
        return
      }

      // RPC succeeded — the booking is reset to `pending` with no provider
      // order. Redirect to /book with the booking ID so the checkout flow
      // picks it up in Mode B (existing bookingId) and creates a fresh KPay
      // order. This full-page nav clears stale component state cleanly.
      const orderGroupId =
        payload && typeof payload === "object" && !Array.isArray(payload)
          ? (payload as Record<string, unknown>).orderGroupId
          : undefined
      try {
        sessionStorage.setItem(
          "kpayRetry",
          JSON.stringify({ bookingId, orderGroupId: orderGroupId ?? null }),
        )
      } catch {}
      window.location.href = `/book?bookingId=${encodeURIComponent(bookingId)}&redirect_status=retry`
    } catch {
      setRetryError("Network error — please try again")
    } finally {
      setRetrying(false)
    }
  }, [bookingId, retrying])

  return (
    <ConfirmingPayment
      reason={reason}
      hold={hold}
      retrying={retrying}
      retryError={retryError}
      onRetry={handleRetry}
      onBackToSlots={onBackToSlots}
    />
  )
}

/* ─────────────────────────  Root  ───────────────────────── */
export default function BookPage() {
  const t = useTranslations("book")
  const router = useRouter()
  const [screen, setScreen] = useState(0)

  // Step labels from i18n so the progress bar matches the page locale
  const STEPS = [
    t("step_select"),
    t("step_login"),
    t("step_payment"),
    t("step_confirm"),
  ]

  const handleBack = useCallback(() => {
    if (screen === 0) {
      router.push("/")
    } else {
      // Step back one section (e.g. login → slot selection) instead of the old
      // leave-confirm dead end — the selection state survives, so backing up
      // is always safe. Leaving the flow entirely stays behind the confirm
      // modal via the browser/home navigation.
      direction.current = -1
      setScreen((s) => Math.max(0, s - 1))
    }
  }, [screen, router])
  const today = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  }, [])
  const [selectedDate, setSelectedDate] = useState<Date>(today)
  // Per-date selection of individual (table, hour) slots — 'T:H' keys — so one
  // order can mix tables. Runs are derived per (date, table) below.
  const [selectedSlotsByDate, setSelectedSlotsByDate] = useState<Map<string, Set<string>>>(new Map())
  const [bookingRef] = useState(() => genRef())
  const [promoCode, setPromoCode] = useState<PromoResult | null>(null)
  const paymentRef = useRef<HTMLDivElement>(null)
  // Stripe and KPay external-return confirmation state.
  const [confirmBookingId, setConfirmBookingId] = useState<string | null>(null)
  const [confirmedBooking, setConfirmedBooking] = useState<ConfirmedBooking | null>(null)
  // Every ticket from the same checkout (order_group_id), primary first — a
  // single-booking order is just a 1-element array (Task 8).
  const [confirmedBookings, setConfirmedBookings] = useState<ConfirmedBooking[]>([])
  const [confirmError, setConfirmError] = useState(false)
  const [confirmRecoveryReason, setConfirmRecoveryReason] = useState<PaymentRecoveryReason | null>(null)
  const confirmResult = useOrderConfirmationPolling(confirmBookingId, Boolean(confirmBookingId) && !confirmError && !confirmRecoveryReason)

  const haptic = useHaptic()

  // One-time prefill from ?date=YYYY-MM-DD&start=HH&duration=N&table=1|2 —
  // used by the AI chat widget's booking handoff link (it can't lock a slot
  // or take payment for an anonymous chat session, so it hands the visitor
  // here with their requested slot pre-selected instead). Availability isn't
  // re-checked here; Screen1's own pruning effect and the lock-on-checkout
  // flow already handle a prefilled slot having been taken in the meantime,
  // same as any manually-selected one.
  const searchParams = useSearchParams()
  useEffect(() => {
    const dateParam = searchParams.get("date")
    const startParam = searchParams.get("start")
    const durationParam = searchParams.get("duration")
    const tableParam = searchParams.get("table")
    if (!dateParam || !/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) return

    const start = Number(startParam)
    const duration = Number(durationParam ?? "1")
    const table = Number(tableParam)
    if (!Number.isInteger(start) || start < CONFIG.openHour || start >= CONFIG.closeHour) return
    if (!Number.isInteger(duration) || duration < 1 || duration > CONFIG.maxHours) return
    if (start + duration > CONFIG.closeHour) return

    const hours = new Set<string>()
    const tn = table === 1 || table === 2 ? table : 1
    for (let h = start; h < start + duration; h++) hours.add(slotKey(tn, h))
    setSelectedSlotsByDate(new Map([[dateParam, hours]]))
    setSelectedDate(new Date(`${dateParam}T00:00:00`))
    // Mount-only: this is a one-shot initial prefill, not a live sync with the URL.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Pre-fill promo code from ?promo= URL param (affiliate / marketing links).
  useEffect(() => {
    const promoParam = searchParams.get("promo")
    if (!promoParam) return
    const code = promoParam.trim().toUpperCase()
    if (!code) return
    // Store the code — it'll be validated when the user reaches the payment
    // screen and enters a total
    sessionStorage.setItem('pendingPromo', code)
  }, [])
  // Clear the pending promo when it's actually applied
  useEffect(() => {
    if (promoCode) sessionStorage.removeItem('pendingPromo')
  }, [promoCode])

  // Toggle one (table, hour) slot on/off for a given date. Deletes the date's
  // map entry entirely when its Set becomes empty, so the map never
  // accumulates empty entries.
  const toggleSlot = useCallback((date: string, table: number, hour: number) => {
    setSelectedSlotsByDate((prev) => {
      const prevSet = prev.get(date) ?? EMPTY_SET
      const nextSet = new Set(prevSet)
      const key = slotKey(table, hour)
      if (nextSet.has(key)) nextSet.delete(key)
      else nextSet.add(key)

      const next = new Map(prev)
      if (nextSet.size === 0) next.delete(date)
      else next.set(date, nextSet)
      return next
    })
  }, [])

  // Prune/update a single date's slot Set via an updater function (used by
  // Screen1's availability-pruning effect).
  const pruneSlotsForDate = useCallback((date: string, updater: (prev: Set<string>) => Set<string>) => {
    setSelectedSlotsByDate((prev) => {
      const prevSet = prev.get(date) ?? EMPTY_SET
      const nextSet = updater(prevSet)
      if (nextSet === prevSet) return prev
      const next = new Map(prev)
      if (nextSet.size === 0) next.delete(date)
      else next.set(date, nextSet)
      return next
    })
  }, [])

  // Remove every slot belonging to one run (its date + table + hour span).
  const removeRun = useCallback((run: SelectedBlock) => {
    haptic.vibrate(8)
    setSelectedSlotsByDate((prev) => {
      const prevSet = prev.get(run.date)
      if (!prevSet) return prev
      const nextSet = new Set(prevSet)
      for (let h = run.startHour; h < run.startHour + run.duration; h++) {
        nextSet.delete(slotKey(run.tableNumber, h))
      }
      const next = new Map(prev)
      if (nextSet.size === 0) next.delete(run.date)
      else next.set(run.date, nextSet)
      return next
    })
  }, [haptic])

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
      const restored = parseSelectionEntries(s.entries)
      if (restored.size > 0) {
        setSelectedSlotsByDate(restored)
        const firstDate = Array.from(restored.keys()).sort()[0]
        const d = new Date(`${firstDate}T00:00:00`)
        if (!Number.isNaN(d.getTime())) setSelectedDate(d)
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── KPay refresh recovery ─────────────────────────────────────────────────
  // On mount, check if there's a persisted KPay session (from a page refresh
  // mid-payment). If found, jump to the payment screen. The actual state
  // restoration (kpayMethod, kpayMode, etc.) happens inside Screen3, which
  // owns that state — here we only handle the screen transition and pass the
  // resume identifiers down.
  const [kpayResumeData, setKpayResumeData] = useState<{ bookingId: string; orderNo: string } | null>(null)
  const kpayRestoreHandled = useRef(false)
  useEffect(() => {
    if (typeof window === "undefined" || kpayRestoreHandled.current) return
    kpayRestoreHandled.current = true
    try {
      const persisted = readKPayPersistedState()
      if (!persisted) return
      setScreen(2)
      setKpayResumeData({
        bookingId: persisted.bookingId,
        orderNo: persisted.providerOrderNo,
      })
      console.log('[Book] KPay session restored from sessionStorage', {
        bookingId: persisted.bookingId,
        method: persisted.method,
      })
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Persist selection whenever there's a real order in progress.
  useEffect(() => {
    if (typeof window === "undefined") return
    if (selectedSlotsByDate.size === 0) return
    try {
      const entries = Array.from(selectedSlotsByDate.entries()).map(([date, slots]) => ({
        date,
        slots: Array.from(slots),
      }))
      sessionStorage.setItem(
        "bookingSelection",
        JSON.stringify({
          entries,
          updatedAt: Date.now(),
        }),
      )
    } catch {}
  }, [selectedSlotsByDate])

  // Clear the persisted selection once a booking is confirmed, so a stale
  // future selection doesn't resurface on the next visit.
  useEffect(() => {
    if (confirmedBooking && typeof window !== "undefined") {
      try {
        sessionStorage.removeItem("bookingSelection")
        sessionStorage.removeItem("pendingBooking")
        clearKPayPersistedState()
      } catch {}
    }
  }, [confirmedBooking])

  // Detect an external payment return. The page reloads after KPay/Stripe
  // navigation, so polling must start here rather than inside the payment form.
  useEffect(() => {
    if (typeof window === "undefined") return
    const params = new URLSearchParams(window.location.search)
    const bId = params.get("bookingId")
    if (!bId || !(params.get("redirect_status") || params.get("payment_intent"))) return

    // Retry path: the user clicked "選擇付款方式" on the recovery screen.
    // handleRetry stored bookingId + orderGroupId in sessionStorage before
    // redirecting. We restore them into kpayResumeData so KPayPayment picks
    // up the existing booking in Mode B and generates a fresh KPay order.
    if (params.get("redirect_status") === "retry") {
      try {
        const raw = sessionStorage.getItem("kpayRetry")
        if (raw) {
          const parsed = JSON.parse(raw) as { bookingId?: string; orderGroupId?: string | null }
          if (parsed.bookingId === bId) {
            setKpayResumeData({
              bookingId: bId,
              orderNo: parsed.orderGroupId ?? "",
            })
            sessionStorage.removeItem("kpayRetry")
          }
        }
      } catch {}
      setConfirmBookingId(bId)
      setConfirmError(false)
      setConfirmRecoveryReason(null)
      direction.current = 1
      setScreen(2)
      return
    }

    // A KPay return is deliberately neutral: only the authenticated status
    // endpoint can decide whether payment failed or the booking was confirmed.
    setConfirmBookingId(bId)
    setConfirmError(false)
    setConfirmRecoveryReason(null)
    setScreen(3)
  }, [])

  // Once the provider-aware poll sees success, load the existing confirmation
  // payload so Screen4 can reuse the established ticket/printer animation.
  useEffect(() => {
    if (!confirmBookingId || confirmResult.status !== "success") return
    let cancelled = false
    const loadConfirmation = async () => {
      try {
        const response = await fetch(`/api/booking/status?bookingId=${encodeURIComponent(confirmBookingId)}`, { cache: "no-store" })
        if (!response.ok) throw new Error("booking status unavailable")
        const payload = await response.json() as { booking?: ConfirmedBooking; bookings?: ConfirmedBooking[] }
        if (cancelled || !payload.booking) return
        setConfirmedBooking(payload.booking)
        setConfirmedBookings(Array.isArray(payload.bookings) && payload.bookings.length > 0 ? payload.bookings : [payload.booking])
      } catch {
        if (!cancelled) setConfirmError(true)
      }
    }
    void loadConfirmation()
    return () => { cancelled = true }
  }, [confirmBookingId, confirmResult.status])

  useEffect(() => {
    const { status } = confirmResult
    if (status === "timeout") setConfirmRecoveryReason("timeout")
    if (status === "failed") setConfirmRecoveryReason("payment_failed")
    if (status === "cancelled") setConfirmRecoveryReason("cancelled")
    // An "expired" provider status maps to the same recovery as "failed" — the
    // QR or redirect session expired, not the slot hold.
    if (status === "expired") setConfirmRecoveryReason("payment_failed")
  }, [confirmResult])

  // Shared availability cache: prefetches today + 7 days so date-switching in
  // Screen1 is instant, and exposes invalidate() for post-payment refresh (Task 4).
  const availability = useAvailabilityCache()
  const monthAvailability = useMonthAvailability()

  // Task 4: once a booking confirms, drop the cached availability for its
  // date(s) and clear the whole selection, so returning to /book in the same
  // session shows the just-booked slot/table as taken — no hard refresh.
  useEffect(() => {
    if (!confirmedBooking) return
    if (confirmedBooking.date) availability.invalidate(confirmedBooking.date)
    for (const date of selectedSlotsByDate.keys()) availability.invalidate(date)
    setSelectedSlotsByDate(new Map())
    // Only react to a new confirmation; availability/selectedSlotsByDate are
    // stable enough here (same reasoning as before).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirmedBooking])

  const activeDateStr = fmtYMD(selectedDate)
  const slotsForActiveDate = selectedSlotsByDate.get(activeDateStr) ?? EMPTY_SET

  // The order = every contiguous run per (date, table) across every date the
  // user has picked slots on, sorted chronologically (mixed-table orders
  // produce separate runs per table).
  const runs: SelectedBlock[] = useMemo(() => {
    const dates = Array.from(selectedSlotsByDate.keys()).sort()
    const out: SelectedBlock[] = []
    for (const date of dates) {
      const slots = selectedSlotsByDate.get(date)
      if (!slots || slots.size === 0) continue
      const hoursByTable = new Map<number, number[]>()
      for (const key of slots) {
        const { table, hour } = parseSlotKey(key)
        const list = hoursByTable.get(table) ?? []
        list.push(hour)
        hoursByTable.set(table, list)
      }
      const dateRuns: SelectedBlock[] = []
      for (const [table, hours] of hoursByTable) {
        dateRuns.push(...groupHoursIntoRuns(hours, date, table))
      }
      dateRuns.sort((a, b) => a.startHour - b.startHour || a.tableNumber - b.tableNumber)
      out.push(...dateRuns)
    }
    return out
  }, [selectedSlotsByDate])

  // Live pricing periods (afternoon/evening/latenight) — read straight from the
  // public `config` table (`pricing_rates` key; RLS allows anon SELECT). Falls
  // back to DEFAULT_PERIODS until this resolves or if it fails, same fallback
  // contract as getConfig().
  const [periods, setPeriods] = useState<PricingPeriod[]>(DEFAULT_PERIODS)
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from("config")
        .select("value")
        .eq("key", "pricing_rates")
        .single()
      const rates = data?.value as Record<string, { base: number; discount: number; timeRange: string }> | null
      if (!cancelled && !error && rates && typeof rates === 'object' && !Array.isArray(rates)) {
        setPeriods(pricingRatesToPeriods(rates))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const orderTotal = runs.reduce((sum, r) => sum + quoteBlockTotal(r.date, r.startHour, r.duration, periods), 0)
  const totalSelectedHours = useMemo(() => {
    let total = 0
    for (const slots of selectedSlotsByDate.values()) total += slots.size
    return total
  }, [selectedSlotsByDate])

  const direction = useRef(1)

  const advance = useCallback(() => {
    direction.current = 1
    setScreen((s) => Math.min(s + 1, 3))
  }, [])

  // Resume a slot the caller already has locked (e.g. an abandoned checkout)
  // instead of re-picking: adopt its date/hour/table into the order state and
  // jump straight to the payment screen. StripePayment's lock-on-mount effect
  // re-locks as the same user, which the RPC treats as a no-op refresh of
  // locked_until — never re-validates as "taken."
  const resumeLockedSlot = useCallback(
    (date: string, startHour: number, duration: number, tableNumber: number) => {
      setSelectedSlotsByDate(() => {
        const slots = new Set<string>()
        for (let h = startHour; h < startHour + duration; h++) slots.add(slotKey(tableNumber, h))
        return new Map([[date, slots]])
      })
      const d = new Date(`${date}T00:00:00`)
      if (!Number.isNaN(d.getTime())) setSelectedDate(d)
      direction.current = 1
      setScreen(2)
    },
    [],
  )

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
      const restored = parseSelectionEntries(state.entries)
      if (restored.size > 0) {
        setSelectedSlotsByDate(restored)
        const firstDate = Array.from(restored.keys()).sort()[0]
        const d = new Date(`${firstDate}T00:00:00`)
        if (!Number.isNaN(d.getTime())) setSelectedDate(d)
      }
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
        position: "relative",
      }}
    >
      {/* Subtle backdrop dust — same treatment as the member dashboard, low
          opacity so it never competes with booking content readability. */}
      <div aria-hidden="true" style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", opacity: 0.35 }}>
        <Starfield />
      </div>
      <div className="book-container" style={{ position: "relative", zIndex: 1 }}>
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
            <ProgressSteps
              steps={STEPS}
              current={screen}
              onStepClick={goToStep}
              currentProgress={screen === 0 && totalSelectedHours > 0 ? 1 : 0}
            />
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
                  selectedDate={selectedDate}
                  setSelectedDate={setSelectedDate}
                  slotsForDate={slotsForActiveDate}
                  onToggleSlot={toggleSlot}
                  onPruneSlots={pruneSlotsForDate}
                  selectedSlotsByDate={selectedSlotsByDate}
                  totalSelectedHours={totalSelectedHours}
                  runs={runs}
                  orderTotal={orderTotal}
                  removeRun={removeRun}
                  onContinue={advance}
                  onResumeLocked={resumeLockedSlot}
                  availability={availability}
                  monthAvailability={monthAvailability}
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
                style={{
                  position: "fixed",
                  inset: 0,
                  zIndex: 120,
                  background: tokens.colors.bg,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  overflow: "auto",
                }}
              >
                <Screen2
                  onSuccess={advance}
                  runs={runs}
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
                  blocks={runs}
                  periods={periods}
                  promoCode={promoCode}
                  onPromoChange={setPromoCode}
                  resumeBookingId={kpayResumeData?.bookingId}
                  resumeOrderNo={kpayResumeData?.orderNo}
                  onBackToSlots={() => {
                    // Refresh availability (the lock may have changed while on
                    // the payment step) but keep the user's selection intact —
                    // going back to slot-select must not reset date/table/time.
                    for (const date of selectedSlotsByDate.keys()) availability.invalidate(date)
                    direction.current = -1
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
                  <ConfirmingPaymentContainer
                    bookingId={confirmBookingId}
                    reason={confirmRecoveryReason}
                    hold={confirmResult.hold}
                    onBackToSlots={() => {
                      setConfirmBookingId(null)
                      setConfirmRecoveryReason(null)
                      setConfirmError(false)
                      direction.current = -1
                      setScreen(0)
                    }}
                  />
                ) : confirmedBooking ? (
                  <Screen4
                    tickets={confirmedBookings.map((b) => ({
                      date: b.date,
                      startHour: parseInt(b.start_time.slice(0, 2), 10),
                      duration: Number(b.duration_hours),
                      tableNumber: b.table_number,
                      bookingRef: b.booking_reference ?? bookingRef,
                      humanCode: b.human_code,
                      memberCode: b.member_code ?? '',
                      holderName: b.holder_name ?? null,
                      totalPrice: b.total_price,
                      paymentMethod: b.payment_method,
                    }))}
                  />
                ) : (
                  // Defensive fallback — the normal flow always sets confirmBookingId
                  // via the Stripe redirect-return effect before screen reaches 3, so
                  // this branch shouldn't render in practice.
                  <Screen4
                    tickets={
                      runs.length > 0
                        ? runs.map((r) => ({
                            date: r.date,
                            startHour: r.startHour,
                            duration: r.duration,
                            tableNumber: r.tableNumber,
                            bookingRef,
                            memberCode: '',
                            holderName: null,
                            totalPrice: quoteBlockTotal(r.date, r.startHour, r.duration, periods),
                          }))
                        : []
                    }
                  />
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>


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
          min-height: 100dvh;
          padding: 24px 16px calc(24px + env(safe-area-inset-bottom, 0px));
        }
        .dual-row {
          display: grid;
          grid-template-columns: 52px 1fr 1fr;
          gap: 4px;
        }
        .skeleton-pulse {
          animation: skeleton-pulse 1.4s ease-in-out infinite;
        }
        @keyframes skeleton-pulse {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }
        @media (min-width: 480px) {
          .dual-row {
            grid-template-columns: 64px 1fr 1fr;
            gap: 6px;
          }
        }
        .checkout-layout {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }
        .checkout-summary {
          flex: 1;
        }
        .checkout-payment {
          flex: 1;
        }
        @media (min-width: 768px) {
          .checkout-layout {
            display: grid;
            grid-template-columns: 1fr 440px;
            gap: 40px;
            align-items: start;
          }
          .checkout-summary {
            position: sticky;
            top: 88px;
            align-self: start;
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
        .mobile-picks {
          display: block;
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

        /* Confirm-pay bar. Same treatment as .mobile-cta but NOT hidden on
           desktop — the commit action stays reachable at the bottom on both,
           so the gesture is identical whichever device the customer books on. */
        .pay-cta {
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
        .pay-cta-inner {
          max-width: 480px;
          margin: 0 auto;
        }
        /* Clear the fixed bar so the trust strip and legal links stay reachable
           rather than sitting under it. Mobile's .screen-content already
           reserves 110px; desktop only reserves 48px, so it needs the offset. */
        .pay-screen {
          padding-bottom: calc(96px + env(safe-area-inset-bottom, 0px));
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
          .mobile-picks {
            display: none;
          }
          .mobile-cta {
            display: none;
          }
        }

        /* ── Room gallery popup ── */
        .gallery-track {
          display: flex;
          flex-direction: row;
          overflow-x: auto;
          scroll-snap-type: x mandatory;
          -webkit-overflow-scrolling: touch;
          scrollbar-width: none;
          background: #000;
          flex: 1;
          min-height: 0;
        }
        .gallery-track::-webkit-scrollbar {
          display: none;
        }
        .gallery-slide {
          flex: 0 0 100%;
          scroll-snap-align: start;
          aspect-ratio: 16 / 11;
          position: relative;
          overflow: hidden;
        }
        .gallery-dots {
          display: flex;
          flex-direction: row;
          justify-content: center;
          gap: 8px;
          padding: 14px 20px 4px;
          flex-shrink: 0;
        }
        .gallery-dot {
          width: 8px;
          height: 8px;
          min-width: 8px;
          min-height: 8px;
          border: none;
          border-radius: 999px;
          padding: 0;
          cursor: pointer;
          transition: background 0.2s;
        }
      `}</style>
    </main>
  )
}
