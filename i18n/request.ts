import { getRequestConfig } from 'next-intl/server'
import { hasLocale } from 'next-intl'
import { routing } from './routing'

export default getRequestConfig(async ({ requestLocale }) => {
  // requestLocale is set by the middleware; fall back to the default.
  const requested = await requestLocale
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale

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
  }
})
