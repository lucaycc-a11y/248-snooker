/**
 * POST /api/admin/bookings/[id]/cancel
 *
 * Admin-only: cancel a booking, optionally with compensation (points or waived).
 * Modeled after the existing executeCancelBooking in lib/admin/actionExecutor.ts
 * but as a direct REST endpoint (not via AI pending_action flow).
 *
 * No real KPay refund this phase — only waive; function signature
 * pre-designed for future refund integration.
 *
 * Auth: getAdminData() guard.
 */

import { NextResponse } from 'next/server'
import { getAdminData } from '@/lib/data/getAdmin'
import { getLegacyServiceSupabase } from '@/lib/supabase/legacy'
import { num, str } from '@/lib/data/adminReadHelpers'
import { withAdminSecurity } from '@/lib/security/admin-wrapper'
import { validateWeatherCredit } from '@/lib/admin/weather-credit-policy'

export const runtime = 'nodejs'

type CancelRequest = {
  reason: string
  compensationType?: 'none' | 'points' | 'refund' | 'credit'
  compensationValue?: number
  /** Required by the weather-credit policy when credit ≠ booking total. */
  differenceReason?: string | null
}

async function handleAdminBookingCancel(
  req: Request,
  adminUser: { id: string; email?: string },
  context?: { params: Record<string, string> }
) {
  try {
    const admin = await getAdminData()
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized — admin only' }, { status: 401 })
    }

    const bookingId = context?.params?.id
    if (!bookingId || typeof bookingId !== 'string') {
      return NextResponse.json({ error: 'Invalid booking ID' }, { status: 400 })
    }

    const body = await req.json().catch(() => null)
    const {
      reason,
      compensationType = 'none',
      compensationValue = 0,
      differenceReason = null,
    } = (body ?? {}) as Partial<CancelRequest>

    if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
      return NextResponse.json({ error: 'Cancellation reason is required' }, { status: 400 })
    }

    const validCompensation = ['none', 'points', 'refund', 'credit'].includes(compensationType)
    if (!validCompensation) {
      return NextResponse.json({ error: 'Invalid compensation type' }, { status: 400 })
    }

    // Points compensation must have a positive value
    if (compensationType === 'points' && (!compensationValue || compensationValue <= 0)) {
      return NextResponse.json({ error: 'Points compensation must be positive' }, { status: 400 })
    }

    // Credit compensation must have a positive value
    if (compensationType === 'credit' && (!compensationValue || compensationValue <= 0)) {
      return NextResponse.json({ error: 'Credit compensation must be positive' }, { status: 400 })
    }

    const service = getLegacyServiceSupabase()

    // ── Fetch booking ──────────────────────────────────────────────────
    const { data: booking, error: fetchErr } = await service
      .from('bookings')
      .select('id, user_id, status, total_price, date, start_time, table_number, human_code')
      .eq('id', bookingId)
      .single()

    if (fetchErr || !booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    const bookingStatus = str(booking as Record<string, unknown>, ['status'])
    if (bookingStatus === 'cancelled' || bookingStatus === 'admin_cancelled') {
      return NextResponse.json({ error: 'Booking is already cancelled' }, { status: 400 })
    }

    // ── Weather-credit policy gate ─────────────────────────────────────
    // Runs BEFORE the status flip: a rejected policy must not leave a
    // cancelled booking with no compensation. Pure function, no DB reads.
    // Currently unimplemented by design — see lib/admin/weather-credit-policy.ts.
    if (compensationType === 'credit') {
      const bookingTotal = num(booking as Record<string, unknown>, ['total_price'], 0)
      let policy
      try {
        policy = validateWeatherCredit({
          bookingTotal,
          creditAmount: compensationValue,
          differenceReason:
            typeof differenceReason === 'string' && differenceReason.trim().length > 0
              ? differenceReason.trim()
              : null,
          adminRole: admin.role,
        })
      } catch (policyErr) {
        const message =
          policyErr instanceof Error ? policyErr.message : 'Credit policy unavailable'
        return NextResponse.json({ error: message }, { status: 503 })
      }
      if (!policy.ok) {
        return NextResponse.json({ error: policy.error }, { status: 400 })
      }
    }

    // ── Update booking status ──────────────────────────────────────────
    const { error: updateErr } = await service
      .from('bookings')
      .update({ status: 'admin_cancelled' })
      .eq('id', bookingId)

    if (updateErr) {
      console.error('[cancel] update_failed', { bookingId, message: updateErr.message })
      return NextResponse.json({ error: 'Failed to cancel booking' }, { status: 500 })
    }

    // ── Log to cancellation_log ────────────────────────────────────────
    try {
      await service.from('cancellation_log').insert({
        booking_id: bookingId,
        admin_id: admin.userId,
        reason: reason.trim(),
        compensation_type: compensationType,
        compensation_value:
          compensationType === 'points' || compensationType === 'credit'
            ? compensationValue
            : 0,
      })
    } catch (logErr) {
      // Non-fatal — cancellation_log migration may not have run yet
      console.warn('[cancel] cancellation_log_insert_failed', {
        bookingId,
        message: (logErr as Error).message,
      })
    }

    // ── Handle points compensation ─────────────────────────────────────
    if (compensationType === 'points' && compensationValue > 0) {
      const userId = str(booking as Record<string, unknown>, ['user_id'])
      if (userId) {
        // Read current points
        const { data: user } = await service
          .from('users')
          .select('points')
          .eq('id', userId)
          .single()

        const currentPoints = num(user ?? {}, ['points'], 0)
        const newPoints = currentPoints + compensationValue

        await service
          .from('users')
          .update({ points: newPoints })
          .eq('id', userId)

        // Log to points_ledger
        try {
          await service.from('points_ledger').insert({
            user_id: userId,
            points: compensationValue,
            type: 'cancellation_compensation',
            reason: `Cancellation compensation for booking ${bookingId}: ${reason.trim()}`,
            admin_action: true,
          })
        } catch (ledgerErr) {
          console.warn('[cancel] points_ledger_insert_failed', {
            bookingId,
            message: (ledgerErr as Error).message,
          })
        }
      }
    }

    // ── Handle credit compensation ─────────────────────────────────────
    // credits_ledger.type is CHECK-constrained to CREDITS_LEDGER_TYPES —
    // 'manual' is the only legal value for an admin-granted credit.
    if (compensationType === 'credit' && compensationValue > 0) {
      const userId = str(booking as Record<string, unknown>, ['user_id'])
      if (userId) {
        const { data: ledgerRows } = await service
          .from('credits_ledger')
          .select('amount')
          .eq('user_id', userId)

        const balance = (ledgerRows ?? []).reduce(
          (sum, r) => sum + num(r as Record<string, unknown>, ['amount'], 0),
          0,
        )
        const balanceAfter = balance + compensationValue

        const { error: creditErr } = await service.from('credits_ledger').insert({
          user_id: userId,
          amount: compensationValue,
          balance_after: balanceAfter,
          type: 'manual',
          note: `Weather cancellation credit for booking ${bookingId}: ${reason.trim()}`,
          actor_id: admin.userId,
        })
        if (creditErr) {
          console.error('[cancel] credits_ledger_insert_failed', {
            bookingId,
            message: creditErr.message,
          })
          return NextResponse.json({ error: 'Failed to grant credit' }, { status: 500 })
        }
      }
    }

    // ── Log to admin_action_log ────────────────────────────────────────
    try {
      await service.from('admin_action_log').insert({
        admin_id: admin.userId,
        admin_email: admin.email,
        action_type: 'booking_cancelled',
        target_table: 'bookings',
        target_id: bookingId,
        before_jsonb: {
          status: bookingStatus,
          total_price: booking.total_price,
          date: booking.date,
          start_time: booking.start_time,
          table_number: booking.table_number,
          human_code: booking.human_code,
        },
        after_jsonb: {
          status: 'admin_cancelled',
          reason: reason.trim(),
          compensation_type: compensationType,
          compensation_value:
            compensationType === 'points' || compensationType === 'credit'
              ? compensationValue
              : 0,
          difference_reason: compensationType === 'credit' ? differenceReason : null,
        },
        risk_level: 'high',
        confirmed_by: admin.userId,
      })
    } catch (logErr) {
      console.warn('[cancel] audit_log_write_failed', {
        bookingId,
        message: (logErr as Error).message,
      })
    }

    console.log('[cancel] success', {
      bookingId,
      adminId: admin.userId,
      reason: reason.trim(),
      compensation: compensationType,
    })

    return NextResponse.json({
      success: true,
      bookingId,
      previousStatus: bookingStatus,
      compensation: compensationType !== 'none'
        ? { type: compensationType, value: compensationValue }
        : null,
    })
  } catch (err) {
    const e = err as Error
    console.error('[cancel] error', { message: e.message, stack: e.stack })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// Export with admin security wrapper: auth + admin role check + CSRF + rate limiting
export const POST = withAdminSecurity(handleAdminBookingCancel, {
  rateLimit: {
    bucket: 'admin_booking_cancel',
    max: 30,
    windowSeconds: 60,
  },
})
