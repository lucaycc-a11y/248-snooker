"use client"

import { useEffect, useRef, useState } from "react"
import { useTranslations } from "next-intl"
import { Link } from "@/i18n/navigation"
import type { PricingPeriod } from "@/lib/data/pricing"

/**
 * Section 6 — Pricing (Apple One-style centered cards)
 *
 * Desktop: CSS Grid 3-column card layout.
 * Mobile: horizontal scroll-snap carousel with dot indicators.
 *
 * Data comes exclusively from the `config` table via the `periods` prop.
 * Pricing logic (rateFrom2h, best-value detection) mirrors HomePricing.
 *
 * Placeholder: no placeholder images needed — this section is typographic.
 */

const FONT_FAMILY =
  '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Noto Sans TC", "Helvetica Neue", Helvetica, Arial, sans-serif'

function fmt(value: number): string {
  return `HK$${Math.round(value)}`
}

/* ── Period icons (reused from HomePricing) ──────────────────────── */

function SunIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} style={{ width: 28, height: 28, color: "var(--brand)", display: "block" }}>
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

function BoltIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} style={{ width: 28, height: 28, color: "var(--brand)", display: "block" }}>
      <circle cx="12" cy="12" r="7" fill="currentColor" stroke="none" />
      <path d="M14.6 2.6 6.4 13.4h5.2l-2.2 8 8.2-10.8h-5.2z" />
    </svg>
  )
}

function MoonIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} style={{ width: 28, height: 28, color: "var(--brand)", display: "block" }}>
      <path d="M20.4 14.6A8.6 8.6 0 0 1 9.4 3.6a8.6 8.6 0 1 0 11 11z" />
      <circle cx="17.6" cy="5.2" r="1" fill="currentColor" stroke="none" />
      <circle cx="20.4" cy="9.4" r="0.8" fill="currentColor" stroke="none" />
    </svg>
  )
}

function getIcon(id: string) {
  if (id === "morning") return <SunIcon />
  if (id === "afternoon") return <BoltIcon />
  return <MoonIcon />
}

/* ── Component ───────────────────────────────────────────────────── */

export default function Section6Pricing({ periods }: { periods: PricingPeriod[] }) {
  const t = useTranslations("pricingPage")
  const secRef = useRef<HTMLElement>(null)
  const [entered, setEntered] = useState(false)
  const [activeIdx, setActiveIdx] = useState(0)
  const carouselRef = useRef<HTMLDivElement>(null)

  const effectiveRate = (p: PricingPeriod) => p.rateFrom2h ?? p.rate
  const bestValueId = periods.reduce(
    (best, p) => (effectiveRate(p) < effectiveRate(best) ? p : best),
    periods[0],
  )?.id

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

  /* ── Mobile carousel scroll tracking ────────────────────────────── */

  useEffect(() => {
    const carousel = carouselRef.current
    if (!carousel) return

    const onScroll = () => {
      const { scrollLeft, clientWidth } = carousel
      const idx = Math.round(scrollLeft / clientWidth)
      setActiveIdx(Math.max(0, Math.min(periods.length - 1, idx)))
    }

    carousel.addEventListener("scroll", onScroll, { passive: true })
    return () => carousel.removeEventListener("scroll", onScroll)
  }, [periods.length])

  return (
    <section
      ref={secRef}
      data-nav-theme="dark"
      aria-labelledby="s6-title"
      className="s6-section"
      data-cms-key="pricingPage.periods_title"
    >
      <div className="s6-inner">
        {/* ── Header ── */}
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

        {/* ── Desktop: CSS Grid ── */}
        <div className="s6-grid" aria-label="Pricing periods">
          {periods.map((period, i) => (
            <PricingCard
              key={period.id}
              period={period}
              isBestValue={period.id === bestValueId}
              t={t}
              delay={i * 0.12}
              entered={entered}
            />
          ))}
        </div>

        {/* ── Mobile: Scroll-snap carousel ── */}
        <div ref={carouselRef} className="s6-carousel" aria-label="Pricing periods">
          {periods.map((period, i) => (
            <div key={period.id} className="s6-slide">
              <PricingCard
                period={period}
                isBestValue={period.id === bestValueId}
                t={t}
                delay={0}
                entered={entered}
              />
            </div>
          ))}
        </div>

        {/* ── Dot indicators (mobile only) ── */}
        <div className="s6-dots" aria-hidden="true">
          {periods.map((period, i) => (
            <span
              key={period.id}
              className={`s6-dot ${i === activeIdx ? "s6-dot--active" : ""}`}
            />
          ))}
        </div>
      </div>

      {/* Section layout styles */}
      <style jsx>{`
        .s6-section {
          background: #000000;
          padding: clamp(80px, 12vh, 140px) 24px;
          overflow: hidden;
        }
        .s6-inner {
          max-width: 1100px;
          margin: 0 auto;
        }
        .s6-eyebrow {
          font-family: ${FONT_FAMILY};
          font-size: 14px;
          font-weight: 600;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--brand);
          margin: 0 0 12px;
          text-align: center;
        }
        .s6-title {
          font-family: ${FONT_FAMILY};
          font-size: clamp(2rem, 5vw, 3.2rem);
          font-weight: 800;
          letter-spacing: -0.03em;
          line-height: 1.1;
          color: #ffffff;
          margin: 0 0 16px;
          text-align: center;
        }
        .s6-subtitle {
          font-family: ${FONT_FAMILY};
          font-size: clamp(14px, 1.6vw, 17px);
          color: rgba(255, 255, 255, 0.5);
          margin: 0 0 clamp(40px, 6vw, 72px);
          text-align: center;
          max-width: 480px;
          margin-left: auto;
          margin-right: auto;
        }
        .s6-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 24px;
          align-items: stretch;
        }
        .s6-carousel {
          display: none;
        }
        .s6-dots {
          display: none;
          justify-content: center;
          gap: 8px;
          margin-top: 24px;
        }
        .s6-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.25);
          transition: background 0.3s, transform 0.3s;
        }
        .s6-dot--active {
          background: #ffffff;
          transform: scale(1.25);
        }
        @media (max-width: 768px) {
          .s6-grid {
            display: none;
          }
          .s6-carousel {
            display: flex;
            overflow-x: auto;
            scroll-snap-type: x mandatory;
            -webkit-overflow-scrolling: touch;
            gap: 16px;
            padding: 0 calc(50vw - 160px);
            scroll-padding: 0 calc(50vw - 160px);
          }
          .s6-carousel::-webkit-scrollbar {
            display: none;
          }
          .s6-slide {
            flex: 0 0 320px;
            scroll-snap-align: center;
          }
          .s6-dots {
            display: flex;
          }
        }
        @media (max-width: 400px) {
          .s6-slide {
            flex: 0 0 280px;
          }
          .s6-carousel {
            padding: 0 calc(50vw - 140px);
            scroll-padding: 0 calc(50vw - 140px);
          }
        }
      `}</style>

      {/* Card styles — global because PricingCard is a separate function component */}
      <style jsx global>{`
        .s6-card {
          position: relative;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 20px;
          padding: 40px 28px 36px;
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          opacity: 0;
          transform: translateY(20px) scale(0.96);
          transition:
            opacity 0.6s cubic-bezier(0.16, 1, 0.3, 1),
            transform 0.6s cubic-bezier(0.16, 1, 0.3, 1),
            border-color 0.3s ease,
            box-shadow 0.3s ease;
        }
        .s6-card--in {
          opacity: 1;
          transform: none;
        }
        .s6-card:hover {
          border-color: rgba(255, 255, 255, 0.18);
          box-shadow: 0 24px 56px -20px rgba(0, 0, 0, 0.5);
        }
        .s6-badge {
          position: absolute;
          top: -12px;
          left: 50%;
          transform: translateX(-50%);
          background: var(--brand);
          color: #000;
          font-family: ${FONT_FAMILY};
          font-size: 11px;
          font-weight: 700;
          padding: 5px 14px;
          border-radius: 999px;
          white-space: nowrap;
          letter-spacing: 0.02em;
        }
        .s6-icon {
          margin-bottom: 20px;
        }
        .s6-card-title {
          font-family: ${FONT_FAMILY};
          font-weight: 700;
          font-size: 18px;
          color: #ffffff;
          margin: 0 0 6px;
        }
        .s6-card-time {
          font-family: ${FONT_FAMILY};
          font-size: 13px;
          color: rgba(255, 255, 255, 0.4);
          margin: 0 0 28px;
        }
        .s6-price {
          display: flex;
          align-items: baseline;
          justify-content: center;
          gap: 4px;
          margin-bottom: 16px;
        }
        .s6-price-amount {
          font-family: ${FONT_FAMILY};
          font-weight: 600;
          font-size: clamp(2rem, 4vw, 2.6rem);
          letter-spacing: -0.02em;
          color: #ffffff;
          line-height: 1;
        }
        .s6-price-unit {
          font-family: ${FONT_FAMILY};
          font-size: 13px;
          color: rgba(255, 255, 255, 0.4);
        }
        .s6-deal {
          display: inline-block;
          background: rgba(34, 197, 94, 0.12);
          color: #4ade80;
          font-family: ${FONT_FAMILY};
          font-size: 12.5px;
          font-weight: 500;
          padding: 7px 14px;
          border-radius: 999px;
          margin-bottom: 24px;
        }
        .s6-deal strong {
          font-weight: 700;
          color: #86efac;
        }
        .s6-spacer {
          height: 33px;
          margin-bottom: 24px;
        }
        .s6-cta {
          margin-top: auto;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: #ffffff;
          color: #000000;
          font-family: ${FONT_FAMILY};
          font-size: 14.5px;
          font-weight: 600;
          padding: 13px 34px;
          border-radius: 999px;
          text-decoration: none;
          transition: background 0.2s, transform 0.15s;
          min-height: 44px;
          width: 100%;
        }
        .s6-cta:hover {
          background: rgba(255, 255, 255, 0.88);
          transform: scale(1.02);
        }
        .s6-cta:active {
          transform: scale(0.97);
        }
        @media (max-width: 768px) {
          .s6-card {
            padding: 36px 24px 32px;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .s6-card {
            opacity: 1;
            transform: none;
          }
        }
      `}</style>
    </section>
  )
}

/* ── Pricing Card sub-component ───────────────────────────────────── */

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
  return (
    <div
      className={`s6-card ${entered ? "s6-card--in" : ""}`}
      style={{
        transitionDelay: `${delay}s`,
        borderColor: isBestValue ? "rgba(34,197,94,0.4)" : undefined,
      }}
    >
      {/* Best value badge */}
      {isBestValue && (
        <span className="s6-badge" data-cms-key="pricingPage.badge_best_value">
          {t("badge_best_value")}
        </span>
      )}

      {/* Icon */}
      <div className="s6-icon">{getIcon(period.id)}</div>

      {/* Title */}
      <h3
        className="s6-card-title"
        data-cms-key={`pricingPage.period_${period.id}_title`}
      >
        {t(`period_${period.id}_title`)}
      </h3>

      {/* Time */}
      <p
        className="s6-card-time"
        data-cms-key={`pricingPage.period_${period.id}_time`}
      >
        {t(`period_${period.id}_time`)}
      </p>

      {/* Price */}
      <div className="s6-price">
        <span className="s6-price-amount">{fmt(period.rate)}</span>
        <span className="s6-price-unit">{t("per_hour")}</span>
      </div>

      {/* Member rate pill */}
      {period.rateFrom2h !== undefined ? (
        <span className="s6-deal" data-cms-key="pricingPage.member_price_prefix">
          {t("member_price_prefix")} <strong>{fmt(period.rateFrom2h)}</strong>
        </span>
      ) : (
        <div className="s6-spacer" />
      )}

      {/* CTA */}
      <Link
        href="/book"
        className="s6-cta"
        data-cms-key="pricingPage.cta_book"
      >
        {t("cta_book")}
      </Link>
    </div>
  )
}
