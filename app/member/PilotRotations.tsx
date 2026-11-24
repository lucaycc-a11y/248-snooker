"use client";

import { pilotCached, pilotFetch } from "@/lib/member/pilot-fetch";
import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  parseRotations,
  roundRobinProgress,
  rotationStandings,
  type PilotRotation,
  type RotationMatch,
} from "@/lib/member/pilot-rpc";

const FONT_STYLE: React.CSSProperties = { fontFamily: "'Good Times', 'Noto Sans TC', system-ui, sans-serif" };
const CARD_STYLE: React.CSSProperties = {
  ...FONT_STYLE,
  borderRadius: 20,
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.10)",
  overflow: "hidden",
};
const ACCENT = "#9be24a";
const GOLD = "#ffd24a";

function sideName(m: RotationMatch, side: number): string {
  const names = m.players.filter((p) => p.side === side).map((p) => p.name);
  return names.length ? names.join(" / ") : "—";
}

function sideWon(m: RotationMatch, side: number): boolean {
  return m.players.some((p) => p.side === side && p.isWinner);
}

function sideHasMe(m: RotationMatch, side: number): boolean {
  return m.players.some((p) => p.side === side && p.isMe);
}

function Pill({ children, tone }: { children: React.ReactNode; tone: "accent" | "gold" | "muted" }) {
  const color = tone === "gold" ? GOLD : tone === "accent" ? ACCENT : "rgba(255,255,255,0.7)";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        height: 22,
        padding: "0 10px",
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.04em",
        color,
        border: `1px solid ${color}`,
        background: "rgba(255,255,255,0.04)",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

function RotationCard({ rotation }: { rotation: PilotRotation }) {
  const t = useTranslations("memberPilot");
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const rows = rotationStandings(rotation);
  const styleLabel =
    rotation.style === "winnerStays" ? t("rotWinnerStays") : rotation.style === "roundRobin" ? t("rotRoundRobin") : t("rotOther");
  const date = rotation.startedAt
    ? new Intl.DateTimeFormat(locale, { timeZone: "Asia/Hong_Kong", year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(rotation.startedAt))
    : "";
  const rr = rotation.style === "roundRobin" ? roundRobinProgress(rotation) : null;
  const pct = rr && rr.total > 0 ? Math.min(100, Math.round((rr.played / rr.total) * 100)) : 0;

  return (
    <article style={CARD_STYLE}>
      <div style={{ padding: "18px 18px 14px" }}>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, justifyContent: "space-between" }}>
          <Pill tone="accent">{styleLabel}</Pill>
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>{t("rotMatches", { n: rotation.matches.length })}</span>
        </div>
        <p style={{ margin: "10px 0 0", fontSize: 13, color: "rgba(255,255,255,0.7)" }}>
          {date}
          {rotation.roomName ? ` · ${rotation.roomName}` : ""}
        </p>

        {rr && rr.total > 0 ? (
          <div style={{ marginTop: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "rgba(255,255,255,0.7)", marginBottom: 6 }}>
              <span>{rr.played >= rr.total ? t("rotComplete") : t("rotProgress", { played: rr.played, total: rr.total })}</span>
              <span>{pct}%</span>
            </div>
            <div style={{ height: 6, borderRadius: 999, background: "rgba(255,255,255,0.12)", overflow: "hidden" }}>
              <div style={{ width: `${pct}%`, height: "100%", background: ACCENT, borderRadius: 999 }} />
            </div>
          </div>
        ) : null}
      </div>

      <div role="table" style={{ padding: "0 12px 8px" }}>
        <div role="row" style={{ display: "grid", gridTemplateColumns: "36px 1fr 34px 34px", gap: 6, padding: "6px 8px", fontSize: 11, color: "rgba(255,255,255,0.5)" }}>
          <span role="columnheader">{t("rotRank")}</span>
          <span role="columnheader">{t("rotPlayer")}</span>
          <span role="columnheader" style={{ textAlign: "center" }}>{t("rotWins")}</span>
          <span role="columnheader" style={{ textAlign: "center" }}>{t("rotLosses")}</span>
        </div>
        {rows.map((r) => (
          <div
            key={r.key}
            role="row"
            style={{
              display: "grid",
              gridTemplateColumns: "36px 1fr 34px 34px",
              gap: 6,
              alignItems: "center",
              padding: "10px 8px",
              borderRadius: 12,
              marginTop: 2,
              background: r.isMe ? "rgba(155,226,74,0.12)" : r.mvp ? "rgba(255,210,74,0.08)" : "transparent",
              border: r.isMe ? "1px solid rgba(155,226,74,0.35)" : "1px solid transparent",
            }}
          >
            <span role="cell" style={{ fontSize: 15, fontWeight: 700, color: r.mvp ? GOLD : "rgba(255,255,255,0.85)" }}>{r.rank}</span>
            <span role="cell" style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
              <span style={{ fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</span>
              {r.isMe ? <Pill tone="accent">{t("rotYou")}</Pill> : null}
              {r.mvp ? <Pill tone="gold">{t("rotMvp")}</Pill> : null}
            </span>
            <span role="cell" style={{ textAlign: "center", fontSize: 15, fontWeight: 700, color: ACCENT }}>{r.wins}</span>
            <span role="cell" style={{ textAlign: "center", fontSize: 15, color: "rgba(255,255,255,0.6)" }}>{r.losses}</span>
          </div>
        ))}
      </div>

      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        style={{
          ...FONT_STYLE,
          width: "100%",
          minHeight: 44,
          border: "none",
          borderTop: "1px solid rgba(255,255,255,0.08)",
          background: "rgba(255,255,255,0.03)",
          color: "rgba(255,255,255,0.85)",
          fontSize: 13,
          cursor: "pointer",
        }}
      >
        {open ? t("rotHide") : t("rotShow")} {open ? "▲" : "▼"}
      </button>

      {open ? (
        <ol style={{ listStyle: "none", margin: 0, padding: "10px 12px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
          {rotation.matches.map((m, i) => {
            const aWon = sideWon(m, 0);
            const bWon = sideWon(m, 1);
            return (
              <li key={m.id} style={{ borderRadius: 14, padding: "10px 12px", background: "rgba(255,255,255,0.05)" }}>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginBottom: 6 }}>{t("rotMatchN", { n: m.seq || i + 1 })}</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: aWon ? 700 : 400, color: aWon ? "#fff" : "rgba(255,255,255,0.6)", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {aWon ? "🏆 " : ""}{sideName(m, 0)}{sideHasMe(m, 0) ? ` (${t("rotYou")})` : ""}
                  </span>
                  <span style={{ fontSize: 16, fontWeight: 700, color: ACCENT, whiteSpace: "nowrap" }}>{m.scoreA} : {m.scoreB}</span>
                  <span style={{ fontSize: 14, textAlign: "right", fontWeight: bWon ? 700 : 400, color: bWon ? "#fff" : "rgba(255,255,255,0.6)", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {sideName(m, 1)}{sideHasMe(m, 1) ? ` (${t("rotYou")})` : ""}{bWon ? " 🏆" : ""}
                  </span>
                </div>
              </li>
            );
          })}
        </ol>
      ) : null}
    </article>
  );
}

/** Rotation (輪流賽) cards: standings with MVP, per-match results, round-robin progress. Hidden when there are none. */
export default function PilotRotations() {
  const t = useTranslations("memberPilot");
  const [rotations, setRotations] = useState<PilotRotation[]>([]);

  useEffect(() => {
    let alive = true;
    const cachedRot = parseRotations(pilotCached("/api/member/pilot/rotations"));
    if (cachedRot.enabled) setRotations(cachedRot.rotations);
    void (async () => {
      try {
        const json = await pilotFetch("/api/member/pilot/rotations");
        const parsed = parseRotations(json);
        if (alive && parsed.enabled) setRotations(parsed.rotations);
      } catch {
        // leave the section hidden
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (rotations.length === 0) return null;
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <h3 style={{ ...FONT_STYLE, margin: 0, fontSize: 16, fontWeight: 700 }}>{t("rotTitle")}</h3>
      {rotations.map((r) => (
        <RotationCard key={r.id} rotation={r} />
      ))}
    </section>
  );
}
