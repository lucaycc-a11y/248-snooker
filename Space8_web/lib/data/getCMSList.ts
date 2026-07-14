import { getPublicSupabase } from '@/lib/supabase/public'

// Public read for FAQ/legal-style content lists. RLS already filters to
// status='published'; the query filters explicitly too (defense in depth,
// matching getCMS.ts's own convention).

export type CMSListItem<T = Record<string, string>> = {
  id: string
  orderIndex: number
  fields: T
}

export async function getCMSList<T = Record<string, string>>(
  page: string,
  collectionKey: string,
  locale = 'zh-HK'
): Promise<CMSListItem<T>[]> {
  const supabase = getPublicSupabase()
  if (!supabase) return []
  try {
    const { data, error } = await supabase
      .from('cms_list_items')
      .select('id, order_index, fields')
      .eq('page', page)
      .eq('collection_key', collectionKey)
      .eq('locale', locale)
      .eq('status', 'published')
      .order('order_index', { ascending: true })
    if (error || !data) return []
    return data.map((r) => ({ id: r.id as string, orderIndex: r.order_index as number, fields: r.fields as T }))
  } catch {
    return []
  }
}
