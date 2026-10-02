import { getPricing } from '@/lib/pricing/config'

export async function GET() {
  try {
    const pricing = await getPricing()

    const periods = pricing.periods.map((period) => ({
      name: {
        morning: '早上',
        afternoon: '下午',
        evening: '晚上',
      }[period.id],
      tagline: null,
      startTime: period.timeRange.split('-')[0],
      endTime: period.timeRange.split('-')[1],
      rate: period.base,
      memberRate: null,
      bestValue: false,
    }))

    return Response.json({ periods }, { status: 200 })
  } catch (error) {
    console.error('Failed to fetch pricing:', error)
    return Response.json(
      { error: 'Failed to fetch pricing' },
      { status: 500 }
    )
  }
}

