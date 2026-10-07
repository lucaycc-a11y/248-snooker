import { ENABLED_LOCALES, DEFAULT_LOCALE } from '@/i18n/enabled-locales'

// Production origin. Canonicals, hreflang, sitemap and JSON-LD always point
// here — never at uat.* or *.vercel.app, even when rendered on those hosts.
export const SITE_URL = 'https://space8.com.hk'
export const PRODUCTION_HOST = 'space8.com.hk'

// Path for a locale: the default locale has no prefix (/venue), others do (/en/venue).
export function localePath(locale: string, path: string): string {
  const clean = path === '/' ? '' : path
  if (locale === DEFAULT_LOCALE) return clean || '/'
  return `/${locale}${clean}`
}

export function absoluteUrl(locale: string, path: string): string {
  const p = localePath(locale, path)
  return p === '/' ? SITE_URL : `${SITE_URL}${p}`
}

// hreflang map built from ENABLED_LOCALES only, so a closed locale (which
// middleware 301s to zh-HK) is never advertised. x-default = default locale.
export function hreflangLanguages(path: string): Record<string, string> {
  const languages: Record<string, string> = Object.fromEntries(
    ENABLED_LOCALES.map((locale) => [locale, absoluteUrl(locale, path)]),
  )
  languages['x-default'] = absoluteUrl(DEFAULT_LOCALE, path)
  return languages
}

// Self-referencing canonical + enabled-locale hreflang for a page's metadata.
// `path` is the locale-less route, e.g. '/', '/venue', '/blog/my-post'.
export function pageAlternates(locale: string, path: string, opts: { hreflang?: boolean } = {}) {
  const canonical = absoluteUrl(locale, path)
  if (opts.hreflang === false) return { canonical }
  return { canonical, languages: hreflangLanguages(path) }
}

// Production is exactly space8.com.hk. www. is accepted (it only redirects to
// the apex); uat.*, *.vercel.app, localhost and everything else is not.
export function isProductionHost(host: string | null | undefined): boolean {
  if (!host) return false
  const h = host.toLowerCase().split(':')[0]
  return h === PRODUCTION_HOST || h === `www.${PRODUCTION_HOST}`
}

export const IN_LANGUAGE: string[] = [...ENABLED_LOCALES]
