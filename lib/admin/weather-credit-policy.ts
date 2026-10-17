/**
 * Weather-compensation credit policy.
 *
 * This is the gate between an admin click and real money leaving the business.
 * It is intentionally left unimplemented — the rules are a business decision,
 * not a technical one.
 *
 * Call site: `app/api/admin/bookings/[id]/cancel/route.ts`, before any
 * `credits_ledger` insert. Price and booking rules stay in the `config` table;
 * this is a pure policy check and must not read the database.
 */

export type WeatherCreditInput = {
  /** HKD actually paid for the booking. */
  bookingTotal: number
  /** HKD of credit the admin wants to grant. */
  creditAmount: number
  /** Required by the mockup when the amount differs from the booking total. */
  differenceReason: string | null
  adminRole: 'super_admin' | 'admin'
}

export type WeatherCreditResult = { ok: true } | { ok: false; error: string }

/**
 * Decide whether a weather-compensation credit may be granted.
 *
 * Questions to answer (~5–10 lines):
 * 1. May `creditAmount` exceed `bookingTotal`? If not, reject above the paid amount.
 * 2. When `creditAmount !== bookingTotal`, is `differenceReason` mandatory?
 * 3. Is there a max variance (absolute HKD or a percentage of `bookingTotal`)?
 * 4. Can a plain `admin` grant this at all, or only `super_admin`?
 *
 * Return `{ ok: true }` to allow, or `{ ok: false, error }` with a user-facing
 * message (zh-HK) to block.
 */
export function validateWeatherCredit(input: WeatherCreditInput): WeatherCreditResult {
  // TODO: implement the policy. Left as a stub on purpose.
  void input
  throw new Error('validateWeatherCredit is not implemented — fill in lib/admin/weather-credit-policy.ts')
}
