import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getServiceSupabase } from '@/lib/supabase/service'
import { getStripe } from '@/lib/stripe/server'
import { rateLimit } from '@/lib/rate-limit'

export const runtime = 'nodejs'

// POST /api/bookings/[id]/refund
// Self-serve partial refund (price minus Stripe's processing fee), blocked
// inside the config-driven cutoff window before start_time. DB-first ordering:
// request_booking_refund() commits the DB refund (status, points, slot) in one
// Postgres transaction FIRST, then Stripe is called to move the money. If
// Stripe fails after that, the member-facing state is still correct (slot
// released, points reversed) — only the money hasn't moved, which is logged
// loudly for manual reconciliation rather than auto-compensated.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const allowed = await rateLimit('booking_refund', `user:${user.id}`, 10, 60)
    if (!allowed) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    }

    const bookingId = params.id
    const body = await req.json().catch(() => null)
    const reason =
      typeof body?.reason === 'string' && body.reason.trim() !== ''
        ? body.reason.slice(0, 500)
        : null

    const service = getServiceSupabase()

    // Ownership check BEFORE calling the RPC — the RPC is service_role-only and
    // trusts the caller scoped the booking id correctly; this route is the auth
    // boundary. 404 (not 403) for someone else's booking, matching the existing
    // getMemberTicket convention of treating "not owned" as "not found".
    const { data: owned } = await service
      .from('bookings')
      .select('id, user_id')
      .eq('id', bookingId)
      .maybeSingle()
    if (!owned || owned.user_id !== user.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const { data, error } = await service.rpc('request_booking_refund', {
      p_booking_id: bookingId,
      p_reason: reason,
    })
    if (error) {
      const code = (error as { code?: string }).code
      if (code === 'P0001') {
        return NextResponse.json(
          { error: 'Refund window closed', reason: 'cutoff_closed' },
          { status: 409 },
        )
      }
      console.error('[bookings/refund] rpc_error', { message: error.message, code, bookingId })
      return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }
    if (!data?.success) {
      return NextResponse.json(
        { error: 'Refund not allowed', reason: data?.reason ?? 'not_refundable' },
        { status: 400 },
      )
    }

    // ── DB refund committed. Now move the money. ──────────────────────
    try {
      const stripe = getStripe()
      await stripe.refunds.create({
        payment_intent: data.stripe_payment_intent,
        amount: Math.round(data.refund_amount * 100), // HK$ → cents
      })
    } catch (stripeErr) {
      console.error('[bookings/refund] stripe_refund_failed_after_db_commit', {
        bookingId,
        refundAmount: data.refund_amount,
        paymentIntentId: data.stripe_payment_intent,
        message: (stripeErr as Error).message,
      })
      return NextResponse.json(
        {
          error: 'refund_pending_manual_review',
          detail: 'Booking refunded in our system; the money transfer needs manual reconciliation.',
        },
        { status: 500 },
      )
    }

    // Email (non-fatal) — mirrors the webhook's "send then log" pattern.
    try {
      const { data: profile } = await service
        .from('users')
        .select('name, preferred_locale')
        .eq('id', user.id)
        .single()
      const { data: bookingRow } = await service
        .from('bookings')
        .select('date, start_time, end_time, table_number')
        .eq('id', bookingId)
        .single()

      if (profile?.name && bookingRow) {
        const { sendBookingRefundedEmail } = await import('@/lib/resend/send')
        await sendBookingRefundedEmail({
          to: user.email ?? '',
          booking: {
            id: bookingId,
            date: bookingRow.date,
            start_time: bookingRow.start_time,
            end_time: bookingRow.end_time,
            table_number: bookingRow.table_number,
          },
          originalPrice: data.original_price,
          refundFee: data.refund_fee,
          refundAmount: data.refund_amount,
          cancellationReason: reason,
          customerName: profile.name,
          locale: (profile.preferred_locale as 'zh-HK' | 'zh-CN' | 'en' | 'ja') || 'zh-HK',
        })
      }
    } catch (e) {
      console.error('[bookings/refund] email_failed', { message: (e as Error).message, bookingId })
    }

    return NextResponse.json({
      success: true,
      bookingId,
      refundAmount: data.refund_amount,
      refundFee: data.refund_fee,
      originalPrice: data.original_price,
    })
  } catch (err) {
    console.error('[bookings/refund] error', { message: (err as Error).message })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
