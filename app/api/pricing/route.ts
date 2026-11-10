import { getPricing } from '@/lib/pricing/config'
import { getActivePricingV2 } from '@/lib/pricing-v2'

// Depends on the viewer (admin before go-live) and the clock — never cache.
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const pricing = await getPricing()
    const v2 = await getActivePricingV2()

    return Response.json(
      {
        periods: pricing.periods.map((period) => ({
          id: period.id,
          rate: period.base,
          comboRate: v2 && typeof v2.comboRates[period.id] === 'number' ? v2.comboRates[period.id] : null,
          start: period.timeRange.split('-')[0],
          end: period.timeRange.split('-')[1],
        })),
        currency: pricing.currency,
        comboMinHours: v2 ? v2.comboMinHours : null,
        preauth_deposit: pricing.preauth_deposit,
        overstay_per_15min: pricing.overstay_per_15min,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Failed to fetch pricing:', error)
    return Response.json(
      { error: 'Failed to fetch pricing' },
      { status: 500 }
    )
  }
}

