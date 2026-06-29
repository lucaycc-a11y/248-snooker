import { getPublicSupabase } from '@/lib/supabase/public'

// Bundled fallbacks for a few global keys. Page COPY lives in next-intl
// messages/*.json — this CMS layer only provides optional runtime overrides
// (edited by admins) keyed by data-cms-key. When no DB row exists we return the
// bundled default, and if there's none, the key itself.
const mockCMS: Record<string, string> = {
  'hero.title': '248 Snooker Club',
  'hero.subtitle': '24小時私人桌球會所',
  'booking.title': '預訂桌枱',
  'pricing.title': '價格',
  'nav.book': '預訂',
  'nav.pricing': '定價',
  'nav.about': '關於',
  'nav.blog': 'Blog',
  'nav.cta': '立即預訂',
  'footer.product': '產品',
  'footer.company': '公司',
  'footer.legal': '法律',
  'footer.social': '社交',
}

// Single key lookup (back-compat with the original signature). Optional locale
// selects a per-locale override row; defaults to zh-HK.
export async function getCMS(key: string, locale = 'zh-HK'): Promise<string> {
  const supabase = getPublicSupabase()
  if (supabase) {
    try {
      const { data } = await supabase
        .from('cms_content')
        .select('value')
        .eq('key', key)
        .eq('locale', locale)
        .maybeSingle()
      if (data?.value) return data.value as string
    } catch {
      // fall through to bundled default
    }
  }
  return mockCMS[key] ?? key
}

// Batch fetch all overrides for a locale, returned as a key→value map. Pages use
// this to resolve many data-cms-key values in one round-trip; merge it over your
// next-intl defaults. Returns {} when Supabase is unavailable.
export async function getCMSMap(locale = 'zh-HK'): Promise<Record<string, string>> {
  const supabase = getPublicSupabase()
  if (!supabase) return {}
  try {
    const { data, error } = await supabase
      .from('cms_content')
      .select('key, value')
      .eq('locale', locale)
    if (error || !data) return {}
    return Object.fromEntries(data.map((r) => [r.key as string, r.value as string]))
  } catch {
    return {}
  }
}
