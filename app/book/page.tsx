"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AnimatePresence, motion } from "framer-motion";

/* ─────────────────────────  Design tokens  ───────────────────────── */
const ACCENT = "#0071E3";
const SPRING = [0.16, 1, 0.3, 1] as const;
const HAIRLINE = "1px solid rgba(255,255,255,0.1)";
const BEBAS =
  "'Bebas Neue', 'Oswald', 'Haas Grot Disp', 'Helvetica Neue Condensed', 'Arial Narrow', sans-serif";

const RATE_PER_HOUR = 80; // HK$ — dummy demo rate (1.5h → HK$120)

/* ─────────────────────────  Static data  ───────────────────────── */
const WEEKDAYS = ["一", "二", "三", "四", "五", "六", "日"]; // Mon–Sun

const START_TIMES: string[] = (() => {
  const out: string[] = [];
  for (let m = 0; m <= 23 * 60 + 30; m += 30) {
    const h = Math.floor(m / 60);
    const mm = m % 60;
    out.push(`${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`);
  }
  return out;
})();

const DURATIONS = [
  { label: "30分", hours: 0.5 },
  { label: "1小時", hours: 1 },
  { label: "1.5小時", hours: 1.5 },
  { label: "2小時", hours: 2 },
  { label: "2.5小時", hours: 2.5 },
  { label: "3小時", hours: 3 },
  { label: "3.5小時", hours: 3.5 },
  { label: "4小時", hours: 4 },
  { label: "4.5小時", hours: 4.5 },
  { label: "5小時", hours: 5 },
  { label: "5.5小時", hours: 5.5 },
  { label: "6小時", hours: 6 },
];

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/* ─────────────────────────  Helpers  ───────────────────────── */
function addMinutesToTime(time: string, minutes: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = (h * 60 + m + minutes) % (24 * 60);
  const hh = Math.floor(total / 60);
  const mm = total % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function buildCalendar(year: number, month: number): (Date | null)[] {
  const first = new Date(year, month, 1);
  const lead = (first.getDay() + 6) % 7; // Monday-first offset
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < lead; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

/* ─────────────────────────  Count-up price  ───────────────────────── */
function useCountUp(value: number, duration = 450) {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    const from = fromRef.current;
    const to = value;
    if (from === to) return;
    startRef.current = null;

    const tick = (ts: number) => {
      if (startRef.current === null) startRef.current = ts;
      const t = Math.min((ts - startRef.current) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
      setDisplay(Math.round(from + (to - from) * eased));
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = to;
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      fromRef.current = value;
    };
  }, [value, duration]);

  return display;
}

/* ─────────────────────────  Drum-roll wheel  ───────────────────────── */
const WHEEL_HEIGHT = 200;
const ITEM_HEIGHT = 44;
const PAD = (WHEEL_HEIGHT - ITEM_HEIGHT) / 2; // 78px top/bottom spacer

function Wheel({
  items,
  selectedIndex,
  onChange,
  ariaLabel,
}: {
  items: string[];
  selectedIndex: number;
  onChange: (i: number) => void;
  ariaLabel: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const settleRef = useRef<number | null>(null);
  const prevIndexRef = useRef<number>(selectedIndex);

  // Detect the centred item via IntersectionObserver (threshold 0.9).
  useEffect(() => {
    const root = scrollRef.current;
    if (!root) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const idx = Number(
              (entry.target as HTMLElement).dataset.index ?? -1
            );
            if (idx >= 0 && idx !== prevIndexRef.current) {
              prevIndexRef.current = idx;
              onChange(idx);
              if (typeof navigator !== "undefined" && navigator.vibrate) {
                navigator.vibrate(8);
              }
              const el = entry.target as HTMLElement;
              el.style.animation = "none";
              void el.offsetHeight;
              el.style.animation =
                "wheel-bounce 180ms cubic-bezier(0.16,1,0.3,1)";
            }
          }
        }
      },
      {
        root,
        rootMargin: `-${PAD}px 0px -${PAD}px 0px`,
        threshold: 0.9,
      }
    );
    itemRefs.current.forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, [items, onChange]);

  // Centre the initial selection without smooth scroll (run once).
  useEffect(() => {
    const root = scrollRef.current;
    if (root) root.scrollTop = selectedIndex * ITEM_HEIGHT;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleItemClick = (i: number) => {
    scrollRef.current?.scrollTo({ top: i * ITEM_HEIGHT, behavior: "smooth" });
  };

  // Snap-correct after manual scroll ends (covers imperfect native snap).
  const handleScroll = () => {
    if (settleRef.current) window.clearTimeout(settleRef.current);
    settleRef.current = window.setTimeout(() => {
      const root = scrollRef.current;
      if (!root) return;
      const idx = Math.round(root.scrollTop / ITEM_HEIGHT);
      const clamped = Math.max(0, Math.min(items.length - 1, idx));
      const target = clamped * ITEM_HEIGHT;
      if (Math.abs(root.scrollTop - target) > 1) {
        root.scrollTo({ top: target, behavior: "smooth" });
      }
    }, 90);
  };

  return (
    <div
      ref={scrollRef}
      onScroll={handleScroll}
      role="listbox"
      aria-label={ariaLabel}
      className="wheel-scroll"
      style={{
        height: WHEEL_HEIGHT,
        overflowY: "scroll",
        scrollSnapType: "y mandatory",
        flex: 1,
        position: "relative",
        WebkitOverflowScrolling: "touch",
      }}
    >
      <div style={{ height: PAD }} aria-hidden />
      {items.map((label, i) => {
        const active = i === selectedIndex;
        return (
          <div
            key={label}
            data-index={i}
            ref={(el) => {
              itemRefs.current[i] = el;
            }}
            role="option"
            aria-selected={active}
            onClick={() => handleItemClick(i)}
            style={{
              height: ITEM_HEIGHT,
              scrollSnapAlign: "center",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              opacity: active ? 1 : 0.3,
              fontSize: active ? 18 : 15,
              fontWeight: active ? 600 : 400,
              color: "#FFFFFF",
              transition:
                "opacity 0.2s ease, font-size 150ms cubic-bezier(0.16,1,0.3,1), font-weight 0.2s ease",
              userSelect: "none",
            }}
          >
            {label}
          </div>
        );
      })}
      <div style={{ height: PAD }} aria-hidden />
    </div>
  );
}

/* ─────────────────────────  Brand logos (inline SVG)  ───────────────────────── */
function AppleLogo() {
  return (
    <svg width="18" height="22" viewBox="0 0 18 22" fill="none" aria-hidden>
      <path
        d="M14.94 11.6c-.02-2.05 1.67-3.03 1.75-3.08-.95-1.4-2.44-1.59-2.97-1.61-1.26-.13-2.46.74-3.1.74-.64 0-1.63-.72-2.68-.7-1.38.02-2.65.8-3.36 2.04-1.43 2.49-.37 6.17 1.03 8.19.68.99 1.49 2.1 2.55 2.06 1.02-.04 1.41-.66 2.65-.66 1.23 0 1.58.66 2.66.64 1.1-.02 1.79-1 2.46-2 .77-1.15 1.09-2.26 1.11-2.32-.02-.01-2.13-.82-2.15-3.24zM12.9 5.36c.56-.68.94-1.62.84-2.56-.81.03-1.79.54-2.37 1.22-.52.6-.98 1.56-.86 2.48.9.07 1.83-.46 2.39-1.14z"
        fill="#000000"
      />
    </svg>
  );
}

function GoogleLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path
        fill="#4285F4"
        d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"
      />
      <path
        fill="#34A853"
        d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"
      />
      <path
        fill="#FBBC05"
        d="M11.69 28.18c-.44-1.32-.69-2.73-.69-4.18s.25-2.86.69-4.18v-5.7H4.34A21.99 21.99 0 0 0 2 24c0 3.55.85 6.91 2.34 9.88l7.35-5.7z"
      />
      <path
        fill="#EA4335"
        d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z"
      />
    </svg>
  );
}

/* ─────────────────────────  Progress dots  ───────────────────────── */
function ProgressDots({ step }: { step: number }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px 0 8px",
      }}
    >
      {[0, 1, 2].map((i) => (
        <div key={i} style={{ display: "flex", alignItems: "center" }}>
          <motion.div
            animate={{
              backgroundColor:
                i <= step ? "#FFFFFF" : "rgba(255,255,255,0.18)",
              scale: i === step ? 1.15 : 1,
            }}
            transition={{ duration: 0.4, ease: SPRING }}
            style={{ width: 9, height: 9, borderRadius: "50%" }}
          />
          {i < 2 && (
            <div
              style={{
                width: 44,
                height: 1,
                background: i < step ? "#FFFFFF" : "rgba(255,255,255,0.18)",
                transition: "background 0.4s ease",
              }}
            />
          )}
        </div>
      ))}
    </div>
  );
}

/* ─────────────────────────  Confetti  ───────────────────────── */
const CONFETTI_COLORS = ["#0071E3", "#FFFFFF", "#1A6B35", "#FFD700"];

function Confetti() {
  const particles = useMemo(
    () =>
      Array.from({ length: 60 }, (_, i) => {
        // Deterministic pseudo-spread from index (no Math.random at render).
        const angle = (i / 60) * Math.PI * 2 + (i % 7) * 0.31;
        const velocity = 90 + (i % 11) * 16;
        return {
          id: i,
          color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
          size: 6 + (i % 5),
          x: Math.cos(angle) * velocity,
          y: Math.sin(angle) * velocity - 40,
          rotate: (i % 2 ? 1 : -1) * (180 + (i % 9) * 40),
        };
      }),
    []
  );

  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        top: "38%",
        left: "50%",
        width: 0,
        height: 0,
        pointerEvents: "none",
        zIndex: 5,
      }}
    >
      {particles.map((p) => (
        <motion.div
          key={p.id}
          initial={{ x: 0, y: 0, opacity: 1, rotate: 0, scale: 1 }}
          animate={{ x: p.x, y: p.y, opacity: 0, rotate: p.rotate, scale: 0.6 }}
          transition={{ duration: 1.2, ease: "easeOut" }}
          style={{
            position: "absolute",
            width: p.size,
            height: p.size,
            borderRadius: 2,
            background: p.color,
          }}
        />
      ))}
    </div>
  );
}

/* ─────────────────────────  Desktop summary card  ───────────────────────── */
function DesktopSummaryCard({
  selectedDay,
  startTime,
  endTime,
  durationLabel,
  price,
  canContinue,
  onContinue,
}: {
  selectedDay: Date | null;
  startTime: string;
  endTime: string;
  durationLabel: string;
  price: number;
  canContinue: boolean;
  onContinue: () => void;
}) {
  const animatedPrice = useCountUp(price);

  return (
    <div className="select-right">
      <div
        style={{
          background: "#111111",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 20,
          padding: 24,
        }}
      >
        <div
          data-cms-key="book.summary.title"
          style={{
            fontSize: 13,
            color: "rgba(255,255,255,0.4)",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            marginBottom: 16,
          }}
        >
          預約摘要
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span data-cms-key="book.summary.date" style={{ fontSize: 14, color: "rgba(255,255,255,0.5)" }}>日期</span>
            <span style={{ fontSize: 15, fontWeight: 500 }}>
              {selectedDay
                ? `${selectedDay.getMonth() + 1}月${selectedDay.getDate()}日`
                : "—"}
            </span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span data-cms-key="book.summary.start" style={{ fontSize: 14, color: "rgba(255,255,255,0.5)" }}>開始</span>
            <span style={{ fontSize: 15, fontWeight: 500 }}>{startTime}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span data-cms-key="book.summary.end" style={{ fontSize: 14, color: "rgba(255,255,255,0.5)" }}>結束</span>
            <span style={{ fontSize: 15, fontWeight: 500 }}>{endTime}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span data-cms-key="book.summary.duration" style={{ fontSize: 14, color: "rgba(255,255,255,0.5)" }}>時長</span>
            <span style={{ fontSize: 15, fontWeight: 500 }}>{durationLabel}</span>
          </div>
        </div>

        <div style={{ height: 1, background: "rgba(255,255,255,0.08)", margin: "0 0 20px" }} />

        <div
          style={{
            fontFamily: BEBAS,
            fontSize: 48,
            lineHeight: 1,
            letterSpacing: "0.01em",
            color: "#FFFFFF",
            textAlign: "center",
            marginBottom: 24,
          }}
        >
          HK${animatedPrice}
        </div>

        <motion.button
          type="button"
          whileTap={canContinue ? { scale: 0.97 } : undefined}
          transition={{ duration: 0.25, ease: SPRING }}
          onClick={() => canContinue && onContinue()}
          disabled={!canContinue}
          style={{
            width: "100%",
            height: 52,
            background: ACCENT,
            borderRadius: 14,
            color: "#fff",
            fontSize: 16,
            fontWeight: 600,
            opacity: canContinue ? 1 : 0.4,
            cursor: canContinue ? "pointer" : "default",
          }}
        >
          <span data-cms-key="book.summary.continue">繼續</span>
        </motion.button>
      </div>
    </div>
  );
}

/* ─────────────────────────  Screen 1: Select  ───────────────────────── */
function SelectScreen({
  selectedDay,
  setSelectedDay,
  startIndex,
  setStartIndex,
  durationIndex,
  setDurationIndex,
  viewYear,
  viewMonth,
  setView,
  onContinue,
}: {
  selectedDay: Date | null;
  setSelectedDay: (d: Date) => void;
  startIndex: number;
  setStartIndex: (i: number) => void;
  durationIndex: number;
  setDurationIndex: (i: number) => void;
  viewYear: number;
  viewMonth: number;
  setView: (y: number, m: number) => void;
  onContinue: () => void;
}) {
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const cells = useMemo(
    () => buildCalendar(viewYear, viewMonth),
    [viewYear, viewMonth]
  );

  const hours = DURATIONS[durationIndex].hours;
  const startTime = START_TIMES[startIndex];
  const endTime = addMinutesToTime(startTime, hours * 60);
  const price = Math.round(RATE_PER_HOUR * hours);
  const animatedPrice = useCountUp(price);

  const canGoPrev =
    viewYear > today.getFullYear() ||
    (viewYear === today.getFullYear() && viewMonth > today.getMonth());

  const goMonth = (delta: number) => {
    let m = viewMonth + delta;
    let y = viewYear;
    if (m < 0) {
      m = 11;
      y -= 1;
    } else if (m > 11) {
      m = 0;
      y += 1;
    }
    setView(y, m);
  };

  const canContinue = selectedDay !== null;

  return (
    <div className="select-screen">
      <div className="select-layout">
        {/* Left column: calendar + wheel picker */}
        <div className="select-left">
      {/* Calendar header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginTop: 8,
          marginBottom: 18,
        }}
      >
        <button
          type="button"
          onClick={() => canGoPrev && goMonth(-1)}
          disabled={!canGoPrev}
          aria-label="上個月"
          style={{
            width: 36,
            height: 36,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            opacity: canGoPrev ? 1 : 0.25,
            color: "#fff",
          }}
        >
          <svg width="9" height="16" viewBox="0 0 9 16" fill="none">
            <path
              d="M8 1L1 8l7 7"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <div style={{ fontSize: 19, fontWeight: 600, letterSpacing: "-0.01em" }}>
          {MONTH_NAMES[viewMonth]} {viewYear}
        </div>
        <button
          type="button"
          onClick={() => goMonth(1)}
          aria-label="下個月"
          style={{
            width: 36,
            height: 36,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
          }}
        >
          <svg width="9" height="16" viewBox="0 0 9 16" fill="none">
            <path
              d="M1 1l7 7-7 7"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>

      {/* Weekday headers */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          marginBottom: 8,
        }}
      >
        {WEEKDAYS.map((w) => (
          <div
            key={w}
            style={{
              textAlign: "center",
              fontSize: 11,
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.4)",
              fontWeight: 600,
              letterSpacing: "0.04em",
            }}
          >
            {w}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          rowGap: 4,
        }}
      >
        {cells.map((date, i) => {
          if (!date) return <div key={`e-${i}`} />;
          const isPast = date < today;
          const isToday = sameDay(date, today);
          const isSelected = selectedDay && sameDay(date, selectedDay);
          return (
            <div
              key={date.toISOString()}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "2px 0",
              }}
            >
              <button
                type="button"
                disabled={isPast}
                onClick={() => setSelectedDay(date)}
                aria-pressed={!!isSelected}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 15,
                  fontWeight: isSelected ? 700 : 400,
                  cursor: isPast ? "default" : "pointer",
                  opacity: isPast ? 0.25 : 1,
                  background: isSelected ? "#FFFFFF" : "transparent",
                  color: isSelected ? "#000000" : "#FFFFFF",
                  border:
                    isToday && !isSelected
                      ? "1px solid rgba(255,255,255,0.7)"
                      : "1px solid transparent",
                  transition: "background 0.2s ease, color 0.2s ease",
                }}
              >
                {date.getDate()}
              </button>
            </div>
          );
        })}
      </div>

      {/* Wheel picker — revealed after a day is chosen */}
      <AnimatePresence>
        {selectedDay && (
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            transition={{ duration: 0.5, ease: SPRING }}
            style={{ marginTop: 26 }}
          >
            <div
              style={{
                fontSize: 13,
                color: "rgba(255,255,255,0.4)",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                marginBottom: 10,
                display: "flex",
                justifyContent: "space-between",
                padding: "0 8px",
              }}
            >
              <span>開始時間</span>
              <span>時長</span>
            </div>

            <div style={{ position: "relative", display: "flex" }}>
              {/* Frosted highlight band across both wheels */}
              <div
                aria-hidden
                style={{
                  position: "absolute",
                  top: PAD,
                  left: 0,
                  right: 0,
                  height: ITEM_HEIGHT,
                  background: "rgba(255,255,255,0.08)",
                  borderTop: "1px solid rgba(255,255,255,0.15)",
                  borderBottom: "1px solid rgba(255,255,255,0.15)",
                  borderRadius: 10,
                  pointerEvents: "none",
                  zIndex: 2,
                }}
              />
              <Wheel
                items={START_TIMES}
                selectedIndex={startIndex}
                onChange={setStartIndex}
                ariaLabel="開始時間"
              />
              <div
                aria-hidden
                style={{
                  width: 1,
                  alignSelf: "stretch",
                  background: "rgba(255,255,255,0.08)",
                }}
              />
              <Wheel
                items={DURATIONS.map((d) => d.label)}
                selectedIndex={durationIndex}
                onChange={setDurationIndex}
                ariaLabel="時長"
              />
            </div>

            {/* Summary + animated price */}
            <div style={{ textAlign: "center", marginTop: 18 }}>
              <div
                style={{
                  fontSize: 13,
                  color: "rgba(255,255,255,0.45)",
                  marginBottom: 6,
                }}
              >
                由 {startTime} 至 {endTime}
              </div>
              <div
                style={{
                  fontFamily: BEBAS,
                  fontSize: 52,
                  lineHeight: 1,
                  letterSpacing: "0.01em",
                  color: "#FFFFFF",
                }}
              >
                HK${animatedPrice}
              </div>
            </div>

            <div
              style={{
                height: 1,
                background: "rgba(255,255,255,0.1)",
                margin: "22px 0",
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Continue (mobile only) */}
      <motion.button
        type="button"
        className="select-continue-mobile"
        whileTap={canContinue ? { scale: 0.97 } : undefined}
        transition={{ duration: 0.25, ease: SPRING }}
        onClick={() => canContinue && onContinue()}
        disabled={!canContinue}
        style={{
          width: "100%",
          height: 52,
          background: ACCENT,
          borderRadius: 14,
          color: "#fff",
          fontSize: 16,
          fontWeight: 600,
          opacity: canContinue ? 1 : 0.4,
          cursor: canContinue ? "pointer" : "default",
          marginTop: selectedDay ? 0 : 26,
        }}
      >
        繼續
      </motion.button>
    </div>

        {/* Right column: desktop summary (sticky) */}
        <DesktopSummaryCard
          selectedDay={selectedDay}
          startTime={startTime}
          endTime={endTime}
          durationLabel={DURATIONS[durationIndex].label}
          price={price}
          canContinue={canContinue}
          onContinue={onContinue}
        />
      </div>
    </div>
  );
}

/* ─────────────────────────  Screen 2: Auth sheet  ───────────────────────── */
function formatPhone(digits: string) {
  const d = digits.slice(0, 8);
  if (d.length <= 4) return d;
  return `${d.slice(0, 4)} ${d.slice(4)}`;
}

function AuthSheet({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [lockSeconds, setLockSeconds] = useState(300); // 5:00
  const [phone, setPhone] = useState(""); // raw digits
  const [stage, setStage] = useState<"phone" | "otp">("phone");
  const [otp, setOtp] = useState<string[]>(["", "", "", "", "", ""]);
  const [resend, setResend] = useState(59);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Lock countdown.
  useEffect(() => {
    const id = setInterval(
      () => setLockSeconds((s) => (s > 0 ? s - 1 : 0)),
      1000
    );
    return () => clearInterval(id);
  }, []);

  // Resend countdown (OTP stage only).
  useEffect(() => {
    if (stage !== "otp") return;
    setResend(59);
    const id = setInterval(() => setResend((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, [stage]);

  useEffect(() => {
    if (stage === "otp") {
      const t = setTimeout(() => otpRefs.current[0]?.focus(), 350);
      return () => clearTimeout(t);
    }
  }, [stage]);

  const lockLabel = `${Math.floor(lockSeconds / 60)}:${String(
    lockSeconds % 60
  ).padStart(2, "0")}`;

  const phoneComplete = phone.length === 8;

  const handleOtpChange = (i: number, raw: string) => {
    const v = raw.replace(/\D/g, "").slice(-1);
    const next = [...otp];
    next[i] = v;
    setOtp(next);
    if (v && i < 5) otpRefs.current[i + 1]?.focus();
    if (v && i === 5 && next.every(Boolean)) {
      setTimeout(onSuccess, 250); // demo: any 6 digits succeed
    }
  };

  const handleOtpKey = (
    i: number,
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (e.key === "Backspace" && !otp[i] && i > 0) {
      otpRefs.current[i - 1]?.focus();
    }
  };

  return (
    <>
      {/* scrim */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(0,0,0,0.6)",
          backdropFilter: "blur(6px)",
          WebkitBackdropFilter: "blur(6px)",
          zIndex: 40,
        }}
      />
      {/* sheet */}
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 360, damping: 34 }}
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          background: "#111111",
          borderRadius: "20px 20px 0 0",
          padding: "28px 24px max(28px, env(safe-area-inset-bottom))",
          zIndex: 50,
        }}
      >
        {/* drag handle */}
        <div
          style={{
            width: 40,
            height: 4,
            borderRadius: 2,
            background: "rgba(255,255,255,0.2)",
            margin: "-12px auto 18px",
          }}
        />

        <AnimatePresence mode="wait" initial={false}>
          {stage === "phone" ? (
            <motion.div
              key="phone"
              initial={{ opacity: 0, x: 0 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.3, ease: SPRING }}
            >
              <h2 style={{ fontSize: 17, fontWeight: 600, marginBottom: 6 }}>
                繼續以完成預約
              </h2>
              <p
                style={{
                  fontSize: 13,
                  color: "rgba(255,255,255,0.5)",
                  marginBottom: 22,
                }}
              >
                你的預約時段已鎖定 {lockLabel}
              </p>

              {/* Apple */}
              <button
                type="button"
                onClick={onSuccess}
                style={{
                  width: "100%",
                  height: 52,
                  background: "#FFFFFF",
                  borderRadius: 14,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  marginBottom: 12,
                }}
              >
                <AppleLogo />
                <span style={{ color: "#000", fontWeight: 600, fontSize: 16 }}>
                  以 Apple 登入
                </span>
              </button>

              {/* Google */}
              <button
                type="button"
                onClick={onSuccess}
                style={{
                  width: "100%",
                  height: 52,
                  background: "#FFFFFF",
                  borderRadius: 14,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 10,
                  marginBottom: 18,
                }}
              >
                <GoogleLogo />
                <span
                  style={{ color: "#1F1F1F", fontWeight: 500, fontSize: 16 }}
                >
                  以 Google 帳號登入
                </span>
              </button>

              {/* divider */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  margin: "4px 0 18px",
                }}
              >
                <div
                  style={{
                    flex: 1,
                    height: 1,
                    background: "rgba(255,255,255,0.12)",
                  }}
                />
                <span style={{ fontSize: 13, color: "rgba(255,255,255,0.4)" }}>
                  或
                </span>
                <div
                  style={{
                    flex: 1,
                    height: 1,
                    background: "rgba(255,255,255,0.12)",
                  }}
                />
              </div>

              {/* WhatsApp phone input */}
              <div
                style={{
                  height: 52,
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.15)",
                  borderRadius: 14,
                  display: "flex",
                  alignItems: "center",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    padding: "0 14px",
                    height: "100%",
                    display: "flex",
                    alignItems: "center",
                    fontSize: 15,
                    color: "#25D366",
                    background: "rgba(37,211,102,0.15)",
                    borderRight: "1px solid rgba(37,211,102,0.3)",
                  }}
                >
                  +852
                </div>
                <input
                  value={formatPhone(phone)}
                  onChange={(e) =>
                    setPhone(e.target.value.replace(/\D/g, "").slice(0, 8))
                  }
                  inputMode="numeric"
                  placeholder="WhatsApp 號碼"
                  style={{
                    flex: 1,
                    height: "100%",
                    background: "transparent",
                    border: "none",
                    outline: "none",
                    color: "#fff",
                    fontSize: 16,
                    padding: "0 14px",
                    letterSpacing: "0.04em",
                  }}
                />
              </div>

              <AnimatePresence>
                {phoneComplete && (
                  <motion.button
                    key="send"
                    type="button"
                    initial={{ opacity: 0, y: 12, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 12, scale: 0.96 }}
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => setStage("otp")}
                    style={{
                      width: "100%",
                      height: 52,
                      background: "#25D366",
                      borderRadius: 14,
                      color: "#000000",
                      fontSize: 16,
                      fontWeight: 600,
                      marginTop: 14,
                    }}
                  >
                    傳送驗證碼
                  </motion.button>
                )}
              </AnimatePresence>
            </motion.div>
          ) : (
            <motion.div
              key="otp"
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 24 }}
              transition={{ duration: 0.3, ease: SPRING }}
            >
              <h2 style={{ fontSize: 17, fontWeight: 600, marginBottom: 6 }}>
                輸入驗證碼
              </h2>
              <p
                style={{
                  fontSize: 13,
                  color: "rgba(255,255,255,0.5)",
                  marginBottom: 24,
                }}
              >
                已傳送至 +852 {formatPhone(phone)}
              </p>

              <div
                style={{
                  display: "flex",
                  gap: 8,
                  justifyContent: "center",
                  marginBottom: 22,
                }}
              >
                {otp.map((d, i) => (
                  <input
                    key={i}
                    ref={(el) => {
                      otpRefs.current[i] = el;
                    }}
                    value={d}
                    onChange={(e) => handleOtpChange(i, e.target.value)}
                    onKeyDown={(e) => handleOtpKey(i, e)}
                    inputMode="numeric"
                    maxLength={1}
                    style={{
                      width: 40,
                      height: 52,
                      border: "1px solid rgba(255,255,255,0.2)",
                      borderRadius: 10,
                      background: "transparent",
                      color: "#fff",
                      fontSize: 24,
                      textAlign: "center",
                      outline: "none",
                    }}
                    onFocus={(e) => (e.currentTarget.style.borderColor = "#25D366")}
                    onBlur={(e) =>
                      (e.currentTarget.style.borderColor =
                        "rgba(255,255,255,0.2)")
                    }
                  />
                ))}
              </div>

              <div style={{ textAlign: "center" }}>
                <span
                  style={{
                    fontSize: 14,
                    color: resend > 0 ? "rgba(255,255,255,0.35)" : "#25D366",
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
      </motion.div>
    </>
  );
}

/* ─────────────────────────  Screen 3: Confirmation  ───────────────────────── */
function ConfirmScreen({ summary }: { summary: string }) {
  const [showContent, setShowContent] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setShowContent(true), 300);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      style={{
        minHeight: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "0 24px",
        position: "relative",
      }}
    >
      <Confetti />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: showContent ? 1 : 0, y: showContent ? 0 : 16 }}
        transition={{ duration: 0.6, ease: SPRING }}
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
          width: "100%",
        }}
      >
        <h1
          style={{
            fontFamily: BEBAS,
            fontSize: 48,
            letterSpacing: "0.02em",
            marginBottom: 12,
          }}
        >
          預約確認
        </h1>
        <p
          style={{
            fontSize: 15,
            color: "rgba(255,255,255,0.6)",
            marginBottom: 30,
          }}
        >
          {summary}
        </p>

        {/* QR placeholder */}
        <div
          style={{
            width: 160,
            height: 160,
            background: "#FFFFFF",
            borderRadius: 12,
            padding: 16,
            marginBottom: 22,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gridTemplateRows: "repeat(3, 1fr)",
              gap: 8,
              width: "100%",
              height: "100%",
            }}
          >
            {[1, 1, 0, 0, 1, 1, 1, 0, 1].map((on, i) => (
              <div
                key={i}
                style={{
                  background: on ? "#000" : "transparent",
                  borderRadius: 3,
                }}
              />
            ))}
          </div>
        </div>

        <div
          style={{
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, monospace",
            fontSize: 14,
            color: "rgba(255,255,255,0.4)",
            letterSpacing: "0.1em",
            marginBottom: 34,
          }}
        >
          248-A3K7-F2M1
        </div>

        {/* buttons */}
        <div style={{ display: "flex", gap: 12, width: "100%" }}>
          {["加入日曆", "分享"].map((label) => (
            <button
              key={label}
              type="button"
              style={{
                flex: 1,
                height: 48,
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.15)",
                borderRadius: 14,
                color: "#fff",
                fontSize: 15,
                fontWeight: 500,
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </motion.div>
    </div>
  );
}

/* ─────────────────────────  Root  ───────────────────────── */
export default function BookPage() {
  const now = useMemo(() => new Date(), []);
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [startIndex, setStartIndex] = useState(28); // 14:00
  const [durationIndex, setDurationIndex] = useState(2); // 1.5小時

  const [authOpen, setAuthOpen] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const step = confirmed ? 2 : authOpen ? 1 : 0;

  const summary = useMemo(() => {
    const day = selectedDay ?? now;
    const startTime = START_TIMES[startIndex];
    const hours = DURATIONS[durationIndex].hours;
    const endTime = addMinutesToTime(startTime, hours * 60);
    return `${day.getFullYear()}年${day.getMonth() + 1}月${day.getDate()}日 · ${startTime}–${endTime} · ${DURATIONS[durationIndex].label}`;
  }, [selectedDay, startIndex, durationIndex, now]);

  return (
    <main
      style={{
        background: "#000",
        minHeight: "100dvh",
        color: "#fff",
        display: "flex",
        justifyContent: "center",
      }}
    >
      <div
        className="book-container"
        style={{
          width: "100%",
          minHeight: "100dvh",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <ProgressDots step={step} />

        {/* Screen 1 / 3 slide */}
        <div style={{ position: "relative" }}>
          <AnimatePresence initial={false}>
            {!confirmed ? (
              <motion.div
                key="select"
                initial={{ x: 0 }}
                animate={{ x: 0 }}
                exit={{ x: "-100%", opacity: 0 }}
                transition={{ duration: 0.45, ease: SPRING }}
              >
                <SelectScreen
                  selectedDay={selectedDay}
                  setSelectedDay={setSelectedDay}
                  startIndex={startIndex}
                  setStartIndex={setStartIndex}
                  durationIndex={durationIndex}
                  setDurationIndex={setDurationIndex}
                  viewYear={viewYear}
                  viewMonth={viewMonth}
                  setView={(y, m) => {
                    setViewYear(y);
                    setViewMonth(m);
                  }}
                  onContinue={() => setAuthOpen(true)}
                />
              </motion.div>
            ) : (
              <motion.div
                key="confirm"
                initial={{ x: "100%", opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ duration: 0.45, ease: SPRING }}
                style={{ minHeight: "calc(100dvh - 56px)" }}
              >
                <ConfirmScreen summary={summary} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Auth sheet */}
        <AnimatePresence>
          {authOpen && !confirmed && (
            <AuthSheet
              onClose={() => setAuthOpen(false)}
              onSuccess={() => {
                setAuthOpen(false);
                setConfirmed(true);
              }}
            />
          )}
        </AnimatePresence>
      </div>

      {/* CSS that Tailwind can't express */}
      <style jsx global>{`
        .wheel-scroll {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        .wheel-scroll::-webkit-scrollbar {
          display: none;
          width: 0;
          height: 0;
        }
        @font-face {
          font-family: "Bebas Neue";
          src: local("Bebas Neue"), local("BebasNeue");
          font-display: swap;
        }
        @keyframes wheel-bounce {
          0% { transform: scale(1); }
          50% { transform: scale(1.04); }
          100% { transform: scale(1); }
        }

        /* Mobile (default) */
        .book-container {
          max-width: 430px;
          border-left: ${HAIRLINE};
          border-right: ${HAIRLINE};
        }
        .select-screen {
          padding: 0 20px 32px;
        }
        .select-layout {
          display: flex;
          flex-direction: column;
        }
        .select-left {
          flex: 1;
        }
        .select-right {
          display: none;
        }
        .select-continue-mobile {
          display: block;
        }

        /* Desktop */
        @media (min-width: 768px) {
          .book-container {
            max-width: 1080px;
            padding: 0 48px;
            border-left: none;
            border-right: none;
          }
          .select-screen {
            padding: 0 0 32px;
          }
          .select-layout {
            display: grid;
            grid-template-columns: 1fr 360px;
            gap: 40px;
            align-items: start;
          }
          .select-left {
            min-width: 0;
          }
          .select-right {
            display: block;
            position: sticky;
            top: 24px;
          }
          .select-continue-mobile {
            display: none !important;
          }
        }
      `}</style>
    </main>
  );
}
