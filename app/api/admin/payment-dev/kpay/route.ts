import { NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import type { Json } from '@/lib/supabase/database.types'
import { createClient } from '@/lib/supabase/server'
import { getServiceSupabase } from '@/lib/supabase/service'
import { requireActiveAdmin, getClientIp } from '@/lib/uat/admin-auth'
import { writeAdminAudit } from '@/lib/admin/audit'
import { KPayProvider } from '@/lib/payments/kpay'
import { KPAY_MIN_AMOUNT_HKD, type PaymentMethod } from '@/lib/payments/types'
import {
  loadPeriods,
  resolveTierForUser,
  slotBounds,
  periodForStart,
  validateSlotLock,
} from '@/lib/booking/server'
import { calculatePrice } from '@/lib/pricing'
import { humanReadableCode } from '@/lib/qr/jwt'
import { prepareCheckout } from '@/lib/checkout/prepare'
import { parseRpc, isLockSlotResult, isLockSlotsResult } from '@/lib/supabase/rpc-parse'
import { logSiteError } from '@/lib/errors/log'

export const runtime = 'nodejs'

// ════════════════════════════════════════════════════════════════════════════
// POST /api/admin/payment-dev/kpay — admin-only KPay test checkout
//
// Purely additive. This route does NOT touch /api/checkout/create or any
// Stripe code path. It exists so an admin can exercise KPay in production
// before public launch, without changing what customers see or pay with.
//
// Invariants, all server-side and none client-controllable:
//   - Caller must be an ACTIVE admin (admin_users.is_active = true) or 403.
//   - bookings.is_test is the LITERAL true. Deliberately NOT derived from
//     hostname: isTestBooking() returns false on production, which would
//     stamp a real booking and leak it into availability + revenue.
//   - slots.is_test is stamped true unconditionally, so the slot vanishes
//     from availability for everyone else while the test is in flight.
//   - The provider is a directly-constructed KPayProvider. getPaymentProvider()
//     reads PAYMENT_PROVIDER=stripe and would silently charge Stripe.
//   - Every attempt, success or failure, writes one audit_log row.
//
// Amount policy: KPay is charged KPAY_MIN_AMOUNT_HKD, NOT bookings.total_price.
// Rationale — checkAmountMatch() is called only from the three Stripe sites
// (payment/create-intent, checkout/status Stripe branch, webhooks/stripe). The
// KPay webhook never compares amounts, and KPay queryOrder returns no captured
// amount, so a deliberately small test charge cannot trip reconciliation. The
// real booking total is still written to bookings and echoed back to the panel
// and the audit row so the two figures are never silently confused.
// ════════════════════════════════════════════════════════════════════════════

/** KPay rails this route will start. Apple Pay / Google Pay are not ready. */
const ALLOWED_METHODS = [
  'card',
  'fps',
  'payme',
  'octopus',
  'alipay',
  'alipayhk',
  'wechat',
  'unionpay_qp',
] as const

type AllowedMethod = (typeof ALLOWED_METHODS)[number]

type Block = { date: string; startHour: number; duration: number; tableNumber: 1 | 2 }

function isValidBlock(b: unknown): b is Block {
  if (typeof b !== 'object' || b === null) return false
  const x = b as Record<string, unknown>
  return (
    typeof x.date === 'string' &&
    typeof x.startHour === 'number' &&
    typeof x.duration === 'number' &&
    (x.tableNumber === 1 || x.tableNumber === 2)
  )
}

export async function POST(req: Request) {
  const ip = getClientIp(req)

  // ── 1. Admin gate. The client flag is never trusted. ─────────────────────
  const supabase = await createClient()
  const auth = await requireActiveAdmin(supabase)

  if (!auth.isAdmin) {
    // A non-admin reaching here is worth recording: the panel is not supposed
    // to render for them, so this means either a forged request or a leak.
    try {
      await writeAdminAudit({
        adminUserId: auth.user?.id ?? null,
        adminEmail: auth.user?.email ?? 'unknown',
        action: 'payment_dev_kpay_denied',
        targetTable: 'bookings',
        targetId: null,
        beforeValue: null,
        afterValue: { reason: auth.error, ip },
        ipAddress: ip,
      })
    } catch {
      // Audit failure must not turn a 403 into a 500 — the rejection stands.
    }
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const adminUserId = auth.user.id
  const adminEmail = auth.user.email ?? 'unknown'

  try {
    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
    }

    // ── 2. Validate method ────────────────────────────────────────────────
    const method = (body as Record<string, unknown>).method
    if (typeof method !== 'string' || !(ALLOWED_METHODS as readonly string[]).includes(method)) {
      return NextResponse.json({ error: 'Invalid payment method' }, { status: 400 })
    }
    const paymentMethod = method as AllowedMethod

    // ── 3. Validate mode ──────────────────────────────────────────────────
    const rawMode = (body as Record<string, unknown>).mode
    const mode: 'qr' | 'h5' = rawMode === 'h5' ? 'h5' : 'qr'

    // ── 4. Validate blocks (real slots only — no synthetic bookings) ──────
    const rawBlocks = (body as Record<string, unknown>).blocks
    if (!Array.isArray(rawBlocks) || rawBlocks.length === 0 || !rawBlocks.every(isValidBlock)) {
      return NextResponse.json({ error: 'Invalid blocks' }, { status: 400 })
    }
    const blocks = rawBlocks as Block[]

    const service = getServiceSupabase()
    // KPay is forced here on purpose — see the file header.
    const provider = new KPayProvider(new URL(req.url).hostname)

    // ── 5. Lock the real slot(s) ──────────────────────────────────────────
    const periods = await loadPeriods()
    const tier = await resolveTierForUser(adminUserId)

    const pSlots = blocks.map((b) => {
      const { slotStart, slotEnd } = slotBounds(b.date, b.startHour, b.duration)
      const quote = calculatePrice(slotStart, slotEnd, tier, periods)
      return {
        date: b.date,
        start_time: `${String(b.startHour).padStart(2, '0')}:00:00`,
        duration_hours: b.duration,
        table_number: b.tableNumber,
        price: quote.total,
      }
    })

    const orderGroupId = blocks.length > 1 ? randomUUID() : null
    let slotIds: string[]

    if (blocks.length > 1) {
      const { data, error } = await service.rpc('find_or_lock_slots', {
        p_user_id: adminUserId,
        p_slots: pSlots,
        p_lock_minutes: 15,
      })
      if (error) {
        return NextResponse.json({ error: 'Slot unavailable', reason: 'unavailable' }, { status: 409 })
      }
      const result = parseRpc('find_or_lock_slots', data, isLockSlotsResult)
      if (!result.success) {
        return NextResponse.json({ error: 'Slot unavailable', reason: result.reason ?? 'unavailable' }, { status: 409 })
      }
      slotIds = result.slot_ids ?? []
    } else {
      const b = blocks[0]
      const { data, error } = await service.rpc('find_or_lock_slot', {
        p_user_id: adminUserId,
        p_date: b.date,
        p_start_time: `${String(b.startHour).padStart(2, '0')}:00:00`,
        p_duration_hours: b.duration,
        p_table_number: b.tableNumber,
        p_price: pSlots[0].price,
        p_lock_minutes: 15,
      })
      if (error) {
        return NextResponse.json({ error: 'Slot unavailable', reason: 'unavailable' }, { status: 409 })
      }
      const result = parseRpc('find_or_lock_slot', data, isLockSlotResult)
      if (!result.success || !result.slot_id) {
        return NextResponse.json({ error: 'Slot unavailable', reason: result.reason ?? 'unavailable' }, { status: 409 })
      }
      slotIds = [result.slot_id]
    }

    // Stamp slots.is_test unconditionally. Availability queries filter
    // .eq('is_test', false) (lib/booking/server.ts), so this is what keeps the
    // test slot out of every other customer's calendar.
    const { error: stampErr } = await service
      .from('slots')
      .update({ is_test: true })
      .in('id', slotIds)
    if (stampErr) {
      console.error('[payment-dev/kpay] failed to stamp slots.is_test', stampErr.message)
    }

    // ── 6. Insert pending booking, is_test = true LITERAL ─────────────────
    const bookingIds: string[] = []
    let bookingTotal = 0
    const slotSummary: Json[] = []

    for (const slotId of slotIds) {
      const slot = await validateSlotLock(slotId, adminUserId)
      if (!slot) {
        return NextResponse.json({ error: 'Slot lock no longer valid' }, { status: 409 })
      }

      const startHour = parseInt(slot.start_time.slice(0, 2), 10)
      const { slotStart, slotEnd } = slotBounds(slot.date, startHour, slot.duration_hours)
      const quote = calculatePrice(slotStart, slotEnd, tier, periods)
      if (quote.amountInCents <= 0) {
        return NextResponse.json({ error: 'Zero-amount bookings are not supported' }, { status: 400 })
      }
      const isWeekend = slotStart.getDay() === 0 || slotStart.getDay() === 6
      const period = periodForStart(startHour, isWeekend, periods)
      const newId = randomUUID()

      const { error: insErr } = await service.from('bookings').insert({
        id: newId,
        user_id: adminUserId,
        slot_id: slot.id,
        date: slot.date,
        start_time: slot.start_time,
        end_time: slot.end_time,
        duration_hours: slot.duration_hours,
        period,
        total_price: quote.total,
        base_price: quote.total,
        subtotal: quote.total,
        status: 'pending',
        table_number: slot.table_number,
        is_free_booking: false,
        // LITERAL true. Not isTestBooking(hostname) — see file header.
        is_test: true,
        order_group_id: orderGroupId,
        human_code: humanReadableCode(newId),
        payment_method: paymentMethod,
      })
      if (insErr) {
        console.error('[payment-dev/kpay] booking insert failed', { message: insErr.message, code: insErr.code })
        await logSiteError('payment-dev/kpay', 'error', 'booking insert failed', {
          message: insErr.message,
          code: insErr.code,
          slotId: slot.id,
        })
        return NextResponse.json({ error: 'Could not create booking' }, { status: 500 })
      }

      bookingIds.push(newId)
      bookingTotal += quote.total
      slotSummary.push({
        slotId: slot.id,
        date: slot.date,
        startTime: slot.start_time,
        endTime: slot.end_time,
        tableNumber: slot.table_number,
        price: quote.total,
      })
    }

    // ── 7. prepare_checkout (reused, not modified) ────────────────────────
    // Writes the authoritative discounted total onto the booking rows. With no
    // promo and no wallet this is a no-op discount that still normalises
    // total_price from base_price.
    const prepared = await prepareCheckout(service, {
      bookingId: bookingIds[0],
      userId: adminUserId,
      promoCode: null,
      walletAmount: 0,
    })
    if (!prepared.ok) {
      console.warn('[payment-dev/kpay] prepare_checkout rejected', {
        bookingId: bookingIds[0],
        reason: prepared.failure.reason,
      })
      return NextResponse.json({ error: prepared.failure.reason }, { status: 400 })
    }

    // ── 8. Claim payment attempt ──────────────────────────────────────────
    const primaryBookingId = bookingIds[0]
    const outTradeNo = humanReadableCode(primaryBookingId)
    const idempotencyKey = `${primaryBookingId}:${Date.now()}`

    const { data: claimData, error: claimErr } = await service.rpc('claim_payment_attempt', {
      p_booking_id: primaryBookingId,
      p_user_id: adminUserId,
      p_provider: 'kpay',
      p_idempotency_key: idempotencyKey,
    })
    if (claimErr) {
      console.error('[payment-dev/kpay] claim_payment_attempt failed', { message: claimErr.message })
      return NextResponse.json({ error: 'Unable to create payment order' }, { status: 500 })
    }

    const claim = claimData as Record<string, unknown> | null
    if (!claim || claim.success !== true) {
      return NextResponse.json({ error: 'Unable to claim payment attempt' }, { status: 500 })
    }
    const attemptId = typeof claim.attempt_id === 'string' ? claim.attempt_id : null

    // ── 9. Create the KPay order at the gateway floor ─────────────────────
    const kpayAmount = KPAY_MIN_AMOUNT_HKD
    let created: {
      providerOrderNo: string
      payInfo: string
      kind: string
      expiresInSeconds: number
    }
    try {
      created = await provider.createOrder({
        outTradeNo,
        bookingId: primaryBookingId,
        amount: kpayAmount,
        method: paymentMethod as PaymentMethod,
        mode,
        baseUrl: new URL(req.url).origin,
      })
    } catch (err) {
      const e = err as Error
      console.error('[payment-dev/kpay] createOrder failed', { bookingId: primaryBookingId, message: e.message })
      if (attemptId) {
        await service.rpc('fail_payment_attempt', {
          p_attempt_id: attemptId,
          p_failure_reason: e.message.slice(0, 240),
        })
      }
      const failedAudit: Json = {
        method: paymentMethod,
        mode,
        outcome: 'create_order_failed',
        error: e.message.slice(0, 240),
        bookingTotal,
        kpayAmount,
        slots: slotSummary,
        ip,
      }
      await writeAdminAudit({
        adminUserId,
        adminEmail,
        action: 'payment_dev_kpay',
        targetTable: 'bookings',
        targetId: primaryBookingId,
        beforeValue: null,
        afterValue: failedAudit,
        ipAddress: ip,
      })
      return NextResponse.json({ error: e.message }, { status: 502 })
    }

    // ── 10. Stamp the provider order onto the booking group ───────────────
    await service
      .from('bookings')
      .update({
        payment_provider: 'kpay',
        provider_order_no: created.providerOrderNo,
        payment_method: paymentMethod,
      })
      .in('id', bookingIds)

    // ── 11. One audit_log row per attempt ─────────────────────────────────
    const createdAudit: Json = {
      method: paymentMethod,
      mode,
      outcome: 'order_created',
      providerOrderNo: created.providerOrderNo,
      attemptId,
      orderGroupId,
      bookingIds,
      bookingTotal,
      kpayAmount,
      slots: slotSummary,
      ip,
    }
    await writeAdminAudit({
      adminUserId,
      adminEmail,
      action: 'payment_dev_kpay',
      targetTable: 'bookings',
      targetId: primaryBookingId,
      beforeValue: null,
      afterValue: createdAudit,
      ipAddress: ip,
    })

    return NextResponse.json({
      bookingId: primaryBookingId,
      bookingIds,
      orderGroupId,
      providerOrderNo: created.providerOrderNo,
      payInfo: created.payInfo,
      kind: created.kind,
      expiresInSeconds: created.expiresInSeconds,
      bookingTotal,
      kpayAmount,
      slots: slotSummary,
      outTradeNo,
    })
  } catch (err) {
    const e = err as Error
    console.error('[payment-dev/kpay] unhandled', { message: e.message, stack: e.stack })
    await logSiteError('payment-dev/kpay', 'error', 'unhandled exception', {
      message: e.message,
      stack: e.stack,
    })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
