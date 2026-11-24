"use client";

import { pilotCached, pilotFetch } from "@/lib/member/pilot-fetch";
import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { exportFramed, frameFileExt, type FrameKind } from "@/lib/pilot/frame-export";

const FONT_STYLE: React.CSSProperties = { fontFamily: "'Good Times', 'Noto Sans TC', system-ui, sans-serif" };

type ClipItem = {
  id: string; kind: string; label: string; room: string; scoreA: number | null; scoreB: number | null
  players: string[]; createdAt: string; expiresAt: string; url: string
};

function parseClips(v: unknown): ClipItem[] | null {
  if (typeof v !== "object" || v === null) return null;
  const o = v as Record<string, unknown>;
  if (o.enabled !== true || !Array.isArray(o.clips)) return null;
  return o.clips.flatMap((c): ClipItem[] => {
    if (typeof c !== "object" || c === null) return [];
    const r = c as Record<string, unknown>;
    if (typeof r.id !== "string" || typeof r.url !== "string") return [];
    return [{
      id: r.id, kind: typeof r.kind === "string" ? r.kind : "manual", label: typeof r.label === "string" ? r.label : "",
      room: typeof r.room === "string" ? r.room : "", scoreA: typeof r.scoreA === "number" ? r.scoreA : null,
      scoreB: typeof r.scoreB === "number" ? r.scoreB : null,
      players: Array.isArray(r.players) ? r.players.filter((p): p is string => typeof p === "string") : [],
      createdAt: typeof r.createdAt === "string" ? r.createdAt : "", expiresAt: typeof r.expiresAt === "string" ? r.expiresAt : "", url: r.url,
    }];
  });
}

/** "我的精華": the member's saved Space Pilot clips (kept 30 days), with Photo Booth frame download. */
export default function PilotClips() {
  const t = useTranslations("memberPilot");
  const [clips, setClips] = useState<ClipItem[] | null>(null);
  const [working, setWorking] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const json = await pilotFetch("/api/member/pilot/clips");
      setClips(parseClips(json));
    } catch {
      /* optional section */
    }
  }, []);

  useEffect(() => {
    const cached = pilotCached("/api/member/pilot/clips");
    if (cached) setClips(parseClips(cached));
    void load();
  }, [load]);

  async function remove(id: string) {
    const res = await fetch(`/api/member/pilot/clips?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    if (res.ok) setClips((list) => (list ? list.filter((c) => c.id !== id) : list));
  }

  async function download(c: ClipItem, kind: FrameKind) {
    setWorking(c.id + kind);
    try {
      const blob = await exportFramed(c.url, kind, {
        label: c.label, room: c.room, scoreA: c.scoreA, scoreB: c.scoreB, players: c.players,
        dateIso: c.createdAt, qrUrl: window.location.origin,
      });
      if (!blob) return;
      const file = new File([blob], `space-pilot.${frameFileExt(blob)}`, { type: blob.type });
      try {
        if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: "Space Pilot" });
          return;
        }
      } catch {
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.name;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setWorking(null);
    }
  }

  if (!clips) return null;
  return (
    <section style={{ ...FONT_STYLE, borderRadius: 20, padding: 20, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)" }} aria-label={t("clips_title")}>
      <h3 style={{ margin: "0 0 4px", fontSize: 16 }}>{t("clips_title")}</h3>
      <p style={{ margin: "0 0 12px", fontSize: 12, color: "rgba(255,255,255,0.6)" }}>{t("clips_hint")}</p>
      {clips.length === 0 ? (
        <p style={{ margin: 0, fontSize: 14, color: "rgba(255,255,255,0.65)" }}>{t("clips_empty")}</p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
          {clips.map((c) => (
            <figure key={c.id} style={{ margin: 0, borderRadius: 14, overflow: "hidden", background: "#000" }}>
              <video src={c.url} controls playsInline muted preload="metadata" style={{ display: "block", width: "100%", aspectRatio: "16 / 9", objectFit: "cover" }} />
              <figcaption style={{ padding: 10, fontSize: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                <span>{c.label}{c.scoreA !== null && c.scoreB !== null ? ` · ${c.scoreA}:${c.scoreB}` : ""}</span>
                <span style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <button type="button" disabled={working !== null} onClick={() => void download(c, "winner45")} style={{ minHeight: 34, padding: "0 10px", borderRadius: 8 }}>{t("clip_frame_45")}</button>
                  <button type="button" disabled={working !== null} onClick={() => void download(c, "story916")} style={{ minHeight: 34, padding: "0 10px", borderRadius: 8 }}>{t("clip_frame_916")}</button>
                  <button type="button" onClick={() => void remove(c.id)} style={{ minHeight: 34, padding: "0 10px", borderRadius: 8 }}>{t("delete")}</button>
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
      )}
    </section>
  );
}
