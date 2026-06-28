import { getPricing } from './database.js'

export async function calculatePrice(date, startHour, durationHours) {
  const pricing = await getPricing()
  if (!pricing?.rules?.length) return null

  const dayOfWeek = new Date(date).getDay()
  let totalPrice = 0
  const breakdown = []

  for (let offset = 0; offset < durationHours; offset++) {
    const hour = (startHour + offset) % 24
    const rule = pricing.rules.find((candidate) => {
      const dayMatch = candidate.days.includes(dayOfWeek)
      const hourMatch = candidate.hours_end < candidate.hours_start
        ? hour >= candidate.hours_start || hour < candidate.hours_end
        : hour >= candidate.hours_start && hour < candidate.hours_end

      return dayMatch && hourMatch
    })

    const fallbackRule = pricing.rules[0]
    const activeRule = rule || fallbackRule
    totalPrice += activeRule.price_per_hour
    breakdown.push({
      hour: `${hour}:00`,
      price: activeRule.price_per_hour,
      label: activeRule.label || '標準時段',
    })
  }

  return { totalPrice, breakdown, currency: pricing.currency || 'HKD' }
}

export async function formatPricingText() {
  const pricing = await getPricing()
  if (!pricing?.rules?.length) return '價錢資料暫時不可用'

  const lines = ['*248 Snooker 場地收費*', '']

  for (const rule of pricing.rules) {
    const days = formatDays(rule.days)
    const hours = rule.hours_end < rule.hours_start
      ? `${rule.hours_start}:00 – 次日${rule.hours_end}:00`
      : `${rule.hours_start}:00 – ${rule.hours_end}:00`

    lines.push(`*${rule.label}*`)
    lines.push(`${days} ${hours}`)
    lines.push(`HK$${rule.price_per_hour}/小時`)
    lines.push('')
  }

  return lines.join('\n').trim()
}

function formatDays(days) {
  const normalized = [...days].sort((a, b) => a - b)
  const sameDays = (expected) => JSON.stringify(normalized) === JSON.stringify(expected)

  if (sameDays([0, 1, 2, 3, 4, 5, 6])) return '每日'
  if (sameDays([1, 2, 3, 4, 5])) return '平日'
  if (sameDays([0, 6])) return '週末'

  return normalized.map((day) => ['日', '一', '二', '三', '四', '五', '六'][day]).join('/')
}
