"use client";

import { useEffect, useState } from "react";

const FONT =
  "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Noto Sans TC', 'Helvetica Neue', Helvetica, Arial, sans-serif";

export const COMBO_FOOTNOTE =
  "跨時段預訂會按各時段的連訂價計算，連訂優惠僅適用於同一天的預訂。";

/** Small "了解連訂" button + modal explaining how 連訂 is calculated. */
export default function ComboInfoPopup({
  label = "了解連訂",
  dark = false,
}: {
  label?: string;
  dark?: boolean;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const fg = dark ? "#ffffff" : "#111110";
  const bg = dark ? "#0a0a0a" : "#ffffff";
  const line = dark ? "#2a2a2a" : "rgba(17,17,16,0.14)";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          minHeight: 44,
          padding: "0 18px",
          borderRadius: 999,
          border: `1px solid ${line}`,
          background: "transparent",
          color: "#1a9d5c",
          fontFamily: FONT,
          fontSize: 14,
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        {label}
      </button>
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="連訂說明"
          onClick={() => setOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            background: "rgba(0,0,0,0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 420,
              background: bg,
              color: fg,
              border: `1px solid ${line}`,
              borderRadius: 20,
              padding: "28px 24px 22px",
              fontFamily: FONT,
              animation: "combo-pop .45s cubic-bezier(.34,1.56,.64,1)",
            }}
          >
            <h3 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 6px" }}>連訂更抵</h3>
            <p style={{ fontSize: 13.5, opacity: 0.6, margin: "0 0 16px" }}>Play more, pay less.</p>
            <p style={{ fontSize: 15, lineHeight: 1.7, margin: "0 0 12px" }}>
              同一天連續預訂 2 小時或以上，每個小時均按該時段的連訂價計算。
            </p>
            <p style={{ fontSize: 15, lineHeight: 1.7, margin: "0 0 12px" }}>{COMBO_FOOTNOTE}</p>
            <p
              style={{
                fontSize: 14,
                lineHeight: 1.7,
                margin: "0 0 20px",
                padding: "12px 14px",
                border: `1px solid ${line}`,
                borderRadius: 12,
              }}
            >
              例如預訂 16:00–20:00：下午連訂價 × 2 + 黃金連訂價 × 2。
            </p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              style={{
                width: "100%",
                minHeight: 48,
                borderRadius: 999,
                border: "none",
                background: "linear-gradient(180deg,#22b86b,#1a9d5c)",
                color: "#fff",
                fontFamily: FONT,
                fontSize: 15,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              明白
            </button>
          </div>
          <style>{`@keyframes combo-pop{from{opacity:0;transform:scale(.92) translateY(10px)}to{opacity:1;transform:none}}
          @media (prefers-reduced-motion: reduce){[role=dialog] > div{animation:none !important}}`}</style>
        </div>
      )}
    </>
  );
}
