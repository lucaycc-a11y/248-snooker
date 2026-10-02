import { getPricing } from '@/lib/pricing/config'

export async function GET() {
  try {
    const pricing = await getPricing()

    return Response.json(
      {
        periods: pricing.periods.map((period) => ({
          id: period.id,
          rate: period.base,
          start: period.timeRange.split('-')[0],
          end: period.timeRange.split('-')[1],
        })),
        currency: pricing.currency,
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

