"use client";

import { useTranslations } from "next-intl";
import { Clock } from "lucide-react";
import type { PricingPeriod } from "@/lib/data/pricing";
import { tokens } from "@/app/styles/tokens";

/**
 * Visual 連訂 hint for the slot-picking and payment screens: a "{hours} 小時起"
 * badge plus each period's standard rate struck through beside its combo rate —
 * prices instead of sentence copy. Hidden unless pricing v2 applies to the
 * viewer (the combo fields ride along on the periods).
 */
export default function ComboNudge({ periods }: { periods: PricingPeriod[] }) {
  const tCombo = useTranslations("combo");
  const comboMinHours = periods.find((p) => p.comboMinHours != null)?.comboMinHours;
  const comboPeriods = periods.filter((p) => p.comboRate != null);
  if (comboMinHours == null || comboPeriods.length === 0) return null;

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: "8px 14px",
        padding: "10px 14px",
        marginBottom: 14,
        border: `1px solid ${tokens.colors.border}`,
        borderRadius: tokens.radius.input,
        background: tokens.colors.brandDim,
      }}
    >
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "3px 10px",
          borderRadius: tokens.radius.pill,
          border: `1px solid ${tokens.colors.border}`,
          fontSize: 12,
          fontWeight: 600,
          color: tokens.colors.link,
          whiteSpace: "nowrap",
        }}
      >
        <Clock size={13} style={{ flexShrink: 0 }} />
        <span data-cms-key="combo.min_hours_badge">
          {tCombo("min_hours_badge", { hours: comboMinHours })}
        </span>
      </span>
      <span style={{ display: "inline-flex", flexWrap: "wrap", alignItems: "baseline", gap: "2px 12px" }}>
        {comboPeriods.map((p) => (
          <span key={p.id} style={{ display: "inline-flex", alignItems: "baseline", gap: 5, whiteSpace: "nowrap" }}>
            <span style={{ fontSize: 12, color: tokens.colors.textFaint }}>
              {tCombo(`period_${p.id}_short`)}
            </span>
            <s style={{ fontSize: 12, color: tokens.colors.textFaint, fontVariantNumeric: "tabular-nums" }}>
              HK${p.rate}
            </s>
            <b style={{ fontSize: 15, color: tokens.colors.link, fontVariantNumeric: "tabular-nums" }}>
              HK${p.comboRate}
            </b>
          </span>
        ))}
        <span data-cms-key="combo.rate_unit" style={{ fontSize: 12, color: tokens.colors.textFaint }}>
          {tCombo("rate_unit")}
        </span>
      </span>
    </div>
  );
}
