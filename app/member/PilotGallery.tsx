"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";

// Real Space Pilot iPad screens (demo data, made-up names) for the public /spacepilot page:
// game modes, Room Link, and results. Kept separate from PilotIntro to keep that file focused on the scroll story.

const INK = "#f5f5f7";
const SUBTLE = "#A1A1A6";
const BORDER = "rgba(255,255,255,0.1)";
const GREEN = "#22C55E";
const GLASS_BG = "rgba(255,255,255,0.05)";
const FONT_FAMILY =
  "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'PingFang HK', 'Noto Sans TC', 'Helvetica Neue', Helvetica, Arial, sans-serif";
const HEADING = "'Good Times', 'Noto Sans TC', system-ui, sans-serif";
const EASE = [0.16, 1, 0.3, 1] as const;
const SHOT = "/pilot-intro/shots";

// Source images are 1600x1103 (the iPad's aspect ratio), except the two-room pair which is 2000x754.
const W = 1600;
const H = 1103;

const SHADOW = "0 1px 2px rgba(0,0,0,0.6), 0 14px 28px rgba(0,0,0,0.45), 0 40px 72px rgba(0,0,0,0.4)";

function Reveal({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 32 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-10% 0px" }}
      transition={{ duration: 0.8, ease: EASE, delay }}
    >
      {children}
    </motion.div>
  );
}

function SectionHead({ kicker, title, body }: { kicker: string; title: string; body?: string }) {
  return (
    <Reveal>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontFamily: HEADING, fontSize: 12, letterSpacing: "0.22em", color: GREEN, textTransform: "uppercase" }}>{kicker}</div>
        <h2 style={{ margin: "18px 0 0", fontFamily: FONT_FAMILY, fontSize: "clamp(30px, 6vw, 54px)", fontWeight: 700, lineHeight: 1.15, letterSpacing: "-0.02em", color: INK }}>
          {title}
        </h2>
        {body && (
          <p style={{ margin: "22px auto 0", maxWidth: 600, fontSize: "clamp(15px, 2.2vw, 18px)", lineHeight: 1.75, color: SUBTLE }}>{body}</p>
        )}
      </div>
    </Reveal>
  );
}

function Shot({ file, alt, w = W, h = H, priority = false }: { file: string; alt: string; w?: number; h?: number; priority?: boolean }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`${SHOT}/${file}.webp`}
      alt={alt}
      width={w}
      height={h}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      style={{ display: "block", width: "100%", height: "auto", borderRadius: 18, border: `1px solid ${BORDER}`, boxShadow: SHADOW, background: "#000" }}
    />
  );
}

const MODES = [
  { id: "1", file: "scoreboard-8ball" },
  { id: "2", file: "scoreboard-9ball-racks" },
  { id: "3", file: "scoreboard-9ball-race" },
  { id: "4", file: "scoreboard-team" },
] as const;

function Modes() {
  const t = useTranslations("memberPilotIntro");
  const [active, setActive] = useState<(typeof MODES)[number]["id"]>("1");
  const cur = MODES.find((m) => m.id === active) ?? MODES[0];
  return (
    <div>
      <SectionHead kicker={t("galModesKicker")} title={t("galModesTitle")} />
      <Reveal delay={0.1}>
        <div role="tablist" aria-label={t("galModesKicker")} style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 10, marginTop: 36 }}>
          {MODES.map((m) => {
            const on = m.id === active;
            return (
              <button
                key={m.id}
                role="tab"
                aria-selected={on}
                type="button"
                onClick={() => setActive(m.id)}
                style={{
                  cursor: "pointer",
                  padding: "10px 18px",
                  borderRadius: 999,
                  fontSize: 14,
                  fontWeight: 600,
                  fontFamily: FONT_FAMILY,
                  color: on ? "#04130a" : INK,
                  background: on ? GREEN : GLASS_BG,
                  border: `1px solid ${on ? GREEN : BORDER}`,
                  transition: "background 0.2s, color 0.2s",
                }}
              >
                {t(`galMode${m.id}Tab` as "galMode1Tab")}
              </button>
            );
          })}
        </div>
        <div style={{ margin: "32px auto 0", maxWidth: 920 }}>
          <Shot key={cur.file} file={cur.file} alt={t(`galMode${cur.id}Title` as "galMode1Title")} />
          <div style={{ textAlign: "center", marginTop: 22 }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: INK }}>{t(`galMode${cur.id}Title` as "galMode1Title")}</div>
            <p style={{ margin: "8px auto 0", maxWidth: 520, fontSize: 15, lineHeight: 1.7, color: SUBTLE }}>{t(`galMode${cur.id}Body` as "galMode1Body")}</p>
          </div>
        </div>
      </Reveal>
    </div>
  );
}

const STEPS = [
  { n: "1", file: "room-link-sync-offer" },
  { n: "2", file: "room-link-sheet" },
  { n: "3", file: "room-link-synced" },
] as const;

function RoomLink() {
  const t = useTranslations("memberPilotIntro");
  return (
    <div>
      <SectionHead kicker={t("galLinkKicker")} title={t("galLinkTitle")} body={t("galLinkBody")} />
      <Reveal delay={0.1}>
        <div style={{ margin: "40px auto 0", maxWidth: 1100 }}>
          <Shot file="room-link-pair" alt={t("galLinkPairAlt")} w={2000} h={754} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))", gap: 28, margin: "56px auto 0", maxWidth: 1100 }}>
          {STEPS.map((s) => (
            <div key={s.n}>
              <Shot file={s.file} alt={t(`galStep${s.n}Title` as "galStep1Title")} />
              <div style={{ marginTop: 16, fontSize: 17, fontWeight: 700, color: INK }}>{t(`galStep${s.n}Title` as "galStep1Title")}</div>
              <p style={{ margin: "6px 0 0", fontSize: 14, lineHeight: 1.7, color: SUBTLE }}>{t(`galStep${s.n}Body` as "galStep1Body")}</p>
            </div>
          ))}
        </div>
      </Reveal>
    </div>
  );
}

function Results() {
  const t = useTranslations("memberPilotIntro");
  const items = [
    { n: "1", file: "result-winner" },
    { n: "2", file: "result-rotation-mvp" },
  ] as const;
  return (
    <div>
      <SectionHead kicker={t("galResultKicker")} title={t("galResultTitle")} body={t("galResultBody")} />
      <Reveal delay={0.1}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))", gap: 28, margin: "40px auto 0", maxWidth: 1100 }}>
          {items.map((it) => (
            <div key={it.n}>
              <Shot file={it.file} alt={t(`galRes${it.n}Title` as "galRes1Title")} />
              <div style={{ marginTop: 16, fontSize: 17, fontWeight: 700, color: INK }}>{t(`galRes${it.n}Title` as "galRes1Title")}</div>
              <p style={{ margin: "6px 0 0", fontSize: 14, lineHeight: 1.7, color: SUBTLE }}>{t(`galRes${it.n}Body` as "galRes1Body")}</p>
            </div>
          ))}
        </div>
      </Reveal>
    </div>
  );
}

export default function PilotGallery({ gap }: { gap: string }) {
  const t = useTranslations("memberPilotIntro");
  return (
    <div style={{ padding: "0 clamp(16px, 4vw, 48px)" }}>
      <div style={{ paddingTop: gap }}>
        <Modes />
      </div>
      <div style={{ paddingTop: gap }}>
        <RoomLink />
      </div>
      <div style={{ paddingTop: gap }}>
        <Results />
      </div>
      <p style={{ margin: "48px auto 0", maxWidth: 560, textAlign: "center", fontSize: 12, lineHeight: 1.6, color: SUBTLE }} data-cms-key="memberPilotIntro.galNote">
        {t("galNote")}
      </p>
    </div>
  );
}
