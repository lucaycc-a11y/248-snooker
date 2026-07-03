import { NextResponse } from 'next/server'
import { getAdminData } from '@/lib/data/getAdmin'
import { getServiceSupabase } from '@/lib/supabase/service'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const LOCALES = ['zh-HK', 'zh-CN', 'en', 'ja']

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminData()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const service = getServiceSupabase()
  const { data, error } = await service.from('blog_posts').select('*').eq('id', id).maybeSingle()
  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ post: data })
}

// Same PATCH shape covers field edits and the publish/unpublish toggle
// (published_at set to now() / null) — one endpoint, since both are just
// column updates on the same row, not a separate draft/version table like
// CMS text uses. Blog posts don't have the same live-site-text risk profile
// cms_versions exists for.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await getAdminData()
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const body: unknown = await req.json().catch(() => null)
    if (!isRecord(body)) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })

    const service = getServiceSupabase()
    const { data: existing } = await service.from('blog_posts').select('*').eq('id', id).maybeSingle()
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const update: Record<string, unknown> = {}
    const stringFields = [
      'title', 'slug', 'excerpt', 'content', 'category',
      'seo_title', 'seo_description', 'cover_image_url', 'og_image_url', 'author',
    ] as const
    for (const field of stringFields) {
      if (field in body) {
        if (typeof body[field] !== 'string' && body[field] !== null) {
          return NextResponse.json({ error: `Invalid ${field}` }, { status: 400 })
        }
        update[field] = body[field]
      }
    }
    if ('locale' in body) {
      if (typeof body.locale !== 'string' || !LOCALES.includes(body.locale)) {
        return NextResponse.json({ error: 'Invalid locale' }, { status: 400 })
      }
      update.locale = body.locale
    }
    if ('publish' in body) {
      if (typeof body.publish !== 'boolean') return NextResponse.json({ error: 'Invalid publish' }, { status: 400 })
      update.published_at = body.publish ? new Date().toISOString() : null
    }
    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: 'No changes' }, { status: 400 })
    }

    const { error } = await service.from('blog_posts').update(update).eq('id', id)
    if (error) {
      console.error('[admin/blog] update failed', error)
      if (error.code === '23505') return NextResponse.json({ error: 'slug_taken' }, { status: 409 })
      return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }

    await service.from('audit_log').insert({
      admin_user_id: admin.userId,
      admin_email: admin.email,
      action: 'publish' in body ? (body.publish ? 'blog_post_publish' : 'blog_post_unpublish') : 'blog_post_update',
      target_table: 'blog_posts',
      target_id: id,
      before_value: existing,
      after_value: update,
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[admin/blog] unexpected error', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await getAdminData()
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const service = getServiceSupabase()
    const { data: existing } = await service.from('blog_posts').select('title, slug').eq('id', id).maybeSingle()
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const { error } = await service.from('blog_posts').delete().eq('id', id)
    if (error) {
      console.error('[admin/blog] delete failed', error)
      return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }

    await service.from('audit_log').insert({
      admin_user_id: admin.userId,
      admin_email: admin.email,
      action: 'blog_post_delete',
      target_table: 'blog_posts',
      target_id: id,
      before_value: existing,
      after_value: null,
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[admin/blog] unexpected error', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
