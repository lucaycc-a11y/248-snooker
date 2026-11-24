"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { pilotCached, pilotFetch } from "@/lib/member/pilot-fetch";

const URL_COACH = "/api/member/pilot/coach";
const FRESH_MS = 6 * 60 * 60_000;

const FONT_STYLE: React.CSSProperties = { fontFamily: "'Good Times', 'Noto Sans TC', system-ui, sans-serif" };

type Coach = { summary: string; tips: string[]; source: "mimo" | "rules"; generatedAt: string };

function isCoach(v: unknown): v is Coach {
  if (typeof v !== "object" || v === null) return false;
  const o = v as Record<string, unknown>;
  return o.ready === true && typeof o.summary === "string" && Array.isArray(o.tips) && typeof o.generatedAt === "string";
}

/** AI 戰績分析: written summary and tips from the member's own match record. Hidden until there are enough matches. */
export default function PilotCoach() {
  const t = useTranslations("memberPilot");
  const [coach, setCoach] = useState<Coach | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (force: boolean) => {
    setBusy(true);
    try {
      const json = await pilotFetch(URL_COACH, force);
      if (isCoach(json)) setCoach(json);
    } catch {
      /* optional section */
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    const cached = pilotCached(URL_COACH);
    if (isCoach(cached)) {
      setCoach(cached);
      if (Date.now() - new Date(cached.generatedAt).getTime() < FRESH_MS) return;
    }
    void load(false);
  }, [load]);

  if (!coach) {
    return busy ? (
      <div aria-busy="true" className="animate-pulse" style={{ height: 120, borderRadius: 20, background: "rgba(255,255,255,0.06)" }} />
    ) : null;
  }

  return (
    <section
      aria-label={t("coach_title")}
      style={{ ...FONT_STYLE, borderRadius: 20, padding: 20, background: "linear-gradient(135deg, rgba(93,180,0,0.14), rgba(124,58,237,0.14))", border: "1px solid rgba(255,255,255,0.12)" }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <h3 style={{ margin: 0, fontSize: 16 }}>✦ {t("coach_title")}</h3>
        <button
          type="button"
          onClick={() => void load(true)}
          disabled={busy}
          style={{ minHeight: 36, padding: "0 12px", borderRadius: 10, fontSize: 12, opacity: busy ? 0.5 : 1 }}
        >
          {busy ? t("coach_loading") : t("coach_refresh")}
        </button>
      </div>
      <p style={{ margin: "12px 0 0", fontSize: 15, lineHeight: 1.7, color: "rgba(255,255,255,0.92)" }}>{coach.summary}</p>
      {coach.tips.length > 0 ? (
        <ul style={{ margin: "12px 0 0", padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 8 }}>
          {coach.tips.map((tip) => (
            <li key={tip} style={{ display: "flex", gap: 8, fontSize: 14, lineHeight: 1.6, color: "rgba(255,255,255,0.85)" }}>
              <span aria-hidden style={{ color: "#9be24a" }}>•</span>
              <span>{tip}</span>
            </li>
          ))}
        </ul>
      ) : null}
      <p style={{ margin: "14px 0 0", fontSize: 11, color: "rgba(255,255,255,0.5)" }}>{t("coach_note")}</p>
    </section>
  );
}
