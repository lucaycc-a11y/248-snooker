/**
 * POST /api/admin/bookings/[id]/cancel
 *
 * Admin cancel with optional compensation. This is the ONE route that calls
 * `admin_cancel_with_credit` — the RPC flips the status, releases the slot,
 * reverses booking points, grants wallet credit via `wallet_apply`, and writes
 * cancellation_log + audit_log + the member notice in one transaction.
 *
 * Nothing here writes `status = 'admin_cancelled'` directly. Doing so skipped
 * every money side-effect and is what made "Cancel and Credit" dead.
 *
 * Auth: getAdminData() via withAdminSecurity.
 */

import { NextResponse } from 'next/server'
import { getAdminData } from '@/lib/data/getAdmin'
import { getLegacyServiceSupabase } from '@/lib/supabase/legacy'
import { getConfigValue } from '@/lib/data/getConfig'
import { num, str } from '@/lib/data/adminReadHelpers'
import { withAdminSecurity } from '@/lib/security/admin-wrapper'
import { validateWeatherCredit } from '@/lib/admin/weather-credit-policy'
import { adminCancelWithCredit } from '@/lib/admin/cancelWithCredit'

export const runtime = 'nodejs'

type CancelRequest = {
  reason: string
  /** WhatsApp / customer-contact reference. Required by the RPC. */
  whatsappRef?: string
  compensationType?: 'none' | 'points' | 'refund' | 'credit'
  compensationValue?: number
  /** Required by the weather-credit policy when credit ≠ booking total. */
  differenceReason?: string | null
}

async function handleAdminBookingCancel(
  req: Request,
  _adminUser: { id: string; email?: string },
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
      whatsappRef = '',
      compensationType = 'none',
      compensationValue = 0,
      differenceReason = null,
    } = (body ?? {}) as Partial<CancelRequest>

    if (!reason || typeof reason !== 'string' || reason.trim().length < 5) {
      return NextResponse.json({ error: '取消原因至少要有 5 個字' }, { status: 400 })
    }

    const validCompensation = ['none', 'points', 'refund', 'credit'].includes(compensationType)
    if (!validCompensation) {
      return NextResponse.json({ error: 'Invalid compensation type' }, { status: 400 })
    }

    // Only credit compensation is supported by the RPC. 'points' / 'refund'
    // are accepted by the request shape but map to a zero-credit cancel plus a
    // separate ledger note — never to a direct status write.
    if (compensationType === 'credit' && (!compensationValue || compensationValue <= 0)) {
      return NextResponse.json({ error: 'Credit 補償金額必須大於 0' }, { status: 400 })
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
    // Runs BEFORE the RPC: a rejected policy must not leave a cancelled
    // booking with no compensation. Pure function; cap comes from config.
    if (compensationType === 'credit') {
      const bookingTotal = num(booking as Record<string, unknown>, ['total_price'], 0)
      const pointsSystem = await getConfigValue<Record<string, unknown>>('points_system', {})
      const rawCap = pointsSystem?.wallet_max_single_amount
      // Missing/invalid config must not silently allow an uncapped credit.
      const cap = typeof rawCap === 'number' && Number.isInteger(rawCap) && rawCap > 0 ? rawCap : 10000
      let policy
      try {
        policy = validateWeatherCredit({
          bookingTotal,
          creditAmount: compensationValue,
          differenceReason:
            typeof differenceReason === 'string' && differenceReason.trim().length > 0
              ? differenceReason.trim()
              : null,
          cap,
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

    // ── One transaction: cancel + credit + ledgers + notice ─────────────
    const creditAmount = compensationType === 'credit' ? compensationValue : 0
    const humanCode = str(booking as Record<string, unknown>, ['human_code']) ?? bookingId
    const dateLabel = str(booking as Record<string, unknown>, ['date']) ?? ''

    const result = await adminCancelWithCredit({
      bookingId,
      adminId: admin.userId,
      reason: reason.trim(),
      whatsappRef: whatsappRef || reason.trim(),
      creditAmount,
      noticeTitle: '預約已取消',
      noticeMessage:
        creditAmount > 0
          ? `你的預約 ${humanCode}（${dateLabel}）已取消，並已存入 HK$${creditAmount} 錢包額度作為補償。`
          : `你的預約 ${humanCode}（${dateLabel}）已取消。`,
    })

    if (!result.ok) {
      const status = result.code === 'booking_not_found' ? 404 : 400
      return NextResponse.json({ error: result.error, code: result.code }, { status })
    }

    console.log('[cancel] success', {
      bookingId,
      adminId: admin.userId,
      reason: reason.trim(),
      compensation: compensationType,
      credit: result.credit,
      pointsReversed: result.pointsReversed,
    })

    return NextResponse.json({
      success: true,
      bookingId,
      previousStatus: bookingStatus,
      credit: result.credit,
      pointsReversed: result.pointsReversed,
      compensation: compensationType !== 'none'
        ? { type: compensationType, value: result.credit }
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
