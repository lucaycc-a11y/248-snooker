import { NextIntlClientProvider } from 'next-intl'
import { getMessages } from 'next-intl/server'
import { routing } from '@/i18n/routing'

// This route sits outside the [locale] segment, so nothing provides next-intl context.
// AuthCard (login / register) calls useTranslations, which throws without a provider —
// the page then shows only "Error". Provide the default locale (zh-HK) explicitly, as
// app/member/layout.tsx does.
export default async function Layout({ children }: { children: React.ReactNode }) {
  const locale = routing.defaultLocale
  const messages = await getMessages({ locale })
  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      {children}
    </NextIntlClientProvider>
  )
}
