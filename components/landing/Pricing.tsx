"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

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
  // Each period tracks its own selected duration (defaults to 1 小時)
  const [hoursByStage, setHoursByStage] = useState<Record<string, number>>(
    () => Object.fromEntries(stages.map((s) => [s.id, 1]))
  );

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

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

  return (
    <section
      id="pricing"
      style={{
        background: "#000000",
        color: "white",
        fontFamily: FONT_FAMILY,
        padding: isMobile ? "120px 0 100px" : "140px 0 120px",
      }}
    >
      {/* Header */}
      <div style={{ padding: "0 24px" }}>{header}</div>

      {/* Vertical period list */}
      <div
        style={{
          maxWidth: "760px",
          width: "100%",
          margin: "64px auto 0",
          padding: isMobile ? "0 24px" : "0 40px",
        }}
      >
        {stages.map((stage, i) => {
          const hours = hoursByStage[stage.id] ?? 1;
          const total = stage.rate * hours;
          return (
            <motion.div
              key={stage.id}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={VIEWPORT}
              transition={{ duration: 0.5, ease: EASE, delay: 0.08 * i }}
              style={{
                padding: "24px 0",
                borderBottom: "1px solid #2D2D2D",
              }}
              data-cms-key={stage.cmsKey}
            >
              {/* Row 1 — icon + label pill + hours · price */}
              <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                <span style={{ color: GREEN_LIGHT, display: "inline-flex", flexShrink: 0 }} aria-hidden="true">
                  {stage.icon}
                </span>

                <div
                  style={{
                    flex: 1,
                    minWidth: 0,
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    flexWrap: "wrap",
                  }}
                >
                  <span
                    style={{
                      fontSize: "15px",
                      fontWeight: 500,
                      color: "white",
                      background: "rgba(255,255,255,0.08)",
                      borderRadius: "100px",
                      padding: "6px 14px",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {stage.label}
                  </span>
                  <span style={{ fontSize: "14px", color: "rgba(255,255,255,0.45)", whiteSpace: "nowrap" }}>
                    {stage.range}
                  </span>
                </div>

                {/* Price — updates with selected duration */}
                <div style={{ textAlign: "right", flexShrink: 0, minWidth: "84px" }}>
                  <div style={{ height: "28px", overflow: "hidden" }}>
                    <AnimatePresence mode="popLayout">
                      <motion.span
                        key={`${stage.id}-${hours}`}
                        initial={{ y: 24, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: -24, opacity: 0 }}
                        transition={SPRING}
                        style={{
                          display: "block",
                          fontSize: "22px",
                          fontWeight: 700,
                          letterSpacing: "-0.02em",
                          color: "white",
                          lineHeight: "28px",
                        }}
                      >
                        {formatPrice(total)}
                      </motion.span>
                    </AnimatePresence>
                  </div>
                  <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)" }}>
                    {hours} 小時 · 每小時 {formatPrice(stage.rate)}
                  </span>
                </div>
              </div>

              {/* Row 2 — duration pills */}
              <div style={{ marginTop: "16px", paddingLeft: "44px" }}>
                <DurationPills
                  hours={hours}
                  onSelect={(h) => setHoursByStage((prev) => ({ ...prev, [stage.id]: h }))}
                />
              </div>
            </motion.div>
          );
        })}

        {/* Learn more links */}
        <div style={{ display: "flex", gap: "28px", flexWrap: "wrap", marginTop: "40px" }}>
          <LearnMore href="/about" cmsKey="pricing_link_choose_time">
            選擇時段
          </LearnMore>
          <LearnMore href="/pricing" cmsKey="pricing_link_details">
            了解定價詳情
          </LearnMore>
        </div>
      </div>
    </section>
  );
}
