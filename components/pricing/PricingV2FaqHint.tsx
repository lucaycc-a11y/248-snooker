import { getActivePricingV2 } from "@/lib/pricing-v2";
import ComboInfoPopup, { COMBO_FOOTNOTE } from "./ComboInfoPopup";

/** Short pricing hint + pop-up for the FAQ page. Hidden unless v2 applies. */
export default async function PricingV2FaqHint() {
  if (!(await getActivePricingV2())) return null;
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
          <b>價錢提示：</b>同一天預訂 2 小時或以上可享連訂價。{COMBO_FOOTNOTE}
        </p>
        <ComboInfoPopup />
      </div>
    </div>
  );
}
