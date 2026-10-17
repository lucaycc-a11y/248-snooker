/**
 * Admin maintenance_log API — per-table booking blocks.
 *
 * GET: list blocks (optionally filtered by date).
 * POST: create a block. `table_number: null` means all tables.
 *
 * Design system: admin-theme.css variables only.
 */

import { NextResponse } from 'next/server'
import { getAdminData } from '@/lib/data/getAdmin'
import { getLegacyServiceSupabase } from '@/lib/supabase/legacy'

export const dynamic = 'force-dynamic'

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

export async function GET(req: Request) {
  try {
    const admin = await getAdminData()
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const url = new URL(req.url)
    const date = url.searchParams.get('date')

    const supabase = getLegacyServiceSupabase()
    let query = supabase
      .from('maintenance_log')
      .select('id, date, start_time, end_time, table_number, reason, created_by')
      .order('date', { ascending: true })
      .order('start_time', { ascending: true })

    if (date) query = query.eq('date', date)

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ blocks: data ?? [] })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unexpected error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const admin = await getAdminData()
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body: unknown = await req.json()
    if (!isRecord(body) || typeof body.date !== 'string' || body.date.trim() === '') {
      return NextResponse.json({ error: 'date is required' }, { status: 400 })
    }

    const tableNumber =
      typeof body.table_number === 'number' && Number.isInteger(body.table_number) && body.table_number > 0
        ? body.table_number
        : null

    const startTime = typeof body.start_time === 'string' && body.start_time.trim() !== '' ? body.start_time : null
    const endTime = typeof body.end_time === 'string' && body.end_time.trim() !== '' ? body.end_time : null

    if ((startTime && !endTime) || (!startTime && endTime)) {
      return NextResponse.json({ error: 'start_time and end_time must be provided together' }, { status: 400 })
    }
    if (startTime && endTime && startTime >= endTime) {
      return NextResponse.json({ error: 'start_time must be before end_time' }, { status: 400 })
    }

    const reason = typeof body.reason === 'string' && body.reason.trim() !== '' ? body.reason.trim() : null

    const supabase = getLegacyServiceSupabase()
    const { data, error } = await supabase
      .from('maintenance_log')
      .insert({
        date: body.date,
        start_time: startTime,
        end_time: endTime,
        table_number: tableNumber,
        reason,
        created_by: admin.userId,
      })
      .select('id, date, start_time, end_time, table_number, reason, created_by')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await supabase.from('audit_log').insert({
      action: 'maintenance.create',
      admin_email: admin.email,
      admin_user_id: admin.userId,
      target_table: 'maintenance_log',
      target_id: data.id,
      before_value: null,
      after_value: {
        date: body.date,
        start_time: startTime,
        end_time: endTime,
        table_number: tableNumber,
        reason,
      },
    })

    return NextResponse.json({ ok: true, block: data })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unexpected error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
