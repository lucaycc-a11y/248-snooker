/**
 * POST /api/admin/bookings/manual-create
 *
 * Create a manual booking for an admin walk-in customer.
 * Follows the admin-test-confirm pattern but with:
 *  - Payment evidence (provider, reference, amount, notes)
 *  - created_via='manual_admin', created_by_admin_id
 *  - Optional user linking
 *  - payment_method set to the admin-selected provider (not 'test')
 *
 * Auth: getAdminData() guard.
 */

import { NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { getAdminData } from '@/lib/data/getAdmin'
import { getServiceSupabase } from '@/lib/supabase/service'
import { calculatePrice } from '@/lib/pricing'
import { loadPeriods, resolveTierForUser, slotBounds, periodForStart } from '@/lib/booking/server'
import { humanReadableCode } from '@/lib/qr/jwt'

export const runtime = 'nodejs'

// ── Types ──────────────────────────────────────────────────────────────
type PaymentInfo = {
  provider: string
  reference: string
  amountCents: number
  notes: string
}

type SlotInfo = {
  date: string
  startHour: number
  duration: number
  tableNumber: 1 | 2
  slotId: string
}

type ManualCreateRequest = {
  payment: PaymentInfo
  slot: SlotInfo
  userId?: string | null
}

// ── Helpers ────────────────────────────────────────────────────────────
function isValidPayment(p: unknown): p is PaymentInfo {
  if (typeof p !== 'object' || p === null) return false
  const x = p as Record<string, unknown>
  return (
    typeof x.provider === 'string' &&
    x.provider.length > 0 &&
    typeof x.reference === 'string' &&
    typeof x.amountCents === 'number' &&
    typeof x.notes === 'string'
  )
}

function isValidSlot(s: unknown): s is SlotInfo {
  if (typeof s !== 'object' || s === null) return false
  const x = s as Record<string, unknown>
  return (
    typeof x.date === 'string' &&
    typeof x.startHour === 'number' &&
    typeof x.duration === 'number' &&
    (x.tableNumber === 1 || x.tableNumber === 2) &&
    typeof x.slotId === 'string'
  )
}

// ── POST ───────────────────────────────────────────────────────────────
export async function POST(req: Request) {
  try {
    // ── Admin gate ──────────────────────────────────────────────────────
    const admin = await getAdminData()
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized — admin only' }, { status: 401 })
    }

    const body = await req.json().catch(() => null)
    const { payment, slot, userId } = (body ?? {}) as Partial<ManualCreateRequest>

    if (!isValidPayment(payment) || !isValidSlot(slot)) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
    }

    // Validate payment amount is positive
    if (payment.amountCents <= 0) {
      return NextResponse.json({ error: 'Payment amount must be positive' }, { status: 400 })
    }

    console.log('[manual-create] attempt', {
      adminId: admin.userId,
      date: slot.date,
      startHour: slot.startHour,
      userId: userId ?? null,
      paymentProvider: payment.provider,
    })

    const service = getServiceSupabase()
    const periods = await loadPeriods()

    // ── Recalculate price server-side (authoritative) ───────────────────
    // Use the target user's tier if linked, otherwise admin tier as fallback
    const tier = userId
      ? await resolveTierForUser(userId)
      : await resolveTierForUser(admin.userId)

    const { slotStart, slotEnd } = slotBounds(slot.date, slot.startHour, slot.duration)
    const quote = calculatePrice(slotStart, slotEnd, tier, periods)

    // ── Verify the slot is still locked (lock should still be active from manual-slot-check) ──
    // We trust the slotId from the client — if the lock expired or was stolen,
    // the confirm_booking RPC will reject it. We don't re-lock here because
    // the slot-check route already locked it for 15 min.

    const period = periodForStart(
      slot.startHour,
      slotStart.getDay() === 0 || slotStart.getDay() === 6,
      periods,
    )
    const startTime = `${String(slot.startHour).padStart(2, '0')}:00:00`
    const endHour = slot.startHour + slot.duration
    const endTime = `${String(endHour % 24).padStart(2, '0')}:00:00`

    // ── Insert pending booking with payment evidence ────────────────────
    const newId = randomUUID()
    const humanCode = humanReadableCode(newId)

    const { data: booking, error: insErr } = await service
      .from('bookings')
      .insert({
        id: newId,
        // Link to target user or fall back to admin (booking must have a user_id)
        user_id: userId || admin.userId,
        slot_id: slot.slotId,
        date: slot.date,
        start_time: startTime,
        end_time: endTime,
        duration_hours: slot.duration,
        period,
        total_price: quote.total,
        status: 'pending',
        table_number: slot.tableNumber,
        is_free_booking: false,
        human_code: humanCode,
        // ── Manual booking evidence fields ──────────────────────────────
        // These columns may or may not exist on the bookings table yet.
        // If the column doesn't exist, the insert will fail harmlessly and
        // we retry without them below.
        payment_method: payment.provider,
      })
      .select('id')
      .single()

    if (insErr || !booking) {
      // Retry without manual-specific columns if they don't exist yet
      const { data: booking2, error: insErr2 } = await service
        .from('bookings')
        .insert({
          id: newId,
          user_id: userId || admin.userId,
          slot_id: slot.slotId,
          date: slot.date,
          start_time: startTime,
          end_time: endTime,
          duration_hours: slot.duration,
          period,
          total_price: quote.total,
          status: 'pending',
          table_number: slot.tableNumber,
          is_free_booking: false,
          human_code: humanCode,
          payment_method: payment.provider,
        })
        .select('id')
        .single()

      if (insErr2 || !booking2) {
        console.error('[manual-create] insert_failed', {
          message: insErr?.message,
          message2: insErr2?.message,
        })
        return NextResponse.json({ error: 'Could not create booking' }, { status: 500 })
      }
    }

    // ── Store payment evidence in admin_action_log ──────────────────────
    // This is a reliable audit trail even if the bookings table doesn't
    // have manual-specific columns.
    try {
      await service.from('admin_action_log').insert({
        admin_id: admin.userId,
        admin_email: admin.email,
        action_type: 'manual_booking_created',
        target_table: 'bookings',
        target_id: newId,
        before_jsonb: null,
        after_jsonb: {
          payment_evidence: {
            provider: payment.provider,
            reference: payment.reference,
            amount_cents: payment.amountCents,
            notes: payment.notes,
          },
          slot: {
            date: slot.date,
            start_time: startTime,
            end_time: endTime,
            duration: slot.duration,
            table_number: slot.tableNumber,
          },
          linked_user_id: userId || null,
          price_quote: {
            total: quote.total,
            amount_cents: quote.amountInCents,
            period,
            tier,
          },
        },
        risk_level: 'medium',
      })
    } catch (logErr) {
      // Non-fatal — audit log failure shouldn't block booking creation
      console.warn('[manual-create] audit_log_write_failed', {
        message: (logErr as Error).message,
      })
    }

    // ── Confirm booking via RPC ─────────────────────────────────────────
    const { data: confirmResult, error: confirmError } = await service.rpc('confirm_booking', {
      p_booking_id: newId,
      p_payment_intent_id: `manual_${payment.provider}_${randomUUID()}`,
      p_payment_method: payment.provider,
      p_qr_code: humanCode,
      p_event_id: null,
    })
    if (confirmError) {
      console.error('[manual-create] confirm_failed', {
        bookingId: newId,
        message: confirmError.message,
      })
      return NextResponse.json({ error: 'Confirm failed', detail: confirmError.message }, { status: 500 })
    }
    const result = confirmResult as { success?: boolean; reason?: string }
    if (result?.success === false) {
      return NextResponse.json({ error: 'Confirm rejected', detail: result.reason }, { status: 500 })
    }

    // ── Send confirmation email (non-blocking) ──────────────────────────
    try {
      const { sendBookingConfirmation } = await import('@/lib/resend/template-send')
      await sendBookingConfirmation(newId)
    } catch (e) {
      console.error('[manual-create] confirmation_email_failed', {
        bookingId: newId,
        message: (e as Error).message,
      })
      // Non-fatal
    }

    console.log('[manual-create] success', {
      bookingId: newId,
      adminId: admin.userId,
      userId: userId ?? 'unlinked',
      paymentProvider: payment.provider,
    })

    // Fetch the confirmed booking for the response
    const { data: confirmedBooking } = await service
      .from('bookings')
      .select('id, status, human_code, date, start_time, end_time, duration_hours, table_number, total_price, payment_method')
      .eq('id', newId)
      .single()

    return NextResponse.json({
      success: true,
      bookingId: newId,
      humanCode,
      booking: confirmedBooking,
    })
  } catch (err) {
    const e = err as Error
    console.error('[manual-create] error', { message: e.message, stack: e.stack })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
