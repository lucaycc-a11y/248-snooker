import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getServiceSupabase } from '@/lib/supabase/service'
import { getPaymentProvider } from '@/lib/payments'
import { humanReadableCode } from '@/lib/qr/jwt'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/checkout/status?bookingId=...
// Returns the KPay order status for a booking. Used by the UI to poll while
// waiting for the customer to complete payment (QR scan / H5 redirect).
//
// For grouped bookings, the primary bookingId is sufficient — all siblings
// share the same provider_order_no.
export async function GET(req: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const bookingId = new URL(req.url).searchParams.get('bookingId')
    if (!bookingId) {
      return NextResponse.json({ error: 'Missing bookingId' }, { status: 400 })
    }

    const service = getServiceSupabase()

    const { data: booking, error: bookingErr } = await service
      .from('bookings')
      .select('id, status, payment_provider, provider_order_no, payment_method, order_group_id, human_code, total_price, user_id')
      .eq('id', bookingId)
      .eq('user_id', user.id)
      .single()

    if (bookingErr || !booking) {
      console.log('[KPay] status: booking_not_found', { bookingId, userId: user.id })
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    const startedAt = Date.now()
    const logResult = (payload: Record<string, unknown>) => {
      console.log('[KPay] pollResult', { bookingId, elapsedMs: Date.now() - startedAt, ...payload })
    }

    // Slot-hold state drives the recovery screen: it decides whether "retry
    // payment" is still possible (hold alive) or the user must pick new slots
    // (hold gone), and supplies the countdown deadline. Only meaningful while
    // the booking is unresolved, so it's skipped on terminal states below.
    const holdState = async (): Promise<{ holdActive: boolean; holdExpiresAt: string | null }> => {
      const { data, error } = await service.rpc('checkout_hold_expiry', {
        p_booking_id: booking.id,
        p_user_id: user.id,
      })
      if (error || !data || typeof data !== 'object' || Array.isArray(data)) {
        // Unknown hold state must not imply an active hold — retry would then
        // re-create an order against slots someone else may already hold.
        if (error) console.error('[KPay] pollResult hold_expiry_failed', { message: error.message })
        return { holdActive: false, holdExpiresAt: null }
      }
      const record = data as Record<string, unknown>
      return {
        holdActive: record.hold_active === true,
        holdExpiresAt: typeof record.expires_at === 'string' ? record.expires_at : null,
      }
    }

    // If the booking is already confirmed server-side (webhook fired), short-circuit
    if (booking.status === 'confirmed') {
      logResult({ status: 'confirmed', providerStatus: 'success' })
      return NextResponse.json({
        bookingId: booking.id,
        status: 'confirmed',
        providerStatus: 'success',
      })
    }

    if (booking.status === 'cancelled' || booking.status === 'expired') {
      logResult({ status: booking.status, providerStatus: booking.status })
      return NextResponse.json({
        bookingId: booking.id,
        status: booking.status,
        providerStatus: booking.status === 'cancelled' ? 'cancelled' : booking.status,
        holdActive: false,
        holdExpiresAt: null,
      })
    }

    // payment_failed is recoverable, so it reports hold state — the UI needs it
    // to decide between "retry payment" and "back to slot selection".
    if (booking.status === 'payment_failed') {
      const hold = await holdState()
      logResult({ status: booking.status, providerStatus: booking.status, holdActive: hold.holdActive })
      return NextResponse.json({
        bookingId: booking.id,
        status: booking.status,
        providerStatus: booking.status,
        holdActive: hold.holdActive,
        holdExpiresAt: hold.holdExpiresAt,
      })
    }

    const hold = await holdState()

    // No provider order yet — the order hasn't been created
    if (!booking.provider_order_no || booking.payment_provider !== 'kpay') {
      logResult({ status: booking.status === 'pending' ? 'pending' : 'failed', providerStatus: 'pending', holdActive: hold.holdActive })
      return NextResponse.json({
        bookingId: booking.id,
        status: booking.status === 'pending' ? 'pending' : 'failed',
        providerStatus: 'pending',
        holdActive: hold.holdActive,
        holdExpiresAt: hold.holdExpiresAt,
      })
    }

    // Query the payment provider for current order status.
    // Use the booking's stored method so the query signs with the right
    // merchant context; the provider is KPay here (checked above).
    const provider = getPaymentProvider()
    const orderStatus = await provider.queryOrder(booking.provider_order_no)

    // Provider success is not database confirmation. The webhook still needs to
    // commit the booking transition and generate the booking credentials.
    // PROACTIVE CONFIRMATION: When the provider reports success but the DB
    // booking isn't confirmed yet, call confirm_booking/confirm_booking_group
    // directly. This makes polling self-healing — if the webhook is delayed or
    // never arrives, the booking still gets finalized. The RPC is idempotent,
    // so a concurrent webhook call is safe.
    let uiStatus: string
    switch (orderStatus.status) {
      case 'success':
        if (booking.status !== 'confirmed') {
          try {
            if (booking.order_group_id) {
              // Grouped booking: confirm every row atomically
              const { data: rows, error: rowsErr } = await service
                .from('bookings')
                .select('id, total_price')
                .eq('order_group_id', booking.order_group_id)

              if (!rowsErr && rows && rows.length > 0) {
                const qrCodes: Record<string, string> = {}
                for (const r of rows) {
                  qrCodes[r.id] = humanReadableCode(r.id)
                }
                console.log('[KPay] proactive confirm_booking_group', {
                  orderGroupId: booking.order_group_id,
                  bookings: rows.length,
                  providerOrderNo: booking.provider_order_no,
                })
                await service.rpc('confirm_booking_group', {
                  p_order_group_id: booking.order_group_id,
                  p_payment_intent_id: booking.provider_order_no,
                  p_payment_method: booking.payment_method,
                  p_qr_codes: qrCodes,
                  p_event_id: null,
                })
              }
            } else {
              // Single booking
              const humanCode = booking.human_code ?? humanReadableCode(booking.id)
              console.log('[KPay] proactive confirm_booking', {
                bookingId: booking.id,
                providerOrderNo: booking.provider_order_no,
              })
              await service.rpc('confirm_booking', {
                p_booking_id: booking.id,
                p_payment_intent_id: booking.provider_order_no,
                p_payment_method: booking.payment_method,
                p_qr_code: humanCode,
                p_event_id: null,
              })
            }
            // Re-read the booking to return the now-confirmed status
            const { data: refreshed } = await service
              .from('bookings')
              .select('status')
              .eq('id', booking.id)
              .single()
            if (refreshed?.status === 'confirmed') {
              // Send confirmation notification (non-fatal, same as webhook).
              // The webhook may also fire and send a duplicate — that's
              // acceptable; a missed notification is worse than a double email.
              try {
                const { sendBookingConfirmation } = await import('@/lib/resend/template-send')
                await sendBookingConfirmation(booking.id)
                await service.from('notification_log').insert([
                  { user_id: booking.user_id, booking_id: booking.id, channel: 'email', type: 'booking_confirmed', status: 'sent' },
                  { user_id: booking.user_id, booking_id: booking.id, channel: 'whatsapp', type: 'booking_confirmed', status: 'pending' },
                ])
              } catch (e) {
                console.error('[KPay] proactive confirmation notification_failed', {
                  bookingId: booking.id,
                  message: (e as Error).message,
                })
              }
              // Mark payment attempt succeeded (non-fatal).
              try {
                await service.rpc('complete_payment_attempt', {
                  p_provider_order_no: booking.provider_order_no,
                  p_provider: 'kpay',
                })
              } catch {
                // non-fatal
              }
              logResult({ status: 'confirmed', providerStatus: 'success' })
              return NextResponse.json({
                bookingId: booking.id,
                status: 'confirmed',
                providerStatus: 'success',
              })
            }
          } catch (e) {
            // Proactive confirmation failed — fall through to pending_confirmation
            // and let the webhook retry. Log the error for debugging.
            console.error('[KPay] proactive confirmation failed', {
              bookingId: booking.id,
              error: (e as Error).message,
            })
          }
        }
        uiStatus = 'pending_confirmation'
        break
      case 'failed':
        uiStatus = 'failed'
        break
      case 'cancelled':
        uiStatus = 'cancelled'
        break
      case 'closed':
        uiStatus = 'failed'
        break
      case 'refunded':
        uiStatus = 'refunded'
        break
      default:
        uiStatus = 'pending'
    }

    logResult({ status: uiStatus, providerStatus: orderStatus.status })

    return NextResponse.json({
      bookingId: booking.id,
      status: uiStatus,
      providerStatus: orderStatus.status,
      holdActive: hold.holdActive,
      holdExpiresAt: hold.holdExpiresAt,
      rawStatus: orderStatus.rawStatus,
      ...(orderStatus.failureCode ? { failureCode: orderStatus.failureCode } : {}),
      ...(orderStatus.failureReason ? { failureReason: orderStatus.failureReason } : {}),
    })
  } catch (err) {
    const e = err as Error
    console.error('[KPay] pollResult error', { message: e.message, stack: e.stack })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}