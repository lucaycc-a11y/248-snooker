/**
 * GET /api/admin/bookings/[id]/payments
 *
 * Returns all payment attempts for a given booking.
 * Auth: getAdminData() guard.
 */

import { NextResponse } from 'next/server'
import { getAdminData } from '@/lib/data/getAdmin'
import { getServiceSupabase } from '@/lib/supabase/service'

type Row = Record<string, unknown>

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await getAdminData()
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const service = getServiceSupabase()
    const { data, error } = await service
      .from('payment_attempts')
      .select('id, booking_id, order_group_id, provider, provider_order_no, status, failure_code, failure_reason, idempotency_key, created_at, updated_at, completed_at')
      .eq('booking_id', id)
      .order('created_at', { ascending: true })

    if (error) throw error

    const payments = (data ?? []).map((r: Row) => ({
      id: String(r.id ?? ''),
      bookingId: String(r.booking_id ?? ''),
      orderGroupId: r.order_group_id ? String(r.order_group_id) : null,
      provider: String(r.provider ?? ''),
      providerOrderNo: r.provider_order_no ? String(r.provider_order_no) : null,
      status: String(r.status ?? ''),
      failureCode: r.failure_code ? String(r.failure_code) : null,
      failureReason: r.failure_reason ? String(r.failure_reason) : null,
      idempotencyKey: String(r.idempotency_key ?? ''),
      createdAt: String(r.created_at ?? ''),
      updatedAt: String(r.updated_at ?? ''),
      completedAt: r.completed_at ? String(r.completed_at) : null,
    }))

    return NextResponse.json({ payments })
  } catch (err) {
    console.error('[admin/bookings/payments] GET error', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
