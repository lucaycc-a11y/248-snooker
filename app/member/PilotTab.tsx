"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type { PilotMatch, PilotStats } from "@/lib/member/pilot-rpc";
import PilotCoach from "./PilotCoach";
import PilotInsights from "./PilotInsights";
import PilotRotations from "./PilotRotations";
import PilotClips from "./PilotClips";
import { renderPosterBlob } from "./pilot-poster";
import { pilotCached, pilotFetch, prefetchPilot } from "@/lib/member/pilot-fetch";

type PilotPhoto = { id: string; kind: string; createdAt: string; url: string | null };

type PilotPayload = {
  enabled: boolean;
  stats?: PilotStats | null;
  matches: PilotMatch[];
  photos: PilotPhoto[];
};

type LoadState = "loading" | "ready" | "error";
type SubTab = "overview" | "matches" | "media";

// Good Times for everything on this tab (Chinese falls back to Noto Sans TC, which Good Times lacks).
const FONT_STYLE: React.CSSProperties = { fontFamily: "'Good Times', 'Noto Sans TC', system-ui, sans-serif" };

const CARD_STYLE: React.CSSProperties = {
  ...FONT_STYLE,
  borderRadius: 20,
  padding: 20,
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.10)",
};

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("zh-HK", {
    timeZone: "Asia/Hong_Kong",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function isPayload(value: unknown): value is PilotPayload {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.enabled === "boolean" && Array.isArray(v.matches) && Array.isArray(v.photos);
}

/** Space Pilot tab on /member: score records and the member's own private photos. */
export default function PilotTab() {
  const t = useTranslations("memberPilot");
  const [state, setState] = useState<LoadState>("loading");
  const [data, setData] = useState<PilotPayload | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [tab, setTab] = useState<SubTab>("overview");

  const load = useCallback(async () => {
    try {
      const json = await pilotFetch("/api/member/pilot");
      if (!isPayload(json)) {
        setState((prev) => (prev === "ready" ? prev : "error"));
        return;
      }
      setData(json);
      setState("ready");
    } catch {
      setState((prev) => (prev === "ready" ? prev : "error"));
    }
  }, []);

  useEffect(() => {
    // Start every Space Pilot request at once, and paint last visit's data immediately.
    prefetchPilot();
    const cached = pilotCached("/api/member/pilot");
    if (isPayload(cached)) {
      setData(cached);
      setState("ready");
    }
    void load();
  }, [load]);

  async function sharePoster(m: PilotMatch) {
    const blob = await renderPosterBlob(
      m,
      { won: t("won"), lost: t("lost"), game: m.game === "nineBall" ? t("game_nine") : t("game_eight"), me: t("me") },
      t("me"),
    );
    if (!blob) return;
    const file = new File([blob], `space-pilot-${m.id.slice(0, 8)}.png`, { type: "image/png" });
    try {
      if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: "Space Pilot" });
        return;
      }
    } catch {
      return; // user cancelled the share sheet
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function removePhoto(id: string) {
    setConfirmId(null);
    const res = await fetch(`/api/member/pilot/photos?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    if (res.ok) {
      setData((prev) => (prev ? { ...prev, photos: prev.photos.filter((p) => p.id !== id) } : prev));
    }
  }

  if (state === "loading") {
    return (
      <div aria-busy="true" aria-label={t("loading")} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 12 }}>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse" style={{ height: 84, borderRadius: 20, background: "rgba(255,255,255,0.06)" }} />
          ))}
        </div>
        {[120, 220].map((h) => (
          <div key={h} className="animate-pulse" style={{ height: h, borderRadius: 20, background: "rgba(255,255,255,0.06)" }} />
        ))}
      </div>
    );
  }
  if (state === "error" || !data) {
    return (
      <div style={CARD_STYLE}>
        <p style={{ margin: 0, color: "rgba(255,255,255,0.8)" }}>{t("error")}</p>
        <button type="button" onClick={() => { setState("loading"); void load(); }} style={{ marginTop: 12, minHeight: 44, padding: "0 18px", borderRadius: 12 }}>
          {t("retry")}
        </button>
      </div>
    );
  }

  if (!data.enabled) {
    return (
      <div style={{ ...CARD_STYLE, opacity: 0.6, textAlign: "center", padding: 32 }} aria-disabled="true">
        <span style={{ display: "inline-block", padding: "4px 12px", borderRadius: 999, background: "rgba(255,255,255,0.12)", fontSize: 12, letterSpacing: 1 }}>
          {t("beta")}
        </span>
        <h3 style={{ margin: "14px 0 6px", fontSize: 18 }}>{t("title")}</h3>
        <p style={{ margin: 0, color: "rgba(255,255,255,0.7)", fontSize: 14 }}>{t("locked")}</p>
      </div>
    );
  }

  // Lifetime numbers from the server; fall back to the recent list if they are missing.
  const finished = data.matches.filter((m) => m.finished);
  const recentWins = finished.filter((m) => m.won).length;
  const stats = data.stats ?? {
    matches: finished.length,
    wins: recentWins,
    winRate: finished.length > 0 ? Math.round((recentWins / finished.length) * 100) : 0,
    longestStreak: 0,
    topOpponent: null,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, ...FONT_STYLE }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <h2 style={{ margin: 0, fontSize: 20 }}>{t("title")}</h2>
        <span style={{ padding: "3px 10px", borderRadius: 999, background: "rgba(93,180,0,0.2)", color: "#9be24a", fontSize: 11, letterSpacing: 1 }}>
          {t("beta")}
        </span>
      </div>

      <div
        role="tablist"
        aria-label={t("title")}
        style={{ position: "sticky", top: 70, zIndex: 20, display: "flex", gap: 4, padding: 4, borderRadius: 14, background: "rgba(20,24,32,0.85)", border: "1px solid rgba(255,255,255,0.10)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)" }}
      >
        {([
          ["overview", t("tab_overview")],
          ["matches", t("tab_matches")],
          ["media", t("tab_media")],
        ] as const).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            style={{ flex: 1, minHeight: 40, borderRadius: 10, border: "none", fontSize: 14, fontWeight: tab === id ? 700 : 500, color: tab === id ? "#fff" : "rgba(255,255,255,0.6)", background: tab === id ? "rgba(255,255,255,0.14)" : "transparent", cursor: "pointer", transition: "background .2s, color .2s" }}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "overview" ? (
      <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 12 }}>
        {[
          { label: t("stat_matches"), value: String(stats.matches) },
          { label: t("stat_wins"), value: String(stats.wins) },
          { label: t("stat_rate"), value: `${stats.winRate}%` },
          { label: t("stat_streak"), value: String(stats.longestStreak) },
        ].map((stat) => (
          <div key={stat.label} style={{ ...CARD_STYLE, textAlign: "center", padding: 16 }}>
            <div style={{ fontSize: 26, fontWeight: 700 }}>{stat.value}</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.65)" }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {stats.topOpponent ? (
        <div style={{ ...CARD_STYLE, padding: 16 }}>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.65)" }}>{t("top_opponent")}</div>
          <div style={{ fontSize: 16, fontWeight: 600, marginTop: 4 }}>
            {stats.topOpponent.name}
            <span style={{ fontWeight: 400, fontSize: 13, color: "rgba(255,255,255,0.7)" }}>
              {" · "}
              {t("top_opponent_record", { matches: stats.topOpponent.matches, wins: stats.topOpponent.myWins })}
            </span>
          </div>
        </div>
      ) : null}

      <PilotCoach />
      <PilotInsights />
      </>
      ) : null}

      {tab === "matches" ? (
      <>
      <PilotRotations />

      <section style={CARD_STYLE} aria-label={t("records")}>
        <h3 style={{ margin: "0 0 12px", fontSize: 16 }}>{t("records")}</h3>
        {data.matches.length === 0 ? (
          <p style={{ margin: 0, color: "rgba(255,255,255,0.65)", fontSize: 14 }}>{t("empty_matches")}</p>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
            {data.matches.map((m) => (
              <li key={m.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 14, background: "rgba(255,255,255,0.05)" }}>
                <span
                  style={{
                    minWidth: 56, textAlign: "center", padding: "4px 8px", borderRadius: 999, fontSize: 12, fontWeight: 700,
                    background: !m.finished ? "rgba(255,255,255,0.12)" : m.won ? "rgba(93,180,0,0.25)" : "rgba(230,70,70,0.22)",
                  }}
                >
                  {!m.finished ? t("unfinished") : m.won ? t("won") : t("lost")}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>
                    {m.game === "nineBall" ? t("game_nine") : t("game_eight")} · {m.myScore} : {m.oppScore}
                  </div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {m.opponents.length > 0 ? `vs ${m.opponents.join(", ")}` : ""} {m.roomName ? `· ${m.roomName}` : ""}
                  </div>
                </div>
                <time style={{ fontSize: 12, color: "rgba(255,255,255,0.55)" }} dateTime={m.startedAt}>{formatDate(m.startedAt)}</time>
                {m.finished ? (
                  <button type="button" onClick={() => void sharePoster(m)} aria-label={t("poster_share")} style={{ minHeight: 36, padding: "0 12px", borderRadius: 10, fontSize: 12 }}>
                    {t("poster_share")}
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      </>
      ) : null}

      {tab === "media" ? (
      <>
      <PilotClips />

      <section style={CARD_STYLE} aria-label={t("photos")}>
        <h3 style={{ margin: "0 0 4px", fontSize: 16 }}>{t("photos")}</h3>
        <p style={{ margin: "0 0 12px", fontSize: 12, color: "rgba(255,255,255,0.6)" }}>{t("photos_private")}</p>
        {data.photos.length === 0 ? (
          <p style={{ margin: 0, color: "rgba(255,255,255,0.65)", fontSize: 14 }}>{t("empty_photos")}</p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 10 }}>
            {data.photos.map((p) => (
              <figure key={p.id} style={{ margin: 0, position: "relative", borderRadius: 14, overflow: "hidden", background: "#000" }}>
                {p.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.url} alt={t("photo_alt")} loading="lazy" decoding="async" style={{ display: "block", width: "100%", aspectRatio: "1 / 1", objectFit: "cover" }} />
                ) : null}
                <figcaption style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: 8, display: "flex", justifyContent: "space-between", alignItems: "center", background: "linear-gradient(transparent, rgba(0,0,0,0.7))", fontSize: 11 }}>
                  <span>{formatDate(p.createdAt)}</span>
                  {confirmId === p.id ? (
                    <span style={{ display: "flex", gap: 6 }}>
                      <button type="button" onClick={() => void removePhoto(p.id)} style={{ minHeight: 32, padding: "0 10px", borderRadius: 8, background: "#e64646", color: "#fff" }}>{t("delete_yes")}</button>
                      <button type="button" onClick={() => setConfirmId(null)} style={{ minHeight: 32, padding: "0 10px", borderRadius: 8 }}>{t("delete_no")}</button>
                    </span>
                  ) : (
                    <button type="button" onClick={() => setConfirmId(p.id)} aria-label={t("delete")} style={{ minHeight: 32, padding: "0 10px", borderRadius: 8 }}>{t("delete")}</button>
                  )}
                </figcaption>
              </figure>
            ))}
          </div>
        )}
      </section>
      </>
      ) : null}
    </div>
  );
}
