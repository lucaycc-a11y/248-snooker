import { NextIntlClientProvider } from 'next-intl'
import { getMessages } from 'next-intl/server'
import { routing } from '@/i18n/routing'

// ════════════════════════════════════════════════════════════════════════════
// Member Layout — Provides NextIntlClientProvider for /member route
//
// `/member` is deliberately excluded from next-intl's [locale] routing
// (middleware.ts → BYPASS_PREFIXES includes /member). This means requests to
// /member never pass through app/[locale]/layout.tsx, which is the only place
// that renders <NextIntlClientProvider>.
//
// However, app/member/MemberPageClient.tsx and its children (MemberCard.tsx,
// TierRing.tsx, PointsHistory.tsx, BookingHistory.tsx, SecuritySettings.tsx,
// NotificationSettings.tsx) all call useTranslations(...) from next-intl.
// That hook throws if there is no NextIntlClientProvider ancestor.
//
// This layout provides the provider with the default locale (zh-HK) explicitly,
// WITHOUT adding a locale segment to the URL or registering /member in
// LOCALIZED_ROOTS — routing stays untouched, only the client context is provided.
//
// Why we don't call getLocale() here:
// getLocale() throws outside the [locale] segment when no request locale has
// been seeded (see app/layout.tsx comment). We force routing.defaultLocale
// instead.
// ════════════════════════════════════════════════════════════════════════════

export default async function MemberLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Force default locale (zh-HK) — /member is single-language by design
  const locale = routing.defaultLocale
  const messages = await getMessages({ locale })

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      {children}
    </NextIntlClientProvider>
  )
}
