import { getActivePricingV2 } from "@/lib/pricing-v2";
import { getTranslations } from "next-intl/server";
import ComboInfoPopup from "./ComboInfoPopup";

const FONT =
  "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Noto Sans TC', 'Helvetica Neue', Helvetica, Arial, sans-serif";

/**
 * 連訂 tagline + rules link + required footnote. The per-period 連訂 rates now
 * live inside the pricing cards; this block stays as the explainer underneath.
 * Server component: renders nothing unless pricing v2 applies to the viewer
 * (admin before go-live, everyone after), so the public sees none of it before
 * the cutover.
 */
export default async function ComboPricingNote({ variant = "dark" }: { variant?: "dark" | "light" }) {
  const v2 = await getActivePricingV2();
  if (!v2) return null;
  if (Object.keys(v2.comboRates).length === 0) return null;
  const tCombo = await getTranslations("combo");

  const dark = variant === "dark";
  const fg = dark ? "#ffffff" : "#111110";
  const sub = dark ? "rgba(255,255,255,0.55)" : "rgba(17,17,16,0.55)";

  return (
    <section
      data-nav-theme={dark ? "dark" : "light"}
      style={{ background: dark ? "#000" : "#fff", padding: "0 24px 90px", fontFamily: FONT }}
    >
      <div style={{ maxWidth: 720, margin: "0 auto", color: fg, textAlign: "center" }}>
        <h3
          data-cms-key="combo.title"
          style={{ fontSize: "clamp(1.4rem,3vw,1.9rem)", fontWeight: 800, margin: "0 0 4px" }}
        >
          {tCombo("title")}
        </h3>
        <p
          data-cms-key="combo.note_tagline"
          style={{ margin: "0 0 22px", color: sub, fontSize: 15 }}
        >
          {tCombo("note_tagline")}
        </p>
        <div style={{ marginBottom: 18 }}>
          <ComboInfoPopup dark={dark} minHours={v2.comboMinHours} />
        </div>
        <p data-cms-key="combo.footnote" style={{ margin: "0 4px", color: sub, fontSize: 13, lineHeight: 1.7 }}>
          {tCombo("footnote")}
        </p>
      </div>
    </section>
  );
}
