/**
 * Ledger Types - Enumerations from Section 3.2 of Prompt 7
 *
 * These are the ONLY valid values for ledger type columns, enforced by
 * database CHECK constraints. Never guess or invent new types.
 */

// points_ledger.type
export const POINTS_LEDGER_TYPES = [
  'booking',
  'bonus',
  'signup',
  'manual',
  'redeem',
  'convert',
  'reversal',
] as const

export type PointsLedgerType = (typeof POINTS_LEDGER_TYPES)[number]

// credits_ledger.type
export const CREDITS_LEDGER_TYPES = [
  'convert',
  'redeem',
  'refund',
  'reversal',
  'signup',
  'manual',
  'topup',
] as const

export type CreditsLedgerType = (typeof CREDITS_LEDGER_TYPES)[number]

// credit_holds.status
export const CREDIT_HOLD_STATUSES = ['held', 'redeemed', 'released'] as const

export type CreditHoldStatus = (typeof CREDIT_HOLD_STATUSES)[number]

// promo_code_usages.status
export const PROMO_USAGE_STATUSES = ['held', 'redeemed', 'released'] as const

export type PromoUsageStatus = (typeof PROMO_USAGE_STATUSES)[number]

// admin_notifications.type
export const NOTIFICATION_TYPES = ['credit', 'promo', 'system'] as const

export type NotificationType = (typeof NOTIFICATION_TYPES)[number]

// users.tier
export const USER_TIERS = ['amateur', 'century', 'maximum'] as const

export type UserTier = (typeof USER_TIERS)[number]

/**
 * Invented names that MUST NOT appear anywhere in the code.
 * A test will grep for these to prevent schema drift.
 */
export const FORBIDDEN_NAMES = [
  'booking_earned',
  'referral',
  'admin_grant',
  'converted_to_credits',
  'chargeback',
  'points_converted', // as a ledger type
  'booking_usage',
  'points_lifetime',
  'points_redeemable',
  'points_to_wallet',
  'user_points', // as a table name
  'wallet', // as a table name
  'p_credits', // as a column
  'min_order_cents',
  'tier_config_',
] as const
