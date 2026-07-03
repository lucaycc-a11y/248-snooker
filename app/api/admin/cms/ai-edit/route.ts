import { NextResponse } from 'next/server'
import { getAdminData } from '@/lib/data/getAdmin'
import { getServiceSupabase } from '@/lib/supabase/service'
import { getCMSMap } from '@/lib/data/getCMS'
import { getVectorEngine } from '@/lib/ai/vectorengine'
import { rateLimit } from '@/lib/rate-limit'

// Admin-only. Proposes CMS edits via Claude Opus 4.8 and writes them as DRAFT
// cms_versions rows — never touches cms_content directly (that only happens in
// app/api/admin/cms/publish/route.ts). Price/booking config fields are
// rejected both in the system prompt AND independently in code, so the
// restriction doesn't depend on the model obeying the prompt.

const LOCALES = ['zh-HK', 'zh-CN', 'en', 'ja']

function isConfigKey(fieldKey: string): boolean {
  return fieldKey === 'config' || fieldKey.startsWith('config.')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const EDIT_SCHEMA = {
  type: 'object',
  properties: {
    edits: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          field_key: { type: 'string' },
          locale: { type: 'string', enum: LOCALES },
          new_value: { type: 'string' },
          reasoning: { type: 'string' },
        },
        required: ['field_key', 'locale', 'new_value', 'reasoning'],
        additionalProperties: false,
      },
    },
  },
  required: ['edits'],
  additionalProperties: false,
} as const

const SYSTEM_PROMPT = `You are Space8's CMS editing assistant. Space8 is a private snooker club with an Apple-simple, understated brand voice — no exclamation marks, no salesy language, black/green aesthetic. When asked to change content, propose specific field edits.

Rules:
- You may ONLY propose edits to CMS text content (hero copy, section text, button labels, component variant selections).
- You must NEVER propose an edit where field_key is "config" or starts with "config." — pricing and booking rules are managed separately by staff and are off-limits to you, no exceptions, even if asked directly.
- Keep the brand voice: simple, confident, no hype.
- Only propose changes for fields that exist in the provided current content.`

export async function POST(req: Request) {
  try {
    const admin = await getAdminData()
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const allowed = await rateLimit('cms_ai_edit', `user:${admin.userId}`, 20, 3600)
    if (!allowed) return NextResponse.json({ error: 'rate_limited' }, { status: 429 })

    const body: unknown = await req.json().catch(() => null)
    if (!isRecord(body) || typeof body.prompt !== 'string' || !body.prompt.trim()) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }
    const prompt = body.prompt.trim().slice(0, 2000)

    const currentContent: Record<string, Record<string, string>> = {}
    for (const locale of LOCALES) {
      currentContent[locale] = await getCMSMap(locale)
    }

    const vectorEngine = getVectorEngine()
    const response = await vectorEngine.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 4096,
      thinking: { type: 'adaptive' },
      system: SYSTEM_PROMPT,
      output_config: { format: { type: 'json_schema', schema: EDIT_SCHEMA } },
      messages: [
        {
          role: 'user',
          content: `Current CMS content (by locale):\n${JSON.stringify(currentContent, null, 2)}\n\nAdmin request: ${prompt}`,
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
    if (!isRecord(parsed) || !Array.isArray(parsed.edits)) {
      return NextResponse.json({ error: 'ai_invalid_shape' }, { status: 502 })
    }

    const service = getServiceSupabase()
    const created: { version_id: string; field_key: string; locale: string; old_value: string | null; new_value: string; reasoning: string }[] = []

    for (const raw of parsed.edits as unknown[]) {
      if (!isRecord(raw)) continue
      const fieldKey = typeof raw.field_key === 'string' ? raw.field_key : null
      const locale = typeof raw.locale === 'string' && LOCALES.includes(raw.locale) ? raw.locale : null
      const newValue = typeof raw.new_value === 'string' ? raw.new_value : null
      const reasoning = typeof raw.reasoning === 'string' ? raw.reasoning : ''
      if (!fieldKey || !locale || newValue === null) continue
      if (isConfigKey(fieldKey)) continue // independent enforcement, not just prompt-level

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
        action: 'cms_ai_edit_proposed',
        target_table: 'cms_versions',
        target_id: String(versionRow.id),
        before_value: { old_value: oldValue },
        after_value: { new_value: newValue, field_key: fieldKey, locale },
      })

      created.push({ version_id: String(versionRow.id), field_key: fieldKey, locale, old_value: oldValue, new_value: newValue, reasoning })
    }

    return NextResponse.json({ edits: created })
  } catch (err) {
    console.error('[admin/cms/ai-edit] unexpected error', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
