"use client"

// Right sidebar for /book's redesign: "你的預約" summary card (date, slot
// count/hours, total price, CTA) + "已選時段" card listing every selected
// slot individually with a per-slot remove action. Replaces the old
// SummaryCard/MobilePriceBar pair — same component renders both the desktop
// sticky sidebar and (via `variant="mobile"`) the fixed bottom bar.
import { useTranslations } from "next-intl"
import { tokens } from "@/app/styles/tokens"
import type { SelectedBlock } from "@/lib/booking/slots"

const BOOK_GREEN = "#22c55e"

function fmtDateLabel(dateStr: string, locale: string): string {
  const d = new Date(`${dateStr}T00:00:00`)
  return d.toLocaleDateString(locale === "en" ? "en-US" : "zh-HK", {
    month: "long",
    day: "numeric",
    weekday: "short",
  })
}

export function SelectionSidebar({
  runs,
  totalHours,
  totalPrice,
  currency,
  ctaLabel,
  ctaDisabled,
  onCta,
  onRemoveRun,
  locale,
  variant = "desktop",
}: {
  runs: SelectedBlock[]
  totalHours: number
  totalPrice: number
  currency: string
  ctaLabel: string
  ctaDisabled: boolean
  onCta: () => void
  onRemoveRun: (run: SelectedBlock) => void
  locale: string
  variant?: "desktop" | "mobile"
}) {
  const t = useTranslations("book")
  const primaryDate = runs[0]?.date

  if (variant === "mobile") {
    return (
      <div className="selection-sidebar selection-sidebar--mobile">
        <div className="selection-sidebar__mobile-info">
          <span className="selection-sidebar__mobile-hours">
            {totalHours > 0
              ? `${totalHours} ${t("hours")}`
              : t("select_date")}
          </span>
          <span className="selection-sidebar__mobile-price">
            {currency} ${totalPrice}
          </span>
        </div>
        <button
          type="button"
          className="selection-sidebar__cta"
          disabled={ctaDisabled}
          onClick={onCta}
          data-cms-key="book.continue"
        >
          {ctaLabel}
        </button>
        <style jsx>{`
          .selection-sidebar--mobile {
            display: flex;
            align-items: center;
            gap: 16px;
            padding: 12px 16px;
            border-top: 1px solid ${tokens.colors.border};
            background: rgba(0, 0, 0, 0.92);
            backdrop-filter: ${tokens.glass.surface};
          }
          .selection-sidebar__mobile-info {
            display: flex;
            flex-direction: column;
            flex: 1;
            min-width: 0;
          }
          .selection-sidebar__mobile-hours {
            font-size: 12px;
            color: ${tokens.colors.textMuted};
          }
          .selection-sidebar__mobile-price {
            font-family: ${tokens.font.display};
            font-size: 24px;
            color: ${tokens.colors.text};
            letter-spacing: 0.01em;
          }
          .selection-sidebar__cta {
            min-height: 44px;
            padding: 0 24px;
            border-radius: ${tokens.radius.button};
            border: none;
            background: ${BOOK_GREEN};
            color: #000;
            font-size: 15px;
            font-weight: 600;
            cursor: pointer;
            transition: opacity 200ms ${tokens.easing.spring};
          }
          .selection-sidebar__cta:disabled {
            opacity: 0.35;
            cursor: not-allowed;
          }
        `}</style>
      </div>
    )
  }

  return (
    <div className="selection-sidebar">
      {/* 你的預約 */}
      <div className="selection-sidebar__card">
        <h3 className="selection-sidebar__title" data-cms-key="book.your_booking">
          {t("your_booking")}
        </h3>

        {primaryDate ? (
          <>
            <div className="selection-sidebar__row">
              <span className="selection-sidebar__label">{t("date")}</span>
              <span className="selection-sidebar__value">
                {fmtDateLabel(primaryDate, locale)}
              </span>
            </div>
            <div className="selection-sidebar__row">
              <span className="selection-sidebar__label">{t("time_slot")}</span>
              <span className="selection-sidebar__value">
                {t("slots_selected", { count: runs.length })} · {totalHours}{" "}
                {t("hours")}
              </span>
            </div>
          </>
        ) : (
          <p className="selection-sidebar__empty">{t("select_date")}</p>
        )}

        <div className="selection-sidebar__total-row">
          <span className="selection-sidebar__label">{t("total")}</span>
          <span className="selection-sidebar__total">
            {currency} ${totalPrice}
          </span>
        </div>

        <button
          type="button"
          className="selection-sidebar__cta"
          disabled={ctaDisabled}
          onClick={onCta}
          data-cms-key="book.continue"
        >
          {ctaLabel}
        </button>
      </div>

      {/* 已選時段 */}
      <div className="selection-sidebar__card">
        <h3 className="selection-sidebar__title" data-cms-key="book.selected_slots_title">
          {t("selected_slots_title")}
        </h3>

        {runs.length === 0 ? (
          <p className="selection-sidebar__empty" data-cms-key="book.no_slots_selected">
            {t("no_slots_selected")}
          </p>
        ) : (
          <ul className="selection-sidebar__list">
            {runs.map((run) => (
              <li
                key={`${run.date}-${run.tableNumber}-${run.startHour}`}
                className="selection-sidebar__item"
              >
                <span className="selection-sidebar__item-text">
                  {fmtDateLabel(run.date, locale)} · {t("table_label")} #
                  {run.tableNumber} ·{" "}
                  {String(run.startHour).padStart(2, "0")}:00–
                  {String(run.startHour + run.duration).padStart(2, "0")}:00
                </span>
                <button
                  type="button"
                  className="selection-sidebar__remove"
                  aria-label={t("remove_slot")}
                  onClick={() => onRemoveRun(run)}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <style jsx>{`
        .selection-sidebar {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .selection-sidebar__card {
          border: 1px solid ${tokens.colors.border};
          border-radius: ${tokens.radius.card};
          padding: 20px;
        }
        .selection-sidebar__title {
          font-family: ${tokens.font.display};
          font-size: 18px;
          letter-spacing: 0.02em;
          color: ${tokens.colors.text};
          margin: 0 0 14px;
        }
        .selection-sidebar__row {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          margin-bottom: 8px;
          font-size: 14px;
        }
        .selection-sidebar__label {
          color: ${tokens.colors.textMuted};
        }
        .selection-sidebar__value {
          color: ${tokens.colors.text};
          font-weight: 500;
          text-align: right;
        }
        .selection-sidebar__empty {
          font-size: 13px;
          color: ${tokens.colors.textMuted};
          margin: 0 0 14px;
        }
        .selection-sidebar__total-row {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          margin: 14px 0 18px;
          padding-top: 14px;
          border-top: 1px solid ${tokens.colors.border};
        }
        .selection-sidebar__total {
          font-family: ${tokens.font.display};
          font-size: 40px;
          line-height: 1;
          letter-spacing: 0.01em;
          color: ${tokens.colors.text};
        }
        .selection-sidebar__cta {
          width: 100%;
          min-height: 44px;
          border-radius: ${tokens.radius.button};
          border: none;
          background: ${BOOK_GREEN};
          color: #000;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          transition: opacity 200ms ${tokens.easing.spring};
        }
        .selection-sidebar__cta:disabled {
          opacity: 0.35;
          cursor: not-allowed;
        }
        .selection-sidebar__list {
          list-style: none;
          margin: 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .selection-sidebar__item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          padding: 8px 10px;
          border-radius: ${tokens.radius.input};
          background: rgba(255, 255, 255, 0.04);
          font-size: 13px;
        }
        .selection-sidebar__item-text {
          color: ${tokens.colors.text};
        }
        .selection-sidebar__remove {
          width: 24px;
          height: 24px;
          min-width: 24px;
          border-radius: 50%;
          border: 1px solid rgba(255, 255, 255, 0.15);
          background: transparent;
          color: ${tokens.colors.textMuted};
          font-size: 16px;
          line-height: 1;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition:
            background 200ms ${tokens.easing.spring},
            color 200ms ${tokens.easing.spring};
        }
        .selection-sidebar__remove:hover {
          background: ${tokens.colors.danger};
          color: #fff;
          border-color: ${tokens.colors.danger};
        }
      `}</style>
    </div>
  )
}
