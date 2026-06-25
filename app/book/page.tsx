"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import {
  Calendar,
  ChevronRight,
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

/* ─────────────────────────  Date Strip  ───────────────────────── */
function DateStrip({
  selected,
  onSelect,
}: {
  selected: Date
  onSelect: (d: Date) => void
}) {
  const dates = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return Array.from({ length: 14 }, (_, i) => {
      const d = new Date(today)
      d.setDate(d.getDate() + i)
      return d
    })
  }, [])

  const dayNames = ["日", "一", "二", "三", "四", "五", "六"]

  return (
    <div
      className="no-scrollbar"
      style={{
        display: "flex",
        gap: "8px",
        overflowX: "auto",
        padding: "4px 0",
        WebkitOverflowScrolling: "touch",
      }}
    >
      {dates.map((date, i) => {
        const isToday = i === 0
        const isSelected = date.toDateString() === selected.toDateString()
        return (
          <button
            key={date.toISOString()}
            type="button"
            onClick={() => onSelect(date)}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "4px",
              padding: "10px 14px",
              borderRadius: tokens.radius.button,
              border: isSelected
                ? "none"
                : isToday
                  ? `1px solid ${tokens.colors.text}`
                  : "1px solid transparent",
              background: isSelected ? tokens.colors.brand : "transparent",
              color: isSelected ? tokens.colors.brandText : tokens.colors.text,
              cursor: "pointer",
              flexShrink: 0,
              transition: `all ${tokens.duration.fast}`,
              minWidth: "52px",
            }}
          >
            <span
              style={{
                fontSize: "11px",
                opacity: isSelected ? 1 : 0.5,
                fontWeight: 500,
              }}
            >
              {dayNames[date.getDay()]}
            </span>
            <span style={{ fontSize: "18px", fontWeight: 600 }}>
              {date.getDate()}
            </span>
            <span style={{ fontSize: "11px", opacity: isSelected ? 1 : 0.5 }}>
              {date.getMonth() + 1}月
            </span>
          </button>
        )
      })}
    </div>
  )
}

/* ─────────────────────────  Drum Roll Wheel  ───────────────────────── */
function DrumWheel({
  items,
  selected,
  onChange,
  loop = false,
  labelFn,
}: {
  items: number[]
  selected: number
  onChange: (val: number) => void
  loop?: boolean
  labelFn?: (val: number) => string
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const haptic = useHaptic()
  const ITEM_H = 44
  const VISIBLE_ITEMS = 5
  const CONTAINER_H = ITEM_H * VISIBLE_ITEMS
  const lastIndexRef = useRef<number>(-1)
  const isResettingRef = useRef(false)

  const displayItems = useMemo(() => {
    if (loop) {
      return [...items, ...items, ...items]
    }
    const pad = Math.floor(VISIBLE_ITEMS / 2)
    const padArr: (number | null)[] = Array(pad).fill(null)
    return [...padArr, ...items.map((i) => i as number | null), ...padArr]
  }, [items, loop])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const idx = loop
      ? items.length + items.indexOf(selected)
      : Math.floor(VISIBLE_ITEMS / 2) + items.indexOf(selected)
    el.scrollTop = idx * ITEM_H
    lastIndexRef.current = items.indexOf(selected)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleScroll = useCallback(() => {
    const el = containerRef.current
    if (!el || isResettingRef.current) return

    const scrollTop = el.scrollTop
    const centerIdx = Math.round(scrollTop / ITEM_H)

    if (loop) {
      const totalLen = items.length
      if (centerIdx < Math.floor(totalLen * 0.5)) {
        isResettingRef.current = true
        el.scrollTop = scrollTop + totalLen * ITEM_H
        requestAnimationFrame(() => {
          isResettingRef.current = false
        })
        return
      }
      if (centerIdx >= Math.floor(totalLen * 2.5)) {
        isResettingRef.current = true
        el.scrollTop = scrollTop - totalLen * ITEM_H
        requestAnimationFrame(() => {
          isResettingRef.current = false
        })
        return
      }
    }

    let itemIdx: number
    if (loop) {
      itemIdx = ((centerIdx % items.length) + items.length) % items.length
    } else {
      itemIdx = centerIdx - Math.floor(VISIBLE_ITEMS / 2)
      if (itemIdx < 0 || itemIdx >= items.length) return
    }

    if (itemIdx !== lastIndexRef.current) {
      lastIndexRef.current = itemIdx
      haptic.vibrate(8)
      onChange(items[itemIdx])
    }
  }, [items, loop, onChange, haptic])

  return (
    <div style={{ position: "relative", height: CONTAINER_H, flex: 1 }}>
      <div
        style={{
          position: "absolute",
          top: "50%",
          transform: "translateY(-50%)",
          left: 0,
          right: 0,
          height: ITEM_H,
          background: tokens.colors.brandDim,
          borderTop: "1px solid rgba(37,211,102,0.3)",
          borderBottom: "1px solid rgba(37,211,102,0.3)",
          borderRadius: "8px",
          pointerEvents: "none",
          zIndex: 1,
        }}
      />
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="no-scrollbar"
        style={{
          height: CONTAINER_H,
          overflowY: "scroll",
          scrollSnapType: "y mandatory",
          WebkitOverflowScrolling: "touch",
          position: "relative",
          zIndex: 2,
        }}
      >
        {displayItems.map((val, idx) => {
          const isCenter = val !== null && val === selected
          return (
            <div
              key={`${val}-${idx}`}
              style={{
                height: ITEM_H,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                scrollSnapAlign: "center",
                fontSize: isCenter ? "20px" : "16px",
                fontWeight: isCenter ? 600 : 400,
                color: tokens.colors.text,
                opacity: isCenter ? 1 : 0.3,
                transition: "all 120ms ease-out",
              }}
            >
              {val !== null ? (labelFn ? labelFn(val) : String(val)) : ""}
            </div>
          )
        })}
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
  selectedDate,
  setSelectedDate,
  startHour,
  setStartHour,
  duration,
  setDuration,
  onContinue,
}: {
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

  return (
    <div className="screen-content">
      <div className="two-col">
        <div className="col-left">
          {/* Date strip */}
          <div style={{ marginBottom: 28 }}>
            <div
              data-cms-key="book.date.title"
              style={{
                fontSize: 13,
                color: tokens.colors.textMuted,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                marginBottom: 14,
              }}
            >
              選擇日期
            </div>
            <DateStrip selected={selectedDate} onSelect={setSelectedDate} />
          </div>

          {/* Drum wheels */}
          <div style={{ marginBottom: 24 }}>
            <div
              data-cms-key="book.time.title"
              style={{
                fontSize: 13,
                color: tokens.colors.textMuted,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                marginBottom: 14,
              }}
            >
              選擇時間
            </div>
            <div style={{ display: "flex", gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontSize: 12,
                    color: tokens.colors.textFaint,
                    textAlign: "center",
                    marginBottom: 8,
                  }}
                >
                  開始時間
                </div>
                <DrumWheel
                  items={startItems}
                  selected={startHour}
                  onChange={setStartHour}
                  loop
                  labelFn={(h) => padTime(h)}
                />
              </div>
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontSize: 12,
                    color: tokens.colors.textFaint,
                    textAlign: "center",
                    marginBottom: 8,
                  }}
                >
                  時長
                </div>
                <DrumWheel
                  items={durationItems}
                  selected={duration}
                  onChange={setDuration}
                  labelFn={(h) => `${h}小時`}
                />
              </div>
            </div>
          </div>

          {/* Time summary */}
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
            <div
              style={{ display: "flex", alignItems: "center", gap: 8 }}
            >
              <Clock size={14} style={{ color: tokens.colors.textMuted }} />
              <span style={{ fontSize: 15 }}>
                {padTime(startHour)} – {padTime(endHour)}
                {crossDay ? " (+1日)" : ""}
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
          canContinue={true}
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
                  fontFamily: BEBAS,
                  fontSize: 18,
                  color: tokens.colors.brand,
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
                height: 52,
                background: "#fff",
                borderRadius: tokens.radius.button,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
                marginBottom: 12,
                border: "none",
                cursor: "pointer",
              }}
            >
              <AppleLogo size={18} color="#000" />
              <span style={{ color: "#000", fontWeight: 600, fontSize: 16 }}>
                以 Apple 登入
              </span>
            </button>

            {/* Google login */}
            <button
              type="button"
              onClick={onSuccess}
              style={{
                width: "100%",
                height: 52,
                background: "#fff",
                borderRadius: tokens.radius.button,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
                marginBottom: 20,
                border: "none",
                cursor: "pointer",
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              <span style={{ color: "#1F1F1F", fontWeight: 500, fontSize: 16 }}>
                以 Google 帳號登入
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
  onSuccess,
}: {
  selectedDate: Date
  startHour: number
  duration: number
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
                <Calendar size={14} style={{ color: tokens.colors.textMuted }} />
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
              香港桌球會 · 枱號 #1
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
  bookingRef,
}: {
  selectedDate: Date
  startHour: number
  duration: number
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
          background: tokens.colors.surface,
          borderRadius: tokens.radius.card,
          border: `1px solid ${tokens.colors.border}`,
          overflow: "hidden",
          position: "relative",
        }}
      >
        {/* Top section */}
        <div style={{ padding: "24px 24px 20px" }}>
          {/* Header row */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
            <img src="/1.svg" alt="248" style={{ height: 24, width: "auto" }} />
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: showContent ? 1 : 0 }}
              transition={{ type: "spring", stiffness: 500, damping: 20, delay: 0.4 }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                background: tokens.colors.brandDim,
                padding: "4px 10px",
                borderRadius: tokens.radius.pill,
              }}
            >
              <CheckCircle size={14} color={tokens.colors.brand} />
              <span style={{ fontSize: 12, fontWeight: 600, color: tokens.colors.brand }}>已確認</span>
            </motion.div>
          </div>

          {/* Time display */}
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 12 }}>
            <span style={{ fontFamily: BEBAS, fontSize: 56, color: tokens.colors.text, lineHeight: 1 }}>
              {padTime(startHour)}
            </span>
            <span style={{ fontSize: 16, color: tokens.colors.textMuted }}>
              → {padTime(endHour)}
            </span>
          </div>

          {/* Date */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <Calendar size={14} style={{ color: tokens.colors.textMuted }} />
            <span style={{ fontSize: 14, color: tokens.colors.textMuted }}>{dateStr}</span>
          </div>

          {/* Venue */}
          <div style={{ fontSize: 13, color: tokens.colors.textFaint }}>
            香港桌球會 · 枱號 #1
          </div>
        </div>

        {/* Perforation line */}
        <div style={{ position: "relative", height: 20 }}>
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
              borderTop: `1px dashed ${tokens.colors.textFaint}`,
            }}
          />
        </div>

        {/* Bottom stub */}
        <div style={{ padding: "16px 24px 24px" }}>
          {/* Info row */}
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
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
              <div style={{ display: "flex", alignItems: "center" }}>
                <VisaLogo className="h-4" />
              </div>
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
              fontSize: 13,
              color: tokens.colors.textMuted,
              letterSpacing: "0.12em",
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
          <Button variant="primary" leftIcon={<CalendarPlus size={16} />} style={{ flex: 1 }}>
            加入日曆
          </Button>
          <Button variant="secondary" leftIcon={<Share2 size={16} />} style={{ flex: 1 }}>
            分享
          </Button>
        </div>
        <div style={{ textAlign: "center", marginTop: 16 }}>
          <Button variant="ghost" onClick={() => window.location.href = "/"}>
            返回主頁
          </Button>
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
  const [bookingRef] = useState(() => genRef())

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
          max-width: 430px;
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
          padding: 76px 20px 100px;
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
