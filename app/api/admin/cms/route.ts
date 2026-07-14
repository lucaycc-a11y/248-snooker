import { NextResponse } from 'next/server'
import { getAdminData } from '@/lib/data/getAdmin'
import { getServiceSupabase } from '@/lib/supabase/service'
import { getCMSGrouped } from '@/lib/data/getAdminCMS'

// Admin-only manual CMS edit — writes a DRAFT cms_versions row. Same shape as
// the per-edit write in ai-edit/route.ts. Never touches cms_content directly;
// only publish/route.ts does that.

const LOCALES = ['zh-HK', 'zh-CN', 'en', 'ja']

function isConfigKey(fieldKey: string): boolean {
  return fieldKey === 'config' || fieldKey.startsWith('config.')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export async function GET(req: Request) {
  const admin = await getAdminData()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const locale = url.searchParams.get('locale')
  const search = url.searchParams.get('search') ?? ''
  const groups = await getCMSGrouped(locale && LOCALES.includes(locale) ? locale : 'zh-HK', search)
  return NextResponse.json({ groups })
}

export async function POST(req: Request) {
  try {
    const admin = await getAdminData()
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body: unknown = await req.json().catch(() => null)
    if (!isRecord(body)) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })

    const fieldKey = typeof body.field_key === 'string' ? body.field_key : ''
    const locale = typeof body.locale === 'string' && LOCALES.includes(body.locale) ? body.locale : ''
    const newValue = typeof body.new_value === 'string' ? body.new_value : null

    if (!fieldKey || !locale || newValue === null) {
      return NextResponse.json({ error: 'Invalid field_key, locale, or new_value' }, { status: 400 })
    }
    if (isConfigKey(fieldKey)) {
      return NextResponse.json({ error: 'config_field_forbidden' }, { status: 403 })
    }

    const service = getServiceSupabase()

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
        change_source: 'manual',
        status: 'draft',
      })
      .select('id')
      .single()
    if (error || !versionRow) {
      console.error('[admin/cms] draft insert failed', error)
      return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }

    await service.from('audit_log').insert({
      admin_user_id: admin.userId,
      admin_email: admin.email,
      action: 'cms_manual_edit_drafted',
      target_table: 'cms_versions',
      target_id: String(versionRow.id),
      before_value: { old_value: oldValue },
      after_value: { new_value: newValue, field_key: fieldKey, locale },
    })

    return NextResponse.json({ success: true, version_id: versionRow.id })
  } catch (err) {
    console.error('[admin/cms] unexpected error', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
