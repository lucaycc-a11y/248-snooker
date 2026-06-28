import { defineRouting } from 'next-intl/routing'

export const routing = defineRouting({
  locales: ['zh', 'en'],
  defaultLocale: 'zh',
  // zh = no prefix (248.formhk.com/), en = /en prefix (248.formhk.com/en)
  localePrefix: 'as-needed',
  // Auto-detect from the Accept-Language header on first visit.
  localeDetection: true,
})

export type Locale = (typeof routing.locales)[number]
