/**
 * POST /api/admin/payment-log/reconcile
 *
 * One-click reconciliation: link a payment attempt to a booking by updating
 * the payment_attempts.booking_id. Also logs to admin_action_log.
 *
 * Auth: getAdminData() guard.
 */

import { NextResponse } from 'next/server'
import { getAdminData } from '@/lib/data/getAdmin'
import { getServiceSupabase } from '@/lib/supabase/service'
import { str } from '@/lib/data/adminReadHelpers'

export const runtime = 'nodejs'

type ReconcileRequest = {
  paymentId: string
  bookingId: string
}

export async function POST(req: Request) {
  try {
    const admin = await getAdminData()
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized — admin only' }, { status: 401 })
    }

    const body = await req.json().catch(() => null)
    const { paymentId, bookingId } = (body ?? {}) as Partial<ReconcileRequest>

    if (!paymentId || !bookingId) {
      return NextResponse.json({ error: 'paymentId and bookingId are required' }, { status: 400 })
    }

    const service = getServiceSupabase()

    // ── Verify the payment attempt exists ─────────────────────────────────
    const { data: payment, error: payErr } = await service
      .from('payment_attempts')
      .select('id, booking_id, status, amount, provider')
      .eq('id', paymentId)
      .single()

    if (payErr || !payment) {
      return NextResponse.json({ error: 'Payment attempt not found' }, { status: 404 })
    }

    // ── Verify the booking exists ─────────────────────────────────────────
    const { data: booking, error: bookErr } = await service
      .from('bookings')
      .select('id, status, human_code, total_price')
      .eq('id', bookingId)
      .single()

    if (bookErr || !booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    const previousBookingId = str(payment as Record<string, unknown>, ['booking_id'])

    // ── Update payment_attempts.booking_id ────────────────────────────────
    const { error: updateErr } = await service
      .from('payment_attempts')
      .update({ booking_id: bookingId })
      .eq('id', paymentId)

    if (updateErr) {
      console.error('[reconcile] update_failed', { paymentId, message: updateErr.message })
      return NextResponse.json({ error: 'Failed to update payment record' }, { status: 500 })
    }

    // ── Log to admin_action_log ──────────────────────────────────────────
    try {
      await service.from('admin_action_log').insert({
        admin_id: admin.userId,
        admin_email: admin.email,
        action_type: 'payment_reconciled',
        target_table: 'payment_attempts',
        target_id: paymentId,
        before_jsonb: {
          booking_id: previousBookingId || null,
          status: str(payment as Record<string, unknown>, ['status']),
        },
        after_jsonb: {
          booking_id: bookingId,
          booking_status: str(booking as Record<string, unknown>, ['status']),
          booking_human_code: str(booking as Record<string, unknown>, ['human_code']),
        },
        risk_level: 'medium',
      })
    } catch (logErr) {
      console.warn('[reconcile] audit_log_write_failed', {
        paymentId,
        message: (logErr as Error).message,
      })
    }

    console.log('[reconcile] success', {
      paymentId,
      bookingId,
      adminId: admin.userId,
      previousBookingId: previousBookingId || null,
    })

    return NextResponse.json({
      success: true,
      paymentId,
      bookingId,
      previousBookingId: previousBookingId || null,
    })
  } catch (err) {
    const e = err as Error
    console.error('[reconcile] error', { message: e.message, stack: e.stack })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
