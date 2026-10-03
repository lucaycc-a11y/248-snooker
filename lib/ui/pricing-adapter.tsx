/**
 * Adapter: convert config-driven PricingPeriod[] to the UI PricingSlot[] format.
 * Bridges the domain model (lib/data/pricing.ts) and the presentation component.
 */

import type { PricingPeriod } from "@/lib/data/pricing"
import type { PricingSlot } from "@/components/ui/pricing-cards"

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

/* ── Tier configuration ─────────────────────────────────────────── */

type TierId = "morning" | "afternoon" | "evening"

const TIER_CONFIG: Record<
  TierId,
  {
    accent: string
    taglineKey: "period_morning_tagline" | "period_afternoon_tagline" | "period_evening_tagline"
  }
> = {
  morning: {
    accent: "#6b7280",
    taglineKey: "period_morning_tagline",
  },
  afternoon: {
    accent: "#16a34a",
    taglineKey: "period_afternoon_tagline",
  },
  evening: {
    accent: "#9333ea",
    taglineKey: "period_evening_tagline",
  },
}

function getTierConfig(id: string): (typeof TIER_CONFIG)[TierId] {
  return TIER_CONFIG[id as TierId] ?? TIER_CONFIG.morning
}

/* ── Adapter function ───────────────────────────────────────────── */

type TranslationFn = (key: string) => string

/**
 * Convert PricingPeriod[] from the config table into PricingSlot[] for the UI.
 * Uses i18n for names, taglines, time labels, and CTA text.
 */
export function periodsToSlots(
  periods: PricingPeriod[],
  t: TranslationFn,
): PricingSlot[] {
  return periods.map((period) => {
    const tier = getTierConfig(period.id)
    return {
      id: period.id,
      name: t(`period_${period.id}_title`),
      tagline: t(tier.taglineKey),
      timeLabel: t(`period_${period.id}_time`),
      price: period.rate,
      unit: t("per_hour"),
      icon: getIcon(period.id, tier.accent),
      accent: tier.accent,
      ctaLabel: t("cta_book"),
      ctaHref: "/book",
    }
  })
}
