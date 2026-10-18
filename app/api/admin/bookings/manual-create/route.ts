/**
 * POST /api/admin/bookings/manual-create
 *
 * Create a manual booking for an admin walk-in customer.
 *  - Payment evidence (provider, reference, amount, notes)
 *  - Origin recorded in `bookings.admin_note` (there is no created_via column)
 *  - Requires a real member — never silently books under the admin
 *  - Pending row is deleted if `confirm_booking` fails (no orphan holds)
 *  - `is_test` is true outside production
 *  - Member inbox notice on success
 *
 * Auth: getAdminData() guard.
 */

import { NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { getAdminData } from '@/lib/data/getAdmin'
import { getLegacyServiceSupabase } from '@/lib/supabase/legacy'
import { calculatePrice } from '@/lib/pricing'
import { loadPeriods, resolveTierForUser, slotBounds, periodForStart } from '@/lib/booking/server'
import { humanReadableCode } from '@/lib/qr/jwt'
import { writeAdminActionLog } from '@/lib/admin/audit'

export const runtime = 'nodejs'

// ── Types ──────────────────────────────────────────────────────────────
/**
 * The wizard posts `amount` in HK$. Older callers posted `amountCents`.
 * Accept both, normalise to HK$ dollars to match `bookings.total_price`.
 */
type PaymentInfo = {
  provider: string
  reference: string
  /** HK$ — matches bookings.total_price units. */
  amount: number
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
  userId: string
}

// ── Helpers ────────────────────────────────────────────────────────────
function readPayment(raw: unknown): PaymentInfo | null {
  if (typeof raw !== 'object' || raw === null) return null
  const x = raw as Record<string, unknown>
  if (typeof x.provider !== 'string' || x.provider.length === 0) return null
  if (typeof x.reference !== 'string') return null
  if (typeof x.notes !== 'string') return null

  // Wizard sends HK$ as `amount`; legacy sends `amountCents`.
  let amount: number | null = null
  if (typeof x.amount === 'number' && Number.isFinite(x.amount)) {
    amount = x.amount
  } else if (typeof x.amountCents === 'number' && Number.isFinite(x.amountCents)) {
    amount = x.amountCents / 100
  }
  if (amount === null) return null

  return { provider: x.provider, reference: x.reference, amount, notes: x.notes }
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

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
}

// ── POST ───────────────────────────────────────────────────────────────
export async function POST(req: Request) {
  let newId: string | null = null
  try {
    // ── Admin gate ──────────────────────────────────────────────────────
    const admin = await getAdminData()
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized — admin only' }, { status: 401 })
    }

    const body = await req.json().catch(() => null)
    const { payment: rawPayment, slot, userId } = (body ?? {}) as Partial<ManualCreateRequest> & {
      payment?: unknown
    }

    const payment = readPayment(rawPayment)
    if (!payment || !isValidSlot(slot)) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
    }

    // A manual booking must belong to a real member. Falling back to the
    // admin's own account hid the mistake and corrupted member history.
    if (!isUuid(userId)) {
      return NextResponse.json(
        { error: '必須選擇會員 — 手動預約不可留空會員' },
        { status: 400 },
      )
    }

    if (payment.amount <= 0) {
      return NextResponse.json({ error: '付款金額必須大於 0' }, { status: 400 })
    }

    console.log('[manual-create] attempt', {
      adminId: admin.userId,
      date: slot.date,
      startHour: slot.startHour,
      userId,
      paymentProvider: payment.provider,
    })

    const service = getLegacyServiceSupabase()
    const periods = await loadPeriods()

    // ── Recalculate price server-side (authoritative) ───────────────────
    const tier = await resolveTierForUser(userId)

    const { slotStart, slotEnd } = slotBounds(slot.date, slot.startHour, slot.duration)
    const quote = calculatePrice(slotStart, slotEnd, tier, periods)

    const period = periodForStart(
      slot.startHour,
      slotStart.getDay() === 0 || slotStart.getDay() === 6,
      periods,
    )
    const startTime = `${String(slot.startHour).padStart(2, '0')}:00:00`
    const endHour = slot.startHour + slot.duration
    const endTime = `${String(endHour % 24).padStart(2, '0')}:00:00`

    // Outside production every manual booking is a test row so it never
    // pollutes revenue. Production always writes is_test = false.
    const isTest = process.env.NODE_ENV !== 'production'

    // ── Insert pending booking with payment evidence ────────────────────
    newId = randomUUID()
    const humanCode = humanReadableCode(newId)

    // Origin lives in admin_note — bookings has no created_via column, and
    // inventing one is exactly the schema-drift failure mode this route had.
    const adminNote = [
      '手動預約（管理員代訂）',
      `管理員：${admin.email}`,
      `付款方式：${payment.provider}`,
      payment.reference ? `參考編號：${payment.reference}` : null,
      `實收：HK$${payment.amount}`,
      payment.notes ? `備註：${payment.notes}` : null,
    ]
      .filter(Boolean)
      .join('；')

    const { data: booking, error: insErr } = await service
      .from('bookings')
      .insert({
        id: newId,
        user_id: userId,
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
        admin_note: adminNote,
        is_test: isTest,
      })
      .select('id')
      .single()

    if (insErr || !booking) {
      console.error('[manual-create] insert_failed', { message: insErr?.message })
      newId = null
      return NextResponse.json(
        { error: 'Could not create booking', detail: insErr?.message },
        { status: 500 },
      )
    }

    // ── Store payment evidence in audit_log ─────────────────────────────
    // Throws on failure: a booking that exists with no audit row is exactly
    // the silent gap this route used to have.
    await writeAdminActionLog({
      adminUserId: admin.userId,
      adminEmail: admin.email,
      actionType: 'manual_booking_created',
      targetTable: 'bookings',
      targetId: newId,
      beforeJsonb: null,
      afterJsonb: {
        payment_evidence: {
          provider: payment.provider,
          reference: payment.reference,
          amount: payment.amount,
          notes: payment.notes,
        },
        slot: {
          date: slot.date,
          start_time: startTime,
          end_time: endTime,
          duration: slot.duration,
          table_number: slot.tableNumber,
        },
        linked_user_id: userId,
        price_quote: {
          total: quote.total,
          amount_cents: quote.amountInCents,
          period,
          tier,
        },
        created_via: 'manual_booking_wizard',
        created_by_admin_id: admin.userId,
        is_test: isTest,
      },
      riskLevel: 'medium',
      confirmedBy: admin.userId,
    })

    // ── Confirm booking via RPC ─────────────────────────────────────────
    const { data: confirmResult, error: confirmError } = await service.rpc('confirm_booking', {
      p_booking_id: newId,
      p_payment_intent_id: `manual_${payment.provider}_${randomUUID()}`,
      p_payment_method: payment.provider,
      p_qr_code: humanCode,
      p_event_id: null,
    })

    const result = (confirmResult ?? null) as { success?: boolean; reason?: string } | null
    const confirmFailed = Boolean(confirmError) || result?.success === false

    if (confirmFailed) {
      // Two-step insert-then-confirm is not atomic. Without this cleanup the
      // pending row keeps holding the slot forever.
      await service.from('bookings').delete().eq('id', newId)
      console.error('[manual-create] confirm_failed', {
        bookingId: newId,
        message: confirmError?.message,
        reason: result?.reason,
      })
      newId = null
      return NextResponse.json(
        {
          error: 'Confirm failed',
          detail: confirmError?.message ?? result?.reason ?? null,
        },
        { status: 500 },
      )
    }

    // ── Member inbox notice (non-blocking) ──────────────────────────────
    try {
      await service.from('admin_notifications').insert({
        user_id: userId,
        title: '預約已確認',
        message: `你的預約 ${humanCode}（${slot.date} ${startTime}）已由職員確認。`,
        type: 'system',
        read: false,
      })
    } catch (e) {
      console.error('[manual-create] inbox_notice_failed', {
        bookingId: newId,
        message: (e as Error).message,
      })
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
      userId,
      paymentProvider: payment.provider,
      isTest,
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
    // Best-effort cleanup if anything after the insert threw.
    if (newId) {
      try {
        await getLegacyServiceSupabase().from('bookings').delete().eq('id', newId)
      } catch {
        /* already logged */
      }
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
