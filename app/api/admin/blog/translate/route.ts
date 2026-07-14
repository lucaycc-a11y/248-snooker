import { NextResponse } from 'next/server'
import { getAdminData } from '@/lib/data/getAdmin'
import { getServiceSupabase } from '@/lib/supabase/service'
import { getVectorEngine, VectorEngineConfigError } from '@/lib/ai/vectorengine'
import { rateLimit } from '@/lib/rate-limit'

// Translates one blog post into another locale as an AI-drafted SUGGESTION —
// creates a new draft blog_posts row (published_at = null) in the same
// translation_group_id, never overwrites or publishes anything. The admin
// reviews/edits the draft in the normal editor and publishes it manually,
// same "AI proposes, human approves" shape as the CMS translate endpoint
// (app/api/admin/cms/translate/route.ts), but blog content is long-form prose
// so it's a full new row per locale, not a per-field diff.

const LOCALES = ['zh-HK', 'zh-CN', 'en'] as const
type Locale = (typeof LOCALES)[number]

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

const TRANSLATE_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    excerpt: { type: 'string' },
    content: { type: 'string' },
    seo_title: { type: 'string' },
    seo_description: { type: 'string' },
  },
  required: ['title', 'excerpt', 'content', 'seo_title', 'seo_description'],
  additionalProperties: false,
} as const

const SYSTEM_PROMPT = `You are Space8's blog translation assistant. Space8 is a private snooker club with an Apple-simple, understated brand voice — no exclamation marks, no salesy language.

Translate the given blog post accurately and idiomatically into the target locale. The "content" field is HTML (from a rich text editor) — preserve all HTML tags exactly, only translate the text nodes inside them. Do not translate proper nouns like "Space8". Keep the brand voice: simple, confident, no hype.`

export async function POST(req: Request) {
  try {
    const admin = await getAdminData()
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const allowed = await rateLimit('blog_ai_translate', `user:${admin.userId}`, 20, 3600)
    if (!allowed) return NextResponse.json({ error: 'rate_limited' }, { status: 429 })

    const body: unknown = await req.json().catch(() => null)
    if (
      !isRecord(body) ||
      typeof body.post_id !== 'string' ||
      !body.post_id.trim() ||
      typeof body.target_locale !== 'string' ||
      !LOCALES.includes(body.target_locale as Locale)
    ) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }
    const postId = body.post_id.trim()
    const targetLocale = body.target_locale as Locale

    const service = getServiceSupabase()
    const { data: source, error: sourceErr } = await service
      .from('blog_posts')
      .select('id, translation_group_id, title, excerpt, content, category, seo_title, seo_description, cover_image_url, og_image_url, author')
      .eq('id', postId)
      .maybeSingle()
    if (sourceErr || !source) {
      return NextResponse.json({ error: 'source_not_found' }, { status: 404 })
    }

    const groupId = (source.translation_group_id as string | null) ?? source.id
    const { data: existingSibling } = await service
      .from('blog_posts')
      .select('id')
      .eq('translation_group_id', groupId)
      .eq('locale', targetLocale)
      .maybeSingle()
    if (existingSibling) {
      return NextResponse.json({ error: 'translation_exists', existing_id: existingSibling.id }, { status: 409 })
    }

    const vectorEngine = getVectorEngine()
    const response = await vectorEngine.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 8192,
      thinking: { type: 'adaptive' },
      system: SYSTEM_PROMPT,
      output_config: { format: { type: 'json_schema', schema: TRANSLATE_SCHEMA } },
      messages: [
        {
          role: 'user',
          content: `Target locale: ${targetLocale}\n\nTitle: ${source.title}\n\nExcerpt: ${source.excerpt ?? ''}\n\nSEO title: ${source.seo_title ?? ''}\n\nSEO description: ${source.seo_description ?? ''}\n\nContent (HTML):\n${source.content ?? ''}`,
        },
      ],
    })

    if (response.stop_reason === 'refusal') {
      return NextResponse.json({ error: 'ai_refused' }, { status: 422 })
    }

    const textBlock = response.content.find((b) => b.type === 'text')
    if (!textBlock) {
      return NextResponse.json({ error: 'ai_no_output' }, { status: 502 })
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(textBlock.text)
    } catch {
      return NextResponse.json({ error: 'ai_invalid_json' }, { status: 502 })
    }
    if (
      !isRecord(parsed) ||
      typeof parsed.title !== 'string' ||
      typeof parsed.content !== 'string'
    ) {
      return NextResponse.json({ error: 'ai_invalid_shape' }, { status: 502 })
    }

    const translatedTitle = parsed.title
    const slug = `${slugify(translatedTitle) || `post-${Date.now()}`}-${targetLocale.toLowerCase()}`

    const { data: created, error: insertErr } = await service
      .from('blog_posts')
      .insert({
        title: translatedTitle,
        locale: targetLocale,
        slug,
        excerpt: typeof parsed.excerpt === 'string' ? parsed.excerpt : null,
        content: parsed.content,
        category: source.category,
        seo_title: typeof parsed.seo_title === 'string' ? parsed.seo_title : null,
        seo_description: typeof parsed.seo_description === 'string' ? parsed.seo_description : null,
        cover_image_url: source.cover_image_url,
        og_image_url: source.og_image_url,
        author: source.author,
        ai_generated: true,
        translation_group_id: groupId,
        // Draft — never auto-published, matches the CMS translate pattern.
        published_at: null,
      })
      .select('id, slug')
      .single()

    if (insertErr || !created) {
      console.error('[admin/blog/translate] insert failed', insertErr)
      if (insertErr?.code === '23505') {
        return NextResponse.json({ error: 'slug_taken' }, { status: 409 })
      }
      return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }

    await service.from('audit_log').insert({
      admin_user_id: admin.userId,
      admin_email: admin.email,
      action: 'blog_post_translate',
      target_table: 'blog_posts',
      target_id: created.id,
      before_value: { source_post_id: source.id },
      after_value: { title: translatedTitle, locale: targetLocale, slug: created.slug },
    })

    return NextResponse.json({ success: true, id: created.id, slug: created.slug })
  } catch (err) {
    if (err instanceof VectorEngineConfigError) {
      console.error('[admin/blog/translate] VectorEngine not configured')
      return NextResponse.json({ error: 'vectorengine_not_configured' }, { status: 503 })
    }
    console.error('[admin/blog/translate] unexpected error', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
