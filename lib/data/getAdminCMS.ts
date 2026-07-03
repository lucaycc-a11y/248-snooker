import { getServiceSupabase } from '@/lib/supabase/service'

// Admin CMS list — reads cms_content directly (service-role, bypasses the
// public read-only RLS) grouped by "page" prefix (the part of the key before
// the first '.', e.g. "hero.title" -> page "hero"). cms_content has no page
// column, so this is inferred from key naming convention.

export type CMSRow = { key: string; locale: string; value: string; isVariant: boolean }
export type CMSPageGroup = { page: string; rows: CMSRow[] }

const VARIANT_OPTIONS: Record<string, string[]> = {
  contact_button_type: ['whatsapp', 'ai_chat'],
}

function isVariantKey(key: string): boolean {
  return key.endsWith('_type') || key.endsWith('_variant') || key in VARIANT_OPTIONS
}

export function getVariantOptions(key: string): string[] | null {
  return VARIANT_OPTIONS[key] ?? null
}

export async function getCMSGrouped(locale = 'zh-HK'): Promise<CMSPageGroup[]> {
  const service = getServiceSupabase()
  const { data } = await service.from('cms_content').select('key, locale, value').eq('locale', locale)
  const rows = (data ?? []) as { key: string; locale: string; value: string }[]

  const groups = new Map<string, CMSRow[]>()
  for (const r of rows) {
    const page = r.key.includes('.') ? r.key.split('.')[0] : r.key
    const list = groups.get(page) ?? []
    list.push({ key: r.key, locale: r.locale, value: r.value, isVariant: isVariantKey(r.key) })
    groups.set(page, list)
  }

  return Array.from(groups.entries())
    .map(([page, rows]) => ({ page, rows: rows.sort((a, b) => a.key.localeCompare(b.key)) }))
    .sort((a, b) => a.page.localeCompare(b.page))
}
