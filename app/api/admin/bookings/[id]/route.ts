import { NextResponse } from 'next/server'
import { getAdminData } from '@/lib/data/getAdmin'
import { getServiceSupabase } from '@/lib/supabase/service'
import { str, type Row } from '@/lib/data/adminReadHelpers'
import { adminCancelWithCredit } from '@/lib/admin/cancelWithCredit'

// Admin-initiated soft-cancel — distinct from user-initiated refund. Does NOT
// touch Stripe (for no-payment-to-reverse cases like spam/no-shows; a paid
// booking needing money back should use the refund flow instead). Available
// to both admin and super_admin roles, per the user's own decision.
//
// `status = 'admin_cancelled'` is written ONLY by `admin_cancel_with_credit`
// (see lib/admin/cancelWithCredit.ts). A direct update here skipped point
// reversal, slot release and the audit row — that path is gone.

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await getAdminData()
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const body: unknown = await req.json().catch(() => null)
    if (!isRecord(body) || body.action !== 'cancel' || typeof body.reason !== 'string' || body.reason.trim().length < 5) {
      return NextResponse.json({ error: '取消原因至少要有 5 個字' }, { status: 400 })
    }
    const reason = body.reason.trim()

    const service = getServiceSupabase()
    const { data: existing } = await service
      .from('bookings')
      .select('id, status, slot_id, human_code, date')
      .eq('id', id)
      .maybeSingle()
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const booking = existing as Row
    const currentStatus = str(booking, ['status'])

    if (currentStatus === 'refunded' || currentStatus === 'admin_cancelled' || currentStatus === 'cancelled') {
      return NextResponse.json({ error: 'already_finalized' }, { status: 400 })
    }

    const humanCode = str(booking, ['human_code']) ?? id
    const dateLabel = str(booking, ['date']) ?? ''

    if (currentStatus === 'confirmed') {
      // Confirmed bookings go through the RPC — it reverses points, frees the
      // slot, writes cancellation_log + audit_log and notifies the member.
      const result = await adminCancelWithCredit({
        bookingId: id,
        adminId: admin.userId,
        reason,
        // No WhatsApp thread for a direct desk cancel.
        whatsappRef: '後台直接取消',
        creditAmount: 0,
        noticeTitle: '預約已取消',
        noticeMessage: `你的預約 ${humanCode}（${dateLabel}）已取消。`,
      })
      if (!result.ok) {
        return NextResponse.json({ error: result.error, code: result.code }, { status: 400 })
      }
      return NextResponse.json({ success: true })
    }

    // Pending / payment_failed / etc. — nothing was collected, so there is no
    // money or points to reverse. `cancelled` is the correct terminal status;
    // `admin_cancelled` is reserved for the RPC path above.
    const { error } = await service.from('bookings').update({ status: 'cancelled' }).eq('id', id)
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
      after_value: { status: 'cancelled', reason },
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[admin/bookings] unexpected error', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
