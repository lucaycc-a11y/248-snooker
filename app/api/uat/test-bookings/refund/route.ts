// POST /api/uat/test-bookings/refund — refund a single is_test booking.
//
// WHY THIS ROUTE EXISTS AT ALL
// Test bookings on UAT charge REAL money (shared production KPay merchant
// account), so an operator must be able to give it back without leaving dev2.
//
// It deliberately does NOT reimplement refunding: the money movement is
// KPayProvider.refund() (lib/payments/kpay.ts), the existing provider method
// that already builds and signs the /v1/refund call. This route is only the
// auth boundary, the is_test guard, and the audit trail around it.
//
// It also does NOT reuse /api/bookings/[id]/refund: that route is Stripe-only
// (stripe.refunds.create against data.stripe_payment_intent) and cannot refund a
// KPay charge, which is how every real payment here is taken. See the task
// report for this discrepancy.
//
// HARD GUARD: refuses any booking with is_test !== true. This endpoint must
// never become a way to refund a paying customer's booking.

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getServiceSupabase } from '@/lib/supabase/service'
import { getPaymentProvider } from '@/lib/payments'
import { requireActiveAdmin, getClientIp } from '@/lib/uat/admin-auth'
import { getHostname } from '@/lib/env/hostname'
import { logSiteError } from '@/lib/errors/log'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const auth = await requireActiveAdmin(supabase)
    if (!auth.isAdmin) {
      return NextResponse.json({ error: auth.error }, { status: 403 })
    }

    const body: unknown = await req.json().catch(() => null)
    if (typeof body !== 'object' || body === null) {
      return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
    }
    const { bookingId, reason } = body as Record<string, unknown>
    if (typeof bookingId !== 'string' || bookingId.trim() === '') {
      return NextResponse.json({ error: 'bookingId is required' }, { status: 400 })
    }

    const service = getServiceSupabase()

    const { data: booking, error: loadErr } = await service
      .from('bookings')
      .select('id, is_test, status, total_price, provider_order_no, refunded_at, human_code, user_id')
      .eq('id', bookingId)
      .maybeSingle()

    if (loadErr || !booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    const row = booking as {
      id: string
      is_test: boolean | null
      status: string
      total_price: number | null
      provider_order_no: string | null
      refunded_at: string | null
      human_code: string | null
      user_id: string
    }

    // ── The guard that makes this endpoint safe to expose ────────────────────
    if (row.is_test !== true) {
      console.warn('[uat/refund] blocked_non_test_booking', {
        bookingId,
        adminId: auth.user.id,
      })
      return NextResponse.json(
        { error: 'This endpoint only refunds is_test = true bookings' },
        { status: 403 },
      )
    }

    if (row.refunded_at) {
      return NextResponse.json({ error: 'Booking already refunded' }, { status: 409 })
    }

    // Fall back to the latest attempt's order number when the booking row does
    // not carry one (older rows stamped it only on the attempt).
    let providerOrderNo = row.provider_order_no
    let attemptId: string | null = null
    const { data: attempt } = await service
      .from('payment_attempts')
      .select('id, provider_order_no, status')
      .eq('booking_id', row.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (attempt) {
      const a = attempt as { id: string; provider_order_no: string | null }
      attemptId = a.id
      if (!providerOrderNo) providerOrderNo = a.provider_order_no
    }

    if (!providerOrderNo) {
      return NextResponse.json(
        { error: 'No KPay order reference on this booking — nothing was charged' },
        { status: 400 },
      )
    }

    const amount = row.total_price ?? 0
    if (amount <= 0) {
      return NextResponse.json({ error: 'Nothing to refund (total is 0)' }, { status: 400 })
    }

    // Hostname-scoped so a UAT charge is refunded with the same KPay credentials
    // that created it.
    const provider = getPaymentProvider(getHostname(req) ?? undefined)
    const result = await provider.refund({
      providerOrderNo,
      amount,
      reason:
        typeof reason === 'string' && reason.trim() !== ''
          ? reason.trim().slice(0, 200)
          : 'UAT test booking refund',
    })

    if (!result.success) {
      console.error('[uat/refund] kpay_refund_failed', {
        bookingId,
        providerOrderNo,
        message: result.message,
      })
      await logSiteError('uat/refund', 'error', 'KPay refund failed for test booking', {
        bookingId,
        providerOrderNo,
        message: result.message,
      })
      return NextResponse.json(
        { error: result.message ?? 'KPay refund failed' },
        { status: 502 },
      )
    }

    // Money moved — record it. Written after the provider call so the DB never
    // claims a refund KPay did not accept.
    const refundedAt = new Date().toISOString()
    const { error: updErr } = await service
      .from('bookings')
      .update({
        status: 'refunded',
        refunded_at: refundedAt,
        refund_amount: amount,
      })
      .eq('id', row.id)

    if (updErr) {
      // The money is already back with the customer; surface the mismatch loudly
      // rather than reporting a clean success.
      console.error('[uat/refund] db_update_failed_after_kpay_refund', {
        bookingId,
        message: updErr.message,
      })
      await logSiteError(
        'uat/refund',
        'error',
        'KPay refunded but booking row update failed — manual reconciliation',
        { bookingId, providerOrderNo, message: updErr.message },
      )
    }

    await service.from('audit_log').insert({
      admin_user_id: auth.user.id,
      admin_email: auth.user.email,
      action: 'refund_test_booking',
      target_table: 'bookings',
      target_id: row.id,
      before_value: {
        status: row.status,
        total_price: amount,
        refunded_at: null,
        payment_attempt_id: attemptId,
      },
      after_value: {
        status: updErr ? row.status : 'refunded',
        refund_amount: amount,
        refunded_at: refundedAt,
        provider_refund_no: result.providerRefundNo ?? null,
        payment_attempt_id: attemptId,
        db_update_failed: Boolean(updErr),
      },
      ip_address: getClientIp(req),
    })

    return NextResponse.json({
      success: true,
      bookingId: row.id,
      refundAmount: amount,
      providerRefundNo: result.providerRefundNo ?? null,
      ...(updErr ? { warning: 'Refund succeeded at KPay but the booking row did not update' } : {}),
    })
  } catch (error) {
    console.error('[uat/test-bookings/refund] error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
