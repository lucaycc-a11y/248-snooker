import { getActivePricingV2 } from "@/lib/pricing-v2";
import { getConfig } from "@/lib/data/getConfig";
import ComboInfoPopup, { COMBO_FOOTNOTE } from "./ComboInfoPopup";

const FONT =
  "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Noto Sans TC', 'Helvetica Neue', Helvetica, Arial, sans-serif";

const NAMES: Record<string, string> = { morning: "上午", afternoon: "下午", evening: "黃金" };

/**
 * 連訂 rate table + tagline + required footnote. Server component: renders
 * nothing unless pricing v2 applies to the viewer (admin before go-live,
 * everyone after), so the public sees none of it before the cutover.
 */
export default async function ComboPricingNote({ variant = "dark" }: { variant?: "dark" | "light" }) {
  const v2 = await getActivePricingV2();
  if (!v2) return null;
  const { periods } = await getConfig();
  const rows = ["morning", "afternoon", "evening"]
    .map((id) => periods.find((p) => p.id === id))
    .filter((p): p is NonNullable<typeof p> => !!p && typeof v2.comboRates[p.id] === "number");
  if (rows.length === 0) return null;

  const dark = variant === "dark";
  const fg = dark ? "#ffffff" : "#111110";
  const sub = dark ? "rgba(255,255,255,0.55)" : "rgba(17,17,16,0.55)";
  const line = dark ? "#2a2a2a" : "rgba(17,17,16,0.12)";

  return (
    <section
      aria-label="連訂價目"
      data-nav-theme={dark ? "dark" : "light"}
      style={{ background: dark ? "#000" : "#fff", padding: "0 24px 90px", fontFamily: FONT }}
    >
      <div style={{ maxWidth: 720, margin: "0 auto", color: fg }}>
        <h3 style={{ fontSize: "clamp(1.4rem,3vw,1.9rem)", fontWeight: 800, margin: "0 0 4px", textAlign: "center" }}>
          透明定價，連訂更抵
        </h3>
        <p style={{ margin: "0 0 28px", textAlign: "center", color: sub, fontSize: 15 }}>
          Play more, pay less. 玩多一點，省多一點
        </p>
        <div style={{ border: `1px solid ${line}`, borderRadius: 18, overflow: "hidden" }}>
          {rows.map((p, i) => (
            <div
              key={p.id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                padding: "16px 20px",
                borderTop: i === 0 ? "none" : `1px solid ${line}`,
              }}
            >
              <div>
                <div style={{ fontWeight: 700, fontSize: 16 }}>{NAMES[p.id] ?? p.id}</div>
                <div style={{ color: sub, fontSize: 13 }}>
                  {p.start}–{p.end}　HK${p.rate} / 小時
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontWeight: 800, fontSize: 20, color: "#1a9d5c" }}>HK${v2.comboRates[p.id]}</div>
                <div style={{ color: sub, fontSize: 12.5 }}>連訂（{v2.comboMinHours} 小時起）</div>
              </div>
            </div>
          ))}
        </div>
        <p style={{ margin: "14px 4px 18px", color: sub, fontSize: 13, lineHeight: 1.7 }}>{COMBO_FOOTNOTE}</p>
        <div style={{ textAlign: "center" }}>
          <ComboInfoPopup dark={dark} />
        </div>
      </div>
    </section>
  );
}
