/**
 * Pricing display formatters.
 */

import type { PricingPeriod } from './config'

export function formatPrice(amountHkd: number): string {
  return `HK$${Math.round(amountHkd)}`
}

export function formatPeriodLabel(period: PricingPeriod): string {
  return `${period.timeRange} · ${formatPrice(period.base)}/小時`
}
