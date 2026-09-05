"use client"

import { useEffect, useRef, useState } from "react"
import { useTranslations } from "next-intl"
import { Link } from "@/i18n/navigation"
import type { PricingPeriod } from "@/lib/data/pricing"

/**
 * Section 6 — Pricing (Apple subscription-style centered cards)
 *
 * Visual language: gray (#f5f5f7) section background, white cards with subtle
 * shadow/border for depth. Three cards identical height — badge positioned
 * absolute so it never expands a card.
 *
 * Tier colors:
 *   morning  → warm neutral (gray family)
 *   afternoon → green (brand)
 *   evening  → purple (peak atmosphere)
 *
 * Price digits use "Good Times" display font; dollar sign uses system font.
 * Mobile: vertical stacked cards (no carousel).
 *
 * Data flows exclusively from the `config` table via the `periods` prop.
 */

/* ── Fonts ──────────────────────────────────────────────────────── */

const FONT_FAMILY =
  '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Noto Sans TC", "Helvetica Neue", Helvetica, Arial, sans-serif'

const FONT_DISPLAY = '"Good Times", "Bebas Neue", sans-serif'

/* ── Tier configuration ─────────────────────────────────────────── */

type TierId = "morning" | "afternoon" | "evening"

const TIER_CONFIG: Record<
  TierId,
  {
    accent: string
    accentHover: string
    accentBg: string
    iconBg: string
    badge: string
    taglineKey: "period_morning_tagline" | "period_afternoon_tagline" | "period_evening_tagline"
  }
> = {
  morning: {
    accent: "#6b7280",
    accentHover: "#4b5563",
    accentBg: "rgba(107,114,128,0.08)",
    iconBg: "rgba(107,114,128,0.10)",
    badge: "最佳時段",
    taglineKey: "period_morning_tagline",
  },
  afternoon: {
    accent: "#16a34a",
    accentHover: "#15803d",
    accentBg: "rgba(22,163,74,0.08)",
    iconBg: "rgba(22,163,74,0.10)",
    badge: "人氣之選",
    taglineKey: "period_afternoon_tagline",
  },
  evening: {
    accent: "#9333ea",
    accentHover: "#7e22ce",
    accentBg: "rgba(147,51,234,0.08)",
    iconBg: "rgba(147,51,234,0.10)",
    badge: "氣氛首選",
    taglineKey: "period_evening_tagline",
  },
}

function getTierConfig(id: string): (typeof TIER_CONFIG)[TierId] {
  return TIER_CONFIG[id as TierId] ?? TIER_CONFIG.morning
}

/* ── Period icons ───────────────────────────────────────────────── */

function SunIcon({ color }: { color: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ width: 28, height: 28, display: "block" }}
    >
      <circle cx="12" cy="12" r="4.1" />
      <line x1="12" y1="1.6" x2="12" y2="3.8" />
      <line x1="12" y1="20.2" x2="12" y2="22.4" />
      <line x1="1.6" y1="12" x2="3.8" y2="12" />
      <line x1="20.2" y1="12" x2="22.4" y2="12" />
      <line x1="4.6" y1="4.6" x2="6.2" y2="6.2" />
      <line x1="17.8" y1="17.8" x2="19.4" y2="19.4" />
      <line x1="4.6" y1="19.4" x2="6.2" y2="17.8" />
      <line x1="17.8" y1="6.2" x2="19.4" y2="4.6" />
    </svg>
  )
}

function BoltIcon({ color }: { color: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      style={{ width: 28, height: 28, display: "block" }}
    >
      <circle cx="12" cy="12" r="7" fill={color} />
      <path
        d="M14.6 2.6 6.4 13.4h5.2l-2.2 8 8.2-10.8h-5.2z"
        fill="#fff"
        stroke="none"
      />
    </svg>
  )
}

function MoonIcon({ color }: { color: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ width: 28, height: 28, display: "block" }}
    >
      <path d="M20.4 14.6A8.6 8.6 0 0 1 9.4 3.6a8.6 8.6 0 1 0 11 11z" />
      <circle cx="17.6" cy="5.2" r="1" fill={color} stroke="none" />
      <circle cx="20.4" cy="9.4" r="0.8" fill={color} stroke="none" />
    </svg>
  )
}

function getIcon(id: string, color: string) {
  if (id === "morning") return <SunIcon color={color} />
  if (id === "afternoon") return <BoltIcon color={color} />
  return <MoonIcon color={color} />
}

/* ── Price formatter: split $ from digits for Good Times font ─── */

function PriceDisplay({
  value,
  unit,
}: {
  value: number
  unit: string
}) {
  const rounded = Math.round(value)
  return (
    <div className="s6-price">
      <span className="s6-price-currency">$</span>
      <span className="s6-price-digits">{rounded}</span>
      <span className="s6-price-unit">{unit}</span>
    </div>
  )
}

/* ── Main component ─────────────────────────────────────────────── */

export default function Section6Pricing({
  periods,
}: {
  periods: PricingPeriod[]
}) {
  const t = useTranslations("pricingPage")
  const secRef = useRef<HTMLElement>(null)
  const [entered, setEntered] = useState(false)

  /* ── IntersectionObserver entrance ──────────────────────────────── */

  useEffect(() => {
    const el = secRef.current
    if (!el) return
    if (
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      !("IntersectionObserver" in window)
    ) {
      setEntered(true)
      return
    }
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setEntered(true)
          obs.unobserve(e.target)
        }
      },
      { threshold: 0.15 },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  /* ── Best value detection (from config, not hardcoded) ────────── */

  const effectiveRate = (p: PricingPeriod) => p.rateFrom2h ?? p.rate
  const bestValueId = periods.reduce(
    (best, p) => (effectiveRate(p) < effectiveRate(best) ? p : best),
    periods[0],
  )?.id

  return (
    <section
      ref={secRef}
      data-nav-theme="light"
      aria-labelledby="s6-title"
      className="s6-section"
    >
      <div className="s6-inner">
        {/* ── Header ──────────────────────────────────────────── */}
        <p
          className="s6-eyebrow"
          data-cms-key="pricingPage.hero_eyebrow"
        >
          {t("hero_eyebrow")}
        </p>
        <h2
          id="s6-title"
          className="s6-title"
          data-cms-key="pricingPage.periods_title"
        >
          {t("periods_title")}
        </h2>
        <p
          className="s6-subtitle"
          data-cms-key="pricingPage.periods_subtitle"
        >
          {t("periods_subtitle")}
        </p>

        {/* ── Card grid (desktop 3-col / mobile vertical stack) ── */}
        <div className="s6-grid" role="list" aria-label="Pricing periods">
          {periods.map((period, i) => (
            <PricingCard
              key={period.id}
              period={period}
              isBestValue={period.id === bestValueId}
              t={t}
              delay={i * 0.15}
              entered={entered}
            />
          ))}
        </div>
      </div>

      {/* ── Section layout styles ───────────────────────────────── */}
      <style jsx>{`
        .s6-section {
          background: #f5f5f7;
          padding: clamp(80px, 12vh, 140px) 24px;
          overflow: hidden;
        }
        .s6-inner {
          max-width: 1100px;
          margin: 0 auto;
        }

        /* ── Header ── */
        .s6-eyebrow {
          font-family: ${FONT_FAMILY};
          font-size: 14px;
          font-weight: 600;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #86868b;
          margin: 0 0 12px;
          text-align: center;
        }
        .s6-title {
          font-family: ${FONT_FAMILY};
          font-size: clamp(2rem, 5vw, 3.2rem);
          font-weight: 800;
          letter-spacing: -0.03em;
          line-height: 1.1;
          color: #1d1d1f;
          margin: 0 0 16px;
          text-align: center;
        }
        .s6-subtitle {
          font-family: ${FONT_FAMILY};
          font-size: clamp(14px, 1.6vw, 17px);
          color: #6e6e73;
          margin: 0 0 clamp(40px, 6vw, 72px);
          text-align: center;
          max-width: 480px;
          margin-left: auto;
          margin-right: auto;
        }

        /* ── Card grid ── */
        .s6-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 24px;
          align-items: stretch;
        }
        @media (max-width: 768px) {
          .s6-grid {
            grid-template-columns: 1fr;
            gap: 20px;
          }
        }
      `}</style>

      {/* ── Card styles ────────────────────────────────────────── */}
      <style jsx global>{`
        .s6-card {
          position: relative;
          background: #ffffff;
          border: 1px solid rgba(0, 0, 0, 0.06);
          border-radius: 20px;
          padding: 44px 28px 36px;
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          /* Entrance animation */
          opacity: 0;
          transform: translateY(32px) scale(0.97);
          transition:
            opacity 0.65s cubic-bezier(0.16, 1, 0.3, 1),
            transform 0.65s cubic-bezier(0.16, 1, 0.3, 1),
            box-shadow 0.3s cubic-bezier(0.4, 0, 0.2, 1),
            border-color 0.3s ease;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
          will-change: transform, opacity;
          /* Prevent badge from expanding card */
          overflow: visible;
        }
        .s6-card--in {
          opacity: 1;
          transform: none;
        }
        /* Hover lift effect */
        .s6-card:hover {
          transform: translateY(-6px) scale(1.01);
          box-shadow: 0 20px 40px -12px rgba(0, 0, 0, 0.12),
                      0 8px 16px -4px rgba(0, 0, 0, 0.06);
          border-color: rgba(0, 0, 0, 0.1);
        }
        .s6-card--in:hover {
          transform: translateY(-6px) scale(1.01);
        }
        /* Touch feedback for mobile */
        .s6-card:active {
          transform: translateY(-2px) scale(0.99);
          transition-duration: 0.1s;
        }

        /* ── Best value badge (absolute — never expands card) ── */
        .s6-badge {
          position: absolute;
          top: -13px;
          left: 50%;
          transform: translateX(-50%);
          color: #ffffff;
          font-family: ${FONT_FAMILY};
          font-size: 11px;
          font-weight: 700;
          padding: 5px 14px;
          border-radius: 999px;
          white-space: nowrap;
          letter-spacing: 0.03em;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
          z-index: 1;
        }

        /* ── Icon container ── */
        .s6-icon-wrap {
          width: 52px;
          height: 52px;
          border-radius: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 20px;
        }

        /* ── Card title ── */
        .s6-card-title {
          font-family: ${FONT_FAMILY};
          font-weight: 700;
          font-size: 20px;
          color: #1d1d1f;
          margin: 0 0 6px;
          letter-spacing: -0.01em;
        }

        /* ── Card tagline ── */
        .s6-card-tagline {
          font-family: ${FONT_FAMILY};
          font-size: 13px;
          color: #86868b;
          margin: 0 0 6px;
          font-style: italic;
        }

        /* ── Time range ── */
        .s6-card-time {
          font-family: ${FONT_FAMILY};
          font-size: 13px;
          color: #aeaeb2;
          margin: 0 0 28px;
        }

        /* ── Price display ── */
        .s6-price {
          display: flex;
          align-items: baseline;
          justify-content: center;
          gap: 2px;
          margin-bottom: 16px;
          line-height: 1;
        }
        .s6-price-currency {
          font-family: ${FONT_FAMILY};
          font-weight: 600;
          font-size: clamp(1.2rem, 2.5vw, 1.6rem);
          color: #1d1d1f;
          align-self: flex-start;
          margin-top: 6px;
        }
        .s6-price-digits {
          font-family: ${FONT_DISPLAY};
          font-weight: 400;
          font-size: clamp(2.8rem, 5vw, 3.6rem);
          letter-spacing: 0.02em;
          color: #1d1d1f;
          line-height: 1;
        }
        .s6-price-unit {
          font-family: ${FONT_FAMILY};
          font-size: 13px;
          color: #86868b;
          margin-left: 4px;
          align-self: flex-end;
          margin-bottom: 4px;
        }

        /* ── Member rate pill ── */
        .s6-deal {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-family: ${FONT_FAMILY};
          font-size: 12.5px;
          font-weight: 500;
          padding: 7px 14px;
          border-radius: 999px;
          margin-bottom: 24px;
        }
        .s6-deal strong {
          font-weight: 700;
        }

        /* ── Spacer for cards without member rate ── */
        .s6-spacer {
          height: 37px;
          margin-bottom: 24px;
        }

        /* ── CTA button ── */
        .s6-cta {
          margin-top: auto;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-family: ${FONT_FAMILY};
          font-size: 15px;
          font-weight: 600;
          padding: 0 28px;
          border-radius: 999px;
          text-decoration: none;
          min-height: 48px;
          width: 100%;
          transition:
            background 0.2s ease,
            transform 0.15s ease,
            box-shadow 0.2s ease;
          letter-spacing: -0.01em;
        }
        .s6-cta:hover {
          transform: scale(1.03);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }
        .s6-cta:active {
          transform: scale(0.97);
          box-shadow: none;
        }

        /* ── Mobile adjustments ── */
        @media (max-width: 768px) {
          .s6-card {
            padding: 40px 24px 32px;
          }
          .s6-card-title {
            font-size: 22px;
          }
          .s6-price-digits {
            font-size: 3.2rem;
          }
        }

        /* ── Reduced motion ── */
        @media (prefers-reduced-motion: reduce) {
          .s6-card {
            opacity: 1;
            transform: none;
            transition: box-shadow 0.2s ease, border-color 0.2s ease;
          }
          .s6-card:hover {
            transform: none;
          }
          .s6-cta:hover {
            transform: none;
          }
        }
      `}</style>
    </section>
  )
}

/* ── Pricing Card sub-component ─────────────────────────────────── */

function PricingCard({
  period,
  isBestValue,
  t,
  delay,
  entered,
}: {
  period: PricingPeriod
  isBestValue: boolean
  t: ReturnType<typeof useTranslations>
  delay: number
  entered: boolean
}) {
  const tier = getTierConfig(period.id)
  const iconColor = tier.accent

  return (
    <div
      className={`s6-card ${entered ? "s6-card--in" : ""}`}
      role="listitem"
      style={{
        transitionDelay: entered ? "0s" : `${delay}s`,
      }}
    >
      {/* Best value badge — absolute positioned, never expands card */}
      {isBestValue && (
        <span
          className="s6-badge"
          style={{ background: tier.accent }}
          data-cms-key="pricingPage.badge_best_value"
        >
          {t("badge_best_value")}
        </span>
      )}

      {/* Icon in colored container */}
      <div
        className="s6-icon-wrap"
        style={{ background: tier.iconBg }}
      >
        {getIcon(period.id, iconColor)}
      </div>

      {/* Title */}
      <h3
        className="s6-card-title"
        data-cms-key={`pricingPage.period_${period.id}_title`}
      >
        {t(`period_${period.id}_title`)}
      </h3>

      {/* Emotional tagline */}
      <p
        className="s6-card-tagline"
        data-cms-key={`pricingPage.${tier.taglineKey}`}
      >
        {t(tier.taglineKey)}
      </p>

      {/* Time range */}
      <p
        className="s6-card-time"
        data-cms-key={`pricingPage.period_${period.id}_time`}
      >
        {t(`period_${period.id}_time`)}
      </p>

      {/* Price with Good Times font for digits */}
      <PriceDisplay value={period.rate} unit={t("per_hour")} />

      {/* Member rate pill — tier-colored background */}
      {period.rateFrom2h !== undefined ? (
        <span
          className="s6-deal"
          style={{
            background: tier.accentBg,
            color: tier.accent,
          }}
          data-cms-key="pricingPage.member_price_prefix"
        >
          {t("member_price_prefix")}{" "}
          <strong>{`$${Math.round(period.rateFrom2h)}`}</strong>
        </span>
      ) : (
        <div className="s6-spacer" />
      )}

      {/* CTA button — tier accent color */}
      <Link
        href="/book"
        className="s6-cta"
        style={{
          background: tier.accent,
          color: "#ffffff",
        }}
        data-cms-key="pricingPage.cta_book"
      >
        {t("cta_book")}
      </Link>
    </div>
  )
}
