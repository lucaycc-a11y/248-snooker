/**
 * Venue table display names.
 * Used instead of raw table_number values throughout the UI.
 */
export const TABLE_NAMES: Record<number, string> = {
  1: 'Space Infinity',
  2: 'Space Eternity',
} as const

export type TableNumber = keyof typeof TABLE_NAMES