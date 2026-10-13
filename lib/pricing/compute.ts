/**
 * Compute the price of a booking.
 *
 * Price = sum of per-hour rates for each hour in the booking, based on which
 * period that hour falls into. No multi-hour discount; no automatic rounding or tier discounts.
 *
 * INVARIANT: Every booked hour must have a matching period. If a requested hour has no
 * period (e.g., after 24:00 or before 06:00), the function throws a clear error.
 */

import type { Pricing, PricingPeriod } from './config'

export type PriceComputationResult = {
  subtotal: number // HK$ total
  breakdown: Array<{
    hour: number // 0-23 (midnight is 24 for display, but code uses hour 0)
    period: PricingPeriod
    rate: number
  }>
}

export class UnmappedHourError extends Error {
  constructor(hour: number, date: string) {
    super(`Hour ${hour}:00 on ${date} is not covered by any pricing period`)
    this.name = 'UnmappedHourError'
  }
}

export function computeBookingPrice(
  date: string, // ISO date "2026-10-15"
  startTime: string, // "06:00"
  endTime: string, // "12:00"
  pricing: Pricing,
): PriceComputationResult {
  // Parse start and end times
  const [startHourStr, startMinStr] = startTime.split(':').map(Number)
  const [endHourStr, endMinStr] = endTime.split(':').map(Number)

  const startHour = startHourStr
  const endHour = endHourStr + (endMinStr > 0 ? 1 : 0) // Round up if there are minutes

  const breakdown: PriceComputationResult['breakdown'] = []
  let subtotal = 0

  // For each hour in the booking, find the matching period and add its rate
  for (let h = startHour; h < endHour; h++) {
    const hour = h % 24 // Handle midnight wrap-around
    const matchingPeriod = pricing.periods.find((p) => hour >= p.startHour && hour < p.endHour)

    if (!matchingPeriod) {
      throw new UnmappedHourError(hour, date)
    }

    breakdown.push({
      hour,
      period: matchingPeriod,
      rate: matchingPeriod.base,
    })
    subtotal += matchingPeriod.base
  }

  return { subtotal, breakdown }
}
