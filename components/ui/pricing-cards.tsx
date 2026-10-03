"use client"

import { useEffect, useRef, useState } from "react"
import { useTranslations } from "next-intl"
import { Link } from "@/i18n/navigation"
import type { PricingPeriod } from "@/lib/data/pricing"

/**
 * Universal pricing cards component — reusable across Home (light) and Venue (dark).
 *
 * Props drive everything: theme (light/dark), content (heading/slots), featured badge.
 * Time ranges and prices flow from the config table via the `slots` prop; no hardcoding.
 *
 * Visual rules:
 * - No shadows, borders only. Featured card gets border emphasis, not shadow.
 * - All tap targets ≥44px. Mobile-first: cards stack, featured first.
 * - Price numerals use Good Times font; Chinese text uses system font.
 * - Animations respect prefers-reduced-motion.
 */

/* ── Fonts ──────────────────────────────────────────────────────── */

const FONT_FAMILY =
  '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Noto Sans TC", "Helvetica Neue", Helvetica, Arial, sans-serif'

const FONT_DISPLAY = '"Good Times", "Bebas Neue", sans-serif'

/* ── Types ──────────────────────────────────────────────────────── */

export type PricingSlot = {
  id: string
  name: string
  tagline?: string
  timeLabel: string // e.g. "每日 HH:MM–HH:MM"
  price: number
  unit: string // e.g. "/ 小時"
  icon: React.ReactNode
  accent: string // hex color for this slot
  ctaLabel: string
  ctaHref: string
}

export type PricingCardsProps = {
  theme?: "light" | "dark"
  eyebrow?: string
  heading: string
  subheading?: string
  slots: PricingSlot[]
  featuredId?: string
  badge?: string
  className?: string
}

/* ── Theme tokens ───────────────────────────────────────────────── */

const THEME = {
  light: {
    sectionBg: "#f5f5f7",
    cardBg: "#ffffff",
    cardBorder: "rgba(0, 0, 0, 0.06)",
    cardBorderHover: "rgba(0, 0, 0, 0.1)",
    eyebrow: "#86868b",
    title: "#1d1d1f",
    subtitle: "#6e6e73",
    cardTitle: "#1d1d1f",
    tagline: "#86868b",
    time: "#aeaeb2",
    priceCurrency: "#1d1d1f",
    priceDigits: "#1d1d1f",
    priceUnit: "#86868b",
    ctaText: "#ffffff",
  },
  dark: {
    sectionBg: "#000000",
    cardBg: "#1a1a1a",
    cardBorder: "rgba(255, 255, 255, 0.1)",
    cardBorderHover: "rgba(255, 255, 255, 0.2)",
    eyebrow: "#a1a1a6",
    title: "#f5f5f7",
    subtitle: "#a1a1a6",
    cardTitle: "#f5f5f7",
    tagline: "#a1a1a6",
    time: "#86868b",
    priceCurrency: "#f5f5f7",
    priceDigits: "#f5f5f7",
    priceUnit: "#a1a1a6",
    ctaText: "#ffffff",
  },
}

/* ── Price formatter: split $ from digits for Good Times font ─── */

function PriceDisplay({
  value,
  unit,
  theme,
}: {
  value: number
  unit: string
  theme: "light" | "dark"
}) {
  const rounded = Math.round(value)
  const colors = THEME[theme]
  return (
    <div className="pricing-price">
      <span className="pricing-price-currency" style={{ color: colors.priceCurrency }}>
        $
      </span>
      <span className="pricing-price-digits" style={{ color: colors.priceDigits }}>
        {rounded}
      </span>
      <span className="pricing-price-unit" style={{ color: colors.priceUnit }}>
        {unit}
      </span>
    </div>
  )
}

/* ── Main component ─────────────────────────────────────────────── */

export default function PricingCards({
  theme = "light",
  eyebrow,
  heading,
  subheading,
  slots,
  featuredId,
  badge,
  className = "",
}: PricingCardsProps) {
  const secRef = useRef<HTMLElement>(null)
  const [entered, setEntered] = useState(false)

  const colors = THEME[theme]

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

  return (
    <section
      ref={secRef}
      data-nav-theme={theme}
      aria-labelledby="pricing-title"
      className={`pricing-section ${className}`}
      style={{ background: colors.sectionBg }}
    >
      <div className="pricing-inner">
        {/* ── Header ──────────────────────────────────────────── */}
        {eyebrow && (
          <p className="pricing-eyebrow" style={{ color: colors.eyebrow }}>
            {eyebrow}
          </p>
        )}
        <h2 id="pricing-title" className="pricing-title" style={{ color: colors.title }}>
          {heading}
        </h2>
        {subheading && (
          <p className="pricing-subtitle" style={{ color: colors.subtitle }}>
            {subheading}
          </p>
        )}

        {/* ── Card grid (desktop 3-col / mobile vertical stack) ── */}
        <div className="pricing-grid" role="list" aria-label="Pricing periods">
          {slots.map((slot, i) => (
            <PricingCard
              key={slot.id}
              slot={slot}
              isFeatured={slot.id === featuredId}
              badge={slot.id === featuredId ? badge : undefined}
              theme={theme}
              delay={i * 0.15}
              entered={entered}
            />
          ))}
        </div>
      </div>

      {/* ── Section layout styles ───────────────────────────────── */}
      <style jsx>{`
        .pricing-section {
          padding: clamp(80px, 12vh, 140px) 24px;
          overflow: hidden;
        }
        .pricing-inner {
          max-width: 1100px;
          margin: 0 auto;
        }

        /* ── Header ── */
        .pricing-eyebrow {
          font-family: ${FONT_FAMILY};
          font-size: 14px;
          font-weight: 600;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          margin: 0 0 12px;
          text-align: center;
        }
        .pricing-title {
          font-family: ${FONT_FAMILY};
          font-size: clamp(2rem, 5vw, 3.2rem);
          font-weight: 800;
          letter-spacing: -0.03em;
          line-height: 1.1;
          margin: 0 0 16px;
          text-align: center;
        }
        .pricing-subtitle {
          font-family: ${FONT_FAMILY};
          font-size: clamp(14px, 1.6vw, 17px);
          margin: 0 0 clamp(40px, 6vw, 72px);
          text-align: center;
          max-width: 480px;
          margin-left: auto;
          margin-right: auto;
        }

        /* ── Card grid ── */
        .pricing-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 24px;
          align-items: stretch;
        }
        @media (max-width: 768px) {
          .pricing-grid {
            grid-template-columns: 1fr;
            gap: 20px;
          }
        }
      `}</style>

      {/* ── Card styles ────────────────────────────────────────── */}
      <style jsx global>{`
        .pricing-card {
          position: relative;
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
            border-color 0.3s ease;
          will-change: transform, opacity;
          overflow: visible;
        }
        .pricing-card--in {
          opacity: 1;
          transform: none;
        }
        /* Hover lift effect */
        .pricing-card:hover {
          transform: translateY(-6px) scale(1.01);
        }
        .pricing-card--in:hover {
          transform: translateY(-6px) scale(1.01);
        }
        /* Touch feedback for mobile */
        .pricing-card:active {
          transform: translateY(-2px) scale(0.99);
          transition-duration: 0.1s;
        }

        /* ── Featured card emphasis (border-based, no shadow) ── */
        .pricing-card--featured {
          border-width: 2px;
        }

        /* ── Badge (absolute — never expands card) ── */
        .pricing-badge {
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
          z-index: 1;
        }

        /* ── Icon container ── */
        .pricing-icon-wrap {
          width: 52px;
          height: 52px;
          border-radius: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 20px;
        }

        /* ── Card title ── */
        .pricing-card-title {
          font-family: ${FONT_FAMILY};
          font-weight: 700;
          font-size: 20px;
          margin: 0 0 6px;
          letter-spacing: -0.01em;
        }

        /* ── Card tagline ── */
        .pricing-card-tagline {
          font-family: ${FONT_FAMILY};
          font-size: 13px;
          margin: 0 0 6px;
          font-style: italic;
        }

        /* ── Time range ── */
        .pricing-card-time {
          font-family: ${FONT_FAMILY};
          font-size: 13px;
          margin: 0 0 28px;
        }

        /* ── Price display ── */
        .pricing-price {
          display: flex;
          align-items: baseline;
          justify-content: center;
          gap: 2px;
          margin-bottom: 16px;
          line-height: 1;
        }
        .pricing-price-currency {
          font-family: ${FONT_FAMILY};
          font-weight: 600;
          font-size: clamp(1.2rem, 2.5vw, 1.6rem);
          align-self: flex-start;
          margin-top: 6px;
        }
        .pricing-price-digits {
          font-family: ${FONT_DISPLAY};
          font-weight: 400;
          font-size: clamp(2.8rem, 5vw, 3.6rem);
          letter-spacing: 0.02em;
          line-height: 1;
        }
        .pricing-price-unit {
          font-family: ${FONT_FAMILY};
          font-size: 13px;
          margin-left: 4px;
          align-self: flex-end;
          margin-bottom: 4px;
        }

        /* ── Spacer for consistent card layout ── */
        .pricing-spacer {
          height: 37px;
          margin-bottom: 24px;
        }

        /* ── CTA button ── */
        .pricing-cta {
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
            transform 0.15s ease,
            opacity 0.2s ease;
          letter-spacing: -0.01em;
        }
        .pricing-cta:hover {
          transform: scale(1.03);
          opacity: 0.9;
        }
        .pricing-cta:active {
          transform: scale(0.97);
        }

        /* ── Mobile adjustments ── */
        @media (max-width: 768px) {
          .pricing-card {
            padding: 40px 24px 32px;
          }
          .pricing-card-title {
            font-size: 22px;
          }
          .pricing-price-digits {
            font-size: 3.2rem;
          }
        }

        /* ── Reduced motion ── */
        @media (prefers-reduced-motion: reduce) {
          .pricing-card {
            opacity: 1;
            transform: none;
            transition: border-color 0.2s ease;
          }
          .pricing-card:hover {
            transform: none;
          }
          .pricing-cta:hover {
            transform: none;
          }
        }
      `}</style>
    </section>
  )
}

/* ── Pricing Card sub-component ─────────────────────────────────── */

function PricingCard({
  slot,
  isFeatured,
  badge,
  theme,
  delay,
  entered,
}: {
  slot: PricingSlot
  isFeatured: boolean
  badge?: string
  theme: "light" | "dark"
  delay: number
  entered: boolean
}) {
  const colors = THEME[theme]

  // Adjust accent tint for dark theme (increase lightness for contrast)
  const accentForDark = theme === "dark" ? adjustColorForDark(slot.accent) : slot.accent
  const iconBg = `${accentForDark}20` // 20 = 12.5% opacity in hex

  return (
    <div
      className={`pricing-card ${entered ? "pricing-card--in" : ""} ${
        isFeatured ? "pricing-card--featured" : ""
      }`}
      role="listitem"
      style={{
        background: colors.cardBg,
        border: `${isFeatured ? "2px" : "1px"} solid ${
          isFeatured ? slot.accent : colors.cardBorder
        }`,
        transitionDelay: entered ? "0s" : `${delay}s`,
      }}
      onMouseEnter={(e) => {
        if (!isFeatured) {
          e.currentTarget.style.borderColor = colors.cardBorderHover
        }
      }}
      onMouseLeave={(e) => {
        if (!isFeatured) {
          e.currentTarget.style.borderColor = colors.cardBorder
        }
      }}
    >
      {/* Badge — absolute positioned, never expands card */}
      {isFeatured && badge && (
        <span className="pricing-badge" style={{ background: slot.accent }}>
          {badge}
        </span>
      )}

      {/* Icon in colored container */}
      <div className="pricing-icon-wrap" style={{ background: iconBg }}>
        {slot.icon}
      </div>

      {/* Title */}
      <h3 className="pricing-card-title" style={{ color: colors.cardTitle }}>
        {slot.name}
      </h3>

      {/* Tagline */}
      {slot.tagline && (
        <p className="pricing-card-tagline" style={{ color: colors.tagline }}>
          {slot.tagline}
        </p>
      )}

      {/* Time range */}
      <p className="pricing-card-time" style={{ color: colors.time }}>
        {slot.timeLabel}
      </p>

      {/* Price with Good Times font for digits */}
      <PriceDisplay value={slot.price} unit={slot.unit} theme={theme} />

      {/* Spacer for consistent card layout */}
      <div className="pricing-spacer" />

      {/* CTA button — slot accent color */}
      <Link
        href={slot.ctaHref}
        className="pricing-cta"
        style={{
          background: accentForDark,
          color: colors.ctaText,
        }}
      >
        {slot.ctaLabel}
      </Link>
    </div>
  )
}

/* ── Color adjustment for dark theme ────────────────────────────── */

/**
 * Lighten a hex color for better contrast on dark backgrounds.
 * Simple heuristic: increase lightness by ~15% while preserving hue.
 */
function adjustColorForDark(hex: string): string {
  // Convert hex to RGB
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)

  // Convert to HSL
  const rNorm = r / 255
  const gNorm = g / 255
  const bNorm = b / 255
  const max = Math.max(rNorm, gNorm, bNorm)
  const min = Math.min(rNorm, gNorm, bNorm)
  let h = 0
  let s = 0
  const l = (max + min) / 2

  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case rNorm:
        h = ((gNorm - bNorm) / d + (gNorm < bNorm ? 6 : 0)) / 6
        break
      case gNorm:
        h = ((bNorm - rNorm) / d + 2) / 6
        break
      case bNorm:
        h = ((rNorm - gNorm) / d + 4) / 6
        break
    }
  }

  // Increase lightness for dark theme
  const newL = Math.min(1, l + 0.15)

  // Convert back to RGB
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1
    if (t > 1) t -= 1
    if (t < 1 / 6) return p + (q - p) * 6 * t
    if (t < 1 / 2) return q
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
    return p
  }

  let newR: number, newG: number, newB: number
  if (s === 0) {
    newR = newG = newB = newL
  } else {
    const q = newL < 0.5 ? newL * (1 + s) : newL + s - newL * s
    const p = 2 * newL - q
    newR = hue2rgb(p, q, h + 1 / 3)
    newG = hue2rgb(p, q, h)
    newB = hue2rgb(p, q, h - 1 / 3)
  }

  const toHex = (n: number) =>
    Math.round(n * 255)
      .toString(16)
      .padStart(2, "0")
  return `#${toHex(newR)}${toHex(newG)}${toHex(newB)}`
}
