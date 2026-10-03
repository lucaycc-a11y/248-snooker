// Ledger type constants matching the actual database enum values.
// These are the ONLY valid type values in points_ledger and credits_ledger.

export const POINTS_LEDGER_TYPES = [
  'booking',
  'signup',
  'manual',
  'reversal',
  'redeem',
  'convert',
] as const

export const CREDITS_LEDGER_TYPES = [
  'convert',
  'redeem',
  'refund',
  'reversal',
  'signup',
  'manual',
  'topup',
] as const

export type PointsLedgerType = (typeof POINTS_LEDGER_TYPES)[number]
export type CreditsLedgerType = (typeof CREDITS_LEDGER_TYPES)[number]
