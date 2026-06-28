"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import {
  Calendar as CalendarIcon,
  ChevronRight,
  ChevronLeft,
  Clock,
  MessageCircle,
  Lock,
  Eye,
  EyeOff,
  CheckCircle,
  CalendarPlus,
  Share2,
} from "lucide-react"
import { tokens } from "@/app/styles/tokens"
import { Button, Card, ProgressSteps, Spinner } from "@/components/ui"
import {
  AppleLogo,
  ApplePayLogo,
  GooglePayLogo,
  AlipayLogo,
  WeChatPayLogo,
  VisaLogo,
  MastercardLogo,
} from "@/components/brand"
import { useHaptic } from "@/lib/useHaptic"

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
function formatPhone(d: string) {
  if (d.length <= 4) return d
  return d.slice(0, 4) + " " + d.slice(4)
}

function formatCard(d: string) {
  return d.replace(/(.{4})/g, "$1 ").trim()
}

function formatExpiry(d: string) {
  if (d.length <= 2) return d
  return d.slice(0, 2) + "/" + d.slice(2)
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

/* ─────────────────────────  QR Code  ───────────────────────── */
function QRCode({ data }: { data: string }) {
  const size = 21
  const grid = useMemo(() => {
    const g: boolean[][] = Array.from({ length: size }, () =>
      Array(size).fill(false)
    )
    const drawFinder = (r: number, c: number) => {
      for (let dr = 0; dr < 7; dr++)
        for (let dc = 0; dc < 7; dc++) {
          const border = dr === 0 || dr === 6 || dc === 0 || dc === 6
          const inner = dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4
          g[r + dr][c + dc] = border || inner
        }
    }
    drawFinder(0, 0)
    drawFinder(0, 14)
    drawFinder(14, 0)
    for (let i = 7; i < 14; i++) {
      g[6][i] = i % 2 === 0
      g[i][6] = i % 2 === 0
    }
    let seed = 0
    for (let i = 0; i < data.length; i++)
      seed = (seed * 31 + data.charCodeAt(i)) & 0xffff
    for (let r = 0; r < size; r++)
      for (let c = 0; c < size; c++) {
        if (g[r][c]) continue
        if (r < 7 && c < 7) continue
        if (r < 7 && c >= 14) continue
        if (r >= 14 && c < 7) continue
        seed = (seed * 1103515245 + 12345) & 0x7fffffff
        g[r][c] = (seed >> 16) % 3 === 0
      }
    return g
  }, [data])

  const cellSize = 7
  const totalSize = size * cellSize
  return (
    <svg
      width={totalSize}
      height={totalSize}
      viewBox={`0 0 ${totalSize} ${totalSize}`}
    >
      {grid.map((row, r) =>
        row.map((on, c) =>
          on ? (
            <rect
              key={`${r}-${c}`}
              x={c * cellSize}
              y={r * cellSize}
              width={cellSize}
              height={cellSize}
              fill="#000"
            />
          ) : null
        )
      )}
    </svg>
  )
}

/* ─────────────────────────  Table Select  ───────────────────────── */
type TableInfo = { id: number; name: string; type: string }

const TABLES: TableInfo[] = [
  { id: 1, name: "枱號 #1", type: "英式桌球" },
  { id: 2, name: "枱號 #2", type: "英式桌球" },
]

// TODO: swap to Supabase query — availability keyed by table id for the chosen slot
const tableAvailability: Record<number, boolean> = {
  1: true,
  2: true,
}

function TableSelect({
  selected,
  onSelect,
}: {
  selected: number | null
  onSelect: (id: number) => void
}) {
  return (
    <div>
      <div
        style={{
          display: "grid",
          gap: 12,
        }}
        className="table-grid"
      >
        {TABLES.map((table) => {
          const available = tableAvailability[table.id]
          const isSelected = selected === table.id
          const dotColor = available
            ? tokens.colors.brand
            : tokens.colors.danger
          return (
            <button
              key={table.id}
              type="button"
              disabled={!available}
              onClick={() => available && onSelect(table.id)}
              data-cms-key={`book.table.${table.id}`}
              style={{
                textAlign: "left",
                padding: "20px",
                borderRadius: tokens.radius.card,
                background: tokens.colors.surface,
                border: isSelected
                  ? `1px solid ${tokens.colors.link}`
                  : available
                    ? "1px solid rgba(255,255,255,0.15)"
                    : "1px solid rgba(255,255,255,0.05)",
                boxShadow: isSelected
                  ? `0 0 0 3px rgba(0,113,227,0.25)`
                  : "none",
                opacity: available ? 1 : 0.6,
                cursor: available ? "pointer" : "not-allowed",
                transition: `border-color ${tokens.duration.fast}, box-shadow ${tokens.duration.fast}`,
                minHeight: 44,
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              <div>
                <div style={{ fontSize: 18, fontWeight: 600 }}>
                  {table.name}
                </div>
                <div
                  style={{
                    fontSize: 13,
                    color: tokens.colors.textMuted,
                    marginTop: 2,
                  }}
                >
                  {table.type}
                </div>
              </div>
              <div
                style={{ display: "flex", alignItems: "center", gap: 6 }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: dotColor,
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    fontSize: 13,
                    color: available
                      ? tokens.colors.text
                      : tokens.colors.danger,
                  }}
                >
                  {available ? "現時可預訂" : "此時段已被預訂"}
                </span>
              </div>
              <div
                style={{
                  marginTop: "auto",
                  height: 40,
                  borderRadius: tokens.radius.button,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 14,
                  fontWeight: 600,
                  background: isSelected
                    ? tokens.colors.link
                    : "rgba(255,255,255,0.08)",
                  color: isSelected ? "#fff" : tokens.colors.text,
                }}
              >
                {!available
                  ? "此時段已被預訂"
                  : isSelected
                    ? "已選擇"
                    : "選擇此枱"}
              </div>
            </button>
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
        如所選時段該枱已被預訂，可隨時切換至另一枱
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
                  opacity: isPast ? 0.3 : 1,
                  cursor: isPast ? "default" : "pointer",
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
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ─────────────────────────  Time List  ───────────────────────── */
function TimeList({
  items,
  selected,
  onChange,
  labelFn,
}: {
  items: number[]
  selected: number
  onChange: (val: number) => void
  labelFn: (val: number) => string
}) {
  const haptic = useHaptic()
  return (
    <div
      className="no-scrollbar"
      style={{
        maxHeight: 220,
        overflowY: "auto",
        WebkitOverflowScrolling: "touch",
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}
    >
      {items.map((val) => {
        const isSelected = val === selected
        return (
          <button
            key={val}
            type="button"
            onClick={() => {
              haptic.vibrate(8)
              onChange(val)
            }}
            style={{
              minHeight: 44,
              borderRadius: tokens.radius.button,
              border: "none",
              background: isSelected ? tokens.colors.link : "transparent",
              color: tokens.colors.text,
              opacity: isSelected ? 1 : 0.6,
              fontSize: 16,
              fontWeight: isSelected ? 600 : 400,
              cursor: "pointer",
              textAlign: "center",
              transition: `background ${tokens.duration.fast}, opacity ${tokens.duration.fast}`,
            }}
          >
            {labelFn(val)}
          </button>
        )
      })}
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
}: {
  selectedDate: Date
  startHour: number
  duration: number
  total: number
  canContinue: boolean
  onContinue: () => void
  ctaLabel: string
  loading?: boolean
}) {
  const endHour = startHour + duration
  const crossDay = endHour >= 24

  return (
    <div className="desktop-card">
      <Card variant="elevated" style={{ position: "sticky", top: 24 }}>
        <div
          data-cms-key="book.card.title"
          style={{
            fontSize: 14,
            color: tokens.colors.textMuted,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            marginBottom: 20,
          }}
        >
          你的預約
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
              日期
            </span>
            <span style={{ fontSize: 15, fontWeight: 500 }}>
              {selectedDate.getFullYear()}年{selectedDate.getMonth() + 1}月
              {selectedDate.getDate()}日
            </span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: 14, color: tokens.colors.textMuted }}>
              時段
            </span>
            <span style={{ fontSize: 15, fontWeight: 500 }}>
              {padTime(startHour)} – {padTime(endHour)}
              {crossDay ? " +1日" : ""}
            </span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: 14, color: tokens.colors.textMuted }}>
              時長
            </span>
            <span style={{ fontSize: 15, fontWeight: 500 }}>
              {duration}小時
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
            fontSize: 48,
            textAlign: "center",
            marginBottom: 28,
            color: tokens.colors.brand,
          }}
        >
          HK${total}
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
  setSelectedTable: (id: number) => void
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

  const startItems = useMemo(
    () => Array.from({ length: 24 }, (_, i) => i),
    []
  )
  const durationItems = useMemo(
    () => Array.from({ length: CONFIG.maxHours }, (_, i) => i + 1),
    []
  )

  const selectedTableInfo = TABLES.find((t) => t.id === selectedTable)
  const canContinue = selectedTable !== null

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
          {/* Selected table badge */}
          {selectedTableInfo && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                background: tokens.colors.brandDim,
                border: `1px solid rgba(37,211,102,0.3)`,
                borderRadius: tokens.radius.pill,
                padding: "6px 14px",
                marginBottom: 24,
                fontSize: 13,
                fontWeight: 500,
              }}
            >
              <CheckCircle size={14} color={tokens.colors.brand} />
              {selectedTableInfo.name} · {selectedTableInfo.type}
            </motion.div>
          )}

          {/* Step 1 — Table */}
          <div style={{ marginBottom: 28 }}>
            {sectionLabel("選擇球枱", "book.table.title")}
            <TableSelect
              selected={selectedTable}
              onSelect={(id) => {
                setSelectedTable(id)
              }}
            />
          </div>

          {/* Step 2 — Calendar (revealed after table chosen) */}
          <AnimatePresence>
            {selectedTable !== null && (
              <motion.div
                key="calendar"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                style={{ overflow: "hidden" }}
              >
                <div style={{ marginBottom: 28 }}>
                  {sectionLabel("選擇日期", "book.date.title")}
                  <Calendar
                    selected={selectedDate}
                    onSelect={(d) => {
                      setSelectedDate(d)
                      setDateChosen(true)
                    }}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Step 3 — Time + duration (revealed after date chosen) */}
          <AnimatePresence>
            {selectedTable !== null && dateChosen && (
              <motion.div
                key="time"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                style={{ overflow: "hidden" }}
              >
                <div style={{ marginBottom: 24 }}>
                  <div style={{ display: "flex", gap: 16 }}>
                    <div style={{ flex: 1 }}>
                      {sectionLabel("開始時間", "book.time.title")}
                      <TimeList
                        items={startItems}
                        selected={startHour}
                        onChange={setStartHour}
                        labelFn={(h) => padTime(h)}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      {sectionLabel("時長", "book.duration.title")}
                      <TimeList
                        items={durationItems}
                        selected={duration}
                        onChange={setDuration}
                        labelFn={(h) => `${h}小時`}
                      />
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
                      {crossDay ? " (+1日)" : ""} · {duration}小時
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
            即時確認 · 毋需等候
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
          ctaLabel="繼續預約"
        />
      </div>

      {/* Mobile sticky CTA */}
      <div className="mobile-cta">
        <Button
          variant="primary"
          size="lg"
          fullWidth
          disabled={!canContinue}
          onClick={onContinue}
        >
          繼續預約
        </Button>
      </div>
    </div>
  )
}

/* ─────────────────────────  Screen 2: Auth  ───────────────────────── */
function Screen2({ onSuccess }: { onSuccess: () => void }) {
  const [lockSec, setLockSec] = useState(300)
  const [phone, setPhone] = useState("")
  const [otpSent, setOtpSent] = useState(false)
  const [otp, setOtp] = useState<string[]>(["", "", "", "", "", ""])
  const [resend, setResend] = useState(0)
  const otpRefs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    const id = setInterval(
      () => setLockSec((s) => (s > 0 ? s - 1 : 0)),
      1000
    )
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (!otpSent) return
    setResend(59)
    const id = setInterval(
      () => setResend((s) => (s > 0 ? s - 1 : 0)),
      1000
    )
    return () => clearInterval(id)
  }, [otpSent])

  useEffect(() => {
    if (otpSent) setTimeout(() => otpRefs.current[0]?.focus(), 300)
  }, [otpSent])

  const lockLabel = `${Math.floor(lockSec / 60)}:${String(lockSec % 60).padStart(2, "0")}`
  const phoneComplete = phone.length === 8

  const handleOtp = (i: number, raw: string) => {
    const v = raw.replace(/\D/g, "").slice(-1)
    const next = [...otp]
    next[i] = v
    setOtp(next)
    if (v && i < 5) otpRefs.current[i + 1]?.focus()
    if (v && i === 5 && next.every(Boolean)) setTimeout(onSuccess, 250)
  }

  const handleOtpKey = (i: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otp[i] && i > 0)
      otpRefs.current[i - 1]?.focus()
  }

  return (
    <div className="screen-content">
      <div className="two-col">
        <div className="col-left">
          <div
            style={{
              background: tokens.colors.surface,
              borderRadius: tokens.radius.card,
              border: `1px solid ${tokens.colors.border}`,
              padding: 28,
            }}
          >
            <h2
              data-cms-key="book.auth.title"
              style={{ fontSize: 20, fontWeight: 600, marginBottom: 6 }}
            >
              完成預約
            </h2>
            <p style={{ fontSize: 13, color: tokens.colors.textMuted, marginBottom: 4 }}>
              <span data-cms-key="book.auth.lock">你的時段已暫時鎖定</span>{" "}
              <span
                style={{
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                  fontSize: 16,
                  fontWeight: 600,
                  color: tokens.colors.text,
                }}
              >
                {lockLabel}
              </span>
            </p>
            <div style={{ height: 24 }} />

            {/* Apple login */}
            <button
              type="button"
              onClick={onSuccess}
              style={{
                width: "100%",
                height: 56,
                background: "#000",
                borderRadius: 14,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
                marginBottom: 12,
                border: "1px solid rgba(255,255,255,0.3)",
                cursor: "pointer",
              }}
            >
              <AppleLogo size={20} color="#fff" />
              <span style={{ color: "#fff", fontWeight: 600, fontSize: 16 }}>
                以 Apple 登入
              </span>
            </button>

            {/* Google login */}
            <button
              type="button"
              onClick={onSuccess}
              style={{
                width: "100%",
                height: 56,
                background: "#fff",
                borderRadius: 14,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
                marginBottom: 20,
                border: "none",
                cursor: "pointer",
              }}
            >
              <img
                src="https://developers.google.com/identity/images/g-logo.png"
                alt="Google"
                width={20}
                height={20}
                style={{ display: "block" }}
              />
              <span style={{ color: "#1F1F1F", fontWeight: 500, fontSize: 16 }}>
                以 Google 帳戶登入
              </span>
            </button>

            {/* Divider */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                margin: "0 0 20px",
              }}
            >
              <div
                style={{ flex: 1, height: 1, background: tokens.colors.border }}
              />
              <span
                style={{ fontSize: 13, color: tokens.colors.textMuted }}
              >
                或
              </span>
              <div
                style={{ flex: 1, height: 1, background: tokens.colors.border }}
              />
            </div>

            {/* WhatsApp OTP */}
            <AnimatePresence mode="wait">
              {!otpSent ? (
                <motion.div
                  key="phone"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, x: -16 }}
                  transition={{ duration: 0.25 }}
                >
                  <div
                    className="phone-input-row"
                    style={{
                      height: 52,
                      background: "rgba(255,255,255,0.06)",
                      border: `1px solid ${tokens.colors.borderStrong}`,
                      borderRadius: tokens.radius.button,
                      display: "flex",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        padding: "0 16px",
                        display: "flex",
                        alignItems: "center",
                        background: tokens.colors.brandDim,
                        borderRight: "1px solid rgba(37,211,102,0.3)",
                        color: tokens.colors.brand,
                        fontWeight: 600,
                        fontSize: 15,
                        flexShrink: 0,
                      }}
                    >
                      +852
                    </div>
                    <input
                      value={formatPhone(phone)}
                      onChange={(e) =>
                        setPhone(
                          e.target.value.replace(/\D/g, "").slice(0, 8)
                        )
                      }
                      inputMode="numeric"
                      placeholder="WhatsApp 號碼"
                      style={{
                        flex: 1,
                        background: "transparent",
                        border: "none",
                        outline: "none",
                        color: tokens.colors.text,
                        fontSize: 16,
                        padding: "0 16px",
                        letterSpacing: "0.04em",
                      }}
                    />
                  </div>
                  <AnimatePresence>
                    {phoneComplete && (
                      <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.96 }}
                        transition={{
                          type: "spring",
                          stiffness: 400,
                          damping: 28,
                        }}
                        style={{ marginTop: 14 }}
                      >
                        <Button
                          variant="primary"
                          size="md"
                          fullWidth
                          leftIcon={<MessageCircle size={18} />}
                          onClick={() => setOtpSent(true)}
                        >
                          傳送驗證碼
                        </Button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ) : (
                <motion.div
                  key="otp"
                  initial={{ opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.25 }}
                >
                  <p
                    style={{
                      fontSize: 13,
                      color: tokens.colors.textMuted,
                      marginBottom: 20,
                    }}
                  >
                    驗證碼已傳送至 +852 {formatPhone(phone)}
                  </p>
                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      justifyContent: "center",
                      marginBottom: 20,
                    }}
                  >
                    {otp.map((d, i) => (
                      <input
                        key={i}
                        ref={(el) => {
                          otpRefs.current[i] = el
                        }}
                        value={d}
                        onChange={(e) => handleOtp(i, e.target.value)}
                        onKeyDown={(e) => handleOtpKey(i, e)}
                        inputMode="numeric"
                        maxLength={1}
                        className="otp-input"
                        style={{
                          width: 44,
                          height: 56,
                          border: `1px solid ${tokens.colors.borderStrong}`,
                          borderRadius: 10,
                          background: "rgba(255,255,255,0.04)",
                          color: tokens.colors.text,
                          fontSize: 24,
                          fontWeight: 600,
                          textAlign: "center",
                          outline: "none",
                        }}
                      />
                    ))}
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <span
                      data-cms-key="book.auth.resend"
                      style={{
                        fontSize: 14,
                        color:
                          resend > 0
                            ? tokens.colors.textMuted
                            : tokens.colors.brand,
                        cursor: resend > 0 ? "default" : "pointer",
                      }}
                      onClick={() => resend === 0 && setResend(59)}
                    >
                      {resend > 0 ? `重新傳送 (${resend}s)` : "重新傳送"}
                    </span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Desktop right: same auth content in card */}
        <div className="desktop-card" />
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
  onSuccess,
}: {
  selectedDate: Date
  startHour: number
  duration: number
  tableName: string
  onSuccess: () => void
}) {
  const [cardNum, setCardNum] = useState("")
  const [expiry, setExpiry] = useState("")
  const [cvc, setCvc] = useState("")
  const [cardName, setCardName] = useState("")
  const [showCvc, setShowCvc] = useState(false)
  const [loading, setLoading] = useState(false)

  const total = CONFIG.pricePerHour * duration
  const endHour = startHour + duration
  const crossDay = endHour >= 24

  // TODO: Stripe Payment Intent — connect real payment
  const handlePay = () => {
    setLoading(true)
    setTimeout(onSuccess, 1500)
  }

  const canPay =
    cardNum.length >= 16 &&
    expiry.length >= 4 &&
    cvc.length >= 3 &&
    cardName.length > 0

  const cardBrand = cardNum.startsWith("4")
    ? "visa"
    : cardNum.startsWith("5")
      ? "mastercard"
      : null

  return (
    <div className="screen-content">
      <div className="two-col">
        <div className="col-left">
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
              <span data-cms-key="book.pay.subtotal" style={{ color: tokens.colors.textMuted }}>小計</span>
              <span>HK${total}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, marginBottom: 12 }}>
              <span data-cms-key="book.pay.fee" style={{ color: tokens.colors.textMuted }}>服務費</span>
              <span>HK$0</span>
            </div>
            <div style={{ height: 1, background: tokens.colors.border, marginBottom: 12 }} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span data-cms-key="book.pay.total" style={{ fontSize: 15, fontWeight: 600 }}>總計</span>
              <span style={{ fontFamily: BEBAS, fontSize: 28, color: tokens.colors.brand }}>HK${total}</span>
            </div>
          </Card>

          {/* Payment methods */}
          <div
            data-cms-key="book.pay.method"
            style={{ fontSize: 13, color: tokens.colors.textMuted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 14 }}
          >
            付款方式
          </div>

          {/* Express payments */}
          <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
            <button
              type="button"
              onClick={handlePay}
              style={{
                flex: 1, height: 52, background: "#000",
                border: `1px solid ${tokens.colors.borderStrong}`,
                borderRadius: tokens.radius.button,
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer",
              }}
            >
              <ApplePayLogo />
            </button>
            <button
              type="button"
              onClick={handlePay}
              style={{
                flex: 1, height: 52, background: "#fff",
                border: `1px solid ${tokens.colors.borderStrong}`,
                borderRadius: tokens.radius.button,
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer",
              }}
            >
              <GooglePayLogo />
            </button>
          </div>

          {/* Wallet payments */}
          <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
            <button
              type="button"
              onClick={handlePay}
              style={{
                flex: 1, height: 52,
                border: `1px solid ${tokens.colors.borderStrong}`,
                borderRadius: tokens.radius.button,
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", background: "transparent",
              }}
            >
              <AlipayLogo />
            </button>
            <button
              type="button"
              onClick={handlePay}
              style={{
                flex: 1, height: 52,
                border: `1px solid ${tokens.colors.borderStrong}`,
                borderRadius: tokens.radius.button,
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", background: "transparent",
              }}
            >
              <WeChatPayLogo />
            </button>
          </div>

          {/* Credit card divider */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "0 0 20px" }}>
            <div style={{ flex: 1, height: 1, background: tokens.colors.border }} />
            <span data-cms-key="book.pay.or-card" style={{ fontSize: 13, color: tokens.colors.textMuted }}>或用信用卡</span>
            <div style={{ flex: 1, height: 1, background: tokens.colors.border }} />
          </div>

          {/* Card form */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div
              style={{
                height: 52, background: "rgba(255,255,255,0.06)",
                border: `1px solid ${tokens.colors.border}`,
                borderRadius: tokens.radius.input,
                display: "flex", alignItems: "center", overflow: "hidden",
              }}
              className="pay-input-wrap"
            >
              <input
                value={formatCard(cardNum)}
                onChange={(e) => setCardNum(e.target.value.replace(/\D/g, "").slice(0, 16))}
                inputMode="numeric"
                placeholder="卡號"
                style={{
                  flex: 1, height: "100%", background: "transparent",
                  border: "none", outline: "none", color: tokens.colors.text,
                  fontSize: 16, padding: "0 16px",
                }}
              />
              {cardBrand === "visa" && (
                <div style={{ paddingRight: 12 }}><VisaLogo className="h-5" /></div>
              )}
              {cardBrand === "mastercard" && (
                <div style={{ paddingRight: 12 }}><MastercardLogo className="h-5" /></div>
              )}
            </div>
            <div style={{ display: "flex", gap: 12 }}>
              <input
                value={formatExpiry(expiry)}
                onChange={(e) => setExpiry(e.target.value.replace(/\D/g, "").slice(0, 4))}
                inputMode="numeric"
                placeholder="MM/YY"
                className="pay-input"
                style={{
                  flex: 1, height: 52, background: "rgba(255,255,255,0.06)",
                  border: `1px solid ${tokens.colors.border}`,
                  borderRadius: tokens.radius.input,
                  padding: "0 16px", color: tokens.colors.text, fontSize: 16, outline: "none",
                }}
              />
              <div style={{ position: "relative", width: 100 }}>
                <input
                  value={cvc}
                  onChange={(e) => setCvc(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  inputMode="numeric"
                  placeholder="CVC"
                  type={showCvc ? "text" : "password"}
                  className="pay-input"
                  style={{
                    width: "100%", height: 52, background: "rgba(255,255,255,0.06)",
                    border: `1px solid ${tokens.colors.border}`,
                    borderRadius: tokens.radius.input,
                    padding: "0 16px", paddingRight: 40,
                    color: tokens.colors.text, fontSize: 16, outline: "none",
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowCvc(!showCvc)}
                  style={{
                    position: "absolute", right: 12, top: "50%",
                    transform: "translateY(-50%)", color: tokens.colors.textMuted,
                    background: "none", border: "none", cursor: "pointer",
                  }}
                >
                  {showCvc ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <input
              value={cardName}
              onChange={(e) => setCardName(e.target.value)}
              placeholder="持卡人姓名"
              autoComplete="cc-name"
              className="pay-input"
              style={{
                height: 52, background: "rgba(255,255,255,0.06)",
                border: `1px solid ${tokens.colors.border}`,
                borderRadius: tokens.radius.input,
                padding: "0 16px", color: tokens.colors.text, fontSize: 16, outline: "none", width: "100%",
              }}
            />
          </div>

          {/* Stripe secure */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 14 }}>
            <Lock size={12} style={{ color: tokens.colors.textMuted }} />
            <span data-cms-key="book.pay.secure" style={{ fontSize: 12, color: tokens.colors.textMuted }}>
              以 Stripe 安全加密處理 · 香港
            </span>
          </div>
        </div>

        {/* Desktop summary card */}
        <SummaryCard
          selectedDate={selectedDate}
          startHour={startHour}
          duration={duration}
          total={total}
          canContinue={canPay}
          onContinue={handlePay}
          ctaLabel={`立即付款 · HK$${total}`}
          loading={loading}
        />
      </div>

      {/* Mobile sticky CTA */}
      <div className="mobile-cta">
        <div className="mobile-cta-fade" />
        <Button
          variant="primary"
          size="lg"
          fullWidth
          disabled={!canPay}
          loading={loading}
          onClick={handlePay}
          rightIcon={<ChevronRight size={18} />}
        >
          {`立即付款 · HK$${total}`}
        </Button>
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
}: {
  selectedDate: Date
  startHour: number
  duration: number
  tableName: string
  bookingRef: string
}) {
  const [showContent, setShowContent] = useState(false)
  const confettiRef = useRef<HTMLDivElement>(null)

  const total = CONFIG.pricePerHour * duration
  const endHour = startHour + duration
  const dayNames = ["日", "一", "二", "三", "四", "五", "六"]
  const dateStr = `${selectedDate.getFullYear()}年${selectedDate.getMonth() + 1}月${selectedDate.getDate()}日 星期${dayNames[selectedDate.getDay()]}`

  useEffect(() => {
    const t = setTimeout(() => setShowContent(true), 300)
    return () => clearTimeout(t)
  }, [])

  // Confetti
  useEffect(() => {
    const container = confettiRef.current
    if (!container) return
    const colors = [tokens.colors.brand, "#FFFFFF", tokens.colors.link, "#FFD700", "#FF6B6B"]
    const particles: HTMLDivElement[] = []

    requestAnimationFrame(() => {
      for (let i = 0; i < 80; i++) {
        const el = document.createElement("div")
        const size = 5 + Math.random() * 5
        const color = colors[i % colors.length]
        const dur = 1.2 + Math.random() * 0.8
        const tx = (Math.random() - 0.5) * 400
        const ty = Math.random() * 600
        const rot = Math.random() * 720
        el.style.cssText = `
          position:absolute; width:${size}px; height:${size}px;
          background:${color}; border-radius:2px; left:50%; top:0;
          animation: confetti-fall ${dur}s cubic-bezier(0.16,1,0.3,1) forwards;
          --tx:${tx}px; --ty:${ty}px; --rot:${rot}deg;
        `
        container.appendChild(el)
        particles.push(el)
      }
    })

    const cleanup = setTimeout(() => particles.forEach((p) => p.remove()), 3000)
    return () => {
      clearTimeout(cleanup)
      particles.forEach((p) => p.remove())
    }
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
      <div
        ref={confettiRef}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          pointerEvents: "none",
          overflow: "hidden",
        }}
      />

      {/* Ticket Card */}
      <motion.div
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: showContent ? 1 : 0.96, opacity: showContent ? 1 : 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 25, delay: 0.1 }}
        style={{
          width: "100%",
          maxWidth: 380,
          background: "linear-gradient(145deg, #111111, #1a1a1a)",
          borderRadius: 20,
          border: "1px solid rgba(255,255,255,0.12)",
          overflow: "hidden",
          position: "relative",
        }}
      >
        {/* Top section */}
        <div style={{ padding: "24px 24px 20px" }}>
          {/* Header row */}
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
            <img src="/1.svg" alt="248 Snooker" style={{ height: 24, width: "auto" }} />
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: showContent ? 1 : 0 }}
              transition={{ type: "spring", stiffness: 500, damping: 20, delay: 0.4 }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                background: tokens.colors.brand,
                padding: "4px 10px",
                borderRadius: tokens.radius.pill,
              }}
            >
              <span style={{ fontSize: 12, fontWeight: 700, color: "#000" }}>已確認</span>
            </motion.div>
          </div>

          {/* Time display — large Bebas */}
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
            <span style={{ fontFamily: BEBAS, fontSize: 48, color: tokens.colors.text, lineHeight: 1, letterSpacing: "0.02em" }}>
              {padTime(startHour)}
            </span>
            <span style={{ fontFamily: BEBAS, fontSize: 32, color: tokens.colors.textMuted, lineHeight: 1 }}>
              →
            </span>
            <span style={{ fontFamily: BEBAS, fontSize: 48, color: tokens.colors.text, lineHeight: 1, letterSpacing: "0.02em" }}>
              {padTime(endHour)}
            </span>
          </div>

          {/* Date */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <CalendarIcon size={14} style={{ color: tokens.colors.textMuted }} />
            <span style={{ fontSize: 14, color: tokens.colors.text }}>{dateStr}</span>
          </div>

          {/* Venue */}
          <div style={{ fontSize: 13, color: tokens.colors.textMuted }}>
            248 Snooker · {tableName}
          </div>
        </div>

        {/* Perforation line */}
        <div style={{ position: "relative", height: 20, margin: "16px 0" }}>
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
          {/* Dashed line */}
          <div
            style={{
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
        <div style={{ padding: "16px 24px 24px" }}>
          {/* Info row */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 11, color: tokens.colors.textFaint, marginBottom: 2 }}>時長</div>
              <div style={{ fontSize: 14, fontWeight: 500 }}>{duration}小時</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: tokens.colors.textFaint, marginBottom: 2 }}>已付</div>
              <div style={{ fontSize: 14, fontWeight: 500 }}>HK${total}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: tokens.colors.textFaint, marginBottom: 2 }}>付款</div>
              <img
                src="https://upload.wikimedia.org/wikipedia/commons/4/41/Visa_Logo.png"
                alt="Visa"
                style={{ height: 16, width: "auto", display: "block" }}
              />
            </div>
          </div>

          {/* QR Code */}
          <div
            style={{
              background: "#fff",
              borderRadius: 12,
              padding: 16,
              display: "flex",
              justifyContent: "center",
              marginBottom: 12,
            }}
          >
            <QRCode data={bookingRef} />
          </div>

          {/* Booking ref */}
          <div
            style={{
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              fontSize: 14,
              color: tokens.colors.text,
              letterSpacing: "0.2em",
              textAlign: "center",
              marginBottom: 12,
            }}
          >
            {bookingRef}
          </div>

          {/* Footer text */}
          <div
            style={{
              fontSize: 11,
              color: tokens.colors.textFaint,
              textAlign: "center",
            }}
          >
            請於入場時出示此二維碼 · 24 小時客服
          </div>
        </div>
      </motion.div>

      {/* Actions below ticket */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: showContent ? 1 : 0, y: showContent ? 0 : 16 }}
        transition={{ delay: 0.5, duration: 0.4 }}
        style={{ marginTop: 24, width: "100%", maxWidth: 380 }}
      >
        <div style={{ display: "flex", gap: 12 }}>
          <button
            type="button"
            onClick={handleAddCalendar}
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
              fontSize: 14,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            <CalendarPlus size={16} />
            加入日曆
          </button>
          <button
            type="button"
            onClick={handleShare}
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
              fontSize: 14,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            <Share2 size={16} />
            分享
          </button>
        </div>
        <div style={{ textAlign: "center", marginTop: 16 }}>
          <button
            type="button"
            onClick={() => (window.location.href = "/")}
            style={{
              background: "none",
              border: "none",
              color: tokens.colors.textMuted,
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            返回主頁
          </button>
        </div>
      </motion.div>
    </div>
  )
}

/* ─────────────────────────  Root  ───────────────────────── */
export default function BookPage() {
  const [screen, setScreen] = useState(0)
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

  const tableName =
    TABLES.find((t) => t.id === selectedTable)?.name ?? "枱號 #1"

  const direction = useRef(1)

  const advance = useCallback(() => {
    direction.current = 1
    setScreen((s) => Math.min(s + 1, 3))
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
        {/* Progress */}
        <div className="progress-bar-wrap">
          <ProgressSteps steps={STEPS} current={screen} />
        </div>

        {/* Screen content */}
        <div style={{ position: "relative", overflow: "hidden", flex: 1 }}>
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
                <Screen2 onSuccess={advance} />
              </motion.div>
            )}
            {screen === 2 && (
              <motion.div
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
                  onSuccess={advance}
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
                <Screen4
                  selectedDate={selectedDate}
                  startHour={startHour}
                  duration={duration}
                  tableName={tableName}
                  bookingRef={bookingRef}
                />
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
        }
        .screen-content {
          padding: 76px 16px 100px;
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
        }
        .desktop-card {
          display: none;
        }
        .mobile-cta {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          padding: 16px 24px calc(16px + env(safe-area-inset-bottom, 0px));
          background: linear-gradient(to top, ${tokens.colors.bg} 60%, transparent);
          z-index: 40;
        }
        .mobile-cta-fade {
          position: absolute;
          top: -80px;
          left: 0;
          right: 0;
          height: 80px;
          background: linear-gradient(to top, ${tokens.colors.bg}, transparent);
          pointer-events: none;
        }

        .otp-input:focus {
          border-color: ${tokens.colors.brand} !important;
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
            max-width: 1100px;
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
          .two-col {
            display: grid;
            grid-template-columns: 1fr 360px;
            gap: 48px;
            align-items: start;
          }
          .col-left {
            min-width: 0;
          }
          .desktop-card {
            display: block;
          }
          .mobile-cta {
            display: none;
          }
        }
      `}</style>
    </main>
  )
}
