"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslations } from "next-intl";

const GREEN_LIGHT = "#22C55E";
const SUBTLE = "#86868B";

const FONT_FAMILY =
  "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', Helvetica, Arial, sans-serif";

const EASE = [0.16, 1, 0.3, 1] as const;
const SPRING = { type: "spring", stiffness: 260, damping: 26 } as const;
const VIEWPORT = { once: true, amount: 0.2 } as const;

// ── Large period icons (lucide-react paths, inlined). stroke-width 1, sized via props. ──
const LARGE_ICON_PROPS = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function SunGlyph({ size }: { size: number }) {
  return (
    <svg {...LARGE_ICON_PROPS} width={size} height={size} aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  );
}

function MoonGlyph({ size }: { size: number }) {
  return (
    <svg {...LARGE_ICON_PROPS} width={size} height={size} aria-hidden="true">
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
    </svg>
  );
}

function MoonStarGlyph({ size }: { size: number }) {
  return (
    <svg {...LARGE_ICON_PROPS} width={size} height={size} aria-hidden="true">
      <path d="M18 5h4M20 3v4M21.53 13.13A8 8 0 1 1 10.87 2.47a7 7 0 0 0 10.66 10.66Z" />
    </svg>
  );
}

interface Stage {
  id: string;
  label: string;
  range: string;
  rate: number; // HK$ per hour
  Glyph: (props: { size: number }) => React.ReactNode;
  cmsKey: string;
}

function formatPrice(value: number): string {
  return `HK$${Math.round(value)}`;
}

interface LearnMoreProps {
  href: string;
  children: React.ReactNode;
  cmsKey?: string;
}

function LearnMore({ href, children, cmsKey }: LearnMoreProps) {
  return (
    <a
      href={href}
      className="group inline-flex items-center"
      style={{
        color: GREEN_LIGHT,
        fontSize: "16px",
        fontFamily: FONT_FAMILY,
        textDecoration: "none",
        gap: "6px",
      }}
      data-cms-key={cmsKey}
    >
      <span
        aria-hidden="true"
        style={{ width: "6px", height: "6px", borderRadius: "50%", background: GREEN_LIGHT, flexShrink: 0 }}
      />
      <span style={{ borderBottom: "1px solid transparent" }} className="group-hover:!border-current">
        {children}
      </span>
      <span
        aria-hidden="true"
        style={{ transition: "transform 0.2s ease" }}
        className="group-hover:translate-x-[3px]"
      >
        ›
      </span>
    </a>
  );
}

interface DurationOption {
  label: string;
  hours: number;
}

interface DurationPillsProps {
  hours: number;
  onSelect: (hours: number) => void;
  durations: readonly DurationOption[];
}

function DurationPills({ hours, onSelect, durations }: DurationPillsProps) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
      {durations.map((d) => {
        const selected = hours === d.hours;
        return (
          <button
            key={d.label}
            type="button"
            onClick={() => onSelect(d.hours)}
            style={{
              fontSize: "14px",
              fontWeight: 500,
              color: selected ? "#000" : "white",
              background: selected ? "white" : "transparent",
              border: `1px solid ${selected ? "white" : "#3D3D3D"}`,
              borderRadius: "100px",
              padding: "9px 18px",
              cursor: "pointer",
              transition: "all 0.2s ease",
              fontFamily: FONT_FAMILY,
            }}
          >
            {d.label}
          </button>
        );
      })}
    </div>
  );
}

// ── Eyebrow + reusable content block ──
function Eyebrow({ label }: { label: string }) {
  return (
    <p
      style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        fontSize: "14px",
        fontWeight: 500,
        color: GREEN_LIGHT,
        letterSpacing: "0.04em",
        margin: "0 0 28px",
      }}
      data-cms-key="pricing_eyebrow"
    >
      <span
        aria-hidden="true"
        style={{ width: "6px", height: "6px", borderRadius: "50%", background: GREEN_LIGHT, flexShrink: 0 }}
      />
      {label}
    </p>
  );
}

interface StageContentProps {
  stage: Stage;
  hours: number;
  onSelect: (hours: number) => void;
  priceSize: string;
  perHour: string;
  ctaBook: string;
  ctaLearn: string;
  durations: readonly DurationOption[];
}

function StageContent({ stage, hours, onSelect, priceSize, perHour, ctaBook, ctaLearn, durations }: StageContentProps) {
  const total = stage.rate * hours;
  return (
    <>
      <Eyebrow label={stage.label} />

      <h3
        style={{
          fontSize: "32px",
          fontWeight: 700,
          letterSpacing: "-0.02em",
          color: "white",
          margin: "0 0 2px",
        }}
      >
        {stage.label}
      </h3>
      <p style={{ fontSize: "14px", color: SUBTLE, margin: "0 0 32px" }}>{stage.range}</p>

      {/* Price — flips with pill selection */}
      <div style={{ display: "flex", alignItems: "flex-end", gap: "8px", marginBottom: "40px" }}>
        <div style={{ height: priceSize, overflow: "hidden", display: "flex", alignItems: "flex-end" }}>
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={`${stage.id}-${hours}`}
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -50, opacity: 0 }}
              transition={SPRING}
              style={{
                display: "block",
                fontSize: priceSize,
                fontWeight: 700,
                letterSpacing: "-0.04em",
                lineHeight: 1,
                color: "white",
              }}
            >
              {formatPrice(total)}
            </motion.span>
          </AnimatePresence>
        </div>
        <span style={{ fontSize: "14px", color: SUBTLE, paddingBottom: "8px" }}>{perHour}</span>
      </div>

      <div style={{ marginBottom: "44px" }}>
        <DurationPills hours={hours} onSelect={onSelect} durations={durations} />
      </div>

      <div style={{ display: "flex", gap: "32px", flexWrap: "wrap" }}>
        <LearnMore href="/about" cmsKey="pricing_link_choose_time">
          {ctaBook}
        </LearnMore>
        <LearnMore href="/pricing" cmsKey="pricing_link_details">
          {ctaLearn}
        </LearnMore>
      </div>
    </>
  );
}

export default function Pricing() {
  const t = useTranslations('pricing');
  const [isMobile, setIsMobile] = useState(false);
  const [stageIndex, setStageIndex] = useState(0);

  const stages: Stage[] = [
    {
      id: "afternoon",
      label: t('afternoon_label'),
      range: t('afternoon_range'),
      rate: 60,
      Glyph: SunGlyph,
      cmsKey: "pricing_stage_afternoon",
    },
    {
      id: "evening",
      label: t('evening_label'),
      range: t('evening_range'),
      rate: 80,
      Glyph: MoonGlyph,
      cmsKey: "pricing_stage_evening",
    },
    {
      id: "latenight",
      label: t('night_label'),
      range: t('night_range'),
      rate: 60,
      Glyph: MoonStarGlyph,
      cmsKey: "pricing_stage_latenight",
    },
  ];

  const durations: DurationOption[] = [
    { label: t('duration_1h'), hours: 1 },
    { label: t('duration_2h'), hours: 2 },
    { label: t('duration_3h'), hours: 3 },
  ];

  const perHour = t('per_hour');
  const ctaBook = t('cta_book');
  const ctaLearn = t('cta_learn');

  // Each period remembers its own selected duration (defaults to 1h).
  const [hoursByStage, setHoursByStage] = useState<Record<string, number>>(
    () => Object.fromEntries(stages.map((s) => [s.id, 1]))
  );

  const sectionRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Deterministic scroll tracking: measure how far the sticky section has been
  // scrolled through its own travel (300vh tall, 100vh sticky child => 200vh of
  // travel). progress 0→1 maps to the three periods. Computed from the element's
  // own rect so it never depends on framer's internal measurement timing.
  useEffect(() => {
    if (isMobile) return;
    const el = sectionRef.current;
    if (!el) return;

    let frame = 0;
    const update = () => {
      frame = 0;
      const rect = el.getBoundingClientRect();
      const travel = rect.height - window.innerHeight; // 200vh worth of scroll
      if (travel <= 0) return;
      // -rect.top is how far we've scrolled into the section.
      const progress = Math.min(1, Math.max(0, -rect.top / travel));
      const idx = progress < 0.33 ? 0 : progress < 0.66 ? 1 : 2;
      setStageIndex((prev) => (prev === idx ? prev : idx));
    };

    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [isMobile]);

  const setHoursFor = (id: string, h: number) =>
    setHoursByStage((prev) => ({ ...prev, [id]: h }));

  // ===== Mobile: three full-screen centred sections, vertical scroll-snap =====
  if (isMobile) {
    return (
      <section
        id="pricing"
        className="no-scrollbar"
        style={{
          background: "#000000",
          color: "white",
          fontFamily: FONT_FAMILY,
          height: "100vh",
          overflowY: "scroll",
          scrollSnapType: "y mandatory",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {stages.map((stage, i) => {
          const hours = hoursByStage[stage.id] ?? 1;
          const total = stage.rate * hours;
          return (
            <motion.div
              key={stage.id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={VIEWPORT}
              transition={{ duration: 0.6, ease: EASE }}
              style={{
                height: "100vh",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                alignItems: "center",
                textAlign: "center",
                padding: "88px 24px",
                scrollSnapAlign: "start",
              }}
              data-cms-key={stage.cmsKey}
            >
              {/* Section label — first section only */}
              {i === 0 && <Eyebrow label={t('title')} />}

              {/* Period name + range */}
              <h3
                style={{
                  fontSize: "40px",
                  fontWeight: 700,
                  letterSpacing: "-0.02em",
                  color: "white",
                  margin: "0 0 4px",
                }}
              >
                {stage.label}
              </h3>
              <p style={{ fontSize: "16px", color: SUBTLE, margin: 0 }}>{stage.range}</p>

              {/* Large icon — between text and price */}
              <div style={{ color: GREEN_LIGHT, margin: "40px 0" }} aria-hidden="true">
                <stage.Glyph size={80} />
              </div>

              {/* Price — flips with pill selection */}
              <div style={{ height: "72px", overflow: "hidden", display: "flex", alignItems: "flex-end" }}>
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.span
                    key={`${stage.id}-${hours}`}
                    initial={{ y: 56, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -56, opacity: 0 }}
                    transition={SPRING}
                    style={{
                      display: "block",
                      fontSize: "72px",
                      fontWeight: 700,
                      letterSpacing: "-0.04em",
                      lineHeight: 1,
                      color: "white",
                    }}
                  >
                    {formatPrice(total)}
                  </motion.span>
                </AnimatePresence>
              </div>
              <p style={{ fontSize: "16px", color: SUBTLE, margin: "10px 0 0" }}>{perHour}</p>

              {/* Duration pills */}
              <div style={{ display: "flex", justifyContent: "center", margin: "40px 0 0" }}>
                <DurationPills hours={hours} onSelect={(h) => setHoursFor(stage.id, h)} durations={durations} />
              </div>

              {/* Links */}
              <div style={{ display: "flex", justifyContent: "center", gap: "24px", flexWrap: "wrap", marginTop: "40px" }}>
                <LearnMore href="/about" cmsKey="pricing_link_choose_time">
                  {ctaBook}
                </LearnMore>
                <LearnMore href="/pricing" cmsKey="pricing_link_details">
                  {ctaLearn}
                </LearnMore>
              </div>
            </motion.div>
          );
        })}
      </section>
    );
  }

  // ===== Desktop: 300vh scroll, sticky split with large icon left =====
  const active = stages[stageIndex];
  const activeHours = hoursByStage[active.id] ?? 1;

  return (
    <section id="pricing" data-nav-theme="dark" style={{ background: "#000000", color: "white", fontFamily: FONT_FAMILY }}>
      <div ref={sectionRef} style={{ position: "relative", height: "300vh" }}>
        <div
          style={{
            position: "sticky",
            top: 0,
            zIndex: 1,
            height: "100vh",
            display: "flex",
            alignItems: "center",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              maxWidth: "1100px",
              width: "100%",
              margin: "0 auto",
              padding: "32px 48px",
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "64px",
              alignItems: "center",
            }}
          >
            {/* LEFT — large icon, crossfades with scroll (always one visible) */}
            <div
              style={{
                position: "relative",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                minHeight: "240px",
                color: GREEN_LIGHT,
              }}
              aria-hidden="true"
            >
              <AnimatePresence initial={false}>
                <motion.div
                  key={active.id}
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.6, opacity: 0 }}
                  transition={SPRING}
                  style={{ position: "absolute", display: "inline-flex" }}
                >
                  <active.Glyph size={160} />
                </motion.div>
              </AnimatePresence>
            </div>

            {/* RIGHT — content, crossfades with scroll (always one visible) */}
            <div
              style={{
                position: "relative",
                minHeight: "380px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                paddingLeft: "48px",
              }}
            >
              <AnimatePresence initial={false}>
                <motion.div
                  key={active.id}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -30 }}
                  transition={{ duration: 0.4, ease: EASE }}
                  style={{ position: "absolute", top: 0, left: 0, right: 0 }}
                  data-cms-key={active.cmsKey}
                >
                  <StageContent
                    stage={active}
                    hours={activeHours}
                    onSelect={(h) => setHoursFor(active.id, h)}
                    priceSize="64px"
                    perHour={perHour}
                    ctaBook={ctaBook}
                    ctaLearn={ctaLearn}
                    durations={durations}
                  />
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
