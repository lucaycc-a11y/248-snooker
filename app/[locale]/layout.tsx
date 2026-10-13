import { NextIntlClientProvider, hasLocale } from 'next-intl'
import { setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { routing } from '@/i18n/routing'

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }))
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) {
    notFound()
  }

  // Enable static rendering for this locale.
  setRequestLocale(locale)

  // Page copy is served entirely from the static next-intl message bundles
  // (messages/{locale}.json) below — no runtime Supabase fetch. The
  // cms_content/cms_list_items/cms_versions tables and the CMSRoot/CMSProvider
  // Realtime-subscription + inline-edit layer that used to read them at
  // request time have been intentionally removed (SEO: avoids a DB
  // round-trip blocking content delivery, and next-intl content can be
  // fully statically rendered/cached). The tables themselves are kept in
  // Supabase, untouched, in case a lightweight CMS is reintroduced later.
  return (
    <NextIntlClientProvider>
      {children}
    </NextIntlClientProvider>
  )
}
