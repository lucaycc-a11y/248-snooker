"use client"

// Dual-table slot grid for /book's redesign: Table #1 and Table #2 shown
// side-by-side (stacked on mobile) so the user can compare both tables'
// availability without switching tabs, grouped by 上午/下午/晚上. Each cell is
// one of 3 states — available (border only), selected (solid fill), booked
// (disabled, "已被預約"). Each table header shows a live "X / Y 空" count plus
// a one-cell-per-hour progress rail.
import { useMemo, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { useTranslations } from "next-intl"
import { tokens } from "@/app/styles/tokens"
import {
  ALL_TABLES,
  getHongKongNow,
  SLOT_GROUPS,
  tableStatesFor,
  type DaySlot,
} from "@/lib/booking/slots"
import { useHaptic } from "@/lib/useHaptic"

const BOOK_GREEN = "#22c55e"
const MIN_TAP = 44

export function TableSlotGrid({
  dateStr,
  daySlots,
  loading,
  selectedHours,
  totalSelectedHours,
  maxHours,
  activeTable,
  onToggleHour,
  onResumeLocked,
}: {
  dateStr: string
  daySlots: DaySlot[] | null
  loading: boolean
  /** Hours currently selected on this date, per table. */
  selectedHours: Map<number, Set<number>>
  /** Total hours selected across the WHOLE order (every date), for the cap. */
  totalSelectedHours: number
  maxHours: number
  /** The table the current order is locked to (once any hour is picked), or
   * null before any pick. Used to visually de-emphasize the OTHER table's
   * card — a passive hint that this is a single-table order, on top of the
   * confirm dialog that fires on an actual cross-table tap. */
  activeTable: number | null
  onToggleHour: (tableNumber: number, hour: number) => void
  /** Tapping a cell that's the caller's OWN active hold resumes straight to
   * payment instead of toggling a new selection — see BookPage's
   * resumeLockedSlot. */
  onResumeLocked: (date: string, startHour: number, duration: number, tableNumber: number) => void
}) {
  const t = useTranslations("book")
  const haptic = useHaptic()
  const [showToast, setShowToast] = useState(false)

  // All time comparisons use Hong Kong venue time, not the browser's clock.
  const nowHK = useMemo(() => getHongKongNow(), [])
  const isTodayHK = dateStr === nowHK.date

  if (loading || !daySlots) {
    return (
      <div className="table-slot-grid table-slot-grid--loading">
        {ALL_TABLES.map((tn) => (
          <div key={tn} className="table-slot-grid__skeleton" />
        ))}
        <style jsx>{`
          .table-slot-grid--loading {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 16px;
          }
          .table-slot-grid__skeleton {
            height: 420px;
            border-radius: ${tokens.radius.card};
            border: 1px solid ${tokens.colors.border};
            background: linear-gradient(
              90deg,
              ${tokens.colors.surface} 25%,
              ${tokens.colors.surfaceElevated} 50%,
              ${tokens.colors.surface} 75%
            );
            background-size: 200% 100%;
            animation: shimmer 1.4s ease-in-out infinite;
          }
          @keyframes shimmer {
            0% {
              background-position: 200% 0;
            }
            100% {
              background-position: -200% 0;
            }
          }
          @media (max-width: 768px) {
            .table-slot-grid--loading {
              grid-template-columns: 1fr;
            }
          }
        `}</style>
      </div>
    )
  }

  return (
    <div className="table-slot-grid">
      {ALL_TABLES.map((tn) => {
        const mySelected = selectedHours.get(tn) ?? new Set<number>()
        const allHours = SLOT_GROUPS.flatMap((g) => g.hours)
        let freeCount = 0
        const railStates = allHours.map((h) => {
          const states = tableStatesFor(daySlots, dateStr, h, 1)
          const s = states.get(tn) ?? "available"
          if (s === "available" || s === "locked_by_you") freeCount++
          return s
        })

        const isInactive = activeTable !== null && activeTable !== tn

        return (
          <div
            key={tn}
            className="table-slot-grid__table"
            data-inactive={isInactive || undefined}
          >
            <div className="table-slot-grid__header">
              <span className="table-slot-grid__title">
                {t("table_label")} #{tn}
                {activeTable === tn && (
                  <span className="table-slot-grid__active-badge" data-cms-key="book.table_active_badge">
                    {t("table_active_badge")}
                  </span>
                )}
              </span>
              <span className="table-slot-grid__stat">
                {freeCount} / {allHours.length} {t("slots_free")}
              </span>
            </div>

            {/* Mini progress rail — one cell per hour, colour-coded */}
            <div className="table-slot-grid__rail">
              {railStates.map((s, i) => (
                <span
                  key={allHours[i]}
                  className="table-slot-grid__rail-cell"
                  style={{
                    background:
                      s === "booked" || s === "locked"
                        ? tokens.colors.danger
                        : s === "locked_by_you"
                          ? BOOK_GREEN
                          : "rgba(255,255,255,0.15)",
                  }}
                />
              ))}
            </div>

            {SLOT_GROUPS.map((group) => (
              <div key={group.key} className="table-slot-grid__group">
                <span className="table-slot-grid__group-label">
                  {t(`slot_group_${group.key}`)}
                </span>
                <div className="table-slot-grid__cells">
                  {group.hours.map((h) => {
                    const isPast = isTodayHK && h < nowHK.hour
                    const states = tableStatesFor(daySlots, dateStr, h, 1)
                    const state = states.get(tn) ?? "available"
                    const isSelected = mySelected.has(h)
                    const isLockedByYou = state === "locked_by_you"
                    const isTaken = state === "booked" || state === "locked"
                    const isBooked = isTaken || isPast
                    const atCap = !isSelected && totalSelectedHours >= maxHours
                    const disabled = (isBooked || atCap) && !isLockedByYou

                    return (
                      <button
                        key={h}
                        type="button"
                        disabled={disabled && !isSelected}
                        onClick={() => {
                          if (isLockedByYou) {
                            const own = daySlots.find(
                              (s) => s.table_number === tn && s.locked_by_you && s.date === dateStr,
                            )
                            if (own) {
                              onResumeLocked(
                                own.date,
                                parseInt(own.start_time.slice(0, 2), 10),
                                Number(own.duration_hours),
                                tn,
                              )
                              return
                            }
                          }
                          if (isBooked) return
                          if (atCap) {
                            setShowToast(true)
                            setTimeout(() => setShowToast(false), 2000)
                            return
                          }
                          haptic.vibrate(8)
                          onToggleHour(tn, h)
                        }}
                        aria-pressed={isSelected}
                        aria-label={
                          isLockedByYou
                            ? `${h}:00 ${t("table_resume")}`
                            : isTaken
                              ? `${h}:00 ${t("slot_taken")}`
                              : `${h}:00`
                        }
                        title={isLockedByYou ? t("table_locked_by_you") : undefined}
                        className="table-slot-grid__cell"
                        data-state={
                          isSelected
                            ? "selected"
                            : isLockedByYou
                              ? "locked-by-you"
                              : isBooked
                                ? "booked"
                                : "available"
                        }
                      >
                        <span className="table-slot-grid__cell-time">
                          {String(h).padStart(2, "0")}:00
                        </span>
                        {isTaken && !isSelected && !isLockedByYou && (
                          <span className="table-slot-grid__cell-tag">
                            {t("slot_taken")}
                          </span>
                        )}
                        {isLockedByYou && (
                          <span className="table-slot-grid__cell-tag table-slot-grid__cell-tag--resume">
                            {t("table_resume")}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )
      })}

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

      <style jsx>{`
        .table-slot-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }
        .table-slot-grid__table {
          border: 1px solid ${tokens.colors.border};
          border-radius: ${tokens.radius.card};
          padding: 16px;
          transition: opacity 200ms ${tokens.easing.spring};
        }
        .table-slot-grid__table[data-inactive] {
          opacity: 0.5;
        }
        .table-slot-grid__header {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          margin-bottom: 10px;
        }
        .table-slot-grid__title {
          font-family: ${tokens.font.display};
          font-size: 20px;
          letter-spacing: 0.02em;
          color: ${tokens.colors.text};
          display: inline-flex;
          align-items: baseline;
          gap: 8px;
        }
        .table-slot-grid__active-badge {
          font-family: ${tokens.font.sans};
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.04em;
          color: #000;
          background: ${BOOK_GREEN};
          border-radius: 999px;
          padding: 2px 8px;
        }
        .table-slot-grid__stat {
          font-size: 13px;
          color: ${tokens.colors.textMuted};
        }
        .table-slot-grid__rail {
          display: grid;
          grid-template-columns: repeat(18, 1fr);
          gap: 2px;
          margin-bottom: 16px;
        }
        .table-slot-grid__rail-cell {
          height: 4px;
          border-radius: 2px;
          transition: background 200ms ${tokens.easing.spring};
        }
        .table-slot-grid__group {
          margin-bottom: 14px;
        }
        .table-slot-grid__group:last-child {
          margin-bottom: 0;
        }
        .table-slot-grid__group-label {
          display: block;
          font-size: 12px;
          color: ${tokens.colors.textMuted};
          margin-bottom: 6px;
        }
        .table-slot-grid__cells {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 6px;
        }
        .table-slot-grid__cell {
          position: relative;
          min-height: ${MIN_TAP}px;
          border-radius: ${tokens.radius.input};
          border: 1px solid rgba(255, 255, 255, 0.15);
          background: transparent;
          color: ${tokens.colors.text};
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 2px;
          padding: 4px;
          transition:
            background 200ms ${tokens.easing.spring},
            border-color 200ms ${tokens.easing.spring},
            color 200ms ${tokens.easing.spring},
            transform 200ms ${tokens.easing.spring};
        }
        .table-slot-grid__cell:active:not(:disabled) {
          transform: scale(0.96);
        }
        .table-slot-grid__cell[data-state="selected"] {
          background: ${BOOK_GREEN};
          border-color: ${BOOK_GREEN};
          color: #000;
          font-weight: 600;
        }
        .table-slot-grid__cell[data-state="booked"] {
          border-color: rgba(255, 255, 255, 0.06);
          color: ${tokens.colors.textFaint};
          cursor: not-allowed;
        }
        .table-slot-grid__cell[data-state="locked-by-you"] {
          border-color: ${BOOK_GREEN};
          color: ${BOOK_GREEN};
          cursor: pointer;
        }
        .table-slot-grid__cell:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }
        .table-slot-grid__cell-tag {
          font-size: 10px;
          color: ${tokens.colors.danger};
        }
        .table-slot-grid__cell-tag--resume {
          color: ${BOOK_GREEN};
        }

        @media (max-width: 768px) {
          .table-slot-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  )
}
