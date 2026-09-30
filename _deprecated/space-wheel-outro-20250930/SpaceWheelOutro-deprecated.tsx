"use client";

// Outro section — appears after the last wheel photo.
// Layout (single dark section, no clutter):
//
//   eyebrow + mission statement
//   cta title + subtitle
//   3 steps as a single quiet row
//   4 stats as a single slim row
//   two CTA buttons
//
// All copy comes from existing i18n keys. No new keys here.
//
// DEPRECATED 2025-09-30: replaced by simplified light-bg version.
// Removed: cta title+subtitle, steps row, stats row.
// Current file: app/[locale]/about/SpaceWheelOutro.tsx
import { useTranslations } from "next-intl";
import { motion } from "framer-motion";
import Link from "next/link";

const REVEAL = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.2, 0.7, 0.3, 1] } },
};

const CONTAINER = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1 } },
};

type StepItem = { title: string; body: string };
type StatItem = { value: string; unit: string; suffix: string; label: string };

export function SpaceWheelOutro() {
  const t = useTranslations("aboutPage");
  const steps = t.raw("cta_steps") as StepItem[];
  const stats = t.raw("stats_items") as StatItem[];

  return (
    <section
      className="w-full bg-[#0a0a0a] py-24 px-6 md:px-12 lg:px-20"
      aria-labelledby="outro-heading"
    >
      <motion.div
        className="max-w-4xl mx-auto flex flex-col gap-16"
        variants={CONTAINER}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.2 }}
      >
        {/* ── Mission ── */}
        <motion.div variants={REVEAL} className="flex flex-col gap-3">
          <p
            className="text-xs tracking-[0.25em] uppercase text-white/40"
            style={{ fontFamily: "'Good Times', monospace" }}
          >
            {t("mission_eyebrow")}
          </p>
          <h2
            id="outro-heading"
            className="text-3xl md:text-4xl font-semibold text-white leading-snug"
            style={{ fontFamily: "'Noto Sans TC', sans-serif" }}
          >
            {t("mission_statement")}
          </h2>
        </motion.div>

        {/* ── CTA block ── */}
        <motion.div variants={REVEAL} className="flex flex-col gap-3">
          <h3
            className="text-2xl md:text-3xl font-semibold text-white"
            style={{ fontFamily: "'Noto Sans TC', sans-serif" }}
          >
            {t("cta_title")}
          </h3>
          <p
            className="text-white/60 text-base leading-relaxed max-w-2xl"
            style={{ fontFamily: "'Noto Sans TC', sans-serif", fontWeight: 600 }}
          >
            {t("cta_subtitle")}
          </p>
        </motion.div>

        {/* ── Steps — single quiet row ── */}
        <motion.ol
          variants={REVEAL}
          className="flex flex-wrap gap-x-10 gap-y-4 list-none"
          aria-label="預訂步驟"
        >
          {steps.map((step, i) => (
            <li key={step.title} className="flex items-center gap-3">
              <span
                className="text-xs tabular-nums"
                style={{
                  fontFamily: "'Good Times', monospace",
                  color: "#22c55e",
                }}
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <span
                className="text-white/80 text-sm font-semibold"
                style={{ fontFamily: "'Noto Sans TC', sans-serif" }}
              >
                {step.title}
              </span>
            </li>
          ))}
        </motion.ol>

        {/* ── Stats — single slim row ── */}
        <motion.ul
          variants={REVEAL}
          className="flex flex-wrap gap-x-12 gap-y-6 list-none border-t border-white/10 pt-8"
          aria-label="數據"
        >
          {stats.map((stat) => (
            <li key={stat.label} className="flex flex-col gap-0.5">
              <span
                className="text-2xl font-bold tabular-nums text-white"
                style={{ fontFamily: "'Good Times', monospace" }}
              >
                {stat.value}
                <span className="text-base font-normal text-white/50 ml-0.5">
                  {stat.unit}
                </span>
                {stat.suffix && (
                  <span className="text-base font-normal text-white/50">
                    {stat.suffix}
                  </span>
                )}
              </span>
              <span
                className="text-xs text-white/50"
                style={{ fontFamily: "'Noto Sans TC', sans-serif" }}
              >
                {stat.label}
              </span>
            </li>
          ))}
        </motion.ul>

        {/* ── CTAs ── */}
        <motion.div variants={REVEAL} className="flex flex-wrap gap-4">
          <Link
            href="/book"
            className="inline-flex items-center justify-center rounded-full bg-[#22c55e] text-black font-semibold text-sm px-6 py-3 transition hover:bg-[#16a34a] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#22c55e]"
            style={{ fontFamily: "'Noto Sans TC', sans-serif", minHeight: 44 }}
          >
            {t("cta_primary")}
          </Link>
          <Link
            href="/pricing"
            className="inline-flex items-center justify-center rounded-full border border-white/20 text-white/80 font-semibold text-sm px-6 py-3 transition hover:border-white/40 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/40"
            style={{ fontFamily: "'Noto Sans TC', sans-serif", minHeight: 44 }}
          >
            {t("cta_secondary")}
          </Link>
        </motion.div>
      </motion.div>
    </section>
  );
}

export default SpaceWheelOutro;
