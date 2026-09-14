// Dev2 Panel: Test Booking Operations
// List test bookings and refund them

import { NextRequest, NextResponse } from 'next/server'
import { getAdminData } from '@/lib/data/getAdmin'
import { getServiceSupabase } from '@/lib/supabase/service'
import { getPaymentProvider } from '@/lib/payments'

export const runtime = 'nodejs'

// GET - List recent test bookings
export async function GET(req: NextRequest) {
  const admin = await getAdminData()
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const onlyMine = searchParams.get('onlyMine') === 'true'

    const service = getServiceSupabase()

    let query = service
      .from('bookings')
      .select('id, date, start_time, end_time, table_number, status, total_price, user_id, created_at')
      .eq('is_test', true)
      .order('created_at', { ascending: false })
      .limit(50)

    if (onlyMine) {
      query = query.eq('user_id', admin.userId)
    }

    const { data: bookings, error } = await query

    if (error) throw error

    // Get payment status for each booking
    const bookingIds = (bookings || []).map((b) => b.id)
    const { data: payments } = await service
      .from('payment_attempts')
      .select('booking_id, status, method')
      .in('booking_id', bookingIds)

    const paymentMap = new Map(
      (payments || []).map((p) => [p.booking_id, { status: p.status, method: p.method }])
    )

    return NextResponse.json({
      bookings: (bookings || []).map((b) => ({
        id: b.id,
        date: b.date,
        startTime: b.start_time,
        endTime: b.end_time,
        tableNumber: b.table_number,
        status: b.status,
        totalPrice: b.total_price,
        userId: b.user_id,
        createdAt: b.created_at,
        paymentStatus: paymentMap.get(b.id)?.status || 'unknown',
        paymentMethod: paymentMap.get(b.id)?.method || null,
      })),
    })
  } catch (error) {
    console.error('[dev2/test-bookings] GET error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// POST - Refund a test booking
export async function POST(req: NextRequest) {
  const admin = await getAdminData()
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const { bookingId, confirmation } = body

    if (!bookingId) {
      return NextResponse.json({ error: 'bookingId required' }, { status: 400 })
    }

    if (confirmation !== 'REFUND') {
      return NextResponse.json({ error: 'Invalid confirmation' }, { status: 400 })
    }

    const service = getServiceSupabase()

    // Verify it's a test booking
    const { data: booking } = await service
      .from('bookings')
      .select('id, is_test, status, total_price')
      .eq('id', bookingId)
      .single()

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    if (!booking.is_test) {
      return NextResponse.json({ error: 'Not a test booking' }, { status: 400 })
    }

    if (booking.status === 'refunded') {
      return NextResponse.json({ error: 'Already refunded' }, { status: 409 })
    }

    // Get payment attempt to find the provider payment ID
    const { data: payment } = await service
      .from('payment_attempts')
      .select('provider_payment_id, provider_order_no, method')
      .eq('booking_id', bookingId)
      .eq('status', 'succeeded')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!payment?.provider_order_no) {
      return NextResponse.json({ error: 'No successful payment found' }, { status: 404 })
    }

    // Execute refund via payment provider
    const hostname = req.headers.get('host') || undefined
    const provider = getPaymentProvider(hostname)

    const refundResult = await provider.refund({
      providerOrderNo: payment.provider_order_no,
      amount: booking.total_price,
      reason: 'Test booking refund via dev2 panel',
    })

    if (!refundResult.success) {
      return NextResponse.json(
        {
          error: 'Refund failed',
          detail: refundResult.message || 'Unknown error',
        },
        { status: 500 }
      )
    }

    // Update booking status
    await service.from('bookings').update({ status: 'refunded' }).eq('id', bookingId)

    // Write audit log
    await service.from('audit_log').insert({
      admin_user_id: admin.userId,
      admin_email: admin.email,
      action: 'refund_test_booking',
      target_table: 'bookings',
      target_id: bookingId,
      before_value: { status: booking.status },
      after_value: { status: 'refunded', refund_amount: booking.total_price },
    })

    return NextResponse.json({
      success: true,
      refundId: refundResult.providerRefundNo,
      amount: booking.total_price,
    })
  } catch (error) {
    console.error('[dev2/test-bookings] POST error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// DELETE - Delete own test bookings
export async function DELETE(req: NextRequest) {
  const admin = await getAdminData()
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const service = getServiceSupabase()

    // Delete only this admin's test bookings
    const { data: deleted, error } = await service
      .from('bookings')
      .delete()
      .eq('is_test', true)
      .eq('user_id', admin.userId)
      .select('id')

    if (error) throw error

    // Write audit log
    await service.from('audit_log').insert({
      admin_user_id: admin.userId,
      admin_email: admin.email,
      action: 'delete_own_test_bookings',
      target_table: 'bookings',
      target_id: null,
      before_value: null,
      after_value: { deleted_count: deleted?.length || 0, deleted_ids: deleted?.map((d) => d.id) },
    })

    return NextResponse.json({
      success: true,
      deletedCount: deleted?.length || 0,
    })
  } catch (error) {
    console.error('[dev2/test-bookings] DELETE error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
