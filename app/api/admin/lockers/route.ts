/**
 * Admin Lockers API — §11.6.
 *
 * GET    /api/admin/lockers              — list lockers + active bookings
 * POST   /api/admin/lockers              — create locker
 * PUT    /api/admin/lockers              — update locker (number, status, label)
 * DELETE /api/admin/lockers?id=xxx       — delete locker
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

function num(row: Row, key: string): number | null {
  const v = row[key]
  return typeof v === 'number' ? v : null
}

/* ── GET — list lockers with active bookings ──────────── */
export async function GET() {
  try {
    const admin = await getAdminData()
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const service = getServiceSupabase()

    // Fetch all lockers
    const { data: lockerData, error: lockerErr } = await service
      .from('lockers')
      .select('id, number, status, label')
      .order('number', { ascending: true })

    if (lockerErr) {
      console.error('[admin/lockers] GET lockers query error', { message: lockerErr.message })
      return NextResponse.json({ lockers: [] })
    }

    const lockers = (Array.isArray(lockerData) ? lockerData : []).map((r: Row) => ({
      id: r.id as string,
      number: num(r, 'number') ?? 0,
      status: str(r, 'status') ?? 'available',
      label: str(r, 'label'),
    }))

    // Fetch active locker bookings
    const { data: bookingData } = await service
      .from('locker_bookings')
      .select('id, locker_id, user_id, booking_id, start_time, end_time, status, created_at')
      .eq('status', 'active')
      .order('start_time', { ascending: true })

    const bookings = (Array.isArray(bookingData) ? bookingData : []).map((r: Row) => ({
      id: r.id as string,
      lockerId: r.locker_id as string,
      userId: r.user_id as string,
      bookingId: (r.booking_id as string) ?? null,
      startTime: str(r, 'start_time') ?? '',
      endTime: str(r, 'end_time') ?? '',
      status: str(r, 'status') ?? 'active',
      createdAt: str(r, 'created_at') ?? '',
    }))

    return NextResponse.json({ lockers, bookings })
  } catch (err) {
    console.error('[admin/lockers] GET error', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

/* ── POST — create locker ────────────────────────────── */
export async function POST(req: Request) {
  try {
    const admin = await getAdminData()
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json().catch(() => null)
    if (!isRecord(body)) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    const number = typeof body.number === 'number' ? body.number : null
    if (number === null || number < 1) {
      return NextResponse.json({ error: 'Valid locker number is required' }, { status: 400 })
    }

    const status = typeof body.status === 'string' && ['available', 'occupied', 'maintenance'].includes(body.status)
      ? body.status
      : 'available'
    const label = typeof body.label === 'string' ? body.label.trim() || null : null

    const service = getServiceSupabase()

    // Check for duplicate number
    const { data: existing } = await service
      .from('lockers')
      .select('id')
      .eq('number', number)
      .limit(1)

    if (Array.isArray(existing) && existing.length > 0) {
      return NextResponse.json({ error: `Locker #${number} already exists` }, { status: 409 })
    }

    const { data, error } = await service
      .from('lockers')
      .insert({ number, status, label })
      .select('id, number, status, label')
      .single()

    if (error) {
      console.error('[admin/lockers] POST insert error', { message: error.message })
      return NextResponse.json({ error: 'Failed to create locker' }, { status: 500 })
    }

    // Log to admin_action_log
    await service.from('admin_action_log').insert({
      admin_user_id: admin.userId,
      admin_email: admin.email,
      action_type: 'locker_create',
      target_table: 'lockers',
      target_id: data.id,
      before_jsonb: null,
      after_jsonb: JSON.stringify({ number, status, label }),
      risk_level: 'low',
      confirmed_by: admin.userId,
    })

    return NextResponse.json({ locker: data })
  } catch (err) {
    console.error('[admin/lockers] POST error', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

/* ── PUT — update locker ─────────────────────────────── */
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

    const service = getServiceSupabase()

    // Fetch current state for audit log
    const { data: currentData } = await service
      .from('lockers')
      .select('id, number, status, label')
      .eq('id', id)
      .single()

    if (!currentData) {
      return NextResponse.json({ error: 'Locker not found' }, { status: 404 })
    }

    const updates: Record<string, unknown> = {}

    if (typeof body.number === 'number' && body.number >= 1) {
      // Check duplicate number (excluding self)
      const { data: dup } = await service
        .from('lockers')
        .select('id')
        .eq('number', body.number)
        .neq('id', id)
        .limit(1)

      if (Array.isArray(dup) && dup.length > 0) {
        return NextResponse.json({ error: `Locker #${body.number} already exists` }, { status: 409 })
      }
      updates.number = body.number
    }

    if (typeof body.status === 'string' && ['available', 'occupied', 'maintenance'].includes(body.status)) {
      updates.status = body.status
    }

    if (typeof body.label === 'string' || body.label === null) {
      updates.label = typeof body.label === 'string' ? body.label.trim() || null : null
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    const { data, error } = await service
      .from('lockers')
      .update(updates)
      .eq('id', id)
      .select('id, number, status, label')
      .single()

    if (error) {
      console.error('[admin/lockers] PUT update error', { message: error.message })
      return NextResponse.json({ error: 'Failed to update locker' }, { status: 500 })
    }

    // Log to admin_action_log
    await service.from('admin_action_log').insert({
      admin_user_id: admin.userId,
      admin_email: admin.email,
      action_type: 'locker_update',
      target_table: 'lockers',
      target_id: id,
      before_jsonb: JSON.stringify(currentData),
      after_jsonb: JSON.stringify(data),
      risk_level: 'low',
      confirmed_by: admin.userId,
    })

    return NextResponse.json({ locker: data })
  } catch (err) {
    console.error('[admin/lockers] PUT error', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

/* ── DELETE — delete locker ──────────────────────────── */
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

    // Fetch before state
    const { data: beforeData } = await service
      .from('lockers')
      .select('id, number, status, label')
      .eq('id', id)
      .single()

    if (!beforeData) {
      return NextResponse.json({ error: 'Locker not found' }, { status: 404 })
    }

    // Check for active bookings — refuse delete if occupied
    const { data: activeBookings } = await service
      .from('locker_bookings')
      .select('id')
      .eq('locker_id', id)
      .eq('status', 'active')
      .limit(1)

    if (Array.isArray(activeBookings) && activeBookings.length > 0) {
      return NextResponse.json({ error: 'Cannot delete locker with active bookings' }, { status: 409 })
    }

    const { error } = await service
      .from('lockers')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('[admin/lockers] DELETE error', { message: error.message })
      return NextResponse.json({ error: 'Failed to delete locker' }, { status: 500 })
    }

    // Log to admin_action_log
    await service.from('admin_action_log').insert({
      admin_user_id: admin.userId,
      admin_email: admin.email,
      action_type: 'locker_delete',
      target_table: 'lockers',
      target_id: id,
      before_jsonb: JSON.stringify(beforeData),
      after_jsonb: null,
      risk_level: 'medium',
      confirmed_by: admin.userId,
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[admin/lockers] DELETE error', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
