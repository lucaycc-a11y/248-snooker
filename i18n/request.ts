import { getRequestConfig } from 'next-intl/server'
import { getActiveLocale, isValidLocale } from './enabled-locales'

export default getRequestConfig(async ({ requestLocale }) => {
  // requestLocale is set by the middleware; fall back to the default.
  // If the requested locale is closed (zh-CN, en), fall back to zh-HK.
  const requested = await requestLocale
  const locale = getActiveLocale(requested)

  // Messages are served entirely from the static messages/{locale}.json
  // bundles, built into the app. This used to be merged at request time with
  // live overrides from the `cms_content` Supabase table (mergeMessagesWithCMS
  // in lib/i18n/mergeMessages.ts, now removed) — that runtime DB fetch was
  // dropped for SEO/static-rendering reasons; see app/[locale]/layout.tsx for
  // the fuller rationale. The cms_content table itself is untouched in case a
  // lightweight CMS is reintroduced later.
  const messages = (await import(`../messages/${locale}.json`)).default

  return {
    locale,
    messages,
    onError(error) {
      // In development and tests, throw on missing keys to catch them early
      if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
        throw error
      }
      // In production, log but don't crash
      console.error('[i18n]', error.message)
    },
    getMessageFallback({ namespace, key }) {
      // Return the key path as fallback so missing keys are visible
      const path = namespace ? `${namespace}.${key}` : key

      // In development and tests, throw to fail fast
      if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
        throw new Error(`Missing translation: ${path}`)
      }

      return path
    },
  }
})
