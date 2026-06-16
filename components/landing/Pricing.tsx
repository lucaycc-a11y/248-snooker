"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence, useScroll, useMotionValueEvent } from "framer-motion";

const GREEN = "#1A6B35";
const GREEN_LIGHT = "#22C55E";

const FONT_FAMILY =
  "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', Helvetica, Arial, sans-serif";

const EASE = [0.16, 1, 0.3, 1] as const;
const SPRING = { type: "spring", stiffness: 260, damping: 26 } as const;
const VIEWPORT = { once: true, amount: 0.2 } as const;

// ── Static period icons (lucide-react paths, inlined to avoid a new dependency) ──
const ICON_PROPS = {
  width: 28,
  height: 28,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const SunIcon = (
  <svg {...ICON_PROPS} aria-hidden="true">
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
  </svg>
);

const MoonIcon = (
  <svg {...ICON_PROPS} aria-hidden="true">
    <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
  </svg>
);

const MoonStarIcon = (
  <svg {...ICON_PROPS} aria-hidden="true">
    <path d="M18 5h4M20 3v4M21.53 13.13A8 8 0 1 1 10.87 2.47a7 7 0 0 0 10.66 10.66Z" />
  </svg>
);

interface Stage {
  id: string;
  label: string;
  range: string;
  rate: number; // HK$ per hour
  copy: string;
  icon: React.ReactNode;
  cmsKey: string;
}

const stages: Stage[] = [
  {
    id: "afternoon",
    label: "下午",
    range: "12pm – 6pm",
    rate: 60,
    copy: "每日下午，開放給所有人。",
    icon: SunIcon,
    cmsKey: "pricing_stage_afternoon",
  },
  {
    id: "evening",
    label: "晚上",
    range: "6pm – 12am",
    rate: 80,
    copy: "夜深了，球桌依然等你。",
    icon: MoonIcon,
    cmsKey: "pricing_stage_evening",
  },
  {
    id: "latenight",
    label: "深夜",
    range: "12am – 6am",
    rate: 60,
    copy: "香港唯一 24 小時桌球會所。",
    icon: MoonStarIcon,
    cmsKey: "pricing_stage_latenight",
  },
];

const durations = [
  { label: "1 小時", hours: 1 },
  { label: "2 小時", hours: 2 },
  { label: "3 小時", hours: 3 },
] as const;

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
        fontSize: "17px",
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

interface DurationPillsProps {
  hours: number;
  onSelect: (hours: number) => void;
}

function DurationPills({ hours, onSelect }: DurationPillsProps) {
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
              color: selected ? "#000" : "rgba(255,255,255,0.8)",
              background: selected ? "white" : "transparent",
              border: `1px solid ${selected ? "white" : "rgba(255,255,255,0.25)"}`,
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

export default function Pricing() {
  const [isMobile, setIsMobile] = useState(false);
  const [stageIndex, setStageIndex] = useState(0);
  const [hours, setHours] = useState(2);

  const sectionRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end end"],
  });

  useMotionValueEvent(scrollYProgress, "change", (v) => {
    const idx = v < 0.34 ? 0 : v < 0.67 ? 1 : 2;
    setStageIndex((prev) => (prev === idx ? prev : idx));
  });

  const active = stages[stageIndex];
  const total = active.rate * hours;

  // ===== Shared header =====
  const header = (
    <>
      <motion.p
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={VIEWPORT}
        transition={{ duration: 0.6, ease: EASE }}
        style={{
          fontSize: "14px",
          fontWeight: 500,
          color: GREEN_LIGHT,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          textAlign: "center",
          marginBottom: "16px",
        }}
        data-cms-key="pricing_eyebrow"
      >
        <span
          style={{
            display: "inline-block",
            width: "6px",
            height: "6px",
            background: GREEN_LIGHT,
            borderRadius: "50%",
            marginRight: "8px",
            verticalAlign: "middle",
          }}
        />
        定價
      </motion.p>

      <motion.h2
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={VIEWPORT}
        transition={{ duration: 0.6, ease: EASE }}
        style={{
          fontSize: "clamp(40px, 6vw, 72px)",
          fontWeight: 600,
          letterSpacing: "-0.03em",
          color: "white",
          textAlign: "center",
          margin: "0 0 4px",
        }}
        data-cms-key="pricing_title"
      >
        透明定價。
      </motion.h2>

      <motion.p
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={VIEWPORT}
        transition={{ duration: 0.6, ease: EASE, delay: 0.05 }}
        style={{
          fontSize: "clamp(40px, 6vw, 72px)",
          fontWeight: 600,
          letterSpacing: "-0.03em",
          color: GREEN_LIGHT,
          textAlign: "center",
          margin: 0,
        }}
        data-cms-key="pricing_subtitle"
      >
        冇驚喜。
      </motion.p>

      <motion.div
        initial={{ opacity: 0, scaleX: 0 }}
        whileInView={{ opacity: 1, scaleX: 1 }}
        viewport={VIEWPORT}
        transition={{ duration: 0.6, ease: EASE }}
        style={{
          width: "40px",
          height: "2px",
          background: GREEN,
          margin: "28px auto 0",
          borderRadius: "2px",
        }}
      />
    </>
  );

  // ===== Right-side text + price (shared by layouts) =====
  const infoPanel = (
    <div style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
      <div style={{ minHeight: isMobile ? "150px" : "210px" }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={active.id}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -24 }}
            transition={{ duration: 0.45, ease: EASE }}
            data-cms-key={active.cmsKey}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "6px", flexWrap: "wrap" }}>
              <span style={{ color: GREEN_LIGHT, display: "inline-flex" }} aria-hidden="true">
                {active.icon}
              </span>
              <h3
                style={{
                  fontSize: "clamp(28px, 3vw, 38px)",
                  fontWeight: 500,
                  letterSpacing: "-0.02em",
                  color: "white",
                  margin: 0,
                }}
              >
                {active.label}
              </h3>
              <span style={{ fontSize: "18px", color: "rgba(255,255,255,0.45)" }}>{active.range}</span>
            </div>
            <p style={{ fontSize: "17px", color: "rgba(255,255,255,0.6)", margin: "0 0 8px", lineHeight: 1.5 }}>
              {active.copy}
            </p>
          </motion.div>
        </AnimatePresence>

        {/* Spring-animated price */}
        <div style={{ height: "112px", overflow: "hidden" }}>
          <AnimatePresence mode="popLayout">
            <motion.div
              key={`${active.id}-${hours}`}
              initial={{ y: 60, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -60, opacity: 0 }}
              transition={SPRING}
              style={{
                fontSize: "clamp(64px, 8vw, 96px)",
                fontWeight: 600,
                letterSpacing: "-0.04em",
                lineHeight: 1,
                color: "white",
              }}
            >
              {formatPrice(total)}
            </motion.div>
          </AnimatePresence>
        </div>
        <p style={{ fontSize: "16px", color: "rgba(255,255,255,0.4)", margin: "12px 0 0" }}>
          {hours} 小時 · 每小時 {formatPrice(active.rate)}
        </p>
      </div>

      {/* Learn more links (green) */}
      <div style={{ display: "flex", gap: "28px", flexWrap: "wrap", marginTop: "32px" }}>
        <LearnMore href="/about" cmsKey="pricing_link_choose_time">
          選擇時段
        </LearnMore>
        <LearnMore href="/pricing" cmsKey="pricing_link_details">
          了解定價詳情
        </LearnMore>
      </div>
    </div>
  );

  return (
    <section
      id="pricing"
      style={{
        background: "#000000",
        color: "white",
        fontFamily: FONT_FAMILY,
      }}
    >
      {/* Header */}
      <div style={{ padding: isMobile ? "120px 24px 0" : "140px 0 0" }}>{header}</div>

      {isMobile ? (
        /* ===== Mobile: horizontal snap-scroll, each card self-contained ===== */
        <>
          <div
            className="no-scrollbar"
            style={{
              display: "flex",
              gap: "16px",
              overflowX: "auto",
              scrollSnapType: "x mandatory",
              padding: "8px 24px",
              scrollPaddingLeft: "24px",
              WebkitOverflowScrolling: "touch",
              marginTop: "48px",
            }}
          >
            {stages.map((stage) => {
              const stageTotal = stage.rate * hours;
              return (
                <div
                  key={stage.id}
                  className="snap-start shrink-0"
                  style={{
                    minWidth: "85vw",
                    scrollSnapAlign: "start",
                    borderRadius: "24px",
                    border: "1px solid rgba(34,197,94,0.35)",
                    background: "rgba(34,197,94,0.06)",
                    padding: "28px",
                    display: "flex",
                    flexDirection: "column",
                  }}
                  data-cms-key={stage.cmsKey}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "8px" }}>
                    <span style={{ color: GREEN_LIGHT, display: "inline-flex", flexShrink: 0 }} aria-hidden="true">
                      {stage.icon}
                    </span>
                    <div style={{ display: "flex", alignItems: "baseline", gap: "10px", flexWrap: "wrap" }}>
                      <span style={{ fontSize: "24px", fontWeight: 500, color: "white", letterSpacing: "-0.01em" }}>
                        {stage.label}
                      </span>
                      <span style={{ fontSize: "14px", color: "rgba(255,255,255,0.45)" }}>{stage.range}</span>
                    </div>
                  </div>

                  <p style={{ fontSize: "16px", color: "rgba(255,255,255,0.6)", margin: "0 0 20px", lineHeight: 1.5 }}>
                    {stage.copy}
                  </p>

                  <DurationPills hours={hours} onSelect={setHours} />

                  {/* Inline price for this period */}
                  <div style={{ marginTop: "24px" }}>
                    <div style={{ height: "76px", overflow: "hidden" }}>
                      <AnimatePresence mode="popLayout">
                        <motion.div
                          key={`${stage.id}-${hours}`}
                          initial={{ y: 50, opacity: 0 }}
                          animate={{ y: 0, opacity: 1 }}
                          exit={{ y: -50, opacity: 0 }}
                          transition={SPRING}
                          style={{
                            fontSize: "64px",
                            fontWeight: 600,
                            letterSpacing: "-0.04em",
                            lineHeight: 1,
                            color: "white",
                          }}
                        >
                          {formatPrice(stageTotal)}
                        </motion.div>
                      </AnimatePresence>
                    </div>
                    <p style={{ fontSize: "15px", color: "rgba(255,255,255,0.4)", margin: "10px 0 0" }}>
                      {hours} 小時 · 每小時 {formatPrice(stage.rate)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Learn more links */}
          <div style={{ display: "flex", gap: "28px", flexWrap: "wrap", padding: "32px 24px 0" }}>
            <LearnMore href="/about" cmsKey="pricing_link_choose_time">
              選擇時段
            </LearnMore>
            <LearnMore href="/pricing" cmsKey="pricing_link_details">
              了解定價詳情
            </LearnMore>
          </div>
        </>
      ) : (
        /* ===== Desktop: scroll-driven sticky stage ===== */
        <div ref={sectionRef} style={{ position: "relative", height: "300vh", marginTop: "64px" }}>
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
                padding: "0 40px",
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "64px",
                alignItems: "center",
              }}
            >
              {/* Left — static spec-sheet rows */}
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {stages.map((stage, i) => {
                  const isActive = i === stageIndex;
                  return (
                    <div
                      key={stage.id}
                      style={{
                        borderRadius: "20px",
                        border: `1px solid ${isActive ? "rgba(34,197,94,0.5)" : "rgba(255,255,255,0.1)"}`,
                        background: isActive ? "rgba(34,197,94,0.06)" : "rgba(255,255,255,0.02)",
                        padding: "24px",
                        transition: "border-color 0.3s ease, background 0.3s ease",
                      }}
                      data-cms-key={stage.cmsKey}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                        <span style={{ color: GREEN_LIGHT, display: "inline-flex", flexShrink: 0 }} aria-hidden="true">
                          {stage.icon}
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "baseline", gap: "10px", flexWrap: "wrap" }}>
                            <span style={{ fontSize: "20px", fontWeight: 500, color: "white", letterSpacing: "-0.01em" }}>
                              {stage.label}
                            </span>
                            <span style={{ fontSize: "14px", color: "rgba(255,255,255,0.45)" }}>{stage.range}</span>
                          </div>
                          <span style={{ fontSize: "14px", color: "rgba(255,255,255,0.55)" }}>
                            每小時 {formatPrice(stage.rate)}
                          </span>
                        </div>
                      </div>

                      {/* Duration pills — selecting sets this period active + the hours */}
                      <div style={{ marginTop: "16px" }}>
                        <DurationPills
                          hours={isActive ? hours : 0}
                          onSelect={(h) => {
                            setStageIndex(i);
                            setHours(h);
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Right — sticky price card */}
              <div>{infoPanel}</div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
