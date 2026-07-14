import { cookies } from 'next/headers'
import { routing } from '@/i18n/routing'

// Routes OUTSIDE the [locale] segment (e.g. /member) are bypassed by the intl
// middleware, so requestLocale is never set. We resolve the active locale from
// the NEXT_LOCALE cookie (which next-intl writes on locale switch) and load its
// messages directly, then hand both to a NextIntlClientProvider.
export async function resolveLocaleFromCookie(): Promise<string> {
  const store = await cookies()
  const cookieLocale = store.get('NEXT_LOCALE')?.value
  return cookieLocale && (routing.locales as readonly string[]).includes(cookieLocale)
    ? cookieLocale
    : routing.defaultLocale
}

// Return type is intentionally left to inference (the dynamic JSON import
// resolves to `any`), so the result is assignable to NextIntlClientProvider's
// `messages` prop without a fragile cast to its internal message type.
export async function loadMessages(locale: string) {
  try {
    return (await import(`../../messages/${locale}.json`)).default
  } catch {
    return (await import(`../../messages/${routing.defaultLocale}.json`)).default
  }
}
