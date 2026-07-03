import { NextResponse } from 'next/server'
import { getAdminData } from '@/lib/data/getAdmin'
import { getServiceSupabase } from '@/lib/supabase/service'
import { str, type Row } from '@/lib/data/adminReadHelpers'

// Admin-initiated soft-cancel — distinct from user-initiated refund. Sets
// status='admin_cancelled', releases the slot, does NOT touch Stripe (for
// no-payment-to-reverse cases like spam/no-shows; a paid booking needing
// money back should use the refund flow instead). Available to both admin
// and super_admin roles, per the user's own decision.

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await getAdminData()
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const body: unknown = await req.json().catch(() => null)
    if (!isRecord(body) || body.action !== 'cancel' || typeof body.reason !== 'string' || body.reason.trim().length === 0) {
      return NextResponse.json({ error: 'A reason is required' }, { status: 400 })
    }
    const reason = body.reason.trim()

    const service = getServiceSupabase()
    const { data: existing } = await service
      .from('bookings')
      .select('id, status, slot_id')
      .eq('id', id)
      .maybeSingle()
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const booking = existing as Row
    const currentStatus = str(booking, ['status'])

    if (currentStatus === 'refunded' || currentStatus === 'admin_cancelled') {
      return NextResponse.json({ error: 'already_finalized' }, { status: 400 })
    }

    const { error } = await service.from('bookings').update({ status: 'admin_cancelled' }).eq('id', id)
    if (error) {
      console.error('[admin/bookings] cancel update failed', error)
      return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }

    const slotId = booking.slot_id
    if (typeof slotId === 'string') {
      await service.from('slots').update({ status: 'available', locked_by: null, locked_until: null }).eq('id', slotId)
    }

    await service.from('audit_log').insert({
      admin_user_id: admin.userId,
      admin_email: admin.email,
      action: 'booking_admin_cancel',
      target_table: 'bookings',
      target_id: id,
      before_value: { status: currentStatus },
      after_value: { status: 'admin_cancelled', reason },
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[admin/bookings] unexpected error', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
