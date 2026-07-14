"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import {
  Calendar as CalendarIcon,
  ChevronRight,
  ChevronLeft,
  Clock,
  Lock,
} from "lucide-react"
import { tokens } from "@/app/styles/tokens"
import { Button, Card, ProgressSteps, BackButton } from "@/components/ui"
import { LoadingGif } from "@/components/ui/LoadingGif"
import { Starfield } from "@/app/[locale]/Starfield"
import { AuthCard } from "@/components/auth/AuthCard"
import StripePayment from "@/components/checkout/StripePayment"
import { TicketCard } from "@/components/booking/TicketCard"
import { createClient } from "@/lib/supabase/client"
import { useAvailabilityCache } from "@/lib/booking/useAvailabilityCache"
import { useMonthAvailability } from "@/lib/booking/useMonthAvailability"
import {
  ALL_TABLES,
  getHongKongNow,
  groupHoursIntoRuns,
  parseSelectionEntries,
  tableStatesFor,
  type DaySlot,
  type SelectedBlock,
} from "@/lib/booking/slots"
import { BookingCalendar } from "@/components/booking/BookingCalendar"
import { TableSlotGrid } from "@/components/booking/TableSlotGrid"
import { SelectionSidebar } from "@/components/booking/SelectionSidebar"
import { quoteBlockTotal } from "@/lib/pricing"
import { DEFAULT_PERIODS, type PricingPeriod } from "@/lib/data/pricing"
import { useHaptic } from "@/lib/useHaptic"
import { useLocale, useTranslations } from "next-intl"
import { Link, useRouter } from "@/i18n/navigation"
import { useSearchParams } from "next/navigation"
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

// Shared empty-Set sentinel — avoids allocating a fresh object every render
// when a date has no entry in selectedHoursByDate. Never mutated directly;
// every write site copies it into a new Set first.
const EMPTY_SET: Set<number> = new Set()

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
/* ─────────────────────────  Table Select  ───────────────────────── */
type TableInfo = { id: number; name: string; type: string }

function useTables() {
  const t = useTranslations("book")
  return [
    { id: 1, name: `${t("table_label")} #1`, type: t("snooker") },
    { id: 2, name: `${t("table_label")} #2`, type: t("snooker") },
  ]
}

/* ─────────────────────────  Drum Roll Wheel (iOS)  ───────────────────────── */
/* ─────────────────────────  Screen 1: Select  ───────────────────────── */
function Screen1({
  selectedTable,
  selectedDate,
  setSelectedDate,
  hoursForDate,
  onToggleHourOnTable,
  onPruneHours,
  selectedHoursByDate,
  runs,
  orderTotal,
  removeRun,
  onContinue,
  onResumeLocked,
  availability,
  monthAvailability,
  locale,
}: {
  selectedTable: number | null
  selectedDate: Date
  setSelectedDate: (d: Date) => void
  hoursForDate: Set<number>
  onToggleHourOnTable: (date: string, hour: number, tableNumber: number) => void
  onPruneHours: (date: string, updater: (prev: Set<number>) => Set<number>) => void
  selectedHoursByDate: Map<string, Set<number>>
  runs: SelectedBlock[]
  orderTotal: number
  removeRun: (run: SelectedBlock) => void
  onContinue: () => void
  onResumeLocked: (date: string, startHour: number, duration: number, tableNumber: number) => void
  availability: ReturnType<typeof useAvailabilityCache>
  monthAvailability: ReturnType<typeof useMonthAvailability>
  locale: string
}) {
  const dateStr = useMemo(() => {
    const y = selectedDate.getFullYear()
    const m = String(selectedDate.getMonth() + 1).padStart(2, "0")
    const d = String(selectedDate.getDate()).padStart(2, "0")
    return `${y}-${m}-${d}`
  }, [selectedDate])

  const timeRef = useRef<HTMLDivElement>(null)
  const t = useTranslations("book")

  // Read the day's slots from the shared prefetch cache. Synchronous once
  // cached (prefetched week or fetched earlier); out-of-window dates trigger
  // an on-demand fetch and the grid shows a skeleton meanwhile. Fails OPEN.
  const daySlots = availability.getSlots(dateStr)

  useEffect(() => {
    if (availability.getSlots(dateStr) === null && availability.loadingDate !== dateStr) {
      availability.fetchDate(dateStr)
    }
  }, [dateStr, availability])

  // Ensure every OTHER date present in the order (besides the one currently
  // being viewed) is also cached, so table-availability across the whole
  // order can be computed without a stale/missing daySlots gap.
  useEffect(() => {
    for (const date of selectedHoursByDate.keys()) {
      if (date === dateStr) continue
      if (availability.getSlots(date) === null && availability.loadingDate !== date) {
        availability.fetchDate(date)
      }
    }
  }, [selectedHoursByDate, dateStr, availability])

  const dayLoading = daySlots === null && availability.loadingDate === dateStr

  // Prune hours on the viewed date that have since become unavailable (e.g.
  // someone else's hold expired into a booking while this page was open).
  useEffect(() => {
    if (!daySlots) return
    onPruneHours(dateStr, (prevHours) => {
      let changed = false
      const next = new Set(prevHours)
      for (const h of prevHours) {
        const states = tableStatesFor(daySlots, dateStr, h, 1)
        const stillFree = ALL_TABLES.some((tn) => states.get(tn) === "available")
        if (!stillFree) {
          next.delete(h)
          changed = true
        }
      }
      return changed ? next : prevHours
    })
  }, [daySlots, dateStr, onPruneHours])

  const ready = runs.length > 0
  const canContinue = ready

  const datesWithSelections = useMemo(
    () => new Set(selectedHoursByDate.keys()),
    [selectedHoursByDate],
  )

  // Total hours picked across the WHOLE order (every date), for the
  // per-order max-hours cap — not just the hours visible on this date.
  const totalSelectedHours = useMemo(() => {
    let total = 0
    for (const hours of selectedHoursByDate.values()) total += hours.size
    return total
  }, [selectedHoursByDate])

  // Selected hours split per table for the viewed date, so each of
  // TableSlotGrid's two columns only highlights its own picks.
  const selectedHoursPerTable = useMemo(() => {
    const map = new Map<number, Set<number>>()
    if (selectedTable !== null && hoursForDate.size > 0) {
      map.set(selectedTable, hoursForDate)
    }
    return map
  }, [selectedTable, hoursForDate])

  const sectionLabel = (text: string, cmsKey: string) => (
    <div
      data-cms-key={cmsKey}
      style={{
        fontSize: 14,
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
            <BookingCalendar
              selected={selectedDate}
              onSelect={(d) => {
                setSelectedDate(d)
                scrollToRef(timeRef)
                // Deliberately NOT clearing selectedHoursByDate/selectedTable
                // here — cross-date orders must survive a calendar switch.
              }}
              monthAvailability={monthAvailability}
              datesWithSelections={datesWithSelections}
            />
          </div>

          {/* Step 2 — Dual-table slot grid */}
          <div ref={timeRef} style={{ marginBottom: 24 }}>
            {sectionLabel(t("start_time"), "book.time.title")}
            <div
              data-cms-key="book.multi_slot_discount_hint"
              style={{ fontSize: 14, color: tokens.colors.textMuted, marginBottom: 14 }}
            >
              {t("multi_slot_discount_hint")}
            </div>
            <TableSlotGrid
              dateStr={dateStr}
              daySlots={daySlots}
              loading={dayLoading}
              selectedHours={selectedHoursPerTable}
              totalSelectedHours={totalSelectedHours}
              maxHours={CONFIG.maxHours}
              activeTable={selectedTable}
              onToggleHour={(tableNumber, hour) => onToggleHourOnTable(dateStr, hour, tableNumber)}
              onResumeLocked={onResumeLocked}
            />
          </div>

          {/* Hint */}
          <div
            data-cms-key="book.hint"
            style={{
              fontSize: 14,
              color: tokens.colors.textMuted,
              textAlign: "center",
              marginBottom: 16,
            }}
          >
            {t("instant_confirm")}
          </div>
        </div>

        {/* Desktop summary */}
        <div className="desktop-card">
          <SelectionSidebar
            runs={runs}
            totalHours={runs.reduce((sum, r) => sum + r.duration, 0)}
            totalPrice={orderTotal}
            currency={CONFIG.currency}
            ctaLabel={t("continue")}
            ctaDisabled={!canContinue}
            onCta={onContinue}
            onRemoveRun={removeRun}
            locale={locale}
            variant="desktop"
          />
        </div>
      </div>

      {/* Mobile sticky price bar */}
      <div className="mobile-cta">
        <SelectionSidebar
          runs={runs}
          totalHours={runs.reduce((sum, r) => sum + r.duration, 0)}
          totalPrice={orderTotal}
          currency={CONFIG.currency}
          ctaLabel={t("continue")}
          ctaDisabled={!canContinue}
          onCta={onContinue}
          onRemoveRun={removeRun}
          locale={locale}
          variant="mobile"
        />
      </div>
    </div>
  )
}

/* ─────────────────────────  Screen 2: Auth  ───────────────────────── */
function Screen2({
  onSuccess,
  selectedHoursByDate,
  selectedTable,
}: {
  onSuccess: () => void
  selectedHoursByDate: Map<string, Set<number>>
  selectedTable: number | null
}) {
  const t = useTranslations("book")
  const tables = useTables()

  // IKEA effect: name the actual held slot ("07:00–08:00, Table #2") instead
  // of a generic "your slot is held" — the user just made this specific
  // choice, so losing it reads as a bigger loss than losing an abstract one.
  const holdSummary = useMemo(() => {
    const entry = Array.from(selectedHoursByDate.entries())[0]
    if (!entry) return null
    const [, hours] = entry
    if (hours.size === 0) return null
    const sorted = Array.from(hours).sort((a, b) => a - b)
    const startHour = sorted[0]
    const endHour = sorted[sorted.length - 1] + 1
    const tableName = tables.find((tb) => tb.id === selectedTable)?.name
    return tableName
      ? t("login_subtitle_specific", { start: padTime(startHour), end: padTime(endHour), table: tableName })
      : null
  }, [selectedHoursByDate, selectedTable, tables, t])

  // Persist the in-progress booking before any auth redirect (the Google fallback
  // flow leaves the page). On return, BookPage restores this and re-lands on the
  // login step so AuthCard resolves the now-active session. Refreshed on every
  // selection change so a redirect at any moment is covered.
  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      const entries = Array.from(selectedHoursByDate.entries()).map(([date, hours]) => ({
        date,
        hours: Array.from(hours),
      }))
      sessionStorage.setItem(
        "pendingBooking",
        JSON.stringify({
          tableNumber: selectedTable,
          entries,
        }),
      )
    } catch {}
  }, [selectedHoursByDate, selectedTable])

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
              style={{ fontSize: 14, color: "rgba(255,255,255,0.55)" }}
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
  tableName,
  blocks,
  onBackToSlots,
  periods,
}: {
  tableName: string
  blocks: SelectedBlock[]
  onBackToSlots?: () => void
  periods: PricingPeriod[]
}) {
  const t = useTranslations("book")
  const locale = useLocale()

  // Single-block scalars used only for <StripePayment>'s flat-form fallback
  // fields and the single-block summary display below — StripePayment itself
  // already branches on blocks.length > 1 vs a flat single-block body.
  const primary = blocks[0]
  const dateStr = primary?.date ?? ""
  const startHour = primary?.startHour ?? 0
  const duration = primary?.duration ?? 0
  const tableNumber = primary?.tableNumber ?? 0
  const selectedDate = primary ? new Date(`${primary.date}T00:00:00`) : new Date()

  // Order total across every block (grouped, non-contiguous orders sum them).
  const total = blocks.reduce((sum, b) => sum + quoteBlockTotal(b.date, b.startHour, b.duration, periods), 0)
  const endHour = startHour + duration
  const crossDay = endHour >= 24

  // The user is already authenticated + profile_complete by the time they reach
  // this step (Screen2 gates on it), so `users` already has display_name/email/
  // phone — read it once here rather than asking the Payment Element to collect
  // it again. RLS lets a user select their own row via the cookie-bound browser
  // client (same pattern as AuthCard/AccountMenu).
  const [profile, setProfile] = useState<{ name: string; email: string; phone: string } | null>(null)
  // Consent checkbox — must be checked before payment submits (item 八(4)).
  // Defaults unchecked; the user has to actively agree.
  const [consentGiven, setConsentGiven] = useState(false)
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
                      fontSize: 14,
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
            style={{ fontSize: 14, color: tokens.colors.textMuted, marginBottom: profile ? 12 : 16, paddingTop: blocks.length > 1 ? 4 : 0 }}
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
                  <div style={{ fontSize: 14, color: tokens.colors.textMuted }}>
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
            style={{ fontSize: 14, color: tokens.colors.textMuted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 14 }}
          >
            {t("payment_title")}
          </div>

          {/* Consent checkbox — must be checked before payment can submit
              (StripePayment's submit button reads consentGiven). Links to the
              updated /legal page's terms tab. */}
          <label
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 10,
              marginBottom: 16,
              cursor: "pointer",
              userSelect: "none",
            }}
          >
            <input
              type="checkbox"
              checked={consentGiven}
              onChange={(e) => setConsentGiven(e.target.checked)}
              style={{
                width: 18,
                height: 18,
                marginTop: 2,
                flexShrink: 0,
                accentColor: tokens.colors.brand,
                cursor: "pointer",
              }}
            />
            <span style={{ fontSize: 14, color: tokens.colors.text, lineHeight: 1.5 }} data-cms-key="book.consent">
              {t("terms_agree_prefix")}{" "}
              <Link href="/legal?tab=terms" target="_blank" style={{ color: tokens.colors.brand, textDecoration: "underline" }}>
                {t("terms_venue_rules")}
              </Link>{" "}
              {t("terms_and")}{" "}
              <Link href="/legal?tab=terms" target="_blank" style={{ color: tokens.colors.brand, textDecoration: "underline" }}>
                {t("terms_tnc")}
              </Link>
            </span>
          </label>

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
            locale={locale as "en" | "zh-HK" | "zh-CN"}
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
            contactUsLabel={t("contact_us_link")}
            billingDetails={profile ?? undefined}
            onBackToSlots={onBackToSlots}
            backToSlotsLabel={t("back_to_slots")}
            consentGiven={consentGiven}
          />

          {total > 0 && (
            <div
              data-cms-key="book.points_earned"
              style={{
                fontSize: 12,
                color: tokens.colors.textMuted,
                textAlign: "center",
                marginTop: 12,
              }}
            >
              {/* Same base-tier floor as Screen1 — the real signed-in tier
                  multiplier isn't fetched anywhere in this page, so this
                  stays a floor estimate here too rather than a half-accurate
                  number from a new, scope-expanding tier lookup. */}
              {t("points_earned_estimate", { pts: total })}
            </div>
          )}

          <div
            data-cms-key="book.payment_reminder"
            style={{
              fontSize: 14,
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
  humanCode?: string
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
        spread: 70,
        scalar: 0.7,
        shapes: ["star", "circle"],
        origin: { y: 0.6 },
        colors: ["#22c55e", "#ffffff", "#A78BFA"],
      })
    }, 2000)
    // Second, delayed burst: tight angle + high velocity + low spread reads
    // as a shooting star crossing the screen rather than a second identical
    // confetti pop — reinforces the space theme without a new particle system.
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
        colors: ["#ffffff", "#A78BFA"],
      })
    }, 2600)
    return () => {
      clearTimeout(timer)
      clearTimeout(meteorTimer)
    }
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
          <img src={encodeURI("/logos/White Version Hor, Tran 8.png")} alt="Space8" style={{ height: 24, width: "auto" }} />
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
              humanCode={ticket.humanCode}
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
  date: string
  start_time: string
  end_time: string
  duration_hours: number
  table_number: number
  total_price: number
  payment_method: string | null
  order_group_id: string | null
  human_code?: string
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
          <LoadingGif />
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
  const locale = useLocale()
  const router = useRouter()
  const [screen, setScreen] = useState(0)
  // Leave-booking confirm. On step 0 the back arrow exits straight home; on any
  // later step we ask first, since the user has invested effort (and, once the
  // slot-lock RPC ships, a hold may be active).
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false)
  // Screen-transition slide direction — declared early since handleBack (a
  // step-backward navigator) needs to set it too, not just `advance`/`goToStep`.
  const direction = useRef(1)

  // `<` always steps back one screen first (login → time-select, payment →
  // login, etc.) — it must never jump straight past in-progress steps. Only
  // screen 0, where there's nowhere left to step back TO, asks whether to
  // leave the booking outright (a real destructive exit, not a step).
  const handleBack = useCallback(() => {
    if (screen === 0) {
      setShowLeaveConfirm(true)
    } else {
      direction.current = -1
      setScreen((s) => Math.max(0, s - 1))
    }
  }, [screen])
  const today = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  }, [])
  const [selectedDate, setSelectedDate] = useState<Date>(today)
  const [selectedHoursByDate, setSelectedHoursByDate] = useState<Map<string, Set<number>>>(new Map())
  const [selectedTable, setSelectedTable] = useState<number | null>(null)
  // Confirm-before-switch guard for the dual-table grid: tapping the OTHER
  // table's column while the order already has picks on a different table
  // would otherwise silently wipe those picks (a real "很混亂"/confusing
  // complaint — the switch happened with zero warning). Now it's staged here
  // and only applied if the user confirms; declining is a no-op.
  const [pendingTableSwitch, setPendingTableSwitch] = useState<{ date: string; hour: number; tableNumber: number } | null>(null)
  const [bookingRef] = useState(() => genRef())
  const paymentRef = useRef<HTMLDivElement>(null)
  // Stripe redirect-return confirmation state.
  const [confirmBookingId, setConfirmBookingId] = useState<string | null>(null)
  const [confirmedBooking, setConfirmedBooking] = useState<ConfirmedBooking | null>(null)
  // Every ticket from the same checkout (order_group_id), primary first — a
  // single-booking order is just a 1-element array (Task 8).
  const [confirmedBookings, setConfirmedBookings] = useState<ConfirmedBooking[]>([])
  const [confirmError, setConfirmError] = useState(false)

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

    const hours = new Set<number>()
    for (let h = start; h < start + duration; h++) hours.add(h)
    setSelectedHoursByDate(new Map([[dateParam, hours]]))
    setSelectedDate(new Date(`${dateParam}T00:00:00`))
    if (table === 1 || table === 2) setSelectedTable(table)
    // Mount-only: this is a one-shot initial prefill, not a live sync with the URL.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Toggle one hour on/off for a given date. Deletes the date's map entry
  // entirely when its Set becomes empty, so the map never accumulates empty
  // entries.
  const toggleHour = useCallback((date: string, hour: number) => {
    setSelectedHoursByDate((prev) => {
      const prevSet = prev.get(date) ?? EMPTY_SET
      const nextSet = new Set(prevSet)
      if (nextSet.has(hour)) nextSet.delete(hour)
      else nextSet.add(hour)

      const next = new Map(prev)
      if (nextSet.size === 0) next.delete(date)
      else next.set(date, nextSet)
      return next
    })
  }, [])

  // Table-aware toggle for the new dual-table grid: tapping a cell in Table
  // N's column both selects the hour AND implicitly picks table N for the
  // whole order (unchanged single-table-per-order model — see selectedTable
  // above). Tapping the OTHER table's column while the order already has
  // picks on a different table would clear those picks, so it's staged as a
  // pendingTableSwitch and requires explicit confirmation first — silently
  // wiping a user's selections was the exact "混亂" (confusing) complaint.
  const toggleHourOnTable = useCallback(
    (date: string, hour: number, tableNumber: number) => {
      setSelectedTable((prevTable) => {
        if (prevTable !== null && prevTable !== tableNumber) {
          setPendingTableSwitch({ date, hour, tableNumber })
          return prevTable
        }
        toggleHour(date, hour)
        return tableNumber
      })
    },
    [toggleHour],
  )

  const confirmTableSwitch = useCallback(() => {
    if (!pendingTableSwitch) return
    const { date, hour, tableNumber } = pendingTableSwitch
    setSelectedHoursByDate(() => new Map([[date, new Set([hour])]]))
    setSelectedTable(tableNumber)
    setPendingTableSwitch(null)
  }, [pendingTableSwitch])

  const cancelTableSwitch = useCallback(() => setPendingTableSwitch(null), [])

  // Prune/update a single date's hour Set via an updater function (used by
  // Screen1's availability-pruning effect).
  const pruneHoursForDate = useCallback((date: string, updater: (prev: Set<number>) => Set<number>) => {
    setSelectedHoursByDate((prev) => {
      const prevSet = prev.get(date) ?? EMPTY_SET
      const nextSet = updater(prevSet)
      if (nextSet === prevSet) return prev
      const next = new Map(prev)
      if (nextSet.size === 0) next.delete(date)
      else next.set(date, nextSet)
      return next
    })
  }, [])

  // Remove every hour belonging to one run (across whichever date it's on).
  const removeRun = useCallback((run: SelectedBlock) => {
    haptic.vibrate(8)
    setSelectedHoursByDate((prev) => {
      const prevSet = prev.get(run.date)
      if (!prevSet) return prev
      const nextSet = new Set(prevSet)
      for (let h = run.startHour; h < run.startHour + run.duration; h++) nextSet.delete(h)
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
        setSelectedHoursByDate(restored)
        const firstDate = Array.from(restored.keys()).sort()[0]
        const d = new Date(`${firstDate}T00:00:00`)
        if (!Number.isNaN(d.getTime())) setSelectedDate(d)
      }
      if (typeof s.tableNumber === "number") setSelectedTable(s.tableNumber)
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Persist selection whenever there's a real order in progress.
  useEffect(() => {
    if (typeof window === "undefined") return
    if (selectedHoursByDate.size === 0) return
    try {
      const entries = Array.from(selectedHoursByDate.entries()).map(([date, hours]) => ({
        date,
        hours: Array.from(hours),
      }))
      sessionStorage.setItem(
        "bookingSelection",
        JSON.stringify({
          entries,
          tableNumber: selectedTable,
          updatedAt: Date.now(),
        }),
      )
    } catch {}
  }, [selectedHoursByDate, selectedTable])

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

  // Task 4: once a booking confirms, drop the cached availability for its
  // date(s) and clear the whole selection, so returning to /book in the same
  // session shows the just-booked slot/table as taken — no hard refresh.
  useEffect(() => {
    if (!confirmedBooking) return
    if (confirmedBooking.date) availability.invalidate(confirmedBooking.date)
    for (const date of selectedHoursByDate.keys()) availability.invalidate(date)
    setSelectedHoursByDate(new Map())
    setSelectedTable(null)
    // Only react to a new confirmation; availability/selectedHoursByDate are
    // stable enough here (same reasoning as before).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirmedBooking])

  const activeDateStr = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, "0")}-${String(selectedDate.getDate()).padStart(2, "0")}`
  const hoursForActiveDate = selectedHoursByDate.get(activeDateStr) ?? EMPTY_SET

  // The order = every contiguous run across every date the user has picked
  // hours on, sorted chronologically. Empty until a table is chosen (the
  // order is scoped to one global table).
  const runs: SelectedBlock[] = useMemo(() => {
    if (selectedTable === null) return []
    const dates = Array.from(selectedHoursByDate.keys()).sort()
    const out: SelectedBlock[] = []
    for (const date of dates) {
      const hours = selectedHoursByDate.get(date)
      if (!hours || hours.size === 0) continue
      out.push(...groupHoursIntoRuns(hours, date, selectedTable))
    }
    return out
  }, [selectedHoursByDate, selectedTable])

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

  const orderTotal = runs.reduce((sum, r) => sum + quoteBlockTotal(r.date, r.startHour, r.duration, periods), 0)
  const totalSelectedHours = useMemo(() => {
    let total = 0
    for (const hours of selectedHoursByDate.values()) total += hours.size
    return total
  }, [selectedHoursByDate])

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
      setSelectedHoursByDate(() => {
        const hours = new Set<number>()
        for (let h = startHour; h < startHour + duration; h++) hours.add(h)
        return new Map([[date, hours]])
      })
      const d = new Date(`${date}T00:00:00`)
      if (!Number.isNaN(d.getTime())) setSelectedDate(d)
      setSelectedTable(tableNumber)
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
      if (typeof state.tableNumber === "number") setSelectedTable(state.tableNumber)
      const restored = parseSelectionEntries(state.entries)
      if (restored.size > 0) {
        setSelectedHoursByDate(restored)
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
                  selectedTable={selectedTable}
                  selectedDate={selectedDate}
                  setSelectedDate={setSelectedDate}
                  hoursForDate={hoursForActiveDate}
                  onToggleHourOnTable={toggleHourOnTable}
                  onPruneHours={pruneHoursForDate}
                  selectedHoursByDate={selectedHoursByDate}
                  runs={runs}
                  orderTotal={orderTotal}
                  removeRun={removeRun}
                  onContinue={advance}
                  onResumeLocked={resumeLockedSlot}
                  availability={availability}
                  monthAvailability={monthAvailability}
                  locale={locale}
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
                  selectedHoursByDate={selectedHoursByDate}
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
                  tableName={tableName}
                  blocks={runs}
                  periods={periods}
                  onBackToSlots={() => {
                    for (const date of selectedHoursByDate.keys()) availability.invalidate(date)
                    setSelectedHoursByDate(new Map())
                    setSelectedTable(null)
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
                      humanCode: b.human_code,
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

      {/* Table-switch confirm — shown when the user has picks on one table and
          taps a cell on the OTHER table. Space8 only allows one table per
          order, so switching clears the prior picks; this used to happen
          silently (the "混亂"/confusing complaint), so it now requires an
          explicit choice. "Cancel" (stay on current table) is the emphasised
          default. */}
      {pendingTableSwitch && (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 110,
            background: "rgba(0,0,0,0.85)", backdropFilter: "blur(10px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: "24px",
          }}
          onClick={cancelTableSwitch}
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
              data-cms-key="book.switch_table.title"
              style={{ fontSize: 18, fontWeight: 600, color: tokens.colors.text, marginBottom: 8 }}
            >
              {t("switch_table_title")}
            </h3>
            <p
              data-cms-key="book.switch_table.body"
              style={{ fontSize: 14, color: tokens.colors.textMuted, marginBottom: 24 }}
            >
              {t("switch_table_body", { table: pendingTableSwitch.tableNumber })}
            </p>
            <div style={{ display: "flex", gap: 12 }}>
              <button
                type="button"
                onClick={cancelTableSwitch}
                data-cms-key="book.switch_table.cancel"
                style={{
                  flex: 1, height: 48, background: tokens.colors.brand, color: "#000",
                  border: "none", borderRadius: tokens.radius.button,
                  fontWeight: 600, fontSize: 16, cursor: "pointer",
                }}
              >
                {t("switch_table_cancel")}
              </button>
              <button
                type="button"
                onClick={confirmTableSwitch}
                data-cms-key="book.switch_table.confirm"
                style={{
                  flex: 1, height: 48, background: "transparent",
                  color: tokens.colors.text, border: `1px solid ${tokens.colors.border}`,
                  borderRadius: tokens.radius.button, fontWeight: 500, fontSize: 16, cursor: "pointer",
                }}
              >
                {t("switch_table_confirm")}
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
