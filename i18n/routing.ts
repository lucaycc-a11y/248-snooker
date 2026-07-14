import { defineRouting } from 'next-intl/routing'

export const routing = defineRouting({
  // zh-HK = no prefix (space8.com.hk/)
  // zh-CN → /zh-CN, en → /en, ja → /ja
  locales: ['zh-HK', 'zh-CN', 'en', 'ja'],
  defaultLocale: 'zh-HK',
  localePrefix: 'as-needed',
  localeDetection: true,
})

export type Locale = (typeof routing.locales)[number]
