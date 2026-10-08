/**
 * Points estimate shown at checkout. Must mirror the server award in
 * confirm_booking / confirm_booking_group: round(amount paid × tier multiplier),
 * where amount paid is already net of promo code and Space Wallet.
 * HK$1 = 1 point at the default tier.
 */
export function tierMultiplier(tier: string | null | undefined): number {
  if (tier === 'maximum') return 2
  if (tier === 'century') return 1.5
  return 1
}

export function estimateEarnPoints(total: number, multiplier = 1): number {
  if (!Number.isFinite(total) || total <= 0) return 0
  return Math.round(total * multiplier)
}
