"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Sun, Moon, MoonStar } from "lucide-react";

const GREEN = "#22C55E";
const BORDER = "#2D2D2D";
const FONT_FAMILY =
  "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', Helvetica, Arial, sans-serif";

type PeriodId = "afternoon" | "evening" | "latenight";

interface Period {
  id: PeriodId;
  label: string;
  range: string;
  rate: number;
  Icon: typeof Sun;
}

const PERIODS: Period[] = [
  { id: "afternoon", label: "下午", range: "12pm – 6pm", rate: 60, Icon: Sun },
  { id: "evening", label: "晚上", range: "6pm – 12am", rate: 80, Icon: Moon },
  { id: "latenight", label: "深夜", range: "12am – 6am", rate: 60, Icon: MoonStar },
];

const DURATIONS = [1, 2, 3] as const;

const STEPS = ["選擇時間", "確認", "付款"] as const;

const WEEKDAY_ZH = ["日", "一", "二", "三", "四", "五", "六"] as const;

interface DayOption {
  iso: string; // YYYY-MM-DD, stable key + storage value
  dayLabel: string;
  dateLabel: string; // d/M
  isToday: boolean;
}

// Pick the period containing the given hour. 6am–12pm falls back to afternoon.
function periodForHour(hour: number): PeriodId {
  if (hour >= 18) return "evening";
  if (hour < 6) return "latenight";
  return "afternoon";
}

function buildDays(now: Date): DayOption[] {
  const days: DayOption[] = [];
  for (let i = 0; i < 14; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate()
    ).padStart(2, "0")}`;
    days.push({
      iso,
      dayLabel: i === 0 ? "今日" : WEEKDAY_ZH[d.getDay()],
      dateLabel: `${d.getDate()}/${d.getMonth() + 1}`,
      isToday: i === 0,
    });
  }
  return days;
}

export default function BookPage() {
  const router = useRouter();

  // Compute date/time-derived state after mount to avoid SSR/client mismatch.
  const [days, setDays] = useState<DayOption[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [period, setPeriod] = useState<PeriodId>("afternoon");
  const [duration, setDuration] = useState<number>(2);

  useEffect(() => {
    const now = new Date();
    const built = buildDays(now);
    setDays(built);
    setSelectedDate(built[0]?.iso ?? "");
    setPeriod(periodForHour(now.getHours()));
  }, []);

  const activePeriod = useMemo(
    () => PERIODS.find((p) => p.id === period) ?? PERIODS[0],
    [period]
  );
  const totalPrice = activePeriod.rate * duration;

  const handleContinue = () => {
    const selection = {
      date: selectedDate,
      period,
      periodLabel: activePeriod.label,
      range: activePeriod.range,
      rate: activePeriod.rate,
      duration,
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
                    background: isCurrent ? GREEN : "rgba(255,255,255,0.08)",
                    color: isCurrent ? "#000" : "rgba(255,255,255,0.5)",
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
          padding: "28px 20px 180px",
        }}
      >
        {/* SECTION 1 — 選擇日期 */}
        <h2 style={sectionTitle}>選擇日期</h2>
        <div
          className="no-scrollbar"
          style={{
            display: "flex",
            gap: "10px",
            overflowX: "auto",
            scrollSnapType: "x mandatory",
            paddingBottom: "4px",
            marginBottom: "36px",
          }}
        >
          {days.map((d) => {
            const selected = d.iso === selectedDate;
            return (
              <button
                key={d.iso}
                type="button"
                onClick={() => setSelectedDate(d.iso)}
                aria-pressed={selected}
                style={{
                  flexShrink: 0,
                  width: "64px",
                  height: "72px",
                  borderRadius: "14px",
                  border: "none",
                  cursor: "pointer",
                  scrollSnapAlign: "start",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "4px",
                  background: selected ? "white" : "rgba(255,255,255,0.08)",
                  color: selected ? "#000" : "white",
                  transition: "background 0.2s ease, color 0.2s ease",
                  fontFamily: FONT_FAMILY,
                }}
              >
                <span style={{ fontSize: "13px", fontWeight: 500, opacity: 0.7 }}>
                  {d.dayLabel}
                </span>
                <span style={{ fontSize: "16px", fontWeight: 600 }}>{d.dateLabel}</span>
              </button>
            );
          })}
        </div>

        {/* SECTION 2 — 選擇時段 */}
        <h2 style={sectionTitle}>選擇時段</h2>
        <div style={{ marginBottom: "36px" }}>
          {PERIODS.map((p) => {
            const selected = p.id === period;
            const Icon = p.Icon;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setPeriod(p.id)}
                aria-pressed={selected}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: "16px",
                  padding: "20px 16px",
                  minHeight: "44px",
                  textAlign: "left",
                  cursor: "pointer",
                  borderBottom: `1px solid ${BORDER}`,
                  borderLeft: `4px solid ${selected ? GREEN : "transparent"}`,
                  borderTop: "none",
                  borderRight: "none",
                  background: selected ? "rgba(34,197,94,0.08)" : "transparent",
                  color: "white",
                  transition: "background 0.2s ease, border-color 0.2s ease",
                  fontFamily: FONT_FAMILY,
                }}
              >
                <Icon size={20} color={GREEN} aria-hidden="true" style={{ flexShrink: 0 }} />
                <span style={{ fontSize: "16px", fontWeight: 600, width: "44px" }}>
                  {p.label}
                </span>
                <span style={{ fontSize: "14px", color: "rgba(255,255,255,0.6)", flex: 1 }}>
                  {p.range}
                </span>
                <span style={{ fontSize: "14px", fontWeight: 500, whiteSpace: "nowrap" }}>
                  HK${p.rate}/小時
                </span>
              </button>
            );
          })}
        </div>

        {/* SECTION 3 — 選擇時長 */}
        <h2 style={sectionTitle}>選擇時長</h2>
        <div style={{ display: "flex", gap: "12px" }}>
          {DURATIONS.map((h) => {
            const selected = h === duration;
            return (
              <button
                key={h}
                type="button"
                onClick={() => setDuration(h)}
                aria-pressed={selected}
                style={{
                  padding: "12px 24px",
                  minHeight: "44px",
                  borderRadius: "100px",
                  border: `1px solid ${selected ? "white" : "#3D3D3D"}`,
                  cursor: "pointer",
                  fontSize: "15px",
                  fontWeight: 500,
                  background: selected ? "white" : "transparent",
                  color: selected ? "#000" : "white",
                  transition: "all 0.2s ease",
                  fontFamily: FONT_FAMILY,
                }}
              >
                {h} 小時
              </button>
            );
          })}
        </div>
      </div>

      {/* SECTION 4 — 價格小結 (sticky bottom) */}
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
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              justifyContent: "space-between",
              marginBottom: "14px",
            }}
          >
            <span style={{ fontSize: "14px", color: "rgba(255,255,255,0.6)" }}>
              {activePeriod.label} · {duration} 小時
            </span>
            <span style={{ fontSize: "26px", fontWeight: 700, letterSpacing: "-0.02em" }}>
              HK${totalPrice}
            </span>
          </div>
          <button
            type="button"
            onClick={handleContinue}
            disabled={!selectedDate}
            style={{
              width: "100%",
              padding: "16px",
              minHeight: "44px",
              borderRadius: "999px",
              border: "none",
              cursor: selectedDate ? "pointer" : "not-allowed",
              background: GREEN,
              color: "white",
              fontSize: "17px",
              fontWeight: 600,
              opacity: selectedDate ? 1 : 0.5,
              fontFamily: FONT_FAMILY,
            }}
          >
            繼續
          </button>
        </div>
      </div>
    </main>
  );
}

const sectionTitle: React.CSSProperties = {
  fontSize: "20px",
  fontWeight: 600,
  letterSpacing: "-0.01em",
  margin: "0 0 16px",
};
