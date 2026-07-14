import { NextResponse } from 'next/server'
import { getAdminData } from '@/lib/data/getAdmin'
import { getServiceSupabase } from '@/lib/supabase/service'

// Admin-configurable AI widget settings — Tier 1 per the spec ("改完即時生效,
// 唔使confirm"): no draft/publish staging, unlike scalar CMS text. Available
// to both admin and super_admin.

const LOCALES = ['zh-HK', 'zh-CN', 'en']
const TONES = ['friendly', 'professional', 'playful']

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export async function GET() {
  const admin = await getAdminData()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = getServiceSupabase()
  const { data } = await service
    .from('ai_widget_settings')
    .select('locale, greeting_message, suggested_prompts, system_prompt_override, tone')
    .in('locale', LOCALES)

  return NextResponse.json({ settings: data ?? [] })
}

export async function POST(req: Request) {
  try {
    const admin = await getAdminData()
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body: unknown = await req.json().catch(() => null)
    if (
      !isRecord(body) ||
      typeof body.locale !== 'string' ||
      !LOCALES.includes(body.locale) ||
      typeof body.greeting_message !== 'string' ||
      !Array.isArray(body.suggested_prompts) ||
      !body.suggested_prompts.every((p) => typeof p === 'string') ||
      typeof body.tone !== 'string' ||
      !TONES.includes(body.tone)
    ) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }
    const systemPromptOverride = typeof body.system_prompt_override === 'string' ? body.system_prompt_override : null

    const service = getServiceSupabase()
    const { data: before } = await service
      .from('ai_widget_settings')
      .select('greeting_message, suggested_prompts, system_prompt_override, tone')
      .eq('locale', body.locale)
      .maybeSingle()

    const { error } = await service.from('ai_widget_settings').upsert({
      locale: body.locale,
      greeting_message: body.greeting_message,
      suggested_prompts: body.suggested_prompts,
      system_prompt_override: systemPromptOverride,
      tone: body.tone,
      updated_at: new Date().toISOString(),
      updated_by: admin.userId,
    })
    if (error) {
      console.error('[admin/ai-settings] upsert failed', error)
      return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }

    await service.from('audit_log').insert({
      admin_user_id: admin.userId,
      admin_email: admin.email,
      action: 'ai_widget_settings_update',
      target_table: 'ai_widget_settings',
      target_id: body.locale,
      before_value: before ?? null,
      after_value: {
        greeting_message: body.greeting_message,
        suggested_prompts: body.suggested_prompts,
        system_prompt_override: systemPromptOverride,
        tone: body.tone,
      },
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[admin/ai-settings] unexpected error', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
