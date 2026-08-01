import type { Metadata } from 'next'
import { NextIntlClientProvider } from 'next-intl'
import { resolveLocaleFromCookie, loadMessages } from '@/lib/i18n/serverLocale'
import ComingSoonContent from './ComingSoonContent'
import { safeJsonLd } from '@/lib/seo/jsonLd'

export const metadata: Metadata = {
  title: 'SPACE8｜香港中八桌球室｜新蒲崗自助無煙獨立球室（即將開幕）',
  description: 'SPACE8 是香港新蒲崗自助無煙中八獨立球室，全預約制，網上預訂、QR碼自助入場。鄰近鑽石山及啟德港鐵站，九龍區中八愛好者主場，即將開幕。',
  robots: { index: true, follow: true },
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

  // Minimal LocalBusiness JSON-LD for coming soon page (no hours/telephone yet)
  const comingSoonJsonLd = {
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
      <script type="application/ld+json">{safeJsonLd(comingSoonJsonLd)}</script>
      <NextIntlClientProvider locale={locale} messages={messages}>
        <ComingSoonContent />
      </NextIntlClientProvider>
    </>
  )
}
