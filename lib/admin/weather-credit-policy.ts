/**
 * Weather-compensation credit policy.
 *
 * This is the gate between an admin click and real money leaving the business.
 * It is a pure function: no database, no clock, no env. The cap is passed in
 * because price and wallet rules live in the `config` table and the caller
 * already has to load it (`config.points_system.wallet_max_single_amount`).
 *
 * Call site: `app/api/admin/bookings/[id]/cancel/route.ts`, before any
 * `credits_ledger` insert / before calling `admin_cancel_with_credit`.
 *
 * Policy (Luca, 2026-10-18):
 *   - amount is an integer, 0 .. cap
 *   - the default amount is the booking's paid `total_price`
 *   - any other amount needs a reason of at least 5 characters
 *   - amount MAY exceed the booking total, up to the cap (weather compensation
 *     is not capped at what was paid) — that is why a differing amount must
 *     carry a reason
 */

export type WeatherCreditInput = {
  /** HKD actually paid for the booking (`bookings.total_price`). */
  bookingTotal: number
  /** HKD of credit the admin wants to grant. */
  creditAmount: number
  /** Required when the amount differs from the booking total. */
  differenceReason: string | null
  /** `config.points_system.wallet_max_single_amount`. */
  cap: number
  /** Kept for the caller's audit trail; not a gate on this policy. */
  adminRole: 'super_admin' | 'admin'
}

export type WeatherCreditResult = { ok: true } | { ok: false; error: string }

/**
 * Decide whether a weather-compensation credit may be granted.
 * Returns `{ ok: true }` to allow, or `{ ok: false, error }` with a
 * user-facing zh-HK message to block.
 */
export function validateWeatherCredit(input: WeatherCreditInput): WeatherCreditResult {
  const { bookingTotal, creditAmount, differenceReason, cap } = input

  if (!Number.isInteger(creditAmount) || creditAmount < 0) {
    return { ok: false, error: '金額必須是 0 或以上的整數' }
  }

  if (creditAmount > cap) {
    return { ok: false, error: `金額不可超過單次上限 HK$${cap.toLocaleString('en-HK')}` }
  }

  // The default is the paid total. Anything else is a deliberate override and
  // has to say why — including a partial credit, not just a larger one.
  if (creditAmount !== bookingTotal) {
    const reason = (differenceReason ?? '').trim()
    if (reason.length < 5) {
      return { ok: false, error: '金額與實付金額不同，請輸入至少 5 個字的原因' }
    }
  }

  return { ok: true }
}
