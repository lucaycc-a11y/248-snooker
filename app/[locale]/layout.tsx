import { NextIntlClientProvider, hasLocale } from 'next-intl'
import { setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { routing } from '@/i18n/routing'
import { getCMSMap } from '@/lib/data/getCMS'
import CMSRoot from '@/components/cms/CMSRoot'

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

  const initialMap = await getCMSMap(locale)

  return (
    <NextIntlClientProvider>
      <CMSRoot initialMap={initialMap} locale={locale}>
        {children}
      </CMSRoot>
    </NextIntlClientProvider>
  )
}
