/**
 * Admin Notification Templates API — §11.3.
 *
 * GET    /api/admin/notifications          — list all templates
 * POST   /api/admin/notifications          — create template
 * PUT    /api/admin/notifications          — update template
 * DELETE /api/admin/notifications?id=xxx   — delete template
 *
 * Security: requires admin auth (getAdminData).
 * Design system: admin-theme.css variables only. NO inline hex, NO shadows, NO `any`.
 */

import { NextResponse } from 'next/server'
import { getAdminData } from '@/lib/data/getAdmin'
import { getServiceSupabase } from '@/lib/supabase/service'

type Row = Record<string, unknown>

function isRecord(v: unknown): v is Row {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function str(row: Row, key: string): string | null {
  const v = row[key]
  return typeof v === 'string' && v.length > 0 ? v : null
}

/* ── GET — list all templates ──────────────────────────── */
export async function GET() {
  try {
    const admin = await getAdminData()
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const service = getServiceSupabase()

    const { data, error } = await service
      .from('notification_templates')
      .select('id, name, channel, subject, body, variables, is_active, created_at, updated_at')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[admin/notifications] GET query error', { message: error.message })
      // Table may not exist yet — return empty list gracefully
      return NextResponse.json({ templates: [] })
    }

    const templates = (Array.isArray(data) ? data : []).map((r: Row) => ({
      id: r.id,
      name: str(r, 'name') ?? '',
      channel: str(r, 'channel') ?? 'push',
      subject: str(r, 'subject') ?? null,
      body: str(r, 'body') ?? '',
      variables: Array.isArray(r.variables) ? r.variables : [],
      isActive: r.is_active === true,
      createdAt: str(r, 'created_at') ?? '',
      updatedAt: str(r, 'updated_at') ?? null,
    }))

    return NextResponse.json({ templates })
  } catch (err) {
    console.error('[admin/notifications] GET error', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

/* ── POST — create template ────────────────────────────── */
export async function POST(req: Request) {
  try {
    const admin = await getAdminData()
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json().catch(() => null)
    if (!isRecord(body)) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    const name = typeof body.name === 'string' && body.name.trim().length > 0 ? body.name.trim() : null
    const channel = typeof body.channel === 'string' ? body.channel : 'push'
    const subject = typeof body.subject === 'string' ? body.subject : null
    const content = typeof body.body === 'string' && body.body.trim().length > 0 ? body.body.trim() : null
    const variables = Array.isArray(body.variables) ? body.variables.filter((v: unknown) => typeof v === 'string') : []
    const isActive = typeof body.is_active === 'boolean' ? body.is_active : true

    if (!name || !content) {
      return NextResponse.json({ error: 'name and body are required' }, { status: 400 })
    }

    if (!['push', 'email', 'sms', 'in_app'].includes(channel)) {
      return NextResponse.json({ error: 'Invalid channel' }, { status: 400 })
    }

    const service = getServiceSupabase()

    const { data, error } = await service
      .from('notification_templates')
      .insert({
        name,
        channel,
        subject,
        body: content,
        variables,
        is_active: isActive,
      })
      .select('id, name, channel, subject, body, variables, is_active, created_at, updated_at')
      .single()

    if (error) {
      console.error('[admin/notifications] POST insert error', { message: error.message })
      return NextResponse.json({ error: 'Failed to create template' }, { status: 500 })
    }

    return NextResponse.json({ template: data })
  } catch (err) {
    console.error('[admin/notifications] POST error', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

/* ── PUT — update template ─────────────────────────────── */
export async function PUT(req: Request) {
  try {
    const admin = await getAdminData()
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json().catch(() => null)
    if (!isRecord(body)) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    const id = typeof body.id === 'string' ? body.id : null
    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    const updates: Record<string, unknown> = {}
    if (typeof body.name === 'string' && body.name.trim().length > 0) updates.name = body.name.trim()
    if (typeof body.channel === 'string' && ['push', 'email', 'sms', 'in_app'].includes(body.channel)) updates.channel = body.channel
    if (typeof body.subject === 'string' || body.subject === null) updates.subject = body.subject
    if (typeof body.body === 'string' && body.body.trim().length > 0) updates.body = body.body.trim()
    if (Array.isArray(body.variables)) updates.variables = body.variables.filter((v: unknown) => typeof v === 'string')
    if (typeof body.is_active === 'boolean') updates.is_active = body.is_active

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    updates.updated_at = new Date().toISOString()

    const service = getServiceSupabase()

    const { data, error } = await service
      .from('notification_templates')
      .update(updates)
      .eq('id', id)
      .select('id, name, channel, subject, body, variables, is_active, created_at, updated_at')
      .single()

    if (error) {
      console.error('[admin/notifications] PUT update error', { message: error.message })
      return NextResponse.json({ error: 'Failed to update template' }, { status: 500 })
    }

    return NextResponse.json({ template: data })
  } catch (err) {
    console.error('[admin/notifications] PUT error', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

/* ── DELETE — delete template ──────────────────────────── */
export async function DELETE(req: Request) {
  try {
    const admin = await getAdminData()
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const url = new URL(req.url)
    const id = url.searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'id query param required' }, { status: 400 })
    }

    const service = getServiceSupabase()

    const { error } = await service
      .from('notification_templates')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('[admin/notifications] DELETE error', { message: error.message })
      return NextResponse.json({ error: 'Failed to delete template' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[admin/notifications] DELETE error', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
