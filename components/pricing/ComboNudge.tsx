"use client";

import { useTranslations } from "next-intl";
import type { PricingPeriod } from "@/lib/data/pricing";
import { tokens } from "@/app/styles/tokens";

/**
 * 連訂 nudge for the slot-picking and payment screens. Hidden unless pricing v2
 * applies to the viewer (comboMinHours comes along with the periods). Once any
 * selected block already reaches the combo minimum it flips to a confirmation,
 * so the hint never nags an order that already qualifies. Mirrors the per-block
 * rule in lib/pricing.ts (a single contiguous block of comboMinHours+ hours).
 */
export default function ComboNudge({
  periods,
  blocks,
}: {
  periods: PricingPeriod[];
  blocks: ReadonlyArray<{ duration: number }>;
}) {
  const tCombo = useTranslations("combo");
  const comboMinHours = periods.find((p) => p.comboMinHours != null)?.comboMinHours;
  if (comboMinHours == null) return null;
  const met = blocks.some((b) => b.duration >= comboMinHours);

  return (
    <div
      style={{
        padding: "10px 14px",
        marginBottom: 14,
        border: `1px solid ${tokens.colors.border}`,
        borderRadius: tokens.radius.input,
        background: tokens.colors.brandDim,
      }}
    >
      <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: tokens.colors.textMuted }}>
        {met ? (
          <span data-cms-key="combo.nudge_met">{tCombo("nudge_met")}</span>
        ) : (
          <>
            <b data-cms-key="combo.faq_label" style={{ color: tokens.colors.link, fontWeight: 600 }}>
              {tCombo("faq_label")}
            </b>
            <span data-cms-key="combo.faq_text">{tCombo("faq_text", { hours: comboMinHours })}</span>
          </>
        )}
      </p>
    </div>
  );
}
