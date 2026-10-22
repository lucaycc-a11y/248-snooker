import type { Metadata } from 'next'
import { NextIntlClientProvider } from 'next-intl'
import { resolveLocaleFromCookie, loadMessages } from '@/lib/i18n/serverLocale'
import KpayMaintenanceContent from './KpayMaintenanceContent'

export const metadata: Metadata = {
  title: 'SPACE8｜新付款，新篇章',
  description: 'SPACE8 正在升級付款系統。',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

export default async function KpayMaintenancePage() {
  const locale = await resolveLocaleFromCookie()
  const messages = await loadMessages(locale)
  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <KpayMaintenanceContent />
    </NextIntlClientProvider>
  )
}
