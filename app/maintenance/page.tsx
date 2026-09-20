import type { Metadata } from 'next'
import { NextIntlClientProvider } from 'next-intl'
import { resolveLocaleFromCookie, loadMessages } from '@/lib/i18n/serverLocale'
import MaintenanceContent from './MaintenanceContent'
import { safeJsonLd } from '@/lib/seo/jsonLd'

export const metadata: Metadata = {
  title: 'SPACE8｜網站維護中',
  description: 'SPACE8 正在進行系統更新，請稍後再試。',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

export default async function MaintenancePage() {
  const locale = await resolveLocaleFromCookie()
  const messages = await loadMessages(locale)

  const maintenanceJsonLd = {
    "@context": "https://schema.org",
    "@type": "SportsActivityLocation",
    name: "SPACE8",
    description: "香港新蒲崗自助無煙中八獨立球室，全預約制",
    address: {
      "@type": "PostalAddress",
      streetAddress: "大有街32號泰力工業中心3樓05室",
      addressLocality: "新蒲崗",
      addressRegion: "九龍",
      addressCountry: "HK",
    },
    url: "https://space8.com.hk",
  }

  return (
    <>
      <script type="application/ld+json">{safeJsonLd(maintenanceJsonLd)}</script>
      <NextIntlClientProvider locale={locale} messages={messages}>
        <MaintenanceContent />
      </NextIntlClientProvider>
    </>
  )
}
