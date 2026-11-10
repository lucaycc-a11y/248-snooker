"use client";

import { useTranslations } from "next-intl";
import { Clock } from "lucide-react";
import type { PricingPeriod } from "@/lib/data/pricing";
import { tokens } from "@/app/styles/tokens";

/**
 * Visual 連訂 hint for the slot-picking and payment screens: a single
 * "2 小時起會有優惠" pill (icon + text, no prices — the struck-through
 * comparison lives on the total instead). Hidden unless pricing v2 applies to
 * the viewer (the combo fields ride along on the periods).
 */
export default function ComboNudge({ periods }: { periods: PricingPeriod[] }) {
  const tCombo = useTranslations("combo");
  const comboMinHours = periods.find((p) => p.comboMinHours != null)?.comboMinHours;
  if (comboMinHours == null) return null;

  return (
    <div style={{ marginBottom: 14 }}>
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "4px 12px",
          borderRadius: tokens.radius.pill,
          border: `1px solid ${tokens.colors.border}`,
          background: tokens.colors.brandDim,
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
    </div>
  );
}
