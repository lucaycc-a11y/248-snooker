/**
 * Member Format Utilities (Section 3.4 and 5.x)
 *
 * Formatting and parsing functions for member area display.
 * All dates/times are in Hong Kong timezone (Asia/Hong_Kong).
 */

/**
 * Parse the converted points count from a credits_ledger note.
 * Format: "100 points converted" → 100
 * Returns null if the note doesn't match the pattern.
 */
export function parseConvertNote(note: string): number | null {
  const match = note.match(/^(\d+) points converted$/)
  return match ? parseInt(match[1], 10) : null
}

/**
 * Map table number to room name (Section 3.4).
 * - 1 → 無限空間球室（枱1）
 * - 2 → 永恆空間球室（枱2）
 * - otherwise → 枱N
 */
export function roomName(tableNumber: number): string {
  switch (tableNumber) {
    case 1:
      return '無限空間球室（枱1）'
    case 2:
      return '永恆空間球室（枱2）'
    default:
      return `枱${tableNumber}`
  }
}

/**
 * Format a number as HK$ with Good Times font class.
 * Examples: formatHkd(10) → "HK$10", formatHkd(1234) → "HK$1,234"
 */
export function formatHkd(n: number): string {
  return `HK$${n.toLocaleString('en-HK')}`
}

/**
 * Format a date as "YYYY年M月" in Hong Kong timezone.
 * Example: "2026-10-03T10:30:00Z" → "2026年10月"
 */
export function formatMonth(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const hkTime = new Intl.DateTimeFormat('zh-HK', {
    year: 'numeric',
    month: 'numeric',
    timeZone: 'Asia/Hong_Kong',
  }).format(d)
  // Result: "2026/10" → "2026年10月"
  const [year, month] = hkTime.split('/')
  return `${year}年${month}月`
}

/**
 * Relative time string for inbox items (Section 5.3).
 * - < 60 minutes: "X 分鐘前"
 * - < 24 hours: "X 小時前"
 * - otherwise: "M月D日"
 *
 * Both `date` and `now` are interpreted in Hong Kong timezone.
 */
export function relativeTime(date: Date | string, now: Date = new Date()): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const diffMs = now.getTime() - d.getTime()
  const diffMinutes = Math.floor(diffMs / 60000)

  if (diffMinutes < 60) {
    return `${diffMinutes} 分鐘前`
  }

  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) {
    return `${diffHours} 小時前`
  }

  // Format as "M月D日" in Hong Kong timezone
  const hkTime = new Intl.DateTimeFormat('zh-HK', {
    month: 'numeric',
    day: 'numeric',
    timeZone: 'Asia/Hong_Kong',
  }).format(d)
  // Result: "10/3" → "10月3日"
  const [month, day] = hkTime.split('/')
  return `${month}月${day}日`
}

/**
 * Format booking time range for wallet detail line (Section 5.1).
 * Example: "09:00" - "11:00" → "09:00–11:00"
 */
export function formatTimeRange(startTime: string, endTime: string): string {
  return `${startTime}–${endTime}`
}

/**
 * Format date as "M月D日" in Hong Kong timezone (for wallet ledger rows).
 */
export function formatDayMonth(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const hkTime = new Intl.DateTimeFormat('zh-HK', {
    month: 'numeric',
    day: 'numeric',
    timeZone: 'Asia/Hong_Kong',
  }).format(d)
  const [month, day] = hkTime.split('/')
  return `${month}月${day}日`
}

/**
 * Determine day group label for inbox (Section 5.3).
 * Returns: "今日" | "昨日" | "更早"
 */
export function dayGroupLabel(date: Date | string, now: Date = new Date()): string {
  const d = typeof date === 'string' ? new Date(date) : date

  // Compare dates in Hong Kong timezone
  const formatter = new Intl.DateTimeFormat('zh-HK', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'Asia/Hong_Kong',
  })

  const itemDate = formatter.format(d)
  const todayDate = formatter.format(now)

  if (itemDate === todayDate) {
    return '今日'
  }

  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayDate = formatter.format(yesterday)

  if (itemDate === yesterdayDate) {
    return '昨日'
  }

  return '更早'
}
