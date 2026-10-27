// Hard ceilings for what Spark may propose. Enforced in code, not in the prompt, so no
// instruction (from the model or anyone else) can lift them. Money limits are HK$.

export const SPARK_LIMITS = {
  /** Largest single wallet credit / deduction. */
  maxCreditPerAction: 500,
  /** Wallet credit above this is flagged 高風險 on the confirm card. */
  highRiskCredit: 200,
  /** Total |credit| one admin may move through Spark per Hong Kong day. */
  maxCreditPerDay: 2000,
  maxPointsPerAction: 2000,
  /** Most pending + executed Spark changes one admin can create per hour. */
  maxProposalsPerHour: 30,
  /** A proposal that is not confirmed in this long expires. */
  proposalTtlMinutes: 30,
  /** Largest credit that may accompany a booking cancel. */
  maxCancelCredit: 500,
  /** Largest discount a Spark-created promo code may carry. */
  maxPromoPercent: 50,
  maxPromoFixed: 200,
  /** Spark-created codes must expire within this many days. */
  maxPromoDays: 365,
} as const

export const TIERS = ['amateur', 'century', 'maximum'] as const
export type Tier = (typeof TIERS)[number]
export const TIER_LABEL: Record<Tier, string> = { amateur: '業餘', century: '百分', maximum: '滿分' }

/** Start of the current Hong Kong day, as an ISO instant. */
export function hkDayStartIso(now = Date.now()): string {
  const hk = new Date(now + 8 * 3600_000)
  return new Date(Date.UTC(hk.getUTCFullYear(), hk.getUTCMonth(), hk.getUTCDate()) - 8 * 3600_000).toISOString()
}
