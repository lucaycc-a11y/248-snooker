import { defineRouting } from 'next-intl/routing'
import { ENABLED_LOCALES, DEFAULT_LOCALE, type EnabledLocale } from './enabled-locales'

export const routing = defineRouting({
  // Only enabled locales are routable. Closed locales (zh-CN, en) redirect to zh-HK.
  // zh-HK = no prefix (space8.com.hk/)
  locales: ENABLED_LOCALES as unknown as string[],
  defaultLocale: DEFAULT_LOCALE,
  localePrefix: 'as-needed',
  // localeDetection MUST be false: with it true, next-intl reads the
  // browser's Accept-Language header on first visit and redirects an
  // English-preferring browser (the default for most machines, incognito
  // windows included) straight to /en — silently overriding defaultLocale.
  // Space8 12-7 改動.docx point 2: "default 繁體字" means every first-time
  // visitor sees zh-HK regardless of browser language; only the manual
  // language switcher (Nav toggleLocale) should ever change it.
  localeDetection: false,
})

export type Locale = EnabledLocale
