import { getActivePricingV2 } from "@/lib/pricing-v2";
import { getTranslations } from "next-intl/server";
import ComboInfoPopup from "./ComboInfoPopup";

/** Short pricing hint + pop-up for the FAQ page. Hidden unless v2 applies. */
export default async function PricingV2FaqHint() {
  const v2 = await getActivePricingV2();
  if (!v2) return null;
  const tCombo = await getTranslations("combo");
  return (
    <div
      style={{
        maxWidth: 720,
        margin: "0 auto",
        padding: "20px 24px 0",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Noto Sans TC', sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          padding: "14px 18px",
          border: "1px solid rgba(17,17,16,0.14)",
          borderRadius: 16,
          background: "#fff",
        }}
      >
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: "#111110", flex: "1 1 240px" }}>
          <b data-cms-key="combo.faq_label">{tCombo("faq_label")}</b>
          <span data-cms-key="combo.faq_text">{tCombo("faq_text", { hours: v2.comboMinHours })}</span>
          <span data-cms-key="combo.footnote">{tCombo("footnote")}</span>
        </p>
        <ComboInfoPopup minHours={v2.comboMinHours} />
      </div>
    </div>
  );
}
