"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
  cubicBezier,
  type MotionValue,
} from "framer-motion";
import { useTranslations } from "next-intl";

// Space Pilot intro for the member page (admin-only preview tab).
// Scroll story: hero → wall zoom-out with the iPad demo → two linked rooms → feature cards.
// Visual tokens match MemberDashboard (black base, glass cards, #22C55E accent, Good Times headings).

const INK = "#f5f5f7";
const SUBTLE = "#A1A1A6";
const BORDER = "rgba(255,255,255,0.1)";
const GREEN = "#22C55E";
const GLASS_BG = "rgba(255,255,255,0.05)";
const GLASS_BLUR = "blur(20px) saturate(180%)";
const FONT_FAMILY =
  "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'PingFang HK', 'Noto Sans TC', 'Helvetica Neue', Helvetica, Arial, sans-serif";
const HEADING = "'Good Times', 'Noto Sans TC', system-ui, sans-serif";
const EASE = [0.16, 1, 0.3, 1] as const;

// Layered shadow: tight contact line + mid + soft ambient, like a device mounted on a wall.
// Static box-shadow (not a filter): rasterised once, so it stays cheap while the layer scales on scroll.
const DEVICE_BOX_SHADOW =
  "0 1px 2px rgba(0,0,0,0.7), 0 12px 20px rgba(0,0,0,0.5), 0 40px 64px rgba(0,0,0,0.45)";
const ZOOM_EASE = cubicBezier(0.33, 0, 0.2, 1);

const SCREENS = ["dashboard", "race", "scoring", "winner"] as const;
type ScreenId = (typeof SCREENS)[number];
const SCREEN_SRC: Record<ScreenId, string> = {
  dashboard: "/pilot-intro/ipad-dashboard.webp",
  race: "/pilot-intro/ipad-race.webp",
  scoring: "/pilot-intro/ipad-scoring.webp",
  winner: "/pilot-intro/ipad-winner.webp",
};

const sectionPad = "clamp(96px, 18vh, 200px)";

function Kicker({ children }: { children: string }) {
  return (
    <div
      style={{
        fontFamily: HEADING,
        fontSize: 12,
        letterSpacing: "0.22em",
        color: GREEN,
        textTransform: "uppercase",
      }}
    >
      {children}
    </div>
  );
}

function BigTitle({ children, size = "clamp(34px, 7vw, 64px)" }: { children: React.ReactNode; size?: string }) {
  return (
    <h2
      style={{
        margin: "18px 0 0",
        fontFamily: FONT_FAMILY,
        fontSize: size,
        fontWeight: 700,
        lineHeight: 1.12,
        letterSpacing: "-0.02em",
        color: INK,
      }}
    >
      {children}
    </h2>
  );
}

function Reveal({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 36 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-12% 0px" }}
      transition={{ duration: 0.9, ease: EASE, delay }}
    >
      {children}
    </motion.div>
  );
}

function Word({ word, progress, start, end }: { word: string; progress: MotionValue<number>; start: number; end: number }) {
  const opacity = useTransform(progress, [start, end], [0.22, 1]);
  return (
    <motion.span style={{ opacity }}>
      {word}
    </motion.span>
  );
}

// Greyed text that "lights up" word by word while scrolling (the Apple paragraph reveal).
function ScrollWords({ text }: { text: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 0.9", "end 0.35"] });
  // Chinese has no spaces, so split into chunks at punctuation and fall back to short slices.
  const chunks = text.match(/[^，。、；,.\s]+[，。、；,.\s]*/g) ?? [text];
  const pieces = chunks.flatMap((c) => (c.length > 8 && !/\s/.test(c) ? c.match(/.{1,6}/g) ?? [c] : [c]));
  const n = pieces.length;
  return (
    <p
      ref={ref}
      style={{
        margin: 0,
        fontSize: "clamp(24px, 4.6vw, 40px)",
        fontWeight: 600,
        lineHeight: 1.45,
        letterSpacing: "-0.01em",
        color: INK,
        textAlign: "center",
        maxWidth: 760,
        marginInline: "auto",
      }}
    >
      {pieces.map((w, i) => (
        <Word key={`${i}-${w}`} word={w} progress={scrollYProgress} start={i / n} end={Math.min(1, (i + 1.6) / n)} />
      ))}
    </p>
  );
}

function DeviceShadow() {
  return (
    <div
      aria-hidden
      style={{ position: "absolute", left: "5.6%", right: "6.1%", top: "5.9%", bottom: "5.4%", borderRadius: "5.4% / 7.6%", background: "#000", boxShadow: DEVICE_BOX_SHADOW }}
    />
  );
}

function DeviceImg({ src, alt, priority = false, sizes, shadow = true }: { src: string; alt: string; priority?: boolean; sizes: string; shadow?: boolean }) {
  return (
    <div style={{ position: "relative" }}>
      {shadow && <DeviceShadow />}
      <Image
        src={src}
        alt={alt}
        width={1400}
        height={992}
        sizes={sizes}
        priority={priority}
        style={{ width: "100%", height: "auto", display: "block", position: "relative" }}
      />
    </div>
  );
}

// ─── Section 1: hero ────────────────────────────────────────────────────────
// Same backdrop as the Space Pilot app: near-black violet base, green glow top-right, purple glow bottom-left.
function PilotBackdrop({ progress }: { progress: MotionValue<number> }) {
  const reduce = useReducedMotion();
  const yA = useTransform(progress, [0, 1], [0, 140]);
  const yB = useTransform(progress, [0, 1], [0, 60]);
  const drift = (d: number) => (reduce ? undefined : { x: [0, d, 0], scale: [1, 1.08, 1] });
  const loop = { duration: 16, repeat: Infinity, ease: "easeInOut" as const };
  return (
    <div aria-hidden style={{ position: "absolute", inset: 0, overflow: "hidden", background: "#05030c" }}>
      <motion.div
        style={{ position: "absolute", width: "85vmax", height: "85vmax", right: "-38vmax", top: "-42vmax", y: yA, willChange: "transform",
          background: "radial-gradient(circle, rgba(34,197,94,0.5) 0%, rgba(34,197,94,0.12) 40%, rgba(34,197,94,0) 65%)" }}
        animate={drift(-48)}
        transition={loop}
      />
      <motion.div
        style={{ position: "absolute", width: "95vmax", height: "95vmax", left: "-48vmax", bottom: "-52vmax", y: yB, willChange: "transform",
          background: "radial-gradient(circle, rgba(124,58,237,0.62) 0%, rgba(88,28,180,0.2) 42%, rgba(88,28,180,0) 66%)" }}
        animate={drift(52)}
        transition={{ ...loop, duration: 20 }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: "radial-gradient(rgba(255,255,255,0.09) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
          WebkitMaskImage: "radial-gradient(ellipse 65% 55% at 50% 38%, #000 15%, transparent 78%)",
          maskImage: "radial-gradient(ellipse 65% 55% at 50% 38%, #000 15%, transparent 78%)",
        }}
      />
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(0,0,0,0) 70%, #000 100%)" }} />
    </div>
  );
}

function Hero({ page = false }: { page?: boolean }) {
  const t = useTranslations("memberPilotIntro");
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const opacity = useTransform(scrollYProgress, [0, 0.7], [1, 0]);
  const y = useTransform(scrollYProgress, [0, 1], [0, -80]);
  const scale = useTransform(scrollYProgress, [0, 1], [1, 0.94]);
  // Staggered entrance on load (opacity + transform only).
  const rise = (n: number) =>
    reduce
      ? {}
      : { initial: { opacity: 0, y: 28 }, animate: { opacity: 1, y: 0 }, transition: { duration: 1.1, ease: EASE, delay: 0.1 + n * 0.14 } };
  return (
    <div
      ref={ref}
      style={{ position: "relative", minHeight: page ? "100svh" : "88vh", display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "0 20px" }}
    >
      {page && <PilotBackdrop progress={scrollYProgress} />}
      <motion.div style={{ opacity, y, scale, position: "relative", willChange: "transform, opacity" }}>
        <motion.div {...rise(0)} style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
          <Kicker>{t("kicker")}</Kicker>
          <span
            style={{
              fontSize: 10,
              letterSpacing: "0.14em",
              padding: "3px 9px",
              borderRadius: 999,
              border: `1px solid ${GREEN}`,
              color: GREEN,
            }}
          >
            BETA
          </span>
        </motion.div>
        <motion.h1
          {...rise(1)}
          style={{
            margin: "28px 0 0",
            fontSize: "clamp(40px, 9vw, 84px)",
            fontWeight: 700,
            lineHeight: 1.08,
            letterSpacing: "-0.025em",
            color: INK,
          }}
        >
          {t("heroTitle1")}
          <br />
          {t("heroTitle2")}
        </motion.h1>
        <motion.p {...rise(2)} style={{ margin: "28px auto 0", maxWidth: 520, fontSize: "clamp(16px, 2.4vw, 20px)", lineHeight: 1.7, color: SUBTLE }}>
          {t("heroBody")}
        </motion.p>
        <motion.p {...rise(3)} style={{ margin: "14px auto 0", fontSize: 13, letterSpacing: "0.04em", color: GREEN }}>{t("betaNote")}</motion.p>
        <motion.div {...rise(4)} style={{ marginTop: 56, color: SUBTLE, fontSize: 12, letterSpacing: "0.1em" }}>
          {t("scroll")}
          <motion.div
            aria-hidden
            animate={{ y: [0, 6, 0] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
            style={{ marginTop: 8 }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </motion.div>
        </motion.div>
      </motion.div>
    </div>
  );
}

// Page hero: gradient headline, Space Pilot backdrop, and the iPad rising from the bottom edge.
function HeroCopy({ intro }: { intro: MotionValue<number> }) {
  const t = useTranslations("memberPilotIntro");
  const reduce = useReducedMotion();
  const opacity = useTransform(intro, [0, 0.5], [1, 0]);
  const y = useTransform(intro, [0, 1], [0, -90]);
  const scale = useTransform(intro, [0, 1], [1, 0.95]);
  const rise = (n: number) =>
    reduce
      ? {}
      : { initial: { opacity: 0, y: 28 }, animate: { opacity: 1, y: 0 }, transition: { duration: 1.1, ease: EASE, delay: 0.1 + n * 0.14 } };
  return (
    <motion.div
      style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "104px 20px 36svh", opacity, y, scale, willChange: "transform, opacity", pointerEvents: "none" }}
    >
      <div>
          <motion.div {...rise(0)} style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
            <Kicker>{t("kicker")}</Kicker>
            <span style={{ fontSize: 10, letterSpacing: "0.14em", padding: "3px 9px", borderRadius: 999, border: `1px solid ${GREEN}`, color: GREEN }}>BETA</span>
          </motion.div>
          <motion.h1
            {...rise(1)}
            style={{
              margin: "22px 0 0",
              fontSize: "clamp(38px, 7.2vw, 80px)",
              fontWeight: 700,
              lineHeight: 1.08,
              letterSpacing: "-0.025em",
              backgroundImage: "linear-gradient(180deg, #ffffff 35%, rgba(245,245,247,0.55) 100%)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              WebkitTextFillColor: "transparent",
              color: "transparent",
            }}
          >
            {t("heroTitle1")}
            <br />
            {t("heroTitle2")}
          </motion.h1>
          <motion.p {...rise(2)} style={{ margin: "22px auto 0", maxWidth: 520, fontSize: "clamp(16px, 2.2vw, 20px)", lineHeight: 1.7, color: SUBTLE }}>
            {t("heroBody")}
          </motion.p>
          <motion.p {...rise(2)} style={{ margin: "10px auto 0", fontSize: 14, letterSpacing: "0.02em", color: GREEN }}>
            {t("exclusiveNote")}
          </motion.p>
          <motion.div
            {...rise(3)}
            style={{ marginTop: 22, display: "inline-flex", alignItems: "center", gap: 8, padding: "7px 14px", borderRadius: 999, background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.35)", fontSize: 13, color: GREEN }}
          >
            <motion.span
              aria-hidden
              animate={reduce ? undefined : { opacity: [1, 0.3, 1] }}
              transition={{ duration: 1.8, repeat: Infinity }}
              style={{ width: 6, height: 6, borderRadius: 999, background: GREEN }}
            />
            {t("betaNote")}
          </motion.div>
      </div>
    </motion.div>
  );
}

// ─── Section 2: wall stage ──────────────────────────────────────────────────
function Caption({ index, progress }: { index: number; progress: MotionValue<number> }) {
  const t = useTranslations("memberPilotIntro");
  const a = 0.34 + index * 0.17;
  const opacity = useTransform(progress, [a - 0.03, a + 0.01, a + 0.11, a + 0.14], index === 3 ? [0, 1, 1, 1] : [0, 1, 1, 0]);
  const y = useTransform(progress, [a - 0.03, a + 0.01], [18, 0]);
  const n = index + 1;
  return (
    <motion.div
      style={{ position: "absolute", left: 0, right: 0, bottom: 0, textAlign: "center", opacity, y, padding: "0 20px" }}
    >
      <div style={{ fontFamily: HEADING, fontSize: 11, letterSpacing: "0.2em", color: GREEN }}>{`0${n} / 04`}</div>
      <div style={{ marginTop: 10, fontSize: "clamp(22px, 4.4vw, 34px)", fontWeight: 700, letterSpacing: "-0.015em", color: INK }}>
        {t(`cap${n}Title` as "cap1Title")}
      </div>
      <div style={{ marginTop: 8, fontSize: "clamp(14px, 2.2vw, 16px)", color: "rgba(255,255,255,0.78)", lineHeight: 1.6 }}>
        {t(`cap${n}Body` as "cap1Body")}
      </div>
    </motion.div>
  );
}

function ScreenLayer({ id, index, progress }: { id: ScreenId; index: number; progress: MotionValue<number> }) {
  const t = useTranslations("memberPilotIntro");
  const a = 0.3 + index * 0.17;
  const keys = index === 0 ? [0, 0.3, a + 0.16, a + 0.2] : [a - 0.04, a + 0.02, a + 0.16, a + 0.2];
  const vals = index === 0 ? [1, 1, 1, 0] : index === 3 ? [0, 1, 1, 1] : [0, 1, 1, 0];
  const opacity = useTransform(progress, keys, vals);
  return (
    <motion.div style={{ position: "absolute", inset: 0, opacity }}>
      <DeviceImg src={SCREEN_SRC[id]} alt={index === 0 ? t("stageLabel") : ""} priority={index === 0} shadow={false} sizes="(max-width: 900px) 92vw, 860px" />
    </motion.div>
  );
}

function StepDot({ index, progress }: { index: number; progress: MotionValue<number> }) {
  const a = 0.34 + index * 0.17;
  const opacity = useTransform(progress, [a - 0.06, a, a + 0.15, a + 0.19], index === 3 ? [0.25, 1, 1, 1] : [0.25, 1, 1, 0.25]);
  const scaleY = useTransform(progress, [a - 0.06, a, a + 0.15, a + 0.19], index === 3 ? [1, 2.4, 2.4, 2.4] : [1, 2.4, 2.4, 1]);
  return <motion.span style={{ width: 4, height: 8, borderRadius: 3, background: GREEN, opacity, scaleY, display: "block" }} />;
}

function WallStage({ page = false, bleed = false }: { page?: boolean; bleed?: boolean }) {
  // Standalone page: the hero lives inside this sticky stage, so the iPad rises out of the hero and the backdrop turns into the wall.
  const intro = page && !bleed;
  const H = intro ? 0.2 : 0;
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress: rawProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const scrollYProgress = useTransform(rawProgress, [H, 1], [0, 1], { clamp: true });
  const introP = useTransform(rawProgress, [0, Math.max(H, 0.001)], [intro ? 0 : 1, 1], { clamp: true });
  const wallFade = useTransform(introP, [0.3, 0.9], [0, 1]);
  const backdropFade = useTransform(introP, [0.25, 0.85], [1, 0]);
  const padRise = useTransform(introP, [0, 1], [reduce ? 0 : 50, 0], { ease: ZOOM_EASE });
  const padRiseY = useTransform(padRise, (v) => `${v}svh`);
  const introTilt = useTransform(introP, [0, 1], [reduce ? 0 : 34, 0], { ease: ZOOM_EASE });
  const introSpin = useTransform(introP, [0, 1], [reduce ? 0 : -9, 0], { ease: ZOOM_EASE });
  const introScale = useTransform(introP, [0, 1], [reduce ? 1 : 1.3, 1], { ease: ZOOM_EASE });
  const zoom = useTransform(scrollYProgress, [0, 0.32], [reduce ? 1 : intro ? 1.12 : 2.4, 1], { ease: ZOOM_EASE });
  const dim = useTransform(scrollYProgress, [0, 0.4], [0, 0.42]);
  const glow = useTransform(scrollYProgress, [0.1, 0.42], [0, 1]);
  const lift = useTransform(scrollYProgress, [0, 0.32], [reduce ? 0 : 30, 0], { ease: ZOOM_EASE });
  const tiltBase = useTransform(scrollYProgress, [0, 0.32], [reduce ? 0 : intro ? 0 : 9, 0], { ease: ZOOM_EASE });
  const tilt = useTransform(() => tiltBase.get() + introTilt.get());
  return (
    <div ref={ref} style={{ height: intro ? "440vh" : "340vh", position: "relative", ...(bleed ? { width: "100vw", marginLeft: "calc(50% - 50vw)" } : {}) }}>
      <div
        style={{
          position: "sticky",
          top: 0,
          height: intro ? "100dvh" : "100svh",
          overflow: "hidden",
          borderRadius: page ? 0 : 28,
          border: page ? "none" : `1px solid ${BORDER}`,
          background: "#000",
          contain: "paint",
        }}
      >
        {intro && (
          <motion.div aria-hidden style={{ position: "absolute", inset: 0, opacity: backdropFade }}>
            <PilotBackdrop progress={introP} />
          </motion.div>
        )}
        <motion.div style={{ position: "absolute", inset: 0, scale: zoom, transformOrigin: "50% 42%", willChange: "transform" }}>
          <motion.div aria-hidden style={{ position: "absolute", inset: 0, opacity: intro ? wallFade : 1 }}>
          <Image
            src="/pilot-intro/wall.webp"
            alt=""
            fill
            sizes="(max-width: 1200px) 100vw, 1200px"
            style={{ objectFit: "cover", objectPosition: "50% 45%" }}
          />
          {/* Dim the wall only, so the iPad stays bright. */}
          <motion.div aria-hidden style={{ position: "absolute", inset: 0, background: "#000", opacity: dim }} />
          <div
            aria-hidden
            style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 70% 70% at 50% 42%, rgba(0,0,0,0) 40%, rgba(0,0,0,0.6) 100%)" }}
          />
          {/* soft light spill from the screen onto the fabric panels (plain gradient, no blur filter) */}
          <motion.div
            aria-hidden
            style={{
              position: "absolute",
              left: "0%",
              right: "0%",
              top: "0%",
              height: "84%",
              opacity: glow,
              background: "radial-gradient(ellipse 52% 46% at 50% 40%, rgba(34,197,94,0.30) 0%, rgba(124,58,237,0.14) 48%, rgba(0,0,0,0) 76%)",
            }}
          />
          </motion.div>
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: 104,
              bottom: 236,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
          <div
            style={{
              position: "relative",
              width: "min(88vw, 880px, calc((100svh - 340px) * 1.411))",
              aspectRatio: "1400 / 992",
              perspective: intro ? 1100 : 1400,
            }}
          >
            <motion.div style={{ position: "absolute", inset: 0, y: intro ? padRiseY : lift, rotateX: tilt, ...(intro ? { rotateY: introSpin, scale: introScale } : {}), willChange: "transform" }}>
              <DeviceShadow />
              {SCREENS.map((id, i) => (
                <ScreenLayer key={id} id={id} index={i} progress={scrollYProgress} />
              ))}
            </motion.div>
          </div>
          </div>
        </motion.div>
        {intro && <HeroCopy intro={introP} />}
        <motion.div
          aria-hidden
          style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: "34%", background: "linear-gradient(180deg, rgba(0,0,0,0), rgba(0,0,0,0.88))", pointerEvents: "none", opacity: intro ? wallFade : 1 }}
        />
        <div aria-hidden style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", display: "flex", flexDirection: "column", gap: 8 }}>
          {[0, 1, 2, 3].map((i) => (
            <StepDot key={i} index={i} progress={scrollYProgress} />
          ))}
        </div>
        <div style={{ position: "absolute", left: 0, right: 0, bottom: "clamp(28px, 7vh, 64px)", height: 120 }}>
          {[0, 1, 2, 3].map((i) => (
            <Caption key={i} index={i} progress={scrollYProgress} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Section 3: two linked rooms ────────────────────────────────────────────
function Rooms() {
  const t = useTranslations("memberPilotIntro");
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 0.9", "center 0.5"] });
  const line = useTransform(scrollYProgress, [0.1, 0.8], [0, 1]);
  const left = useTransform(scrollYProgress, [0, 0.7], [reduce ? 0 : -48, 0]);
  const right = useTransform(scrollYProgress, [0, 0.7], [reduce ? 0 : 48, 0]);
  const fade = useTransform(scrollYProgress, [0, 0.5], [reduce ? 1 : 0, 1]);
  const riseA = useTransform(scrollYProgress, [0, 0.8], [reduce ? 0 : 70, 0], { ease: ZOOM_EASE });
  const riseB = useTransform(scrollYProgress, [0, 0.8], [reduce ? 0 : 120, 0], { ease: ZOOM_EASE });
  const popScale = useTransform(scrollYProgress, [0, 0.8], [reduce ? 1 : 0.92, 1], { ease: ZOOM_EASE });
  const pill = useTransform(scrollYProgress, [0.55, 0.9], [0, 1]);
  return (
    <div ref={ref} style={{ textAlign: "center" }}>
      <Reveal>
        <Kicker>{t("roomsKicker")}</Kicker>
        <BigTitle>{t("roomsTitle")}</BigTitle>
        <p style={{ margin: "24px auto 0", maxWidth: 560, fontSize: "clamp(15px, 2.2vw, 18px)", lineHeight: 1.75, color: SUBTLE }}>
          {t("roomsBody")}
        </p>
      </Reveal>
      <div style={{ position: "relative", marginTop: 64 }}>
        <div
          aria-hidden
          style={{
            position: "absolute",
            left: "10%",
            right: "10%",
            top: "50%",
            height: 280,
            transform: "translateY(-50%)",
            background: "radial-gradient(ellipse at 50% 50%, rgba(34,197,94,0.18) 0%, rgba(0,0,0,0) 65%)",
            pointerEvents: "none",
          }}
        />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 300px), 1fr))", gap: "clamp(40px, 9vw, 96px)", position: "relative" }}>
          <motion.div style={{ x: left, y: riseA, scale: popScale, opacity: fade, willChange: "transform, opacity" }}>
            <DeviceImg src={SCREEN_SRC.scoring} alt={t("roomA")} sizes="(max-width: 700px) 90vw, 440px" />
            <div style={{ marginTop: 20, fontFamily: HEADING, fontSize: 12, letterSpacing: "0.2em", color: INK }}>{t("roomA")}</div>
          </motion.div>
          <motion.div style={{ x: right, y: riseB, scale: popScale, opacity: fade, willChange: "transform, opacity" }}>
            <DeviceImg src={SCREEN_SRC.winner} alt={t("roomB")} sizes="(max-width: 700px) 90vw, 440px" />
            <div style={{ marginTop: 20, fontFamily: HEADING, fontSize: 12, letterSpacing: "0.2em", color: INK }}>{t("roomB")}</div>
          </motion.div>
        </div>
      </div>
      <div style={{ marginTop: 56, position: "relative", height: 36, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <motion.div
          aria-hidden
          style={{
            position: "absolute",
            left: "6%",
            right: "6%",
            height: 2,
            scaleX: line,
            transformOrigin: "50% 50%",
            background: `linear-gradient(90deg, rgba(34,197,94,0), ${GREEN}, rgba(34,197,94,0))`,
            boxShadow: "0 0 18px rgba(34,197,94,0.8)",
          }}
        />
        <motion.span
          style={{
            opacity: pill,
            position: "relative",
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "7px 16px",
            borderRadius: 999,
            fontSize: 12,
            letterSpacing: "0.16em",
            color: GREEN,
            background: "#000",
            border: `1px solid ${GREEN}`,
          }}
        >
          <motion.span
            aria-hidden
            animate={reduce ? undefined : { opacity: [1, 0.3, 1] }}
            transition={{ duration: 1.6, repeat: Infinity }}
            style={{ width: 7, height: 7, borderRadius: 999, background: GREEN }}
          />
          {t("live")}
        </motion.span>
      </div>
      <Reveal delay={0.1}>
        <a
          href="/book"
          style={{
            display: "inline-block",
            marginTop: 40,
            padding: "14px 32px",
            borderRadius: 999,
            background: GREEN,
            color: "#04130a",
            fontSize: 16,
            fontWeight: 700,
            textDecoration: "none",
          }}
        >
          {t("cta")}
        </a>
      </Reveal>
    </div>
  );
}

// ─── Section 4: feature cards ───────────────────────────────────────────────
function Features() {
  const t = useTranslations("memberPilotIntro");
  const items = [
    { n: "01", title: t("f1Title"), body: t("f1Body") },
    { n: "02", title: t("f2Title"), body: t("f2Body"), beta: true },
    { n: "03", title: t("f3Title"), body: t("f3Body") },
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 240px), 1fr))", gap: 16 }}>
      {items.map((it, i) => (
        <motion.div
          key={it.n}
          initial={{ opacity: 0, y: 56, scale: 0.96 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true, margin: "-10% 0px" }}
          transition={{ duration: 1, ease: EASE, delay: i * 0.12 }}
          whileHover={{ y: -4 }}
          style={{
            padding: "28px 24px 32px",
            borderRadius: 24,
            background: GLASS_BG,
            border: `1px solid ${BORDER}`,
            boxShadow: "0 1px 2px rgba(0,0,0,0.4), 0 12px 24px rgba(0,0,0,0.35), 0 32px 56px rgba(0,0,0,0.3)",
            minHeight: 200,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <div style={{ fontFamily: HEADING, fontSize: 12, letterSpacing: "0.2em", color: GREEN }}>{it.n}</div>
            {"beta" in it && it.beta && (
              <span style={{ fontSize: 10, letterSpacing: "0.1em", padding: "3px 9px", borderRadius: 999, border: `1px solid ${GREEN}`, color: GREEN, whiteSpace: "nowrap" }}>
                {t("betaTag")}
              </span>
            )}
          </div>
          <div style={{ marginTop: 40, fontSize: 22, fontWeight: 700, letterSpacing: "-0.01em", color: INK }}>{it.title}</div>
          <div style={{ marginTop: 10, fontSize: 15, lineHeight: 1.7, color: SUBTLE }}>{it.body}</div>
        </motion.div>
      ))}
    </div>
  );
}

// ─── Section 5: FAQ ─────────────────────────────────────────────────────────
function FaqItem({ q, a, open, onToggle }: { q: string; a: string; open: boolean; onToggle: () => void }) {
  return (
    <div style={{ borderBottom: `1px solid ${BORDER}` }}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          padding: "22px 0",
          background: "none",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
          color: INK,
          fontFamily: FONT_FAMILY,
          fontSize: "clamp(17px, 2.6vw, 21px)",
          fontWeight: 600,
          letterSpacing: "-0.01em",
        }}
      >
        <span>{q}</span>
        <motion.span aria-hidden animate={{ rotate: open ? 45 : 0 }} transition={{ duration: 0.3, ease: EASE }} style={{ fontSize: 28, lineHeight: 1, color: GREEN, flexShrink: 0 }}>
          +
        </motion.span>
      </button>
      <motion.div
        initial={false}
        animate={{ height: open ? "auto" : 0, opacity: open ? 1 : 0 }}
        transition={{ duration: 0.45, ease: EASE }}
        style={{ overflow: "hidden" }}
      >
        <p style={{ margin: 0, padding: "0 32px 24px 0", fontSize: 16, lineHeight: 1.8, color: SUBTLE }}>{a}</p>
      </motion.div>
    </div>
  );
}

function Faq() {
  const t = useTranslations("memberPilotIntro");
  const [openIdx, setOpenIdx] = useState<number | null>(0);
  const items = [1, 2, 3, 4, 5, 6].map((n) => ({ q: t(`faq${n}q` as "faq1q"), a: t(`faq${n}a` as "faq1a") }));
  return (
    <div style={{ maxWidth: 760, margin: "0 auto" }}>
      <Reveal>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <Kicker>FAQ</Kicker>
          <BigTitle>{t("faqTitle")}</BigTitle>
        </div>
      </Reveal>
      <div style={{ borderTop: `1px solid ${BORDER}` }}>
        {items.map((it, i) => (
          <FaqItem key={i} q={it.q} a={it.a} open={openIdx === i} onToggle={() => setOpenIdx(openIdx === i ? null : i)} />
        ))}
      </div>
      <p style={{ marginTop: 24, textAlign: "center", fontSize: 14 }}>
        <a href="/legal" style={{ color: GREEN, textDecoration: "none" }}>{t("faqLegal")}</a>
      </p>
    </div>
  );
}

export default function PilotIntro({ variant = "member" }: { variant?: "member" | "page" }) {
  const t = useTranslations("memberPilotIntro");
  if (variant === "page") {
    return (
      <div style={{ fontFamily: FONT_FAMILY, color: INK }}>
        <WallStage page />
        <div style={{ maxWidth: 1120, margin: "0 auto", padding: `${sectionPad} 20px ${sectionPad}` }}>
          <Rooms />
          <div style={{ paddingTop: sectionPad }}>
            <ScrollWords text={t("wordsText")} />
          </div>
          <div style={{ paddingTop: "clamp(64px, 12vh, 120px)" }}>
            <Features />
          </div>
          <div style={{ paddingTop: sectionPad }}>
            <Faq />
          </div>
        </div>
      </div>
    );
  }
  return (
    <div style={{ fontFamily: FONT_FAMILY, color: INK, paddingBottom: sectionPad, overflowX: "clip" }}>
      <div style={{ fontSize: 11, color: SUBTLE, textAlign: "center", paddingTop: 8 }}>{t("adminOnly")}</div>
      <Hero />
      <WallStage page bleed />
      <div style={{ paddingTop: sectionPad }}>
        <Rooms />
      </div>
      <div style={{ paddingTop: sectionPad }}>
        <ScrollWords text={t("wordsText")} />
      </div>
      <div style={{ paddingTop: "clamp(64px, 12vh, 120px)" }}>
        <Features />
      </div>
      <div style={{ paddingTop: sectionPad }}>
        <Faq />
      </div>
    </div>
  );
}
