import { getPublicSupabase } from '@/lib/supabase/public'

export type BlogPost = {
  id: string
  slug: string
  locale: string
  title: string
  excerpt: string | null
  content: string | null
  seo_title: string | null
  seo_description: string | null
  og_image_url: string | null
  cover_image_url: string | null
  category: string | null
  author: string | null
  published_at: string | null
  reading_time: number | null
  views: number | null
}

const LIST_COLUMNS =
  'id, slug, locale, title, excerpt, cover_image_url, og_image_url, category, author, published_at, reading_time, views'

// List published posts for a locale, newest first. Returns [] when Supabase is
// unavailable or the table is empty — the list page renders a "coming soon"
// state in that case.
export async function getBlogPosts(locale: string): Promise<BlogPost[]> {
  const supabase = getPublicSupabase()
  if (!supabase) return []
  try {
    const { data, error } = await supabase
      .from('blog_posts')
      .select(LIST_COLUMNS)
      .eq('locale', locale)
      .not('published_at', 'is', null)
      .lte('published_at', new Date().toISOString())
      .order('published_at', { ascending: false })
    if (error || !data) return []
    return data as BlogPost[]
  } catch {
    return []
  }
}

// Fetch a single published post by slug + locale. Returns null when not found.
export async function getBlogPost(slug: string, locale: string): Promise<BlogPost | null> {
  const supabase = getPublicSupabase()
  if (!supabase) return null
  try {
    const { data, error } = await supabase
      .from('blog_posts')
      .select('*')
      .eq('slug', slug)
      .eq('locale', locale)
      .not('published_at', 'is', null)
      .lte('published_at', new Date().toISOString())
      .maybeSingle()
    if (error || !data) return null
    return data as BlogPost
  } catch {
    return null
  }
}

// Related posts: same category (fallback to recent), excluding the current slug.
export async function getRelatedPosts(
  post: BlogPost,
  limit = 3,
): Promise<BlogPost[]> {
  const supabase = getPublicSupabase()
  if (!supabase) return []
  try {
    let query = supabase
      .from('blog_posts')
      .select(LIST_COLUMNS)
      .eq('locale', post.locale)
      .neq('slug', post.slug)
      .not('published_at', 'is', null)
      .lte('published_at', new Date().toISOString())
      .order('published_at', { ascending: false })
      .limit(limit)
    if (post.category) query = query.eq('category', post.category)
    const { data, error } = await query
    if (error || !data) return []
    return data as BlogPost[]
  } catch {
    return []
  }
}
