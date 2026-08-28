"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { SITE_CONTACT } from "@/lib/site/contact";
import { Logo } from "@/components/brand";
import {
  Target,
  Clock,
  Smartphone,
  MapPin,
  MessageCircle,
  Mail,
  ArrowRight,
} from "lucide-react";

const DARK = "#1D1D1F";
const SUBTLE = "#6e6e73";
const GREEN = "#22C55E";
const GREEN_BRIGHT = "#22b86b";

const FONT_FAMILY =
  "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', Helvetica, Arial, sans-serif";

const EASE = [0.16, 1, 0.3, 1] as const;
const SPRING = [0.2, 0.7, 0.3, 1] as const;
const POP = [0.34, 1.56, 0.64, 1] as const;
const VIEWPORT = { once: true, amount: 0.25 } as const;

const WHATSAPP_URL = SITE_CONTACT.whatsappUrl;
const EMAIL = SITE_CONTACT.email;
const PHONE = SITE_CONTACT.phone;

const STATS_CSS = `
.stat-section { background: #ffffff; padding: 120px 24px 130px; }
.stat-inner { max-width: 1120px; margin: 0 auto; }
.stat-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 28px; }
.stat-item { position: relative; padding: 6px 20px 6px 0; opacity: 0; transform: translateY(22px); transition: opacity .8s cubic-bezier(.2,.7,.3,1), transform .8s cubic-bezier(.2,.7,.3,1); }
.stat-item + .stat-item { border-left: 1px solid rgba(17,17,16,0.12); padding-left: 28px; }
.stat-section.is-in .stat-item { opacity: 1; transform: none; }
.stat-section.is-in .stat-item:nth-child(1) { transition-delay: .05s; }
.stat-section.is-in .stat-item:nth-child(2) { transition-delay: .16s; }
.stat-section.is-in .stat-item:nth-child(3) { transition-delay: .27s; }
.stat-section.is-in .stat-item:nth-child(4) { transition-delay: .38s; }
.stat-value { display: flex; align-items: baseline; gap: 2px; font-family: 'Inter', 'Noto Sans TC', sans-serif; font-weight: 600; font-size: clamp(2.4rem, 5.4vw, 3.9rem); line-height: 1.05; letter-spacing: -0.02em; color: #111110; margin-bottom: 14px; }
.stat-num { font-variant-numeric: tabular-nums; transition: color .3s ease; }
.stat-num.is-tick { color: #1a9d5c; }
.stat-suffix { font-size: .52em; font-weight: 600; color: #1a9d5c; }
.stat-unit { font-family: 'Noto Sans TC', sans-serif; font-size: .30em; font-weight: 700; color: rgba(17,17,16,0.45); margin-left: 6px; }
.stat-label { font-family: 'Noto Sans TC', sans-serif; font-size: 14.5px; font-weight: 500; line-height: 1.7; color: rgba(17,17,16,0.60); }
.stat-live { display: inline-flex; align-items: center; gap: 6px; margin-top: 10px; font-family: 'Noto Sans TC', sans-serif; font-size: 11.5px; color: rgba(17,17,16,0.40); }
.stat-live i { width: 6px; height: 6px; border-radius: 50%; background: #1a9d5c; animation: livePulse 1.9s ease-in-out infinite; }
@keyframes livePulse { 0%,100% { opacity: 1; transform: scale(1); } 50% { opacity: .35; transform: scale(.8); } }
@media (max-width: 900px) { .stat-grid { grid-template-columns: repeat(2, 1fr); gap: 34px 24px; } .stat-item + .stat-item { border-left: 0; padding-left: 0; } .stat-item:nth-child(even) { border-left: 1px solid rgba(17,17,16,0.12); padding-left: 24px; } }
@media (max-width: 560px) { .stat-section { padding: 86px 20px 96px; } .stat-grid { grid-template-columns: repeat(2, 1fr); gap: 30px 16px; } .stat-item { padding-right: 8px; } .stat-item:nth-child(even) { padding-left: 16px; } .stat-value { font-size: clamp(1.8rem, 9vw, 2.4rem); margin-bottom: 10px; } .stat-label { font-size: 13px; } .stat-live { font-size: 10.5px; margin-top: 8px; } }
`;

type TitledItem = { title: string; body: string };
type StatsItem = { value: string; unit: string; suffix: string; label: string; live: string };
type StepItem = { title: string; body: string };

/* ── Philosophy SVG Icons ── */
const TargetIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="phil-icon-svg">
    <circle className="ic-ring ic-r3" cx="12" cy="12" r="9.2" />
    <circle className="ic-ring ic-r2" cx="12" cy="12" r="5.6" />
    <circle className="ic-ring ic-r1" cx="12" cy="12" r="2.1" />
  </svg>
);
const ClockIcon2 = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="phil-icon-svg">
    <circle className="ic-face" cx="12" cy="12" r="9.2" />
    <path className="ic-hand ic-hour" d="M12 12V7.6" />
    <path className="ic-hand ic-min" d="M12 12h4.1" />
  </svg>
);
const PhoneIcon2 = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="phil-icon-svg">
    <rect className="ic-panel" x="6.4" y="2.6" width="11.2" height="18.8" rx="2.4" />
    <circle className="ic-dot" cx="12" cy="6.6" r="1.15" fill="currentColor" stroke="none" />
  </svg>
);

/* ── CTA step icons ── */
const StepIcon1 = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18" /><path d="M8 3v4" /><path d="M16 3v4" />
  </svg>
);
const StepIcon2 = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="5" width="20" height="14" rx="2.4" /><path d="M2 10h20" />
  </svg>
);
const StepIcon3 = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" rx="1.3" /><rect x="14" y="3" width="7" height="7" rx="1.3" />
    <rect x="3" y="14" width="7" height="7" rx="1.3" /><path d="M14 14h3v3h-3z" /><path d="M20 14v3" /><path d="M14 20h3" />
  </svg>
);
const STEP_ICONS = [StepIcon1, StepIcon2, StepIcon3];

export default function AboutContent() {
  const t = useTranslations("aboutPage");
  const missionItems = t.raw("mission_items") as TitledItem[];
  const statsItems = t.raw("stats_items") as StatsItem[];
  const ctaSteps = t.raw("cta_steps") as StepItem[];

  const compareRef = useRef<HTMLDivElement>(null);
  const philRef = useRef<HTMLDivElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);
  const statRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);

  const rotatingWords = t.raw("hero_rotating_words") as string[];
  const [wordIdx, setWordIdx] = useState(0);

  useEffect(() => {
    if (rotatingWords.length <= 1) return;
    const interval = setInterval(() => {
      setWordIdx((prev) => (prev + 1) % rotatingWords.length);
    }, 2400);
    return () => clearInterval(interval);
  }, [rotatingWords.length]);

  /* ── Reduced motion check ── */
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduceMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReduceMotion(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  /* ── IntersectionObserver for philosophy section ── */
  useEffect(() => {
    const el = philRef.current;
    if (!el) return;
    if (reduceMotion || !("IntersectionObserver" in window)) {
      el.classList.add("is-in");
      return;
    }
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          el.classList.add("is-in");
          obs.unobserve(e.target);
        });
      },
      { threshold: 0.22, rootMargin: "0px 0px -8% 0px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [reduceMotion]);

  /* ── IntersectionObserver for CTA section ── */
  useEffect(() => {
    const el = ctaRef.current;
    if (!el) return;
    if (reduceMotion || !("IntersectionObserver" in window)) {
      el.classList.add("is-in");
      return;
    }
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          el.classList.add("is-in");
          obs.unobserve(e.target);
        });
      },
      { threshold: 0.25, rootMargin: "0px 0px -6% 0px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [reduceMotion]);

  /* ── Count-up + IntersectionObserver for stats section ── */
  useEffect(() => {
    const el = statRef.current;
    if (!el) return;
    const nums = Array.from(el.querySelectorAll<HTMLElement>(".stat-num"));

    function easeOutExpo(t: number) { return t === 1 ? 1 : 1 - Math.pow(2, -10 * t); }

    function countUp(targetEl: HTMLElement, done: () => void) {
      const target = parseInt(targetEl.getAttribute("data-to") || "0", 10);
      if (reduceMotion) { targetEl.textContent = String(target); done(); return; }
      const dur = 1500 + Math.min(target, 200) * 4;
      let t0: number | null = null;
      function frame(ts: number) {
        if (t0 === null) t0 = ts;
        const p = Math.min((ts - t0) / dur, 1);
        targetEl.textContent = String(Math.round(easeOutExpo(p) * target));
        if (p < 1) requestAnimationFrame(frame);
        else { targetEl.textContent = String(target); done(); }
      }
      requestAnimationFrame(frame);
    }

    let liveIndex = 0;
    function startLive(targetEl: HTMLElement) {
      const every = parseInt(targetEl.getAttribute("data-live") || "0", 10);
      if (!every || reduceMotion) return;
      const offset = (liveIndex++) * Math.round(every / 3);
      setTimeout(() => {
        setInterval(() => {
          const v = parseInt(targetEl.textContent || "0", 10);
          targetEl.textContent = String(v + 1);
          targetEl.classList.add("is-tick");
          setTimeout(() => targetEl.classList.remove("is-tick"), 700);
        }, every);
      }, offset);
    }

    function run() {
      if (!el) return;
      el.classList.add("is-in");
      nums.forEach((n) => { countUp(n, () => startLive(n)); });
    }

    if (!("IntersectionObserver" in window)) { run(); return; }
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          run();
          obs.unobserve(e.target);
        });
      },
      { threshold: 0.3 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [reduceMotion]);

  /* ── Scroll-tied hero glow ── */
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });
  const heroGlowOpacity = useTransform(scrollYProgress, [0, 0.6], [1, 0]);
  const heroScale = useTransform(scrollYProgress, [0, 0.6], [1, 0.85]);
  const PHIL_CSS = `
    .phil-section .ic-ring { transform-box: fill-box; transform-origin: center; opacity: 0; transform: scale(.3); }
    .phil-section.is-in .ic-ring { animation: ringPop .62s cubic-bezier(.3,1.5,.45,1) forwards; }
    .phil-section.is-in .ic-r1 { animation-delay: .44s; }
    .phil-section.is-in .ic-r2 { animation-delay: .56s; }
    .phil-section.is-in .ic-r3 { animation-delay: .68s; }
    @keyframes ringPop { to { opacity: 1; transform: scale(1); } }
    .phil-item:hover .ic-r1 { animation: ringPulse 1.4s ease-in-out infinite; }
    @keyframes ringPulse { 0%,100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.18); opacity: .55; } }
    .phil-section .ic-face { stroke-dasharray: 64; stroke-dashoffset: 64; }
    .phil-section.is-in .ic-face { animation: drawFace .8s cubic-bezier(.4,.1,.3,1) .5s forwards; }
    @keyframes drawFace { to { stroke-dashoffset: 0; } }
    .phil-section .ic-hand { transform-box: fill-box; transform-origin: 0% 100%; opacity: 0; }
    .phil-section.is-in .ic-hand { animation: handSwing .85s cubic-bezier(.3,1.3,.4,1) forwards; }
    .phil-section.is-in .ic-hour { animation-delay: 1.02s; }
    .phil-section.is-in .ic-min { animation-delay: 1.16s; }
    @keyframes handSwing { 0% { opacity: 0; transform: rotate(-115deg); } 60% { opacity: 1; } 100% { opacity: 1; transform: rotate(0deg); } }
    .phil-item:hover .ic-min { animation: handSpin 2.6s linear infinite; }
    @keyframes handSpin { to { transform: rotate(360deg); } }
    .phil-section .ic-panel { stroke-dasharray: 72; stroke-dashoffset: 72; }
    .phil-section.is-in .ic-panel { animation: drawFace .9s cubic-bezier(.4,.1,.3,1) .62s forwards; }
    .phil-section .ic-dot { transform-box: fill-box; transform-origin: center; opacity: 0; }
    .phil-section.is-in .ic-dot { animation: dotIn .5s cubic-bezier(.3,1.5,.45,1) 1.3s forwards, dotBlink 2.2s ease-in-out 1.9s infinite; }
    @keyframes dotIn { to { opacity: 1; transform: scale(1); } }
    @keyframes dotBlink { 0%,100% { opacity: 1; } 50% { opacity: .28; } }
    @media (max-width: 860px) { .phil-grid { grid-template-columns: 1fr; gap: 36px; } .phil-title { margin-bottom: 54px; white-space: normal; } }
    @media (max-width: 560px) { .phil-section { padding: 86px 20px 96px; } .phil-title { margin-bottom: 44px; } }
  `;

  return (
    <div style={{ fontFamily: FONT_FAMILY }}>
      <style>{STATS_CSS}</style>
      <style>{PHIL_CSS}</style>

      {/* ── Section 1: Hero — 一個...的空間 CTA ── */}
      <section
        ref={heroRef}
        data-nav-theme="light"
        style={{
          minHeight: "auto",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "84px 24px 88px",
          position: "relative",
          overflow: "hidden",
          background: "#fff",
        }}
      >
        <motion.div
          style={{
            position: "absolute",
            top: "-22%",
            left: "50%",
            transform: "translateX(-50%)",
            width: "min(1100px, 120vw)",
            height: "min(1100px, 120vw)",
            background: "radial-gradient(circle, rgba(26,157,92,0.10) 0%, rgba(26,157,92,0.04) 40%, transparent 70%)",
            pointerEvents: "none",
            opacity: heroGlowOpacity,
          }}
        />
        <motion.div
          style={{
            position: "relative",
            zIndex: 1,
            maxWidth: 880,
            width: "100%",
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            scale: heroScale,
          }}
        >
          {/* Logo badge */}
          <motion.div
            initial={reduceMotion ? {} : { opacity: 0, y: -10 }}
            animate={reduceMotion ? {} : { opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease: SPRING, delay: 0.05 }}
            style={{ marginBottom: 30 }}
          >
            <svg
              viewBox="0 0 3840 1000"
              style={{ width: "clamp(130px, 17vw, 180px)", height: "auto", display: "block", fill: "#111110" }}
              aria-label="SPACE8"
            >
              <polygon points="2532.07 716.51 2532.07 276.76 2917.98 276.76 2917.98 335.44 2590.74 335.44 2590.74 657.84 2918.59 657.84 2918.59 716.51 2532.07 716.51" />
              <rect x="2647.6" y="465.48" width="254.05" height="54.44" />
              <path d="M1659.26,293.1c-7.26-12.1-15.72-19.36-28.43-19.36s-21.78,7.26-29.04,19.36l-256.47,426.44h67.14l215.94-363.53,116.14,194.77,30.25,50.81,70.17,117.95h70.77l-256.47-426.44Z" />
              <circle cx="1634" cy="606.35" r="59.44" />
              <path d="M264.44,716.51v-58.67h327.24c48.99,0,75-28.43,75-69.56,0-45.36-26.62-68.35-75-68.35h-205.66c-79.24,0-128.24-52.63-128.24-122.79s45.36-120.37,129.45-120.37h313.93v58.67h-313.93c-43.55,0-68.35,26.61-68.35,65.33s26.01,64.72,67.75,64.72h205.05c85.29,0,130.65,42.34,130.65,125.21,0,71.98-42.95,125.82-130.65,125.82h-327.24Z" />
              <path d="M970.32,590.69v-56.86h189.93c62.3,0,98.59-40.53,98.59-99.81s-36.29-98.6-98.59-98.6h-246.79v381.07h-58.67v-439.75h305.47c98.59,0,156.06,60.49,156.06,155.45s-57.46,158.48-156.06,158.48h-189.93Z" />
              <path d="M2169.16,716.51c-120.97,0-209.89-96.78-209.89-224.41s88.92-215.34,209.89-215.34h234.09v58.67h-234.09c-87.1,0-151.22,65.33-151.22,159.69s63.51,162.71,151.22,162.71h234.09v58.67h-234.09Z" />
              <path d="M3256.74,473.61h112.02c26.88,0,39.58-11.09,39.58-39.03,0-29.71-17.55-39.91-48.54-39.91h-94.09c-30.99,0-48.54,10.2-48.54,39.91,0,27.94,12.7,39.03,39.58,39.03Z" />
              <path d="M3372.12,521.06h-118.74c-26.51,0-41.45,15.08-41.45,41.69,0,27.94,21.28,42.13,51.15,42.13h99.32c29.87,0,51.15-14.19,51.15-42.13s-14.94-41.69-41.45-41.69Z" />
              <path d="M3312.75,230.54c-148.82,0-269.46,120.64-269.46,269.46s120.64,269.46,269.46,269.46,269.46-120.64,269.46-269.46-120.64-269.46-269.46-269.46ZM3373.99,661.2h-122.47c-53.02,0-87.37-38.58-87.37-97.56,0-37.69,17.92-63.42,42.57-72.73-20.16-7.54-37.34-27.94-37.34-68.74,0-54.99,34.73-83.37,87.37-83.37h112.02c52.65,0,87.75,28.38,87.75,83.37,0,40.8-17.55,61.2-37.71,68.74,24.64,9.31,42.57,35.03,42.57,72.73,0,58.98-34.35,97.56-87.37,97.56Z" />
            </svg>
          </motion.div>

          {/* Headline with rotating word */}
          <h1
            style={{
              fontFamily: "'Noto Sans TC', sans-serif",
              fontWeight: 900,
              fontSize: "clamp(2.2rem, 7.4vw, 5.1rem)",
              lineHeight: 1.22,
              letterSpacing: "0.01em",
              color: "#111110",
              display: "flex",
              flexWrap: "nowrap",
              whiteSpace: "nowrap",
              alignItems: "center",
              justifyContent: "center",
              gap: "0 0.04em",
            }}
          >
            <motion.span
              initial={reduceMotion ? {} : { opacity: 0, y: 14 }}
              animate={reduceMotion ? {} : { opacity: 1, y: 0 }}
              transition={{ duration: 0.9, ease: SPRING, delay: 0.18 }}
            >
              {t("hero_prefix")}
            </motion.span>
            <span
              style={{
                position: "relative",
                display: "inline-block",
                height: "1.24em",
                overflow: "hidden",
                verticalAlign: "bottom",
              }}
            >
              {rotatingWords.map((word, i) => (
                <span
                  key={word}
                  style={{
                    position: "absolute",
                    left: "50%",
                    top: 0,
                    whiteSpace: "nowrap",
                    color: "#1a9d5c",
                    transform:
                      i === wordIdx
                        ? "translate(-50%, 0)"
                        : i === (wordIdx - 1 + rotatingWords.length) % rotatingWords.length
                          ? "translate(-50%, -110%)"
                          : "translate(-50%, 110%)",
                    opacity: i === wordIdx ? 1 : 0,
                    transition: reduceMotion
                      ? "opacity 0.2s ease"
                      : "transform 0.72s cubic-bezier(.22,1.15,.36,1), opacity 0.5s ease",
                  }}
                >
                  {word}
                </span>
              ))}
              <span style={{ visibility: "hidden", whiteSpace: "nowrap", display: "inline-block", height: 0, overflow: "hidden" }}>
                {rotatingWords[wordIdx]}
              </span>
            </span>
            <motion.span
              initial={reduceMotion ? {} : { opacity: 0, y: 14 }}
              animate={reduceMotion ? {} : { opacity: 1, y: 0 }}
              transition={{ duration: 0.9, ease: SPRING, delay: 0.18 }}
            >
              {t("hero_suffix")}
            </motion.span>
          </h1>

          <motion.p
            initial={reduceMotion ? {} : { opacity: 0, y: 14 }}
            animate={reduceMotion ? {} : { opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease: SPRING, delay: 0.34 }}
            style={{
              marginTop: 22,
              fontFamily: "'Noto Sans TC', sans-serif",
              fontSize: "clamp(14.5px, 1.7vw, 17px)",
              lineHeight: 1.95,
              color: "rgba(17,17,16,0.58)",
              maxWidth: "60ch",
            }}
          >
            {t("hero_subtitle")}
          </motion.p>

          <motion.div
            initial={reduceMotion ? {} : { opacity: 0, y: 14 }}
            animate={reduceMotion ? {} : { opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease: SPRING, delay: 0.48 }}
            style={{ marginTop: 34, display: "flex", gap: 14, flexWrap: "wrap", justifyContent: "center" }}
          >
            <Link
              href="/book"
              style={{
                display: "inline-flex", alignItems: "center", gap: 9,
                fontFamily: "'Noto Sans TC', sans-serif", fontSize: 15, fontWeight: 500,
                padding: "15px 32px", borderRadius: 999, textDecoration: "none", cursor: "pointer",
                background: "linear-gradient(180deg, #22b86b, #1a9d5c)", color: "#fff",
                boxShadow: "0 10px 30px -10px rgba(26,157,92,0.55)",
                transition: "transform 0.35s cubic-bezier(.2,.7,.3,1), box-shadow 0.35s ease",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 16px 38px -10px rgba(26,157,92,0.65)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = ""; }}
            >
              {t("hero_cta_primary")}
              <ArrowRight size={16} strokeWidth={2} />
            </Link>
            <Link
              href="/venue"
              style={{
                display: "inline-flex", alignItems: "center", gap: 9,
                fontFamily: "'Noto Sans TC', sans-serif", fontSize: 15, fontWeight: 500,
                padding: "15px 32px", borderRadius: 999, textDecoration: "none", cursor: "pointer",
                background: "transparent", color: "#111110", border: "1px solid rgba(17,17,16,0.12)",
                transition: "transform 0.35s cubic-bezier(.2,.7,.3,1), border-color 0.3s ease",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.borderColor = "rgba(17,17,16,0.42)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = ""; e.currentTarget.style.borderColor = ""; }}
            >
              {t("hero_cta_secondary")}
            </Link>
          </motion.div>
        </motion.div>
      </section>

      {/* ── Section 2: 我們的理念 ── */}
      <section
        ref={philRef}
        id="philSection"
        data-nav-theme="dark"
        className="phil-section"
        style={{
          position: "relative",
          background: "#000000",
          padding: "120px 24px 140px",
          overflow: "hidden",
        }}
      >
        <canvas
          id="philStars"
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            display: "block",
            pointerEvents: "none",
            zIndex: 0,
          }}
        />
        <div className="phil-inner" style={{ position: "relative", zIndex: 1, maxWidth: 1120, margin: "0 auto" }}>
          <motion.p
            className="phil-eyebrow"
            initial={reduceMotion ? {} : { opacity: 0, y: 16 }}
            whileInView={reduceMotion ? {} : { opacity: 1, y: 0 }}
            viewport={VIEWPORT}
            transition={{ duration: 0.6, ease: EASE }}
            style={{
              fontFamily: "'Noto Sans TC', sans-serif", fontWeight: 700, fontSize: 13,
              letterSpacing: "0.05em", color: GREEN_BRIGHT, marginBottom: 20,
            }}
          >
            {t("mission_eyebrow")}
          </motion.p>
          <motion.h2
            className="phil-title"
            initial={reduceMotion ? {} : { opacity: 0, y: 24 }}
            whileInView={reduceMotion ? {} : { opacity: 1, y: 0 }}
            viewport={VIEWPORT}
            transition={{ duration: 0.7, ease: EASE, delay: 0.1 }}
            style={{
              fontFamily: "'Noto Sans TC', sans-serif", fontWeight: 900,
              fontSize: "clamp(1.9rem, 5.2vw, 3.4rem)", lineHeight: 1.32,
              letterSpacing: "0.005em", color: "#f5f2ec", whiteSpace: "nowrap", marginBottom: 84,
            }}
          >
            {t("mission_statement")}
          </motion.h2>

          <div className="phil-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 44 }}>
            {missionItems.map((item, i) => {
              const Icon = [TargetIcon, ClockIcon2, PhoneIcon2][i] ?? TargetIcon;
              return (
                <motion.div
                  key={item.title}
                  className="phil-item"
                  initial={reduceMotion ? {} : { opacity: 0, y: 22 }}
                  whileInView={reduceMotion ? {} : { opacity: 1, y: 0 }}
                  viewport={VIEWPORT}
                  transition={{ duration: 0.7, ease: SPRING, delay: 0.26 + i * 0.12 }}
                >
                  <div className="phil-icon" style={{ width: 28, height: 28, color: GREEN_BRIGHT, marginBottom: 22 }}>
                    <Icon />
                  </div>
                  <h3 style={{ fontFamily: "'Noto Sans TC', sans-serif", fontWeight: 700, fontSize: 16.5, color: "#f5f2ec", marginBottom: 12 }}>
                    {item.title}
                  </h3>
                  <p style={{ fontFamily: "'Noto Sans TC', sans-serif", fontSize: 14, lineHeight: 1.8, color: "rgba(245,242,236,0.58)" }}>
                    {item.body}
                  </p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Section 5: 準備好開球了嗎？ ── */}
      <section
        ref={ctaRef}
        id="ctaSection"
        data-nav-theme="dark"
        style={{
          position: "relative",
          background: "#1d1d1f",
          padding: "130px 24px 140px",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute", left: "50%", top: "50%",
            width: "min(940px, 130vw)", height: "min(940px, 130vw)",
            transform: "translate(-50%, -50%)",
            background: "radial-gradient(circle, rgba(26,157,92,0.16) 0%, rgba(26,157,92,0.05) 42%, transparent 70%)",
            pointerEvents: "none",
          }}
        />
        <div
          style={{
            position: "relative", zIndex: 1, maxWidth: 1060, margin: "0 auto",
            display: "grid", gridTemplateColumns: "1.05fr 0.95fr", gap: 56, alignItems: "center",
          }}
        >
          {/* Left: stacked cards */}
          <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 14 }}>
            {ctaSteps.map((step, i) => {
              const StepIcon = STEP_ICONS[i] ?? StepIcon1;
              return (
                <motion.div
                  key={step.title}
                  initial={reduceMotion ? {} : { opacity: 0, y: 26, scale: 0.97 }}
                  whileInView={reduceMotion ? {} : { opacity: 1, y: 0, scale: 1 }}
                  viewport={VIEWPORT}
                  transition={{ duration: 0.75, ease: SPRING, delay: 0.1 + i * 0.12 }}
                  style={{
                    display: "flex", alignItems: "center", gap: 16,
                    padding: "20px 22px", borderRadius: 16,
                    background: "rgba(255,255,255,0.045)", border: "1px solid rgba(255,255,255,0.11)",
                    backdropFilter: "blur(6px)",
                    transition: "border-color 0.35s ease, background 0.35s ease",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(34,184,107,0.45)"; e.currentTarget.style.background = "rgba(34,184,107,0.07)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = ""; e.currentTarget.style.background = ""; }}
                >
                  <div style={{ flexShrink: 0, width: 38, height: 38, borderRadius: 11, background: "rgba(34,184,107,0.14)", color: "#22b86b", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <StepIcon />
                  </div>
                  <div>
                    <b style={{ display: "block", fontFamily: "'Noto Sans TC', sans-serif", fontWeight: 700, fontSize: 15, color: "#f5f2ec", marginBottom: 3 }}>{step.title}</b>
                    <span style={{ fontFamily: "'Noto Sans TC', sans-serif", fontSize: 13, lineHeight: 1.65, color: "rgba(245,242,236,0.55)" }}>{step.body}</span>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Right: copy + ball */}
          <div style={{ textAlign: "left" }}>
            <motion.div
              initial={reduceMotion ? {} : { opacity: 0, x: -190, rotate: -560 }}
              whileInView={reduceMotion ? {} : { opacity: 1, x: 0, rotate: 0 }}
              viewport={VIEWPORT}
              transition={{ duration: 1.35, ease: [0.16, 0.72, 0.3, 1], delay: 0.15 }}
              style={{ position: "relative", width: "clamp(130px, 17vw, 180px)", marginBottom: 28 }}
            >
              <div style={{ width: "100%", aspectRatio: "1/1", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Logo variant="mark" theme="dark" size={140} />
              </div>
              <div
                style={{
                  position: "absolute", left: "50%", bottom: -13, width: "74%", height: 14,
                  transform: "translateX(-50%)",
                  background: "radial-gradient(ellipse, rgba(0,0,0,0.62) 0%, transparent 72%)",
                  filter: "blur(5px)",
                }}
              />
            </motion.div>

            <motion.h2
              initial={reduceMotion ? {} : { opacity: 0, y: 20 }}
              whileInView={reduceMotion ? {} : { opacity: 1, y: 0 }}
              viewport={VIEWPORT}
              transition={{ duration: 0.8, ease: SPRING, delay: 0.3 }}
              style={{
                fontFamily: "'Noto Sans TC', sans-serif", fontWeight: 900,
                fontSize: "clamp(1.9rem, 4.4vw, 3rem)", lineHeight: 1.3,
                color: "#f5f2ec", marginBottom: 16,
              }}
            >
              {t("cta_title")}
            </motion.h2>
            <motion.p
              initial={reduceMotion ? {} : { opacity: 0, y: 20 }}
              whileInView={reduceMotion ? {} : { opacity: 1, y: 0 }}
              viewport={VIEWPORT}
              transition={{ duration: 0.8, ease: SPRING, delay: 0.42 }}
              style={{
                fontFamily: "'Noto Sans TC', sans-serif", fontSize: 15, lineHeight: 1.9,
                color: "rgba(245,242,236,0.58)", maxWidth: "36ch", marginBottom: 32,
              }}
            >
              {t("cta_subtitle")}
            </motion.p>
            <motion.div
              initial={reduceMotion ? {} : { opacity: 0, y: 20 }}
              whileInView={reduceMotion ? {} : { opacity: 1, y: 0 }}
              viewport={VIEWPORT}
              transition={{ duration: 0.8, ease: SPRING, delay: 0.54 }}
              style={{ display: "flex", gap: 13, flexWrap: "wrap" }}
            >
              <Link
                href="/book"
                style={{
                  display: "inline-flex", alignItems: "center", gap: 9,
                  fontFamily: "'Noto Sans TC', sans-serif", fontSize: 15, fontWeight: 500,
                  padding: "15px 32px", borderRadius: 999, textDecoration: "none",
                  background: "linear-gradient(180deg, #22b86b, #1a9d5c)", color: "#fff",
                  boxShadow: "0 12px 34px -12px rgba(26,157,92,0.7)",
                  transition: "transform 0.35s cubic-bezier(.2,.7,.3,1), box-shadow 0.35s ease",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 18px 42px -12px rgba(26,157,92,0.8)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = ""; }}
              >
                {t("cta_primary")}
                <ArrowRight size={16} strokeWidth={2} />
              </Link>
              <Link
                href="/pricing"
                style={{
                  display: "inline-flex", alignItems: "center", gap: 9,
                  fontFamily: "'Noto Sans TC', sans-serif", fontSize: 15, fontWeight: 500,
                  padding: "15px 32px", borderRadius: 999, textDecoration: "none",
                  background: "transparent", color: "#f5f2ec", border: "1px solid rgba(245,242,236,0.24)",
                  transition: "transform 0.35s cubic-bezier(.2,.7,.3,1), border-color 0.3s ease",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.borderColor = "rgba(245,242,236,0.55)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = ""; e.currentTarget.style.borderColor = ""; }}
              >
                {t("cta_secondary")}
              </Link>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── Section 6: Live Stats ── */}
      <section ref={statRef} className="stat-section" id="statSection" data-nav-theme="light">
        <div className="stat-inner">
          <div className="stat-grid">
            {statsItems.map((item, i) => (
              <div key={item.label} className="stat-item">
                <div className="stat-value">
                  <span className="stat-num" data-to={item.value} data-live={item.live ? "600000" : "0"}>0</span>
                  {item.suffix && <span className="stat-suffix">{item.suffix}</span>}
                  {item.unit && <span className="stat-unit">{item.unit}</span>}
                </div>
                <p className="stat-label">{item.label}</p>
                {item.live && (
                  <span className="stat-live"><i />{item.live}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Section 7: 聯絡我們 (kept unchanged) ── */}
      <section
        data-nav-theme="dark"
        style={{ background: "#1C1C1E", color: "white", padding: "clamp(80px, 12vw, 140px) 24px" }}
      >
        <div style={{ maxWidth: 760, margin: "0 auto" }}>
          <h2 style={{ fontSize: "clamp(32px, 5vw, 48px)", fontWeight: 700, letterSpacing: "-0.02em", margin: "0 0 48px" }}>
            {t("contact_title")}
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 28, marginBottom: 48 }}>
            <ContactRow icon={<MapPin size={22} color={GREEN} strokeWidth={1.75} />} label={t("contact_address_label")} value={t("contact_address")} />
            <ContactRow icon={<MessageCircle size={22} color={GREEN} strokeWidth={1.75} />} label={t("contact_whatsapp_label")} value={PHONE} href={WHATSAPP_URL} />
            <ContactRow icon={<Mail size={22} color={GREEN} strokeWidth={1.75} />} label={t("contact_email_label")} value={EMAIL} href={`mailto:${EMAIL}`} />
            <ContactRow icon={<Clock size={22} color={GREEN} strokeWidth={1.75} />} label={t("contact_hours_label")} value={t("contact_hours")} />
          </div>
          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-flex", alignItems: "center", gap: 10,
              background: GREEN, color: "#000", fontWeight: 700, fontSize: 16,
              padding: "0 28px", height: 52, borderRadius: 100, textDecoration: "none",
            }}
          >
            <MessageCircle size={20} strokeWidth={2} />
            {t("contact_cta")}
          </a>
        </div>
      </section>

      {/* ── Stars canvas ── */}
      <StarsCanvas />
    </div>
  );
}

function ContactRow({ icon, label, value, href }: { icon: React.ReactNode; label: string; value: string; href?: string }) {
  const content = (
    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
      <span style={{ flexShrink: 0 }}>{icon}</span>
      <span>
        <span className="font-label" style={{ display: "block", fontSize: 13, color: "#A1A1A6" }}>{label}</span>
        <span style={{ display: "block", fontSize: 17, color: "white", marginTop: 2 }}>{value}</span>
      </span>
    </div>
  );
  return href ? <a href={href} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>{content}</a> : content;
}

/* ── Stars Canvas ── */
function StarsCanvas() {
  useEffect(() => {
    const canvas = document.getElementById("philStars") as HTMLCanvasElement | null;
    const section = document.getElementById("philSection");
    if (!canvas || !section) return;

    const ctx = canvas.getContext("2d")!;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let stars: { x: number; y: number; r: number; speed: number; baseAlpha: number }[] = [];
    let w = 0, h = 0, dpr = 1;
    let raf: number | null = null, visible = false, t = 0;

    const LAYERS = [
      { count: 0.00016, r: [0.35, 0.85] as [number, number], speed: 0.01, alpha: [0.25, 0.55] as [number, number] },
      { count: 0.00009, r: [0.65, 1.35] as [number, number], speed: 0.02, alpha: [0.35, 0.75] as [number, number] },
      { count: 0.00003, r: [1.05, 1.95] as [number, number], speed: 0.035, alpha: [0.55, 1.0] as [number, number] },
    ];

    function rand(a: number, b: number) { return a + Math.random() * (b - a); }

    function resize() {
      dpr = window.devicePixelRatio || 1;
      const rect = section!.getBoundingClientRect();
      w = rect.width; h = rect.height;
      canvas!.width = w * dpr; canvas!.height = h * dpr;
      canvas!.style.width = `${w}px`; canvas!.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (stars.length === 0) initStars();
    }

    function initStars() {
      stars = [];
      const area = w * h;
      LAYERS.forEach((layer) => {
        const count = Math.round(area * layer.count);
        for (let i = 0; i < count; i++) {
          stars.push({
            x: rand(0, w), y: rand(0, h), r: rand(layer.r[0], layer.r[1]),
            speed: layer.speed, baseAlpha: rand(layer.alpha[0], layer.alpha[1]),
          });
        }
      });
    }

    function draw() {
      if (!visible) return;
      ctx.clearRect(0, 0, w, h);
      if (reduce) {
        stars.forEach((s) => {
          ctx.beginPath();
          ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255,255,255,${s.baseAlpha * 0.5})`;
          ctx.fill();
        });
        return;
      }
      t += 0.016;
      stars.forEach((s) => {
        const twinkle = 0.5 + 0.5 * Math.sin(t * s.speed * 8 + s.x);
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${s.baseAlpha * twinkle})`;
        ctx.fill();
      });
      raf = requestAnimationFrame(draw);
    }

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          visible = e.isIntersecting;
          if (visible) draw();
          else if (raf) { cancelAnimationFrame(raf); raf = null; }
        });
      },
      { threshold: 0.1 }
    );

    resize();
    io.observe(section);
    window.addEventListener("resize", resize);
    return () => {
      io.disconnect();
      window.removeEventListener("resize", resize);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);
  return null;
}