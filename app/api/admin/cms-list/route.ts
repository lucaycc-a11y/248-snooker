import { NextResponse } from 'next/server'
import { getAdminData } from '@/lib/data/getAdmin'
import { getServiceSupabase } from '@/lib/supabase/service'

// Admin-only CRUD for cms_list_items (FAQ/legal-style addable content).
// No draft/publish two-step here — new items default to status='published'
// immediately, same instant-feel as inline text edits (Phase B). Every
// mutation writes an audit_log row.

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const LOCALES = ['zh-HK', 'zh-CN', 'en', 'ja']

export async function POST(req: Request) {
  try {
    const admin = await getAdminData()
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body: unknown = await req.json().catch(() => null)
    if (
      !isRecord(body) ||
      typeof body.page !== 'string' ||
      typeof body.collection_key !== 'string' ||
      typeof body.locale !== 'string' ||
      !LOCALES.includes(body.locale) ||
      !isRecord(body.fields)
    ) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }

    const service = getServiceSupabase()

    const { data: existing } = await service
      .from('cms_list_items')
      .select('order_index')
      .eq('page', body.page)
      .eq('collection_key', body.collection_key)
      .eq('locale', body.locale)
      .order('order_index', { ascending: false })
      .limit(1)
      .maybeSingle()
    const nextOrderIndex = (existing?.order_index ?? -1) + 1

    const { data: inserted, error } = await service
      .from('cms_list_items')
      .insert({
        page: body.page,
        collection_key: body.collection_key,
        locale: body.locale,
        order_index: nextOrderIndex,
        fields: body.fields,
        status: 'published',
      })
      .select('id')
      .single()
    if (error || !inserted) {
      console.error('[admin/cms-list] insert failed', error)
      return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }

    await service.from('audit_log').insert({
      admin_user_id: admin.userId,
      admin_email: admin.email,
      action: 'cms_list_item_add',
      target_table: 'cms_list_items',
      target_id: String(inserted.id),
      after_value: { page: body.page, collection_key: body.collection_key, locale: body.locale, fields: body.fields },
    })

    return NextResponse.json({ success: true, id: inserted.id })
  } catch (err) {
    console.error('[admin/cms-list] unexpected error', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  try {
    const admin = await getAdminData()
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body: unknown = await req.json().catch(() => null)
    if (!isRecord(body) || typeof body.id !== 'string') {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }

    const service = getServiceSupabase()

    const { data: before } = await service
      .from('cms_list_items')
      .select('fields, order_index')
      .eq('id', body.id)
      .maybeSingle()

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (isRecord(body.fields)) patch.fields = body.fields
    if (typeof body.order_index === 'number') patch.order_index = body.order_index
    if (Object.keys(patch).length === 1) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
    }

    const { error } = await service.from('cms_list_items').update(patch).eq('id', body.id)
    if (error) {
      console.error('[admin/cms-list] update failed', error)
      return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }

    await service.from('audit_log').insert({
      admin_user_id: admin.userId,
      admin_email: admin.email,
      action: patch.order_index !== undefined ? 'cms_list_item_reorder' : 'cms_list_item_edit',
      target_table: 'cms_list_items',
      target_id: body.id,
      before_value: before ?? null,
      after_value: patch,
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[admin/cms-list] unexpected error', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const admin = await getAdminData()
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const url = new URL(req.url)
    const id = url.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    const service = getServiceSupabase()

    const { data: before } = await service.from('cms_list_items').select('*').eq('id', id).maybeSingle()

    const { error } = await service.from('cms_list_items').delete().eq('id', id)
    if (error) {
      console.error('[admin/cms-list] delete failed', error)
      return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }

    await service.from('audit_log').insert({
      admin_user_id: admin.userId,
      admin_email: admin.email,
      action: 'cms_list_item_delete',
      target_table: 'cms_list_items',
      target_id: id,
      before_value: before ?? null,
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[admin/cms-list] unexpected error', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
