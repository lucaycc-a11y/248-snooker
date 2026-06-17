"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

const BLUE = "#0071E3";
const BORDER = "#2D2D2D";
const CARD = "#111111";
const FONT_FAMILY =
  "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', Helvetica, Arial, sans-serif";

const STEPS = ["選擇時間", "確認", "付款"] as const;

// Monday-first weekday headers.
const WEEK_HEADER = ["一", "二", "三", "四", "五", "六", "日"] as const;
// getDay() index (0=Sun) -> Chinese label.
const WEEKDAY_ZH = ["日", "一", "二", "三", "四", "五", "六"] as const;

// Operating hours: 09:00 through 02:00 next day. Hours use a 9..26 scale,
// where 24 = 00:00, 25 = 01:00, 26 = 02:00. Closing time is hour 26 (02:00).
const OPEN_HOUR = 9;
const CLOSE_HOUR = 26;
const START_HOURS = Array.from(
  { length: CLOSE_HOUR - OPEN_HOUR },
  (_, i) => OPEN_HOUR + i
); // 9 .. 25 -> 17 start slots (last bookable start is 01:00)
const MAX_DURATION = 4;

function formatHour(h: number): string {
  const hh = ((h % 24) + 24) % 24;
  return `${String(hh).padStart(2, "0")}:00`;
}

function isWeekendDay(d: Date): boolean {
  const wd = d.getDay();
  return wd === 0 || wd === 6;
}

// Hourly rate for a slot starting at `hour` (9..26 scale) on a given day.
//   Late night 23:00–02:00 : HK$60  (any day)
//   Peak 18:00–23:00 weekdays + all day Sat/Sun : HK$120
//   Off-peak 09:00–18:00 weekdays : HK$80
function rateForHour(hour: number, weekend: boolean): number {
  if (hour >= 23) return 60; // 23:00, 00:00, 01:00 (start)
  if (weekend) return 120;
  return hour < 18 ? 80 : 120;
}

// Longest duration (hours) bookable from a start hour without passing 02:00.
function maxDurationFrom(startHour: number): number {
  return Math.min(MAX_DURATION, CLOSE_HOUR - startHour);
}

// Placeholder for backend-provided bookings. Return the start hours (9..26
// scale) already taken on the given ISO date. Wire to the API when ready.
function bookedHoursFor(_iso: string): number[] {
  return [];
}

interface MonthCell {
  iso: string;
  day: number;
  date: Date;
  past: boolean;
  isToday: boolean;
}

// Build a Monday-first grid of cells for the given month. Leading slots before
// the 1st are null so the first day lands under its weekday column.
function buildMonth(year: number, month: number, today: Date): (MonthCell | null)[] {
  const first = new Date(year, month, 1);
  const lead = (first.getDay() + 6) % 7; // Mon-first offset
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayMidnight = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  ).getTime();

  const cells: (MonthCell | null)[] = [];
  for (let i = 0; i < lead; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    cells.push({
      iso,
      day,
      date,
      past: date.getTime() < todayMidnight,
      isToday: date.getTime() === todayMidnight,
    });
  }
  return cells;
}

interface Segment {
  fromHour: number;
  toHour: number;
  rate: number;
  hours: number;
}

// Group the booked hours into consecutive same-rate runs for the breakdown.
function priceSegments(startHour: number, duration: number, weekend: boolean): Segment[] {
  const segments: Segment[] = [];
  for (let i = 0; i < duration; i++) {
    const h = startHour + i;
    const rate = rateForHour(h, weekend);
    const last = segments[segments.length - 1];
    if (last && last.rate === rate) {
      last.toHour = h + 1;
      last.hours += 1;
    } else {
      segments.push({ fromHour: h, toHour: h + 1, rate, hours: 1 });
    }
  }
  return segments;
}

export default function BookPage() {
  const router = useRouter();

  // Date/time-derived state is computed after mount to avoid SSR mismatch.
  const [today, setToday] = useState<Date | null>(null);
  const [viewYear, setViewYear] = useState(0);
  const [viewMonth, setViewMonth] = useState(0);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedHour, setSelectedHour] = useState<number | null>(null);
  const [duration, setDuration] = useState<number>(1);

  useEffect(() => {
    const now = new Date();
    setToday(now);
    setViewYear(now.getFullYear());
    setViewMonth(now.getMonth());
  }, []);

  const monthCells = useMemo(
    () => (today ? buildMonth(viewYear, viewMonth, today) : []),
    [today, viewYear, viewMonth]
  );

  const selectedDateObj = useMemo(
    () => (selectedDate ? new Date(`${selectedDate}T00:00:00`) : null),
    [selectedDate]
  );
  const weekend = selectedDateObj ? isWeekendDay(selectedDateObj) : false;
  const booked = useMemo(
    () => new Set(selectedDate ? bookedHoursFor(selectedDate) : []),
    [selectedDate]
  );

  const maxDuration = selectedHour !== null ? maxDurationFrom(selectedHour) : MAX_DURATION;
  const durationCapped = duration > maxDuration;
  const effectiveDuration = Math.min(duration, maxDuration);

  const segments = useMemo(
    () =>
      selectedHour !== null && effectiveDuration > 0
        ? priceSegments(selectedHour, effectiveDuration, weekend)
        : [],
    [selectedHour, effectiveDuration, weekend]
  );
  const totalPrice = segments.reduce((sum, s) => sum + s.rate * s.hours, 0);
  const multiTier = segments.length > 1;

  const canConfirm =
    !!selectedDate && selectedHour !== null && effectiveDuration > 0;

  // Don't let a prev-month arrow walk before the current month.
  const atCurrentMonth =
    !!today && viewYear === today.getFullYear() && viewMonth === today.getMonth();

  const goMonth = (delta: number) => {
    const next = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(next.getFullYear());
    setViewMonth(next.getMonth());
  };

  const selectDate = (iso: string) => {
    setSelectedDate(iso);
    setSelectedHour(null);
    setDuration(1);
  };

  const selectHour = (hour: number) => {
    setSelectedHour(hour);
    setDuration((d) => Math.min(d, maxDurationFrom(hour)));
  };

  const summaryLabel = useMemo(() => {
    if (!canConfirm || !selectedDateObj || selectedHour === null) return "";
    const y = selectedDateObj.getFullYear();
    const m = selectedDateObj.getMonth() + 1;
    const day = selectedDateObj.getDate();
    const wd = WEEKDAY_ZH[selectedDateObj.getDay()];
    const start = formatHour(selectedHour);
    const end = formatHour(selectedHour + effectiveDuration);
    return `${y}年${m}月${day}日（${wd}）· ${start} – ${end} · ${effectiveDuration}小時 · HK$${totalPrice}`;
  }, [canConfirm, selectedDateObj, selectedHour, effectiveDuration, totalPrice]);

  const handleConfirm = () => {
    if (!canConfirm || selectedHour === null) return;
    const selection = {
      date: selectedDate,
      startHour: selectedHour,
      startTime: formatHour(selectedHour),
      endTime: formatHour(selectedHour + effectiveDuration),
      duration: effectiveDuration,
      weekend,
      breakdown: segments.map((s) => ({
        from: formatHour(s.fromHour),
        to: formatHour(s.toHour),
        rate: s.rate,
        hours: s.hours,
      })),
      totalPrice,
    };
    sessionStorage.setItem("bookingSelection", JSON.stringify(selection));
    router.push("/book/confirm");
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#000000",
        color: "white",
        fontFamily: FONT_FAMILY,
      }}
    >
      {/* Sticky progress bar */}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 20,
          background: "rgba(0,0,0,0.85)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          borderBottom: `1px solid ${BORDER}`,
        }}
      >
        <div
          style={{
            maxWidth: "480px",
            margin: "0 auto",
            padding: "16px 20px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          {STEPS.map((step, i) => {
            const isCurrent = i === 0;
            return (
              <div
                key={step}
                style={{ display: "flex", alignItems: "center", flex: 1, gap: "8px" }}
              >
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "22px",
                    height: "22px",
                    borderRadius: "50%",
                    fontSize: "12px",
                    fontWeight: 600,
                    flexShrink: 0,
                    background: isCurrent ? BLUE : "rgba(255,255,255,0.08)",
                    color: isCurrent ? "#fff" : "rgba(255,255,255,0.5)",
                  }}
                >
                  {i + 1}
                </span>
                <span
                  style={{
                    fontSize: "13px",
                    fontWeight: isCurrent ? 600 : 400,
                    color: isCurrent ? "white" : "rgba(255,255,255,0.5)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {step}
                </span>
                {i < STEPS.length - 1 && (
                  <span
                    aria-hidden="true"
                    style={{ flex: 1, height: "1px", background: BORDER, minWidth: "8px" }}
                  />
                )}
              </div>
            );
          })}
        </div>
      </header>

      <div
        style={{
          maxWidth: "480px",
          margin: "0 auto",
          padding: "28px 20px 200px",
        }}
      >
        {/* SECTION 1 — 選擇日期及時段 */}
        <h2 style={sectionTitle}>日期及時段</h2>
        <p style={sectionSubtitle}>選擇開始時間，以小時計費</p>

        {/* Calendar */}
        <div style={{ marginBottom: "32px" }}>
          {/* Month nav */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "16px",
            }}
          >
            <button
              type="button"
              onClick={() => goMonth(-1)}
              disabled={atCurrentMonth}
              aria-label="上個月"
              style={navBtn(atCurrentMonth)}
            >
              <ChevronLeft size={20} aria-hidden="true" />
            </button>
            <span style={{ fontSize: "16px", fontWeight: 600 }}>
              {today ? `${viewYear}年${viewMonth + 1}月` : ""}
            </span>
            <button
              type="button"
              onClick={() => goMonth(1)}
              aria-label="下個月"
              style={navBtn(false)}
            >
              <ChevronRight size={20} aria-hidden="true" />
            </button>
          </div>

          {/* Weekday header */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(7, 1fr)",
              marginBottom: "6px",
            }}
          >
            {WEEK_HEADER.map((w) => (
              <span
                key={w}
                style={{
                  textAlign: "center",
                  fontSize: "12px",
                  fontWeight: 500,
                  color: "rgba(255,255,255,0.4)",
                  padding: "6px 0",
                }}
              >
                {w}
              </span>
            ))}
          </div>

          {/* Day grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(7, 1fr)",
              gap: "4px",
            }}
          >
            {monthCells.map((cell, i) => {
              if (!cell) return <span key={`pad-${i}`} aria-hidden="true" />;
              const selected = cell.iso === selectedDate;
              return (
                <button
                  key={cell.iso}
                  type="button"
                  disabled={cell.past}
                  onClick={() => selectDate(cell.iso)}
                  aria-pressed={selected}
                  aria-label={cell.iso}
                  style={{
                    aspectRatio: "1 / 1",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    margin: "0 auto",
                    width: "40px",
                    borderRadius: "50%",
                    fontSize: "15px",
                    fontWeight: selected ? 600 : 500,
                    cursor: cell.past ? "default" : "pointer",
                    background: selected ? BLUE : "transparent",
                    color: selected ? "#fff" : "white",
                    opacity: cell.past ? 0.3 : 1,
                    border:
                      cell.isToday && !selected
                        ? "1px solid rgba(255,255,255,0.9)"
                        : "1px solid transparent",
                    transition: "background 0.15s ease",
                    fontFamily: FONT_FAMILY,
                  }}
                >
                  {cell.day}
                </button>
              );
            })}
          </div>
        </div>

        {/* Start time picker */}
        {selectedDate && (
          <div style={{ marginBottom: "32px" }}>
            <h3 style={subLabel}>選擇開始時間</h3>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, 1fr)",
                gap: "10px",
              }}
            >
              {START_HOURS.map((hour) => {
                const unavailable = booked.has(hour);
                const selected = hour === selectedHour;
                const rate = rateForHour(hour, weekend);
                return (
                  <button
                    key={hour}
                    type="button"
                    disabled={unavailable}
                    onClick={() => selectHour(hour)}
                    aria-pressed={selected}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: "2px",
                      padding: "10px 4px",
                      minHeight: "44px",
                      borderRadius: "12px",
                      cursor: unavailable ? "not-allowed" : "pointer",
                      background: selected ? BLUE : "transparent",
                      border: `1px solid ${
                        selected ? BLUE : "rgba(255,255,255,0.25)"
                      }`,
                      color: "white",
                      opacity: unavailable ? 0.3 : 1,
                      textDecoration: unavailable ? "line-through" : "none",
                      transition: "background 0.15s ease, border-color 0.15s ease",
                      fontFamily: FONT_FAMILY,
                    }}
                  >
                    <span style={{ fontSize: "14px", fontWeight: 600 }}>
                      {formatHour(hour)}
                    </span>
                    <span
                      style={{
                        fontSize: "10px",
                        color: selected
                          ? "rgba(255,255,255,0.85)"
                          : "rgba(255,255,255,0.45)",
                      }}
                    >
                      HK${rate}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Duration selector */}
        {selectedDate && selectedHour !== null && (
          <div style={{ marginBottom: "8px" }}>
            <h3 style={subLabel}>打幾耐？</h3>
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              {[1, 2, 3, 4].map((h) => {
                const disabled = h > maxDuration;
                const selected = h === effectiveDuration;
                return (
                  <button
                    key={h}
                    type="button"
                    disabled={disabled}
                    onClick={() => setDuration(h)}
                    aria-pressed={selected}
                    style={{
                      padding: "12px 22px",
                      minHeight: "44px",
                      borderRadius: "100px",
                      border: `1px solid ${selected ? BLUE : "#3D3D3D"}`,
                      cursor: disabled ? "not-allowed" : "pointer",
                      fontSize: "15px",
                      fontWeight: 500,
                      background: selected ? BLUE : "transparent",
                      color: "white",
                      opacity: disabled ? 0.3 : 1,
                      transition: "all 0.15s ease",
                      fontFamily: FONT_FAMILY,
                    }}
                  >
                    {h}小時
                  </button>
                );
              })}
            </div>

            {durationCapped && (
              <p
                style={{
                  fontSize: "13px",
                  color: "#FF9F0A",
                  marginTop: "12px",
                }}
              >
                最長可預訂至 02:00
              </p>
            )}

            {multiTier && (
              <p
                style={{
                  fontSize: "13px",
                  color: "rgba(255,255,255,0.5)",
                  marginTop: "12px",
                  lineHeight: 1.6,
                }}
              >
                {segments.map((s, i) => (
                  <span key={s.fromHour}>
                    {i > 0 && " + "}
                    {formatHour(s.fromHour)}–{formatHour(s.toHour)} HK$
                    {s.rate * s.hours}
                  </span>
                ))}
                {" = "}HK${totalPrice}
              </p>
            )}
          </div>
        )}

        {/* Summary card */}
        {canConfirm && (
          <div
            style={{
              marginTop: "28px",
              padding: "18px 20px",
              borderRadius: "16px",
              background: CARD,
              border: "1px solid rgba(255,255,255,0.1)",
              fontSize: "15px",
              fontWeight: 500,
              lineHeight: 1.5,
            }}
          >
            {summaryLabel}
          </div>
        )}
      </div>

      {/* Sticky CTA */}
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 20,
          background: "#000000",
          borderTop: `1px solid ${BORDER}`,
        }}
      >
        <div
          style={{
            maxWidth: "480px",
            margin: "0 auto",
            padding: "16px 20px calc(16px + env(safe-area-inset-bottom))",
          }}
        >
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!canConfirm}
            style={{
              width: "100%",
              padding: "16px",
              minHeight: "44px",
              borderRadius: "999px",
              border: "none",
              cursor: canConfirm ? "pointer" : "not-allowed",
              background: BLUE,
              color: "white",
              fontSize: "17px",
              fontWeight: 600,
              opacity: canConfirm ? 1 : 0.4,
              fontFamily: FONT_FAMILY,
            }}
          >
            確認時段
          </button>
        </div>
      </div>
    </main>
  );
}

const sectionTitle: React.CSSProperties = {
  fontSize: "22px",
  fontWeight: 600,
  letterSpacing: "-0.01em",
  margin: "0 0 4px",
};

const sectionSubtitle: React.CSSProperties = {
  fontSize: "14px",
  color: "rgba(255,255,255,0.5)",
  margin: "0 0 24px",
};

const subLabel: React.CSSProperties = {
  fontSize: "15px",
  fontWeight: 600,
  margin: "0 0 14px",
};

function navBtn(disabled: boolean): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "36px",
    height: "36px",
    borderRadius: "50%",
    border: "none",
    background: "rgba(255,255,255,0.08)",
    color: "white",
    cursor: disabled ? "default" : "pointer",
    opacity: disabled ? 0.3 : 1,
    flexShrink: 0,
  };
}
