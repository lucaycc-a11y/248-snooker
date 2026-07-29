"use client";

// Shared per-period pricing section — the /pricing page's "Part 2" block,
// extracted so the homepage reuses the exact same component (spec: the home
// pricing section IS the pricing page's, not a rewrite). Rates flow from the
// `config` table via getConfig() — never hardcoded here.
//
// Layout: all periods render as side-by-side cards (desktop grid) or a
// horizontal snap-scroll carousel (mobile) — NOT one full-screen section per
// period, so users see every period at a glance without scrolling.

import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Sun, Zap, Moon } from "lucide-react";
import type { PricingPeriod } from "@/lib/data/pricing";

const GREEN = "#22c55e";
const EASE = [0.16, 1, 0.3, 1] as const;

const FONT_FAMILY =
  "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', Helvetica, Arial, sans-serif";

function fmt(value: number): string {
  return `HK$${Math.round(value)}`;
}

export default function PeriodPricingSections({ periods }: { periods: PricingPeriod[] }) {
  const t = useTranslations("pricingPage");

  // Mobile carousel: track which card is snapped for the dot indicators.
  const trackRef = useRef<HTMLDivElement>(null);
  const [current, setCurrent] = useState(0);
  const onScroll = () => {
    const el = trackRef.current;
    if (!el || periods.length === 0) return;
    const cardWidth = el.scrollWidth / periods.length;
    setCurrent(Math.min(periods.length - 1, Math.round(el.scrollLeft / cardWidth)));
  };
  const scrollToCard = (i: number) => {
    const el = trackRef.current;
    if (!el || periods.length === 0) return;
    const cardWidth = el.scrollWidth / periods.length;
    el.scrollTo({ left: i * cardWidth, behavior: "smooth" });
  };

  // "Best value" badge goes on the cheapest effective rate — derived from
  // config, not hardcoded to a period id.
  const effectiveRate = (p: PricingPeriod) => p.rateFrom2h ?? p.rate;
  const bestValueId = periods.reduce(
    (best, p) => (effectiveRate(p) < effectiveRate(best) ? p : best),
    periods[0],
  )?.id;

  return (
    <section
      data-nav-theme="light"
      className="period-pricing-section"
      style={{
        background: "#fff",
        color: "#1d1d1f",
        padding: "clamp(80px, 12vh, 140px) 0",
        borderTop: "1px solid #d2d2d7",
        fontFamily: FONT_FAMILY,
      }}
    >
      {/* Section header — gives the pricing block context on both the homepage
          and /pricing (shared component). Matches the site's "short line +
          full stop" heading style (e.g. "場地。逐一看。"). */}
      <div className="mx-auto mb-10 max-w-[1100px] px-6 md:mb-14">
        <motion.h2
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.6, ease: EASE }}
          data-cms-key="pricingPage.periods_title"
          style={{
            fontSize: "clamp(36px, 5vw, 48px)",
            fontWeight: 700,
            letterSpacing: "-0.03em",
            color: "#1d1d1f",
            margin: "0 0 12px",
          }}
        >
          {t("periods_title")}。
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.6, ease: EASE, delay: 0.05 }}
          data-cms-key="pricingPage.periods_subtitle"
          style={{
            fontSize: "clamp(17px, 2.2vw, 20px)",
            color: "#6e6e73",
            margin: 0,
            maxWidth: "36ch",
          }}
        >
          {t("periods_subtitle")}
        </motion.p>
      </div>

      {/* Complete-sentence pricing summary in the initial HTML — the cards above
          present the same facts visually, but AI crawlers / screen readers get
          full, self-contained sentences here (sr-only = present in the DOM,
          visually hidden). Values come from the same `periods` config. */}
      <p className="sr-only">
        {periods
          .map((p) => {
            const label = t(`period_${p.id}_title`);
            const time = t(`period_${p.id}_time`);
            if (p.rateFrom2h !== undefined) {
              return `Space8 ${label}（${time}）每小時收費 ${fmt(p.rate)}，${t("member_price_prefix")}每小時 ${fmt(p.rateFrom2h)}。`;
            }
            return `Space8 ${label}（${time}）每小時收費 ${fmt(p.rate)}。`;
          })
          .join("")}
      </p>

      {/* Desktop: 3-up grid. Mobile: horizontal snap carousel so all periods
          are discoverable with a sideways swipe. Card width calc(100vw - 48px
          - 20px) leaves a deliberate, CONSISTENT 20px peek of the next card
          (not the random sliver 78vw produced) so "there's more" reads as
          intent, not broken layout. scroll-padding keeps snapped cards
          aligned with the 24px page gutter.

          The entrance animation lives on the TRACK, not each card: animating
          per-card with whileInView made off-screen carousel cards (cards 2/3,
          which start outside the horizontal viewport) still fire their y:40→0
          reveal as you swiped to them, producing a vertical jump on every
          snap. Animating the container once keeps cards perfectly static
          during horizontal scrolling. */}
      <motion.div
        ref={trackRef}
        onScroll={onScroll}
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.7, ease: EASE }}
        className="no-scrollbar hscroll-track mx-auto flex max-w-[1100px] snap-x snap-mandatory items-stretch gap-4 overflow-x-auto px-6 md:grid md:snap-none md:grid-cols-3 md:gap-6 md:overflow-visible"
        style={{ scrollPaddingInline: "24px", paddingTop: "14px", paddingBottom: "4px", touchAction: "pan-y" }}
      >
        {periods.map((period) => {
          const Icon = period.id === "morning" ? Sun : period.id === "afternoon" ? Zap : Moon;
          const isBestValue = period.id === bestValueId;

          return (
            <div
              key={period.id}
              className="pricing-card relative flex w-[calc(100vw-68px)] max-w-[340px] flex-shrink-0 snap-start flex-col items-center md:w-auto md:max-w-none"
              style={{
                border: "1px solid #d2d2d7",
                borderRadius: "18px",
                padding: "40px 24px 32px",
                textAlign: "center",
              }}
            >
              {/* Small "best value" tag — one card only, equal visual weight otherwise */}
              {isBestValue && (
                <span
                  data-cms-key="pricingPage.badge_best_value"
                  style={{
                    position: "absolute",
                    top: "-12px",
                    left: "50%",
                    transform: "translateX(-50%)",
                    background: GREEN,
                    color: "#000",
                    fontSize: "12px",
                    fontWeight: 700,
                    letterSpacing: "0.02em",
                    padding: "4px 12px",
                    borderRadius: "100px",
                    whiteSpace: "nowrap",
                  }}
                >
                  {t("badge_best_value")}
                </span>
              )}

              <Icon size={36} color={GREEN} strokeWidth={1.5} style={{ marginBottom: 16 }} />

              <h3
                style={{
                  fontSize: "clamp(22px, 3vw, 28px)",
                  fontWeight: 700,
                  letterSpacing: "-0.02em",
                  margin: "0 0 6px",
                  color: "#1d1d1f",
                }}
              >
                {t(`period_${period.id}_title`)}
              </h3>

              <p
                style={{
                  fontSize: "15px",
                  color: "#6e6e73",
                  margin: "0 0 28px",
                }}
              >
                {t(`period_${period.id}_time`)}
              </p>

              {/* Price is the visual hero of the card */}
              <div
                style={{
                  fontSize: "clamp(44px, 5vw, 56px)",
                  fontWeight: 700,
                  letterSpacing: "-0.03em",
                  color: "#1d1d1f",
                  lineHeight: 1,
                }}
              >
                {fmt(period.rate)}
                <span style={{ fontSize: "17px", color: "#6e6e73", fontWeight: 400 }}>
                  {" "}
                  {t("per_hour")}
                </span>
              </div>

              {/* Multi-hour discount badge — green highlight, fixed slot so
                  cards without a discount keep equal height/rhythm */}
              <div style={{ minHeight: "28px", margin: "14px 0 28px" }}>
                {period.rateFrom2h !== undefined && (
                  <span
                    style={{
                      display: "inline-block",
                      background: GREEN,
                      color: "#000",
                      fontSize: "14px",
                      fontWeight: 600,
                      letterSpacing: "-0.01em",
                      padding: "4px 12px",
                      borderRadius: "100px",
                    }}
                  >
                    {t("member_price_prefix")} {fmt(period.rateFrom2h)}
                  </span>
                )}
              </div>

              <Link
                href="/book"
                className="transition-transform duration-200 hover:scale-105 md:w-auto"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginTop: "auto",
                  background: GREEN,
                  color: "#000",
                  fontWeight: 700,
                  fontSize: "15px",
                  padding: "0 32px",
                  height: "48px",
                  borderRadius: "100px",
                  textDecoration: "none",
                  width: "100%",
                  minHeight: 48,
                }}
              >
                {t("cta_book")}
              </Link>
            </div>
          );
        })}
      </motion.div>

      {/* Mobile dots — mirror the snapped card; hidden on the desktop grid. */}
      <div className="flex items-center justify-center gap-2 pt-6 md:hidden">
        {periods.map((period, i) => {
          const active = i === current;
          return (
            <button
              key={period.id}
              type="button"
              onClick={() => scrollToCard(i)}
              aria-label={t(`period_${period.id}_title`)}
              aria-current={active}
              style={{
                // 44px invisible tap target around an 8px visual dot
                width: 24,
                height: 44,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "none",
                border: "none",
                padding: 0,
                cursor: "pointer",
              }}
            >
              <span
                style={{
                  height: 8,
                  width: active ? 24 : 8,
                  borderRadius: 100,
                  background: active ? "#1d1d1f" : "#d2d2d7",
                  transition: "all 0.25s ease",
                }}
              />
            </button>
          );
        })}
      </div>
    <style>{`
        @media (max-width: 560px) {
          .period-pricing-section { padding: 70px 0 80px !important; }
          .period-pricing-section .pricing-card { padding: 32px 20px 28px !important; }
          .period-pricing-section .pricing-card a { width: 100% !important; min-height: 48px !important; }
        }
      `}</style>
    </section>
  );
}
