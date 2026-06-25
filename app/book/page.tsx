"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  MessageCircle,
  Lock,
  Eye,
  EyeOff,
  CheckCircle,
  CalendarPlus,
  Share2,
} from "lucide-react";

/* ─────────────────────────  Design Tokens  ───────────────────────── */
const GREEN = "#25D366";
const GREEN_DIM = "rgba(37,211,102,0.25)";
const GREEN_HOVER = "rgba(37,211,102,0.08)";
const GREEN_BORDER = "rgba(37,211,102,0.4)";
const SURFACE = "#111111";
const BORDER = "1px solid rgba(255,255,255,0.1)";
const BORDER_COLOR = "rgba(255,255,255,0.1)";
const MUTED = "rgba(255,255,255,0.45)";
const SPRING: [number, number, number, number] = [0.16, 1, 0.3, 1];
const BEBAS = "'Bebas Neue', system-ui, sans-serif";
const RATE = 120; // HK$ per session (1hr)

/* ─────────────────────────  Helpers  ───────────────────────── */
const WEEKDAYS = ["一", "二", "三", "四", "五", "六", "日"];
const MONTH_NAMES = [
  "1月","2月","3月","4月","5月","6月",
  "7月","8月","9月","10月","11月","12月",
];

function buildCalendar(year: number, month: number): (Date | null)[] {
  const first = new Date(year, month, 1);
  const lead = (first.getDay() + 6) % 7;
  const days = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < lead; i++) cells.push(null);
  for (let d = 1; d <= days; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function formatPhone(d: string) {
  if (d.length <= 4) return d;
  return `${d.slice(0, 4)} ${d.slice(4)}`;
}

function formatCard(d: string) {
  return d.replace(/(.{4})/g, "$1 ").trim();
}

function formatExpiry(d: string) {
  if (d.length <= 2) return d;
  return `${d.slice(0, 2)}/${d.slice(2)}`;
}

function genRef(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const block = (n: number) => Array.from({ length: n }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  return `248-${block(4)}-${block(4)}`;
}

function dayOfWeek(d: Date): string {
  return ["日","一","二","三","四","五","六"][d.getDay()];
}

/* ─────────────────────────  Unavailable slots (demo)  ───────────────────────── */
const UNAVAILABLE_SLOTS = new Set([3, 7, 11, 15, 19, 22]);

/* ─────────────────────────  QR Code SVG  ───────────────────────── */
function QRCode({ data }: { data: string }) {
  const size = 21;
  const grid = useMemo(() => {
    const g: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));
    // Finder patterns
    const drawFinder = (r: number, c: number) => {
      for (let dr = 0; dr < 7; dr++)
        for (let dc = 0; dc < 7; dc++) {
          const border = dr === 0 || dr === 6 || dc === 0 || dc === 6;
          const inner = dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4;
          g[r + dr][c + dc] = border || inner;
        }
    };
    drawFinder(0, 0);
    drawFinder(0, 14);
    drawFinder(14, 0);
    // Timing
    for (let i = 7; i < 14; i++) {
      g[6][i] = i % 2 === 0;
      g[i][6] = i % 2 === 0;
    }
    // Data based on ref
    let seed = 0;
    for (let i = 0; i < data.length; i++) seed = (seed * 31 + data.charCodeAt(i)) & 0xffff;
    for (let r = 0; r < size; r++)
      for (let c = 0; c < size; c++) {
        if (g[r][c]) continue;
        if (r < 7 && c < 7) continue;
        if (r < 7 && c >= 14) continue;
        if (r >= 14 && c < 7) continue;
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        g[r][c] = (seed >> 16) % 3 === 0;
      }
    return g;
  }, [data]);

  const cellSize = 8;
  const totalSize = size * cellSize;
  return (
    <svg width={totalSize} height={totalSize} viewBox={`0 0 ${totalSize} ${totalSize}`}>
      {grid.map((row, r) =>
        row.map((on, c) =>
          on ? <rect key={`${r}-${c}`} x={c * cellSize} y={r * cellSize} width={cellSize} height={cellSize} fill="#000" /> : null
        )
      )}
    </svg>
  );
}

/* ─────────────────────────  Progress Bar  ───────────────────────── */
const STEPS = ["選擇時段", "登入", "付款", "確認"];

function ProgressBar({ current }: { current: number }) {
  return (
    <div className="progress-bar">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", position: "relative" }}>
        {/* connecting line */}
        <div aria-hidden style={{ position: "absolute", top: 5, left: 20, right: 20, height: 2, background: "rgba(255,255,255,0.1)" }} />
        <div aria-hidden style={{ position: "absolute", top: 5, left: 20, height: 2, background: current > 0 ? "#fff" : GREEN, width: `${(current / 3) * (100 - 12)}%`, transition: "width 400ms cubic-bezier(0.16,1,0.3,1)" }} />
        {STEPS.map((label, i) => (
          <div key={label} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, position: "relative", zIndex: 1 }}>
            <div
              style={{
                width: 10, height: 10, borderRadius: "50%",
                background: i < current ? "#fff" : i === current ? GREEN : "transparent",
                border: i > current ? "1.5px solid rgba(255,255,255,0.2)" : "none",
                transition: "all 300ms cubic-bezier(0.16,1,0.3,1)",
              }}
            />
            <span
              data-cms-key={`book.progress.${i}`}
              style={{ fontSize: 10, color: i === current ? "#fff" : MUTED, transition: "color 300ms", whiteSpace: "nowrap" }}
            >
              {label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────────  Desktop Summary Card  ───────────────────────── */
function SummaryCard({
  selectedDate, selectedTime, canContinue, onContinue, ctaLabel,
}: {
  selectedDate: Date | null;
  selectedTime: string | null;
  canContinue: boolean;
  onContinue: () => void;
  ctaLabel: string;
}) {
  return (
    <div className="desktop-card">
      <div style={{ background: SURFACE, borderRadius: 20, border: BORDER, padding: 28 }}>
        <div data-cms-key="book.card.title" style={{ fontSize: 14, color: MUTED, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 20 }}>
          你的預約
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: 14, color: MUTED }}>日期</span>
            <span style={{ fontSize: 15, fontWeight: 500 }}>
              {selectedDate ? `${selectedDate.getFullYear()}年${selectedDate.getMonth() + 1}月${selectedDate.getDate()}日` : "—"}
            </span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: 14, color: MUTED }}>時段</span>
            <span style={{ fontSize: 15, fontWeight: 500 }}>
              {selectedTime ? `${selectedTime} – ${String(Number(selectedTime.split(":")[0]) + 1).padStart(2, "0")}:00` : "—"}
            </span>
          </div>
        </div>
        <div style={{ height: 1, background: "rgba(255,255,255,0.08)", marginBottom: 24 }} />
        <div style={{ fontFamily: BEBAS, fontSize: 48, textAlign: "center", marginBottom: 28, color: "#fff" }}>
          HK${RATE}
        </div>
        <motion.button
          type="button"
          whileTap={canContinue ? { scale: 0.97 } : undefined}
          onClick={() => canContinue && onContinue()}
          disabled={!canContinue}
          style={{
            width: "100%", height: 56, background: canContinue ? GREEN : GREEN_DIM,
            borderRadius: 14, color: canContinue ? "#000" : "rgba(0,0,0,0.4)",
            fontSize: 17, fontWeight: 700, cursor: canContinue ? "pointer" : "default",
            transition: "background 200ms, color 200ms",
          }}
        >
          <span data-cms-key="book.card.cta">{ctaLabel}</span>
        </motion.button>
      </div>
    </div>
  );
}

/* ─────────────────────────  Screen 1: Select  ───────────────────────── */
function Screen1({
  selectedDate, setSelectedDate, selectedTime, setSelectedTime, onContinue,
}: {
  selectedDate: Date | null;
  setSelectedDate: (d: Date) => void;
  selectedTime: string | null;
  setSelectedTime: (t: string) => void;
  onContinue: () => void;
}) {
  const today = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d; }, []);
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const cells = useMemo(() => buildCalendar(viewYear, viewMonth), [viewYear, viewMonth]);

  const canGoPrev = viewYear > today.getFullYear() || (viewYear === today.getFullYear() && viewMonth > today.getMonth());
  const goMonth = (delta: number) => {
    let m = viewMonth + delta, y = viewYear;
    if (m < 0) { m = 11; y--; } else if (m > 11) { m = 0; y++; }
    setViewYear(y); setViewMonth(m);
  };

  const canContinue = selectedDate !== null && selectedTime !== null;
  const endTime = selectedTime ? `${String(Number(selectedTime.split(":")[0]) + 1).padStart(2, "0")}:00` : "";

  return (
    <div className="screen-content">
      <div className="two-col">
        <div className="col-left">
          {/* Calendar */}
          <div style={{ marginBottom: 28 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
              <button type="button" onClick={() => canGoPrev && goMonth(-1)} disabled={!canGoPrev} aria-label="上個月" style={{ width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center", opacity: canGoPrev ? 1 : 0.25, color: "#fff" }}>
                <ChevronLeft size={20} />
              </button>
              <span style={{ fontSize: 18, fontWeight: 600 }}>{viewYear}年{MONTH_NAMES[viewMonth]}</span>
              <button type="button" onClick={() => goMonth(1)} aria-label="下個月" style={{ width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}>
                <ChevronRight size={20} />
              </button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", marginBottom: 8 }}>
              {WEEKDAYS.map(w => (
                <div key={w} style={{ textAlign: "center", fontSize: 11, color: MUTED, fontWeight: 600, letterSpacing: "0.04em" }}>{w}</div>
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", rowGap: 4 }}>
              {cells.map((date, i) => {
                if (!date) return <div key={`e-${i}`} />;
                const isPast = date < today;
                const isToday = sameDay(date, today);
                const isSelected = selectedDate && sameDay(date, selectedDate);
                return (
                  <div key={date.toISOString()} style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "2px 0" }}>
                    <motion.button
                      type="button"
                      disabled={isPast}
                      onClick={() => setSelectedDate(date)}
                      whileTap={!isPast ? { scale: 0.92 } : undefined}
                      style={{
                        width: 44, height: 44, borderRadius: "50%",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 15, fontWeight: isSelected ? 700 : 400,
                        cursor: isPast ? "default" : "pointer",
                        opacity: isPast ? 0.2 : 1,
                        pointerEvents: isPast ? "none" : "auto",
                        background: isSelected ? GREEN : "transparent",
                        color: isSelected ? "#000" : "#fff",
                        border: isToday && !isSelected ? "1px solid rgba(255,255,255,0.7)" : "1px solid transparent",
                        transition: "background 200ms, color 200ms",
                      }}
                    >
                      {date.getDate()}
                    </motion.button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Time Grid */}
          <AnimatePresence>
            {selectedDate && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                transition={{ duration: 0.38, ease: SPRING }}
              >
                <div data-cms-key="book.slots.title" style={{ fontSize: 13, color: MUTED, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 14 }}>
                  選擇時段
                </div>
                <div className="time-grid">
                  {Array.from({ length: 24 }, (_, i) => {
                    const label = `${String(i).padStart(2, "0")}:00`;
                    const unavailable = UNAVAILABLE_SLOTS.has(i);
                    const selected = selectedTime === label;
                    return (
                      <motion.button
                        key={label}
                        type="button"
                        disabled={unavailable}
                        onClick={() => !unavailable && setSelectedTime(label)}
                        whileTap={!unavailable ? { scale: 0.95 } : undefined}
                        style={{
                          height: 52, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 15, fontWeight: selected ? 700 : 400, cursor: unavailable ? "default" : "pointer",
                          background: selected ? GREEN : unavailable ? "rgba(255,255,255,0.03)" : "transparent",
                          border: selected ? `1px solid ${GREEN}` : "1px solid rgba(255,255,255,0.12)",
                          color: selected ? "#000" : unavailable ? "rgba(255,255,255,0.2)" : "#fff",
                          textDecoration: unavailable ? "line-through" : "none",
                          pointerEvents: unavailable ? "none" : "auto",
                          transition: "background 150ms, border-color 150ms, color 150ms",
                        }}
                        onMouseEnter={(e) => { if (!unavailable && !selected) { e.currentTarget.style.background = GREEN_HOVER; e.currentTarget.style.borderColor = GREEN_BORDER; } }}
                        onMouseLeave={(e) => { if (!unavailable && !selected) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)"; } }}
                      >
                        {label}
                      </motion.button>
                    );
                  })}
                </div>

                {/* Summary pill */}
                <AnimatePresence>
                  {canContinue && selectedDate && selectedTime && (
                    <motion.div
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 12 }}
                      transition={{ duration: 0.3, ease: SPRING }}
                      style={{
                        marginTop: 16, background: SURFACE, border: BORDER, borderRadius: 12,
                        padding: "14px 20px", display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 8,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <Calendar size={14} style={{ color: MUTED }} />
                        <span style={{ fontSize: 14 }}>{selectedDate.getFullYear()}年{selectedDate.getMonth() + 1}月{selectedDate.getDate()}日 星期{dayOfWeek(selectedDate)}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <Clock size={14} style={{ color: MUTED }} />
                        <span style={{ fontSize: 14 }}>{selectedTime} – {endTime}</span>
                      </div>
                      <div style={{ width: "100%", textAlign: "right" }}>
                        <span style={{ fontFamily: BEBAS, fontSize: 22, color: GREEN }}>HK${RATE}</span>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Desktop right card */}
        <SummaryCard
          selectedDate={selectedDate}
          selectedTime={selectedTime}
          canContinue={canContinue}
          onContinue={onContinue}
          ctaLabel="繼續預約"
        />
      </div>

      {/* Mobile sticky CTA */}
      <div className="mobile-cta">
        <motion.button
          type="button"
          whileTap={canContinue ? { scale: 0.97 } : undefined}
          animate={canContinue ? { scale: [1, 1.02, 1] } : undefined}
          transition={canContinue ? { repeat: Infinity, duration: 2, ease: "easeInOut" } : undefined}
          onClick={() => canContinue && onContinue()}
          disabled={!canContinue}
          style={{
            width: "100%", height: 56, background: canContinue ? GREEN : GREEN_DIM,
            borderRadius: 14, color: canContinue ? "#000" : "rgba(0,0,0,0.4)",
            fontSize: 17, fontWeight: 700, cursor: canContinue ? "pointer" : "default",
          }}
        >
          <span data-cms-key="book.cta.continue">繼續預約</span>
        </motion.button>
      </div>
    </div>
  );
}

/* ─────────────────────────  Screen 2: Auth  ───────────────────────── */
function Screen2({
  selectedDate, selectedTime, onSuccess, onBack,
}: {
  selectedDate: Date | null;
  selectedTime: string | null;
  onSuccess: () => void;
  onBack: () => void;
}) {
  const [lockSec, setLockSec] = useState(300);
  const [phone, setPhone] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState<string[]>(["","","","","",""]);
  const [resend, setResend] = useState(0);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    const id = setInterval(() => setLockSec(s => s > 0 ? s - 1 : 0), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!otpSent) return;
    setResend(59);
    const id = setInterval(() => setResend(s => s > 0 ? s - 1 : 0), 1000);
    return () => clearInterval(id);
  }, [otpSent]);

  useEffect(() => {
    if (otpSent) setTimeout(() => otpRefs.current[0]?.focus(), 300);
  }, [otpSent]);

  const lockLabel = `${Math.floor(lockSec / 60)}:${String(lockSec % 60).padStart(2, "0")}`;
  const phoneComplete = phone.length === 8;

  const handleOtp = (i: number, raw: string) => {
    const v = raw.replace(/\D/g, "").slice(-1);
    const next = [...otp]; next[i] = v; setOtp(next);
    if (v && i < 5) otpRefs.current[i + 1]?.focus();
    if (v && i === 5 && next.every(Boolean)) setTimeout(onSuccess, 250);
  };
  const handleOtpKey = (i: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otp[i] && i > 0) otpRefs.current[i - 1]?.focus();
  };

  const authContent = (
    <div>
      <h2 data-cms-key="book.auth.title" style={{ fontSize: 20, fontWeight: 600, marginBottom: 6 }}>完成預約</h2>
      <p style={{ fontSize: 13, color: MUTED, marginBottom: 4 }}>
        <span data-cms-key="book.auth.lock">你的時段已暫時鎖定</span>{" "}
        <span style={{ fontFamily: BEBAS, fontSize: 18, color: GREEN }}>{lockLabel}</span>
      </p>
      <div style={{ height: 24 }} />

      {/* Apple */}
      <button type="button" onClick={onSuccess} style={{ width: "100%", height: 52, background: "#fff", borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 12 }}>
        <svg width="20" height="20" viewBox="0 0 814 1000" aria-hidden>
          <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105-37.5-155.5-105L159 829.5C74.5 714.4 0 544.1 0 382.8c0-250.7 163.1-383.8 324.1-383.8 85.5 0 156.6 56.5 209.8 56.5 50.7 0 133.5-60 232.1-60 37.2 0 139.5 3.2 209.8 112.1zm-209.5-228.8c39.5-46.8 67.8-112.1 67.8-177.4 0-9-1.3-18.1-1.9-22.5-64.4 2.6-140.5 43.5-185.9 97.3-35.9 41.5-70.6 106.8-70.6 173.1 0 9.7 1.9 19.4 2.6 22.5 4.5.6 11.6 1.9 18.7 1.9 58.1 0 130.4-38.6 169.3-94.9z" fill="#000"/>
        </svg>
        <span style={{ color: "#000", fontWeight: 600, fontSize: 16 }}>以 Apple 登入</span>
      </button>

      {/* Google */}
      <button type="button" onClick={onSuccess} style={{ width: "100%", height: 52, background: "#fff", borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 20 }}>
        <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
        </svg>
        <span style={{ color: "#1F1F1F", fontWeight: 500, fontSize: 16 }}>以 Google 帳號登入</span>
      </button>

      {/* Divider */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "0 0 20px" }}>
        <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.1)" }} />
        <span style={{ fontSize: 13, color: MUTED }}>或</span>
        <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.1)" }} />
      </div>

      {/* WhatsApp */}
      <AnimatePresence mode="wait">
        {!otpSent ? (
          <motion.div key="phone" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.25 }}>
            <div style={{ height: 52, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 14, display: "flex", overflow: "hidden" }} className="phone-input-row">
              <div style={{ padding: "0 16px", display: "flex", alignItems: "center", background: "rgba(37,211,102,0.1)", borderRight: "1px solid rgba(37,211,102,0.3)", color: GREEN, fontWeight: 600, fontSize: 15, flexShrink: 0 }}>+852</div>
              <input
                value={formatPhone(phone)}
                onChange={e => setPhone(e.target.value.replace(/\D/g, "").slice(0, 8))}
                inputMode="numeric"
                placeholder="WhatsApp 號碼"
                style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "#fff", fontSize: 16, padding: "0 16px", letterSpacing: "0.04em" }}
              />
            </div>
            <AnimatePresence>
              {phoneComplete && (
                <motion.button
                  type="button"
                  initial={{ opacity: 0, y: 10, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.96 }}
                  transition={{ type: "spring", stiffness: 400, damping: 28 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setOtpSent(true)}
                  style={{ width: "100%", height: 52, background: GREEN, borderRadius: 14, color: "#000", fontSize: 16, fontWeight: 700, marginTop: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
                >
                  <MessageCircle size={18} />
                  <span data-cms-key="book.auth.send">傳送驗證碼</span>
                </motion.button>
              )}
            </AnimatePresence>
          </motion.div>
        ) : (
          <motion.div key="otp" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.25 }}>
            <p style={{ fontSize: 13, color: MUTED, marginBottom: 20 }}>驗證碼已傳送至 +852 {formatPhone(phone)}</p>
            <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 20 }}>
              {otp.map((d, i) => (
                <input
                  key={i}
                  ref={el => { otpRefs.current[i] = el; }}
                  value={d}
                  onChange={e => handleOtp(i, e.target.value)}
                  onKeyDown={e => handleOtpKey(i, e)}
                  inputMode="numeric"
                  maxLength={1}
                  className="otp-input"
                  style={{ width: 44, height: 56, border: "1px solid rgba(255,255,255,0.2)", borderRadius: 10, background: "rgba(255,255,255,0.04)", color: "#fff", fontSize: 24, fontWeight: 600, textAlign: "center", outline: "none" }}
                />
              ))}
            </div>
            <div style={{ textAlign: "center" }}>
              <span
                data-cms-key="book.auth.resend"
                style={{ fontSize: 14, color: resend > 0 ? MUTED : GREEN, cursor: resend > 0 ? "default" : "pointer" }}
                onClick={() => resend === 0 && setResend(59)}
              >
                {resend > 0 ? `重新傳送 (${resend}s)` : "重新傳送"}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  return (
    <div className="screen-content">
      <div className="two-col">
        <div className="col-left">
          {/* Mobile: sheet overlay */}
          <div className="auth-mobile-only">
            {authContent}
          </div>
        </div>
        {/* Desktop: show in right card */}
        <div className="desktop-card">
          <div style={{ background: SURFACE, borderRadius: 20, border: BORDER, padding: 28 }}>
            {authContent}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────  Screen 3: Payment  ───────────────────────── */
function Screen3({
  selectedDate, selectedTime, onSuccess,
}: {
  selectedDate: Date | null;
  selectedTime: string | null;
  onSuccess: () => void;
}) {
  const [cardNum, setCardNum] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvc, setCvc] = useState("");
  const [cardName, setCardName] = useState("");
  const [showCvc, setShowCvc] = useState(false);
  const [loading, setLoading] = useState(false);

  const endTime = selectedTime ? `${String(Number(selectedTime.split(":")[0]) + 1).padStart(2, "0")}:00` : "";

  const handlePay = () => {
    setLoading(true);
    setTimeout(onSuccess, 1500);
  };

  const canPay = cardNum.length >= 16 && expiry.length >= 4 && cvc.length >= 3 && cardName.length > 0;

  const inputStyle: React.CSSProperties = {
    height: 52, background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.1)", borderRadius: 14,
    padding: "0 16px", color: "#fff", fontSize: 16, outline: "none", width: "100%",
  };

  return (
    <div className="screen-content">
      <div className="two-col">
        <div className="col-left">
          {/* Order summary */}
          <div style={{ background: SURFACE, borderRadius: 16, border: BORDER, padding: "20px 24px", marginBottom: 24 }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Calendar size={14} style={{ color: MUTED }} />
                <span style={{ fontSize: 14 }}>{selectedDate ? `${selectedDate.getMonth() + 1}月${selectedDate.getDate()}日` : ""}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Clock size={14} style={{ color: MUTED }} />
                <span style={{ fontSize: 14 }}>{selectedTime} – {endTime}</span>
              </div>
            </div>
            <div data-cms-key="book.pay.venue" style={{ fontSize: 13, color: MUTED, marginBottom: 16 }}>香港桌球會 · 枱號 #1</div>
            <div style={{ height: 1, background: "rgba(255,255,255,0.08)", marginBottom: 12 }} />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, marginBottom: 8 }}>
              <span data-cms-key="book.pay.subtotal" style={{ color: MUTED }}>小計</span><span>HK${RATE}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, marginBottom: 12 }}>
              <span data-cms-key="book.pay.fee" style={{ color: MUTED }}>服務費</span><span>HK$0</span>
            </div>
            <div style={{ height: 1, background: "rgba(255,255,255,0.08)", marginBottom: 12 }} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span data-cms-key="book.pay.total" style={{ fontSize: 15, fontWeight: 600 }}>總計</span>
              <span style={{ fontFamily: BEBAS, fontSize: 28, color: GREEN }}>HK${RATE}</span>
            </div>
          </div>

          {/* Payment form */}
          <div data-cms-key="book.pay.method" style={{ fontSize: 13, color: MUTED, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 14 }}>付款方式</div>

          {/* Express */}
          <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
            <button type="button" onClick={handlePay} style={{ flex: 1, height: 52, background: "#000", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 14, color: "#fff", fontSize: 15, fontWeight: 500, display: "flex", alignItems: "center", justifyContent: "center" }}>
              Apple Pay
            </button>
            <button type="button" onClick={handlePay} style={{ flex: 1, height: 52, background: "#000", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 14, color: "#fff", fontSize: 15, fontWeight: 500, display: "flex", alignItems: "center", justifyContent: "center" }}>
              G Pay
            </button>
          </div>

          {/* Divider */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "0 0 20px" }}>
            <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.1)" }} />
            <span data-cms-key="book.pay.or-card" style={{ fontSize: 13, color: MUTED }}>或用信用卡</span>
            <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.1)" }} />
          </div>

          {/* Card inputs */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <input
              value={formatCard(cardNum)}
              onChange={e => setCardNum(e.target.value.replace(/\D/g, "").slice(0, 16))}
              inputMode="numeric"
              placeholder="卡號"
              className="pay-input"
              style={inputStyle}
            />
            <div style={{ display: "flex", gap: 12 }}>
              <input
                value={formatExpiry(expiry)}
                onChange={e => setExpiry(e.target.value.replace(/\D/g, "").slice(0, 4))}
                inputMode="numeric"
                placeholder="MM/YY"
                className="pay-input"
                style={{ ...inputStyle, flex: 1 }}
              />
              <div style={{ position: "relative", width: 100 }}>
                <input
                  value={cvc}
                  onChange={e => setCvc(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  inputMode="numeric"
                  placeholder="CVC"
                  type={showCvc ? "text" : "password"}
                  className="pay-input"
                  style={{ ...inputStyle, paddingRight: 40 }}
                />
                <button type="button" onClick={() => setShowCvc(!showCvc)} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: MUTED }}>
                  {showCvc ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <input
              value={cardName}
              onChange={e => setCardName(e.target.value)}
              placeholder="持卡人姓名"
              autoComplete="cc-name"
              className="pay-input"
              style={inputStyle}
            />
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 14 }}>
            <Lock size={12} style={{ color: MUTED }} />
            <span data-cms-key="book.pay.secure" style={{ fontSize: 12, color: MUTED }}>以 Stripe 安全加密處理</span>
          </div>
        </div>

        {/* Desktop right */}
        <div className="desktop-card">
          <div style={{ background: SURFACE, borderRadius: 20, border: BORDER, padding: 28 }}>
            <div data-cms-key="book.pay.card-title" style={{ fontSize: 14, color: MUTED, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 20 }}>訂單</div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, marginBottom: 8 }}><span>日期</span><span>{selectedDate ? `${selectedDate.getMonth() + 1}月${selectedDate.getDate()}日` : ""}</span></div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, marginBottom: 8 }}><span>時段</span><span>{selectedTime} – {endTime}</span></div>
            <div style={{ height: 1, background: "rgba(255,255,255,0.08)", margin: "16px 0" }} />
            <div style={{ fontFamily: BEBAS, fontSize: 48, textAlign: "center", marginBottom: 24, color: "#fff" }}>HK${RATE}</div>
            <motion.button
              type="button"
              whileTap={canPay ? { scale: 0.97 } : undefined}
              onClick={() => canPay && handlePay()}
              disabled={!canPay || loading}
              style={{
                width: "100%", height: 56, background: canPay ? GREEN : GREEN_DIM, borderRadius: 14,
                color: canPay ? "#000" : "rgba(0,0,0,0.4)", fontSize: 17, fontWeight: 700,
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              }}
            >
              {loading ? <div className="spinner" /> : <><span>立即付款 · HK${RATE}</span><ChevronRight size={18} /></>}
            </motion.button>
          </div>
        </div>
      </div>

      {/* Mobile sticky CTA */}
      <div className="mobile-cta">
        <motion.button
          type="button"
          whileTap={canPay ? { scale: 0.97 } : undefined}
          onClick={() => canPay && handlePay()}
          disabled={!canPay || loading}
          style={{
            width: "100%", height: 56, background: canPay ? GREEN : GREEN_DIM, borderRadius: 14,
            color: canPay ? "#000" : "rgba(0,0,0,0.4)", fontSize: 17, fontWeight: 700,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          }}
        >
          {loading ? <div className="spinner" /> : <><span data-cms-key="book.pay.cta">立即付款 · HK${RATE}</span><ChevronRight size={18} /></>}
        </motion.button>
      </div>
    </div>
  );
}

/* ─────────────────────────  Screen 4: Confirmation  ───────────────────────── */
function Screen4({
  selectedDate, selectedTime, bookingRef,
}: {
  selectedDate: Date | null;
  selectedTime: string | null;
  bookingRef: string;
}) {
  const [showContent, setShowContent] = useState(false);
  const confettiRef = useRef<HTMLDivElement>(null);

  const endTime = selectedTime ? `${String(Number(selectedTime.split(":")[0]) + 1).padStart(2, "0")}:00` : "";

  useEffect(() => {
    const t = setTimeout(() => setShowContent(true), 300);
    return () => clearTimeout(t);
  }, []);

  // Confetti
  useEffect(() => {
    const container = confettiRef.current;
    if (!container) return;
    const colors = ["#25D366", "#FFFFFF", "#0071E3", "#FFD700", "#FF6B6B"];
    const particles: HTMLDivElement[] = [];

    requestAnimationFrame(() => {
      for (let i = 0; i < 80; i++) {
        const el = document.createElement("div");
        const size = 5 + Math.random() * 5;
        const color = colors[i % colors.length];
        const duration = 1.2 + Math.random() * 0.8;
        const tx = (Math.random() - 0.5) * 400;
        const ty = Math.random() * 600;
        const rot = Math.random() * 720;
        el.style.cssText = `
          position:absolute; width:${size}px; height:${size}px;
          background:${color}; border-radius:2px; left:50%; top:0;
          animation: confetti-fall ${duration}s cubic-bezier(0.16,1,0.3,1) forwards;
          --tx:${tx}px; --ty:${ty}px; --rot:${rot}deg;
        `;
        container.appendChild(el);
        particles.push(el);
      }
    });

    const cleanup = setTimeout(() => particles.forEach(p => p.remove()), 3000);
    return () => { clearTimeout(cleanup); particles.forEach(p => p.remove()); };
  }, []);

  return (
    <div className="screen-content" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "calc(100dvh - 80px)", position: "relative", padding: "0 24px" }}>
      <div ref={confettiRef} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, pointerEvents: "none", overflow: "hidden" }} />

      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: showContent ? 1 : 0 }}
        transition={{ type: "spring", stiffness: 400, damping: 20, delay: 0.1 }}
      >
        <CheckCircle size={64} color={GREEN} />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: showContent ? 1 : 0, y: showContent ? 0 : 16 }}
        transition={{ duration: 0.5, ease: SPRING, delay: 0.2 }}
        style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", width: "100%" }}
      >
        <h1 data-cms-key="book.confirm.title" style={{ fontFamily: BEBAS, fontSize: 52, letterSpacing: "0.02em", marginTop: 16, marginBottom: 8 }}>預約確認</h1>
        <p style={{ fontSize: 15, color: MUTED, marginBottom: 28 }}>
          {selectedDate ? `${selectedDate.getMonth() + 1}月${selectedDate.getDate()}日` : ""} · {selectedTime} – {endTime} · 1小時
        </p>

        {/* QR */}
        <div style={{ background: "#fff", borderRadius: 20, padding: 24, width: 200, margin: "0 auto 8px" }}>
          <QRCode data={bookingRef} />
        </div>
        <div style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 13, color: "#666", letterSpacing: "0.1em", marginBottom: 24 }}>
          {bookingRef}
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 12, width: "100%", maxWidth: 360 }}>
          <button type="button" style={{ flex: 1, height: 48, background: GREEN, borderRadius: 14, color: "#000", fontWeight: 700, fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            <CalendarPlus size={16} />
            <span data-cms-key="book.confirm.calendar">加入日曆</span>
          </button>
          <button type="button" style={{ flex: 1, height: 48, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 14, color: "#fff", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            <Share2 size={16} />
            <span data-cms-key="book.confirm.share">分享</span>
          </button>
        </div>

        <button type="button" data-cms-key="book.confirm.home" style={{ marginTop: 16, fontSize: 14, color: MUTED, background: "none", border: "none", cursor: "pointer" }}>
          返回主頁
        </button>
      </motion.div>
    </div>
  );
}

/* ─────────────────────────  Root  ───────────────────────── */
export default function BookPage() {
  const [screen, setScreen] = useState(0);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [bookingRef] = useState(() => genRef());

  const direction = useRef(1);

  const advance = useCallback(() => {
    direction.current = 1;
    setScreen(s => Math.min(s + 1, 3));
  }, []);

  const back = useCallback(() => {
    direction.current = -1;
    setScreen(s => Math.max(s - 1, 0));
  }, []);

  const variants = {
    enter: { x: direction.current > 0 ? "100%" : "-100%", opacity: 0 },
    center: { x: 0, opacity: 1 },
    exit: { x: direction.current > 0 ? "-100%" : "100%", opacity: 0 },
  };

  return (
    <main style={{ background: "#000", minHeight: "100dvh", color: "#fff", display: "flex", justifyContent: "center" }}>
      <div className="book-container">
        <ProgressBar current={screen} />

        <div style={{ position: "relative", overflow: "hidden", flex: 1 }}>
          <AnimatePresence mode="wait" initial={false}>
            {screen === 0 && (
              <motion.div key="s0" variants={variants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.38, ease: SPRING }}>
                <Screen1 selectedDate={selectedDate} setSelectedDate={setSelectedDate} selectedTime={selectedTime} setSelectedTime={setSelectedTime} onContinue={advance} />
              </motion.div>
            )}
            {screen === 1 && (
              <motion.div key="s1" variants={variants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.38, ease: SPRING }}>
                <Screen2 selectedDate={selectedDate} selectedTime={selectedTime} onSuccess={advance} onBack={back} />
              </motion.div>
            )}
            {screen === 2 && (
              <motion.div key="s2" variants={variants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.38, ease: SPRING }}>
                <Screen3 selectedDate={selectedDate} selectedTime={selectedTime} onSuccess={advance} />
              </motion.div>
            )}
            {screen === 3 && (
              <motion.div key="s3" variants={variants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.38, ease: SPRING }}>
                <Screen4 selectedDate={selectedDate} selectedTime={selectedTime} bookingRef={bookingRef} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <style jsx global>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        button { border: none; background: none; font: inherit; }
        input { font: inherit; }
        @font-face {
          font-family: "Bebas Neue";
          src: local("Bebas Neue"), local("BebasNeue");
          font-display: swap;
        }

        .book-container {
          width: 100%; max-width: 430px; min-height: 100dvh;
          display: flex; flex-direction: column; position: relative;
          border-left: 1px solid rgba(255,255,255,0.1);
          border-right: 1px solid rgba(255,255,255,0.1);
        }
        .progress-bar {
          position: fixed; top: 0; left: 0; right: 0;
          background: #000; border-bottom: 1px solid rgba(255,255,255,0.08);
          padding: 16px 24px; z-index: 50;
        }
        .screen-content {
          padding: 76px 20px 100px;
        }
        .two-col {
          display: flex; flex-direction: column;
        }
        .col-left { flex: 1; }
        .desktop-card { display: none; }
        .mobile-cta {
          position: fixed; bottom: 0; left: 0; right: 0;
          padding: 16px 24px calc(16px + env(safe-area-inset-bottom, 0px));
          background: linear-gradient(to top, #000 60%, transparent);
          z-index: 40;
        }
        .auth-mobile-only { display: block; }
        .time-grid {
          display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px;
        }
        .spinner {
          width: 20px; height: 20px; border: 2px solid rgba(0,0,0,0.2);
          border-top-color: #000; border-radius: 50%;
          animation: spin 0.6s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes confetti-fall {
          0% { transform: translate(0, 0) rotate(0); opacity: 1; }
          80% { opacity: 1; }
          100% { transform: translate(var(--tx), var(--ty)) rotate(var(--rot)); opacity: 0; }
        }

        .otp-input:focus { border-color: #25D366 !important; }
        .pay-input:focus { border-color: #25D366 !important; }
        .phone-input-row:focus-within { border-color: #25D366 !important; }

        @media (min-width: 768px) {
          .book-container {
            max-width: 1100px; padding: 0 48px;
            border-left: none; border-right: none;
          }
          .progress-bar {
            position: relative; top: auto; left: auto; right: auto;
            border-bottom: none; padding: 24px 0 16px;
          }
          .screen-content { padding: 0 0 48px; }
          .two-col {
            display: grid; grid-template-columns: 1fr 360px;
            gap: 48px; align-items: start;
          }
          .col-left { min-width: 0; }
          .desktop-card {
            display: block; position: sticky; top: 24px;
          }
          .mobile-cta { display: none; }
          .auth-mobile-only { display: block; }
          .time-grid { grid-template-columns: repeat(6, 1fr); }
        }
      `}</style>
    </main>
  );
}
