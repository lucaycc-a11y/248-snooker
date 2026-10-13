/**
 * Single source of truth for enabled locales.
 * To reopen a locale, add it back to this array — routing, switcher, sitemap,
 * and metadata will update automatically.
 */
export const ENABLED_LOCALES = ['zh-HK'] as const

export type EnabledLocale = (typeof ENABLED_LOCALES)[number]

/**
 * All locales that have message files and can be reopened.
 * Closed locales redirect to the default but their message files stay in place.
 */
export const ALL_LOCALES = ['zh-HK', 'zh-CN', 'en'] as const

export type Locale = (typeof ALL_LOCALES)[number]

export const DEFAULT_LOCALE: EnabledLocale = 'zh-HK'

/**
 * Check if a locale is currently enabled.
 */
export function isLocaleEnabled(locale: string): locale is EnabledLocale {
  return ENABLED_LOCALES.includes(locale as EnabledLocale)
}

/**
 * Check if a locale exists (enabled or closed).
 */
export function isValidLocale(locale: string): locale is Locale {
  return ALL_LOCALES.includes(locale as Locale)
}

/**
 * Get the active locale for a requested locale (falls back to default if closed).
 */
export function getActiveLocale(requested: string | null | undefined): EnabledLocale {
  if (requested && isLocaleEnabled(requested)) {
    return requested as EnabledLocale
  }
  return DEFAULT_LOCALE
}
