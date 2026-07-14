import { getRequestConfig } from 'next-intl/server'
import { hasLocale } from 'next-intl'
import { routing } from './routing'
import { mergeMessagesWithCMS } from '@/lib/i18n/mergeMessages'

export default getRequestConfig(async ({ requestLocale }) => {
  // requestLocale is set by the middleware; fall back to the default.
  const requested = await requestLocale
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale

  // Load static messages as base
  const staticMessages = (await import(`../messages/${locale}.json`)).default

  // Merge with live CMS overrides from database
  const messages = await mergeMessagesWithCMS(staticMessages, locale)

  return {
    locale,
    messages,
  }
})
