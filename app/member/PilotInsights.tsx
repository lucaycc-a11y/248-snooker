"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type { PilotInsights as Insights } from "@/lib/member/pilot-rpc";

const FONT_STYLE: React.CSSProperties = { fontFamily: "'Good Times', 'Noto Sans TC', system-ui, sans-serif" };
const CARD_STYLE: React.CSSProperties = {
  ...FONT_STYLE,
  borderRadius: 20,
  padding: 20,
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.10)",
};

function isInsights(v: unknown): v is Insights {
  if (typeof v !== "object" || v === null) return false;
  const o = v as Record<string, unknown>;
  return o.enabled === true && Array.isArray(o.rivals) && Array.isArray(o.monthly) && typeof o.recap === "object";
}

/** Win-rate line chart over the 12 months of the year. */
function ProgressChart({ data, label }: { data: Insights["monthly"]; label: string }) {
  const W = 320;
  const H = 120;
  const pad = 14;
  const byMonth = new Map(data.map((m) => [m.month, m]));
  const pts = Array.from({ length: 12 }, (_, i) => i + 1)
    .map((month) => ({ month, row: byMonth.get(month) }))
    .filter((p): p is { month: number; row: Insights["monthly"][number] } => p.row !== undefined)
    .map((p) => ({ x: pad + ((p.month - 1) / 11) * (W - pad * 2), y: pad + (1 - p.row.winRate / 100) * (H - pad * 2), rate: p.row.winRate, month: p.month }));
  const path = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H + 18}`} role="img" aria-label={label} style={{ width: "100%", height: "auto" }}>
      <line x1={pad} x2={W - pad} y1={H / 2} y2={H / 2} stroke="rgba(255,255,255,0.12)" strokeDasharray="3 4" />
      {pts.length > 1 ? <path d={path} fill="none" stroke="#9be24a" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" /> : null}
      {pts.map((p) => (
        <g key={p.month}>
          <circle cx={p.x} cy={p.y} r={4} fill="#9be24a" />
          <text x={p.x} y={p.y - 9} textAnchor="middle" fontSize={9} fill="rgba(255,255,255,0.8)">{p.rate}%</text>
        </g>
      ))}
      {Array.from({ length: 12 }, (_, i) => (
        <text key={i} x={pad + (i / 11) * (W - pad * 2)} y={H + 12} textAnchor="middle" fontSize={9} fill="rgba(255,255,255,0.5)">{i + 1}</text>
      ))}
    </svg>
  );
}

/** Rivals (head-to-head records), monthly progress and yearly recap. */
export default function PilotInsights() {
  const t = useTranslations("memberPilot");
  const [data, setData] = useState<Insights | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const res = await fetch("/api/member/pilot/insights", { cache: "no-store" });
        const json: unknown = await res.json().catch(() => null);
        if (alive && res.ok && isInsights(json)) setData(json);
      } catch {
        /* insights are optional */
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (!data) return null;
  const { recap } = data;
  const rate = recap.matches > 0 ? Math.round((recap.wins / recap.matches) * 100) : 0;

  return (
    <>
      <section style={CARD_STYLE} aria-label={t("progress_title", { year: data.year })}>
        <h3 style={{ margin: "0 0 4px", fontSize: 16 }}>{t("progress_title", { year: data.year })}</h3>
        <p style={{ margin: "0 0 10px", fontSize: 12, color: "rgba(255,255,255,0.6)" }}>
          {t("recap_line", { matches: recap.matches, wins: recap.wins, rate })}
          {recap.bestMonth ? ` ${t("recap_best", { month: recap.bestMonth })}` : ""}
          {recap.busiestMonth ? ` ${t("recap_busiest", { month: recap.busiestMonth })}` : ""}
        </p>
        {data.monthly.length === 0 ? (
          <p style={{ margin: 0, fontSize: 14, color: "rgba(255,255,255,0.65)" }}>{t("progress_empty")}</p>
        ) : (
          <ProgressChart data={data.monthly} label={t("progress_chart_label")} />
        )}
      </section>

      <section style={CARD_STYLE} aria-label={t("rivals_title")}>
        <h3 style={{ margin: "0 0 12px", fontSize: 16 }}>{t("rivals_title")}</h3>
        {data.rivals.length === 0 ? (
          <p style={{ margin: 0, fontSize: 14, color: "rgba(255,255,255,0.65)" }}>{t("rivals_empty")}</p>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
            {data.rivals.map((r) => {
              const total = Math.max(1, r.myWins + r.theirWins);
              return (
                <li key={r.name} style={{ padding: "10px 12px", borderRadius: 14, background: "rgba(255,255,255,0.05)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, fontWeight: 600 }}>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</span>
                    <span>{r.myWins} : {r.theirWins}</span>
                  </div>
                  <div style={{ marginTop: 8, height: 6, borderRadius: 3, background: "rgba(230,70,70,0.45)", overflow: "hidden" }}>
                    <div style={{ width: `${(r.myWins / total) * 100}%`, height: "100%", background: "#9be24a" }} />
                  </div>
                  <div style={{ marginTop: 6, fontSize: 11, color: "rgba(255,255,255,0.55)" }}>{t("rival_matches", { matches: r.matches })}</div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}
