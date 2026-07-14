import { getServiceSupabase } from '@/lib/supabase/service'

// Admin CMS list — reads cms_content directly (service-role, bypasses the
// public read-only RLS) grouped by "page" prefix (the part of the key before
// the first '.', e.g. "hero.title" -> page "hero"). cms_content has no page
// column, so this is inferred from key naming convention.
//
// Rewritten (Part 4) to accept a dynamic locale, join cms_versions for a
// draft/published status badge, and support a search substring filter.
// DB schema (cms_content/cms_versions/cms_list_items) is unchanged — this is
// a query-layer rewrite only.

export type CMSRow = { key: string; locale: string; value: string; isVariant: boolean; status: 'draft' | 'published' }
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

export async function getCMSGrouped(locale = 'zh-HK', search = ''): Promise<CMSPageGroup[]> {
  const service = getServiceSupabase()
  let query = service.from('cms_content').select('key, locale, value').eq('locale', locale)
  const trimmedSearch = search.trim()
  if (trimmedSearch) {
    query = query.or(`key.ilike.%${trimmedSearch}%,value.ilike.%${trimmedSearch}%`)
  }
  const { data } = await query
  const rows = (data ?? []) as { key: string; locale: string; value: string }[]

  // Latest cms_versions row per (field_key, locale) determines draft/published
  // status — a key with a pending (unpublished) draft shows 'draft', anything
  // else (never edited, or last edit already published/reverted) shows
  // 'published'.
  const statusByKey = new Map<string, 'draft' | 'published'>()
  try {
    const { data: versionRows } = await service
      .from('cms_versions')
      .select('field_key, locale, status, created_at')
      .eq('locale', locale)
      .order('created_at', { ascending: false })
    for (const v of (versionRows ?? []) as { field_key: string; locale: string; status: string }[]) {
      const k = `${v.field_key}:${v.locale}`
      if (!statusByKey.has(k)) {
        statusByKey.set(k, v.status === 'draft' ? 'draft' : 'published')
      }
    }
  } catch {
    /* stays empty — every row shows as published */
  }

  const groups = new Map<string, CMSRow[]>()
  for (const r of rows) {
    const page = r.key.includes('.') ? r.key.split('.')[0] : r.key
    const list = groups.get(page) ?? []
    list.push({
      key: r.key,
      locale: r.locale,
      value: r.value,
      isVariant: isVariantKey(r.key),
      status: statusByKey.get(`${r.key}:${r.locale}`) ?? 'published',
    })
    groups.set(page, list)
  }

  return Array.from(groups.entries())
    .map(([page, rows]) => ({ page, rows: rows.sort((a, b) => a.key.localeCompare(b.key)) }))
    .sort((a, b) => a.page.localeCompare(b.page))
}
