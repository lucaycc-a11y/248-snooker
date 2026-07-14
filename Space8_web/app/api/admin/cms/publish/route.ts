import { NextResponse } from 'next/server'
import { getAdminData } from '@/lib/data/getAdmin'
import { getServiceSupabase } from '@/lib/supabase/service'

// Admin-only. The ONLY code path that ever writes public.cms_content — both
// manual (app/api/admin/cms/route.ts) and AI-proposed (ai-edit/route.ts)
// edits land here as drafts first, then get published through this route.
//
// Republishing an already-published version (from /admin/cms/history) does
// NOT mutate history in place: it inserts a fresh draft row whose new_value
// is the old version's old_value, then publishes that new row — marked
// status='reverted' (not 'published') so history can visually distinguish a
// rollback from a forward edit.

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

type VersionRow = {
  id: string
  field_key: string
  locale: string
  old_value: string | null
  new_value: string
  status: string
}

export async function POST(req: Request) {
  try {
    const admin = await getAdminData()
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body: unknown = await req.json().catch(() => null)
    if (!isRecord(body) || typeof body.version_id !== 'string') {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }

    const service = getServiceSupabase()

    const { data: versionData } = await service
      .from('cms_versions')
      .select('id, field_key, locale, old_value, new_value, status')
      .eq('id', body.version_id)
      .maybeSingle()
    const version = versionData as VersionRow | null
    if (!version) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    let toPublish = version
    let isRollback = false

    // Re-publishing history: create a fresh draft (restoring old_value as the
    // new content) rather than mutating the historical row.
    if (version.status === 'published') {
      isRollback = true
      const { data: newDraft, error: draftError } = await service
        .from('cms_versions')
        .insert({
          field_key: version.field_key,
          locale: version.locale,
          old_value: version.new_value,
          new_value: version.old_value ?? '',
          changed_by: admin.userId,
          change_source: 'manual',
          status: 'draft',
        })
        .select('id, field_key, locale, old_value, new_value, status')
        .single()
      if (draftError || !newDraft) {
        console.error('[admin/cms/publish] rollback draft failed', draftError)
        return NextResponse.json({ error: 'Internal error' }, { status: 500 })
      }
      toPublish = newDraft as VersionRow
    }

    const { error: upsertError } = await service
      .from('cms_content')
      .upsert({ key: toPublish.field_key, locale: toPublish.locale, value: toPublish.new_value })
    if (upsertError) {
      console.error('[admin/cms/publish] cms_content upsert failed', upsertError)
      return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }

    const { error: markError } = await service
      .from('cms_versions')
      .update({ status: isRollback ? 'reverted' : 'published', published_at: new Date().toISOString() })
      .eq('id', toPublish.id)
    if (markError) {
      console.error('[admin/cms/publish] version status update failed', markError)
      return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }

    await service.from('audit_log').insert({
      admin_user_id: admin.userId,
      admin_email: admin.email,
      action: isRollback ? 'cms_revert' : 'cms_publish',
      target_table: 'cms_content',
      target_id: `${toPublish.field_key}:${toPublish.locale}`,
      before_value: { old_value: toPublish.old_value },
      after_value: { new_value: toPublish.new_value },
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[admin/cms/publish] unexpected error', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
