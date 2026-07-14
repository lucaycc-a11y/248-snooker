import type { Metadata } from 'next'
import { NextIntlClientProvider } from 'next-intl'
import { resolveLocaleFromCookie, loadMessages } from '@/lib/i18n/serverLocale'
import ComingSoonContent from './ComingSoonContent'

export const metadata: Metadata = {
  title: 'Space8 · Coming Soon',
  description: "Hong Kong's self-service Chinese eight-ball club is almost ready.",
}

// Never prerender/cache — the gate can be toggled off at any time, and this
// page's own content doesn't depend on request data, but it must stay dynamic
// so it never gets served stale from an edge cache after the gate is disabled.
export const dynamic = 'force-dynamic'

// Lives OUTSIDE [locale] (like /login) — middleware.ts bypasses intl rewriting
// for /coming-soon so it always resolves at the root regardless of locale
// prefix, and works even before the intl locale is otherwise established.
export default async function ComingSoonPage() {
  const locale = await resolveLocaleFromCookie()
  const messages = await loadMessages(locale)

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <ComingSoonContent />
    </NextIntlClientProvider>
  )
}
