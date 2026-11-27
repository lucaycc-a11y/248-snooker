"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useTranslations } from "next-intl";

const GT = "'Good Times', 'JetBrains Mono', monospace";
const INK = "#f5f5f7";
const SUBTLE = "#A1A1A6";
const GREEN = "#22C55E";

/** Launch info provided by the /spacepilot page; absent in the member preview tab (which stays "beta"). */
export type Launch = { at: number; launched: boolean };
export const LaunchContext = createContext<Launch | null>(null);
export const useLaunch = () => useContext(LaunchContext);

function parts(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };
}
const two = (n: number) => String(n).padStart(2, "0");

/** Apple-style launch countdown: quiet glass capsule, large Good Times numerals. Flips to a launched note at zero. */
export default function SpacePilotCountdown() {
  const t = useTranslations("memberPilotIntro");
  const launch = useLaunch();
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  if (!launch) return null;
  const done = launch.launched || (now !== null && now >= launch.at);
  if (done) {
    return <p style={{ margin: "10px auto 0", fontSize: 14, letterSpacing: "0.02em", color: GREEN }}>{t("launchedNote")}</p>;
  }

  const p = parts(now === null ? 0 : launch.at - now);
  const cells: Array<[string, string]> = [
    [now === null ? "--" : String(p.d), t("unitDays")],
    [now === null ? "--" : two(p.h), t("unitHours")],
    [now === null ? "--" : two(p.m), t("unitMinutes")],
    [now === null ? "--" : two(p.s), t("unitSeconds")],
  ];

  return (
    <div style={{ marginTop: 22 }}>
      <div style={{ fontFamily: GT, fontSize: 11, letterSpacing: "0.2em", color: GREEN, textTransform: "uppercase" }}>{t("launchLabel")}</div>
      <div
        role="timer"
        aria-label={t("launchLabel")}
        style={{
          display: "inline-flex",
          alignItems: "stretch",
          marginTop: 14,
          borderRadius: 22,
          border: "1px solid rgba(255,255,255,0.1)",
          background: "rgba(255,255,255,0.05)",
          backdropFilter: "blur(20px) saturate(180%)",
          WebkitBackdropFilter: "blur(20px) saturate(180%)",
          overflow: "hidden",
        }}
      >
        {cells.map(([value, label], i) => (
          <div key={label} style={{ minWidth: "clamp(62px, 14vw, 92px)", padding: "14px 10px 12px", textAlign: "center", borderLeft: i === 0 ? "none" : "1px solid rgba(255,255,255,0.08)" }}>
            <div style={{ fontFamily: GT, fontSize: "clamp(24px, 5.2vw, 38px)", lineHeight: 1, color: INK, fontVariantNumeric: "tabular-nums" }}>{value}</div>
            <div style={{ marginTop: 8, fontSize: 11, letterSpacing: "0.08em", color: SUBTLE }}>{label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
