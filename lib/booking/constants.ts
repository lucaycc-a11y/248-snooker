/**
 * Venue table display names, locale-aware.
 * Used instead of raw table_number values throughout the UI.
 *
 * Returns format like "無限空間球室（枱1）" (zh-HK) or "Space Infinity (Table 1)" (en).
 * The locale suffix is appended automatically by getTableName().
 */
export const TABLE_NAMES: Record<number, Record<string, string>> = {
  1: {
    'zh-HK': '無限空間球室',
    'zh-CN': '无限空间球室',
    'en': 'Space Infinity',
  },
  2: {
    'zh-HK': '永恆空間球室',
    'zh-CN': '永恒空间球室',
    'en': 'Space Eternity',
  },
} as const

export function getTableName(tableNumber: number, locale: string): string {
  const names = TABLE_NAMES[tableNumber as 1 | 2]
  if (!names) return `Table #${tableNumber}`
  const baseName = names[locale] ?? names['en'] ?? `Table #${tableNumber}`
  // Chinese locales use full-width brackets; English uses half-width
  // e.g. "無限空間球室（枱1）" vs "Space Infinity (Table 1)"
  const suffix =
    locale === 'zh-HK' || locale === 'zh-CN'
      ? `（枱${tableNumber}）`
      : ` (Table ${tableNumber})`
  return `${baseName}${suffix}`
}

export type TableNumber = keyof typeof TABLE_NAMES