import { NextResponse } from 'next/server'
import { getAdminData } from '@/lib/data/getAdmin'
import { getServiceSupabase } from '@/lib/supabase/service'

// Admin blog post list + create. Mirrors app/api/admin/ai-settings/route.ts's
// shape (GET returns all rows for the admin UI, POST upserts + audit-logs).
// Posts are drafts (published_at = null) until explicitly published — see
// the PATCH handler in [id]/route.ts for publish/unpublish.

const LOCALES = ['zh-HK', 'zh-CN', 'en']

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80)
}

export async function GET() {
  const admin = await getAdminData()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = getServiceSupabase()
  const { data, error } = await service
    .from('blog_posts')
    .select('id, slug, locale, title, excerpt, category, cover_image_url, author, published_at, ai_generated, created_at')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[admin/blog] list failed', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
  return NextResponse.json({ posts: data ?? [] })
}

export async function POST(req: Request) {
  try {
    const admin = await getAdminData()
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body: unknown = await req.json().catch(() => null)
    if (
      !isRecord(body) ||
      typeof body.title !== 'string' ||
      !body.title.trim() ||
      typeof body.locale !== 'string' ||
      !LOCALES.includes(body.locale)
    ) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }

    const title = body.title.trim()
    const locale = body.locale
    const slugInput = typeof body.slug === 'string' && body.slug.trim() ? body.slug.trim() : slugify(title)
    const slug = slugify(slugInput) || `post-${Date.now()}`
    // Joining an existing translation group (adding a locale to an existing
    // post) vs. starting a brand-new one — see translate/route.ts for the
    // "create sibling in another locale" flow that sets this.
    const translationGroupId = typeof body.translation_group_id === 'string' ? body.translation_group_id : null

    const service = getServiceSupabase()
    const { data, error } = await service
      .from('blog_posts')
      .insert({
        title,
        locale,
        slug,
        excerpt: typeof body.excerpt === 'string' ? body.excerpt : null,
        content: typeof body.content === 'string' ? body.content : null,
        category: typeof body.category === 'string' ? body.category : null,
        seo_title: typeof body.seo_title === 'string' ? body.seo_title : null,
        seo_description: typeof body.seo_description === 'string' ? body.seo_description : null,
        cover_image_url: typeof body.cover_image_url === 'string' ? body.cover_image_url : null,
        og_image_url: typeof body.og_image_url === 'string' ? body.og_image_url : null,
        author: typeof body.author === 'string' && body.author.trim() ? body.author.trim() : 'Space8',
        ai_generated: body.ai_generated === true,
      })
      .select('id, slug, locale')
      .single()

    if (error || !data) {
      console.error('[admin/blog] insert failed', error)
      if (error?.code === '23505') {
        return NextResponse.json({ error: 'slug_taken' }, { status: 409 })
      }
      return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }

    // New group defaults to the row's own id (set by the migration's default
    // for existing rows); joining an existing group uses the caller's id.
    await service
      .from('blog_posts')
      .update({ translation_group_id: translationGroupId ?? data.id })
      .eq('id', data.id)

    await service.from('audit_log').insert({
      admin_user_id: admin.userId,
      admin_email: admin.email,
      action: 'blog_post_create',
      target_table: 'blog_posts',
      target_id: data.id,
      before_value: null,
      after_value: { title, slug: data.slug, locale: data.locale },
    })

    return NextResponse.json({ success: true, id: data.id, slug: data.slug })
  } catch (err) {
    console.error('[admin/blog] unexpected error', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
