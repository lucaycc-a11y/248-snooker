"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslations } from "next-intl";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import type { MemberBooking } from "@/lib/data/getMember";

const DEEP = "#0a0a0a";
const INK = "#f5f5f7";
const SUBTLE = "#86868b";
const HAIRLINE = "rgba(255,255,255,0.18)";
const BORDER = "rgba(255,255,255,0.1)";
const GREEN = "#22C55E";
const DANGER = "#FF453A";
const FONT_FAMILY =
  "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', Helvetica, Arial, sans-serif";
const DISPLAY = '"Bebas Neue", sans-serif';
const SPRING = { type: "spring", stiffness: 320, damping: 30 } as const;

type DaySlotRow = {
  table_number: number;
  date: string;
  start_time: string;
  duration_hours: number;
  status: string;
  locked_until: string | null;
};

function toDateInputValue(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Advisory-only client-side availability computation (mirrors
// lib/booking/server.ts's getAvailableTables logic) — reschedule_booking() is
// the real authority and re-checks on the server.
function availableStartHours(
  slots: DaySlotRow[],
  date: string,
  tableNumber: number,
  durationHours: number,
): number[] {
  const now = new Date();
  const hours: number[] = [];
  for (let h = 0; h < 24; h++) {
    const reqStart = new Date(`${date}T00:00:00`);
    reqStart.setHours(h, 0, 0, 0);
    if (reqStart <= now) continue; // can't reschedule into the past
    const reqEnd = new Date(reqStart);
    reqEnd.setHours(reqEnd.getHours() + durationHours);

    const occupied = slots.some((s) => {
      if (s.table_number !== tableNumber) return false;
      if (s.status === "locked" && (!s.locked_until || new Date(s.locked_until) <= now)) return false;
      const sStart = new Date(`${s.date}T${s.start_time}`);
      const sEnd = new Date(sStart);
      sEnd.setHours(sEnd.getHours() + Number(s.duration_hours));
      return sStart < reqEnd && reqStart < sEnd;
    });
    if (!occupied) hours.push(h);
  }
  return hours;
}

export default function ReschedulePicker({
  booking,
  onClose,
  onRescheduled,
}: {
  booking: MemberBooking | null;
  onClose: () => void;
  onRescheduled: (
    booking: MemberBooking,
    result: { date: string; startTime: string; endTime: string; tableNumber: number; rescheduleCount: number },
  ) => void;
}) {
  const t = useTranslations("memberPage");
  const [date, setDate] = useState<string>(() => toDateInputValue(new Date()));
  const [tableNumber, setTableNumber] = useState<1 | 2>(1);
  const [slots, setSlots] = useState<DaySlotRow[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [startHour, setStartHour] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset local state whenever a new booking is opened.
  useEffect(() => {
    if (!booking) return;
    const initialTable = typeof booking.tableId === "number" ? (booking.tableId as 1 | 2) : 1;
    setTableNumber(initialTable === 2 ? 2 : 1);
    setDate(booking.date ?? toDateInputValue(new Date()));
    setStartHour(null);
    setError(null);
  }, [booking]);

  useEffect(() => {
    if (!booking || !date) return;
    setLoadingSlots(true);
    setStartHour(null);
    fetch("/api/booking/availability", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date }),
    })
      .then((res) => res.json())
      .then((json) => setSlots(Array.isArray(json.slots) ? json.slots : []))
      .catch(() => setSlots([]))
      .finally(() => setLoadingSlots(false));
  }, [booking, date]);

  const duration = booking?.durationHours ?? 1;
  const freeHours = useMemo(
    () => (date ? availableStartHours(slots, date, tableNumber, duration) : []),
    [slots, date, tableNumber, duration],
  );

  const close = () => {
    if (submitting) return;
    setError(null);
    onClose();
  };

  const confirm = async () => {
    if (!booking || startHour === null) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/bookings/${booking.id}/reschedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, startHour, duration, tableNumber }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          json.reason === "unavailable"
            ? t("reschedule_modal_unavailable_error")
            : t("reschedule_modal_generic_error"),
        );
        return;
      }
      onRescheduled(booking, {
        date: json.date,
        startTime: json.startTime,
        endTime: json.endTime,
        tableNumber: json.tableNumber,
        rescheduleCount: json.rescheduleCount,
      });
    } catch {
      setError(t("reschedule_modal_generic_error"));
    } finally {
      setSubmitting(false);
    }
  };

  const shiftDate = (deltaDays: number) => {
    const d = new Date(`${date}T00:00:00`);
    d.setDate(d.getDate() + deltaDays);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (d < today) return;
    setDate(toDateInputValue(d));
  };

  return (
    <AnimatePresence>
      {booking && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={close}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 100,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
            background: "rgba(0,0,0,0.8)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
          }}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={SPRING}
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "relative",
              width: "100%",
              maxWidth: "420px",
              maxHeight: "88vh",
              overflowY: "auto",
              background: DEEP,
              border: `1px solid ${HAIRLINE}`,
              borderRadius: "24px",
              padding: "32px",
              fontFamily: FONT_FAMILY,
            }}
          >
            <button
              type="button"
              onClick={close}
              aria-label={t("close")}
              style={{
                position: "absolute",
                top: "16px",
                right: "16px",
                width: "36px",
                height: "36px",
                borderRadius: "50%",
                border: "none",
                background: "rgba(255,255,255,0.1)",
                color: INK,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <X size={18} />
            </button>

            <h3
              style={{
                fontFamily: DISPLAY,
                fontSize: "22px",
                letterSpacing: "0.04em",
                margin: "0 0 24px",
                color: INK,
              }}
            >
              {t("reschedule_modal_title")}
            </h3>

            {/* Date stepper */}
            <div style={{ marginBottom: "20px" }}>
              <span style={{ display: "block", fontSize: "13px", color: SUBTLE, marginBottom: "8px" }}>
                {t("reschedule_modal_date_label")}
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <button
                  type="button"
                  onClick={() => shiftDate(-1)}
                  aria-label="Previous day"
                  style={{ width: 36, height: 36, borderRadius: "50%", border: `1px solid ${BORDER}`, background: "transparent", color: INK, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
                >
                  <ChevronLeft size={16} />
                </button>
                <div style={{ flex: 1, textAlign: "center", fontSize: "15px", fontWeight: 600, color: INK }}>
                  {date}
                </div>
                <button
                  type="button"
                  onClick={() => shiftDate(1)}
                  aria-label="Next day"
                  style={{ width: 36, height: 36, borderRadius: "50%", border: `1px solid ${BORDER}`, background: "transparent", color: INK, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>

            {/* Table toggle */}
            <div style={{ marginBottom: "20px" }}>
              <span style={{ display: "block", fontSize: "13px", color: SUBTLE, marginBottom: "8px" }}>
                {t("reschedule_modal_table_label")}
              </span>
              <div style={{ display: "flex", gap: "10px" }}>
                {([1, 2] as const).map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setTableNumber(n)}
                    style={{
                      flex: 1,
                      minHeight: 44,
                      borderRadius: "12px",
                      border: `1px solid ${tableNumber === n ? GREEN : BORDER}`,
                      background: tableNumber === n ? "rgba(34,197,94,0.12)" : "transparent",
                      color: tableNumber === n ? GREEN : INK,
                      fontSize: "14px",
                      fontWeight: 600,
                      cursor: "pointer",
                      fontFamily: FONT_FAMILY,
                    }}
                  >
                    #{n}
                  </button>
                ))}
              </div>
            </div>

            {/* Hour grid */}
            <div style={{ marginBottom: "24px" }}>
              <span style={{ display: "block", fontSize: "13px", color: SUBTLE, marginBottom: "8px" }}>
                {t("reschedule_modal_time_label")}
              </span>
              {loadingSlots ? (
                <div style={{ color: SUBTLE, fontSize: "14px", padding: "12px 0" }}>{t("loading")}</div>
              ) : freeHours.length === 0 ? (
                <div style={{ color: SUBTLE, fontSize: "14px", padding: "12px 0" }}>
                  {t("reschedule_modal_no_slots")}
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "8px" }}>
                  {freeHours.map((h) => (
                    <button
                      key={h}
                      type="button"
                      onClick={() => setStartHour(h)}
                      style={{
                        minHeight: 40,
                        borderRadius: "10px",
                        border: `1px solid ${startHour === h ? GREEN : BORDER}`,
                        background: startHour === h ? "rgba(34,197,94,0.12)" : "transparent",
                        color: startHour === h ? GREEN : INK,
                        fontSize: "13px",
                        fontWeight: 600,
                        cursor: "pointer",
                        fontFamily: FONT_FAMILY,
                      }}
                    >
                      {String(h).padStart(2, "0")}:00
                    </button>
                  ))}
                </div>
              )}
            </div>

            {error && (
              <p style={{ fontSize: "13px", color: DANGER, margin: "0 0 16px" }}>{error}</p>
            )}

            <div style={{ display: "flex", gap: "10px" }}>
              <button
                type="button"
                onClick={close}
                disabled={submitting}
                style={{
                  flex: 1,
                  minHeight: 48,
                  borderRadius: "12px",
                  border: `1px solid ${BORDER}`,
                  background: "transparent",
                  color: INK,
                  fontSize: "15px",
                  fontWeight: 600,
                  cursor: submitting ? "default" : "pointer",
                  fontFamily: FONT_FAMILY,
                }}
              >
                {t("reschedule_modal_cancel")}
              </button>
              <button
                type="button"
                onClick={confirm}
                disabled={submitting || startHour === null}
                style={{
                  flex: 1,
                  minHeight: 48,
                  borderRadius: "12px",
                  border: "none",
                  background: GREEN,
                  color: DEEP,
                  fontSize: "15px",
                  fontWeight: 700,
                  cursor: submitting || startHour === null ? "default" : "pointer",
                  opacity: submitting || startHour === null ? 0.5 : 1,
                  fontFamily: FONT_FAMILY,
                }}
              >
                {t("reschedule_modal_confirm")}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
