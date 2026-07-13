import { NextResponse } from 'next/server'
import { getAdminData } from '@/lib/data/getAdmin'
import { getServiceSupabase } from '@/lib/supabase/service'
import { getVectorEngine, VectorEngineConfigError } from '@/lib/ai/vectorengine'
import { rateLimit } from '@/lib/rate-limit'

// Admin-only. Translates one CMS field's current value into the other 3
// locales via Claude Opus 4.8, writing DRAFT cms_versions rows — never
// touches cms_content directly (that only happens in
// app/api/admin/cms/publish/route.ts). This is the same draft-then-publish
// gate as the free-form AI editor (ai-edit/route.ts), applied to translation
// so a bad machine translation can't go live without a human clicking publish.

const LOCALES = ['zh-HK', 'zh-CN', 'en', 'ja'] as const
type Locale = (typeof LOCALES)[number]

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const TRANSLATE_SCHEMA = {
  type: 'object',
  properties: {
    translations: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          locale: { type: 'string', enum: LOCALES },
          value: { type: 'string' },
        },
        required: ['locale', 'value'],
        additionalProperties: false,
      },
    },
  },
  required: ['translations'],
  additionalProperties: false,
} as const

const SYSTEM_PROMPT = `You are Space8's CMS translation assistant. Space8 is a private snooker club with an Apple-simple, understated brand voice — no exclamation marks, no salesy language, black/green aesthetic.

You will be given one field's text in its source locale. Translate it accurately and idiomatically into the other locales requested, preserving:
- The exact meaning and any placeholders like {count} or {pts} verbatim (do not translate placeholder names).
- The brand voice: simple, confident, no hype.
- Formatting (line breaks, punctuation style appropriate to each locale).

Do not add commentary. Do not translate proper nouns like "Space8".`

export async function POST(req: Request) {
  try {
    const admin = await getAdminData()
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const allowed = await rateLimit('cms_ai_translate', `user:${admin.userId}`, 20, 3600)
    if (!allowed) return NextResponse.json({ error: 'rate_limited' }, { status: 429 })

    const body: unknown = await req.json().catch(() => null)
    if (
      !isRecord(body) ||
      typeof body.field_key !== 'string' ||
      !body.field_key.trim() ||
      typeof body.source_locale !== 'string' ||
      !LOCALES.includes(body.source_locale as Locale)
    ) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }
    const fieldKey = body.field_key.trim()
    const sourceLocale = body.source_locale as Locale
    const targetLocales = LOCALES.filter((l) => l !== sourceLocale)

    const service = getServiceSupabase()

    // Prefer the value the admin is looking at right now (may be an unsaved
    // edit in the textbox) over what's persisted — translating a stale saved
    // value when the box already holds a newer draft would be surprising.
    const bodySourceValue = typeof body.source_value === 'string' ? body.source_value.trim() : ''
    let sourceValue = bodySourceValue
    if (!sourceValue) {
      const { data: sourceRow, error: sourceErr } = await service
        .from('cms_content')
        .select('value')
        .eq('key', fieldKey)
        .eq('locale', sourceLocale)
        .maybeSingle()
      if (sourceErr || !sourceRow?.value) {
        return NextResponse.json({ error: 'source_value_not_found' }, { status: 404 })
      }
      sourceValue = sourceRow.value as string
    }

    const vectorEngine = getVectorEngine()
    const response = await vectorEngine.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 2048,
      thinking: { type: 'adaptive' },
      system: SYSTEM_PROMPT,
      output_config: { format: { type: 'json_schema', schema: TRANSLATE_SCHEMA } },
      messages: [
        {
          role: 'user',
          content: `Field: ${fieldKey}\nSource locale: ${sourceLocale}\nSource text: ${sourceValue}\n\nTranslate into: ${targetLocales.join(', ')}`,
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
    if (!isRecord(parsed) || !Array.isArray(parsed.translations)) {
      return NextResponse.json({ error: 'ai_invalid_shape' }, { status: 502 })
    }

    const created: { version_id: string; locale: string; old_value: string | null; new_value: string }[] = []

    for (const raw of parsed.translations as unknown[]) {
      if (!isRecord(raw)) continue
      const locale = typeof raw.locale === 'string' && targetLocales.includes(raw.locale as Locale) ? (raw.locale as Locale) : null
      const newValue = typeof raw.value === 'string' ? raw.value : null
      if (!locale || newValue === null) continue

      const { data: existing } = await service
        .from('cms_content')
        .select('value')
        .eq('key', fieldKey)
        .eq('locale', locale)
        .maybeSingle()
      const oldValue = (existing?.value as string | undefined) ?? null

      const { data: versionRow, error } = await service
        .from('cms_versions')
        .insert({
          field_key: fieldKey,
          locale,
          old_value: oldValue,
          new_value: newValue,
          changed_by: admin.userId,
          change_source: 'ai',
          status: 'draft',
        })
        .select('id')
        .single()
      if (error || !versionRow) continue

      await service.from('audit_log').insert({
        admin_user_id: admin.userId,
        admin_email: admin.email,
        action: 'cms_ai_translate_proposed',
        target_table: 'cms_versions',
        target_id: String(versionRow.id),
        before_value: { old_value: oldValue },
        after_value: { new_value: newValue, field_key: fieldKey, locale, source_locale: sourceLocale },
      })

      created.push({ version_id: String(versionRow.id), locale, old_value: oldValue, new_value: newValue })
    }

    return NextResponse.json({ translations: created })
  } catch (err) {
    if (err instanceof VectorEngineConfigError) {
      console.error('[admin/cms/translate] VectorEngine not configured')
      return NextResponse.json({ error: 'vectorengine_not_configured' }, { status: 503 })
    }
    console.error('[admin/cms/translate] unexpected error', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
