import type { getServiceSupabase } from '@/lib/supabase/service'

type ServiceClient = ReturnType<typeof getServiceSupabase>

// The authoritative server-side checkout total. prepare_checkout is the ONLY
// place a discount is reserved: it locks the booking group, releases any stale
// reservation, re-derives the subtotal from base_price, holds the promo usage or
// the points, and writes the discounted total_price back onto every row.
//
// Callers must use the returned `total` for the provider amount — never a
// client-supplied cart total, and never the pre-discount quote. The Stripe
// webhook asserts paymentIntent.amount === total_price * 100, so the booking row
// and the provider order have to agree.
export type PreparedCheckout = {
  subtotal: number
  discountAmount: number
  total: number
  kind: 'promo' | 'points' | 'credits' | 'both' | 'none'
  code: string | null
  points: number
  /** Part of discountAmount that came from the promo code. */
  promoDiscount: number
  /** Part of discountAmount that came from Space Wallet credit. */
  creditDiscount: number
}

export type PrepareCheckoutFailure = {
  reason: string
  availablePoints?: number
  minCartAmount?: number
}

export type PrepareCheckoutOutcome =
  | { ok: true; prepared: PreparedCheckout }
  | { ok: false; failure: PrepareCheckoutFailure }

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function asFiniteNumber(value: unknown): number | null {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN
  return Number.isFinite(n) ? n : null
}

function asKind(value: unknown): 'promo' | 'points' | 'credits' | 'both' | 'none' {
  return value === 'promo' || value === 'points' || value === 'credits' || value === 'both' ? value : 'none'
}

// Reasons that mean "the customer can fix this by choosing differently" (400)
// versus "the booking moved underneath us" (409). Anything unmapped is a 500,
// because an unknown reason means prepare_checkout changed and this route did not.
const CLIENT_CORRECTABLE = new Set([
  'discounts_mutually_exclusive',
  'promo_not_stackable_with_credits',
  'audience_not_eligible',
  'weekday_not_allowed',
  'time_not_allowed',
  'invalid_points',
  'insufficient_points',
  'insufficient_credits',
  'invalid_credits',
  'credits_redemption_retired',
  'user_not_found',
  'invalid',
  'inactive',
  'not_started',
  'expired',
  'usage_limit_reached',
  'user_limit_reached',
  'min_order_not_met',
])

const CONFLICT = new Set([
  'booking_not_pending',
  'discount_selection_locked',
])

export function prepareFailureStatus(reason: string): number {
  if (reason === 'booking_not_found') return 404
  if (CONFLICT.has(reason)) return 409
  if (CLIENT_CORRECTABLE.has(reason)) return 400
  return 500
}

// Calls prepare_checkout and narrows its jsonb payload. A promo code and wallet credits
// can be combined (the promo applies first, credits cover what is left) unless the code
// has stackable_with_credits = false, in which case the RPC rejects the combination with
// 'promo_not_stackable_with_credits'. Points redemption is retired.
type PrepareArgs = { bookingId: string; userId: string; promoCode?: string | null; points?: number; walletAmount?: number }

// prepare_checkout, plus one recovery step: if the wallet credit is short only
// because an abandoned order of the same customer still holds it, release that
// dead order's hold (see supersede.ts) and try again once.
export async function prepareCheckout(
  service: ServiceClient,
  args: PrepareArgs,
): Promise<PrepareCheckoutOutcome> {
  const first = await prepareCheckoutOnce(service, args)
  if (first.ok || first.failure.reason !== 'insufficient_credits' || !(args.walletAmount && args.walletAmount > 0)) {
    return first
  }
  try {
    const { releaseDeadPendingOrders } = await import('./supersede')
    const released = await releaseDeadPendingOrders(service, args.userId, args.bookingId)
    if (released === 0) return first
  } catch (e) {
    console.warn('[checkout] supersede recovery failed', { message: (e as Error).message })
    return first
  }
  return prepareCheckoutOnce(service, args)
}

async function prepareCheckoutOnce(
  service: ServiceClient,
  args: PrepareArgs,
): Promise<PrepareCheckoutOutcome> {
  const { data, error } = await service.rpc('prepare_checkout', {
    p_booking_id: args.bookingId,
    p_user_id: args.userId,
    p_promo_code: args.promoCode && args.promoCode.trim() ? args.promoCode.trim().toUpperCase() : undefined,
    p_points: args.points ?? undefined,
    p_credits: args.walletAmount ?? undefined,
  })

  if (error) {
    throw new Error(`prepare_checkout failed: ${error.message}`)
  }

  const row = asRecord(data)
  if (!row) {
    throw new Error('prepare_checkout returned invalid payload')
  }

  if (row.success !== true) {
    const reason = typeof row.reason === 'string' ? row.reason : 'unknown'
    const availablePoints = asFiniteNumber(row.available_points)
    const minCartAmount = asFiniteNumber(row.min_cart_amount)
    return {
      ok: false,
      failure: {
        reason,
        ...(availablePoints !== null ? { availablePoints } : {}),
        ...(minCartAmount !== null ? { minCartAmount } : {}),
      },
    }
  }

  const subtotal = asFiniteNumber(row.subtotal)
  const discountAmount = asFiniteNumber(row.discount_amount)
  const total = asFiniteNumber(row.total)
  if (subtotal === null || discountAmount === null || total === null) {
    throw new Error('prepare_checkout returned invalid amounts')
  }

  return {
    ok: true,
    prepared: {
      subtotal,
      discountAmount,
      total,
      kind: asKind(row.kind),
      code: typeof row.code === 'string' ? row.code : null,
      points: asFiniteNumber(row.points) ?? 0,
      promoDiscount: asFiniteNumber(row.promo_discount) ?? (asKind(row.kind) === 'promo' ? discountAmount : 0),
      creditDiscount: asFiniteNumber(row.credit_discount) ?? (asKind(row.kind) === 'credits' ? discountAmount : 0),
    },
  }
}

// Releases a promo/points reservation. Safe to call when none is held — the RPC
// is a no-op UPDATE in that case. Used when a provider order fails to create, so
// an abandoned attempt does not keep the customer's points locked.
export async function releaseCheckoutHolds(
  service: ServiceClient,
  args: { bookingId: string; orderGroupId: string | null },
): Promise<void> {
  const { error } = await service.rpc('release_checkout_holds', {
    p_booking_id: args.bookingId,
    p_order_group_id: args.orderGroupId ?? undefined,
  })
  if (error) {
    // Never mask the original failure that triggered the release; the stale hold
    // is also swept by expire_stale_bookings.
    console.error('[checkout] release_checkout_holds failed', {
      bookingId: args.bookingId,
      orderGroupId: args.orderGroupId,
      message: error.message,
    })
  }
}

// Reads the redemption rules from config. Rules live in the config table (key
// 'points_redemption') because price/tier logic is config-owned, never hardcoded
// and never a separate table.
export type PointsRule = { points: number; discount: number }

