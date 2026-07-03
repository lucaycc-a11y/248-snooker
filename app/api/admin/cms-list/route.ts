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

export async function GET(req: Request) {
  const admin = await getAdminData()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const page = url.searchParams.get('page')
  const collectionKey = url.searchParams.get('collection_key')
  const locale = url.searchParams.get('locale')
  if (!page || !collectionKey || !locale || !LOCALES.includes(locale)) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const service = getServiceSupabase()
  const { data } = await service
    .from('cms_list_items')
    .select('id, order_index, fields')
    .eq('page', page)
    .eq('collection_key', collectionKey)
    .eq('locale', locale)
    .order('order_index', { ascending: true })

  const items = (data ?? []).map((r) => ({ id: r.id as string, orderIndex: r.order_index as number, fields: r.fields as Record<string, string> }))
  return NextResponse.json({ items })
}

export async function POST(req: Request) {
  try {
    const admin = await getAdminData()
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body: unknown = await req.json().catch(() => null)
    if (!isRecord(body)) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })

    const service = getServiceSupabase()

    // Duplicate-existing-item path (Part 8's hover-toolbar "Copy" action) —
    // alternative to the page/collection_key/locale/fields body below.
    if (typeof body.duplicate_id === 'string') {
      const { data: source } = await service
        .from('cms_list_items')
        .select('page, collection_key, locale, order_index, fields')
        .eq('id', body.duplicate_id)
        .maybeSingle()
      if (!source) return NextResponse.json({ error: 'Not found' }, { status: 404 })

      const insertIndex = (source.order_index as number) + 1

      // Shift every row at or after insertIndex up by one to make room —
      // mirrors CMSList.tsx's existing client-side reorder-shift logic,
      // server-side.
      const { data: toShift } = await service
        .from('cms_list_items')
        .select('id, order_index')
        .eq('page', source.page)
        .eq('collection_key', source.collection_key)
        .eq('locale', source.locale)
        .gte('order_index', insertIndex)
      await Promise.all(
        ((toShift ?? []) as { id: string; order_index: number }[]).map((row) =>
          service.from('cms_list_items').update({ order_index: row.order_index + 1 }).eq('id', row.id)
        )
      )

      const { data: inserted, error } = await service
        .from('cms_list_items')
        .insert({
          page: source.page,
          collection_key: source.collection_key,
          locale: source.locale,
          order_index: insertIndex,
          fields: source.fields,
          status: 'published',
        })
        .select('id')
        .single()
      if (error || !inserted) {
        console.error('[admin/cms-list] duplicate insert failed', error)
        return NextResponse.json({ error: 'Internal error' }, { status: 500 })
      }

      await service.from('audit_log').insert({
        admin_user_id: admin.userId,
        admin_email: admin.email,
        action: 'cms_list_item_duplicate',
        target_table: 'cms_list_items',
        target_id: String(inserted.id),
        before_value: { duplicated_from: body.duplicate_id },
        after_value: { fields: source.fields },
      })

      return NextResponse.json({ success: true, id: inserted.id, order_index: insertIndex })
    }

    if (
      typeof body.page !== 'string' ||
      typeof body.collection_key !== 'string' ||
      typeof body.locale !== 'string' ||
      !LOCALES.includes(body.locale) ||
      !isRecord(body.fields)
    ) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }

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
    if (!before) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const { error } = await service.from('cms_list_items').delete().eq('id', id)
    if (error) {
      console.error('[admin/cms-list] delete failed', error)
      return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }

    // Renumber remaining rows in the same collection so order_index stays
    // contiguous — previously missing (existing gap, fixed here since this
    // route is being touched anyway for Part 8).
    const { data: remaining } = await service
      .from('cms_list_items')
      .select('id, order_index')
      .eq('page', before.page as string)
      .eq('collection_key', before.collection_key as string)
      .eq('locale', before.locale as string)
      .gt('order_index', before.order_index as number)
    await Promise.all(
      ((remaining ?? []) as { id: string; order_index: number }[]).map((row) =>
        service.from('cms_list_items').update({ order_index: row.order_index - 1 }).eq('id', row.id)
      )
    )

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
