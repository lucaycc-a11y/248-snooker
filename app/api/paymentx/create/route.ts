import { NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { createClient } from '@/lib/supabase/server'
import { getServiceSupabase } from '@/lib/supabase/service'
import { getLegacyServiceSupabase } from '@/lib/supabase/legacy'
import { calculatePrice } from '@/lib/pricing'
import { humanReadableCode } from '@/lib/qr/jwt'
import {
  loadPeriods,
  resolveTierForUser,
  validateSlotLock,
  slotBounds,
  periodForStart,
} from '@/lib/booking/server'
import { logSiteError } from '@/lib/errors/log'
import { requireCompleteProfile } from '@/lib/auth/require-complete-profile'
import { prepareCheckout, prepareFailureStatus, releaseCheckoutHolds } from '@/lib/checkout/prepare'
import { isSlotStillBookable, isValidSlotStart, slotStartInHongKong } from '@/lib/booking/slot-cutoff'
import { getHostname } from '@/lib/env/hostname'
import { isTestBooking } from '@/lib/env/test-booking'
import { applyTestPriceOverride } from '@/lib/uat/test-pricing'
import { withSecurity } from '@/lib/security/api-wrapper'
import { parseRpc, isLockSlotResult, isLockSlotsResult } from '@/lib/supabase/rpc-parse'
import { PaymentXClient } from '@/lib/paymentx/client'
import { isPaymentXTester } from '@/lib/paymentx/testers'
import { logPaymentXEvent } from '@/lib/paymentx/events'
import { settlePaymentXOrder, type PaymentXOrderRow } from '@/lib/paymentx/settle'
import { PAYMENTX_VERSION } from '@/lib/paymentx/version'
import { logPaymentEvent } from '@/lib/payments/payment-events'

export const runtime = 'nodejs'

// ── Block type (mirrors page.tsx's SelectedBlock) ──────────────────────────

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


// POST /api/paymentx/create
// PaymentX vX1.0.0 — creates a KPay 全托管收銀台 (hosted cashier) order and returns the
// signed cashier URL. Only accounts an admin added to paymentx_testers may call it.
//
// Mode A — blocks[] : lock slots, insert pending bookings, create the managed order.
//   { blocks: [{ date, startHour, duration, tableNumber }], useWallet, promoCode, mode, returnUrl }
// Mode B — bookingId : resume an existing pending booking.
//   { bookingId, useWallet, promoCode, mode, returnUrl }
//
// One live managed order per booking: calling this again for the same booking returns the
// SAME cashier order (a fresh signed URL), never a second order the customer could pay twice.
async function handlePaymentXCreate(req: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const gate = await requireCompleteProfile(supabase, user.id)
    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })

    if (!(await isPaymentXTester(user.id))) {
      return NextResponse.json({ error: 'PaymentX 暫未對你的帳戶開放' }, { status: 403 })
    }

    const body = await req.json().catch(() => null)
    if (!body?.agreedToTerms) {
      return NextResponse.json({ error: '請先同意條款與細則' }, { status: 400 })
    }
    const mode: 'qr' | 'h5' = body?.mode === 'h5' ? 'h5' : 'qr'
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://space8.com.hk'
    if (typeof body?.returnUrl === 'string' && !body.returnUrl.startsWith(siteUrl)) {
      return NextResponse.json({ error: 'Invalid returnUrl domain' }, { status: 400 })
    }
    const origin = new URL(req.url).origin
    const hostname = new URL(req.url).hostname
    const returnBase =
      typeof body?.returnUrl === 'string' && body.returnUrl.startsWith(siteUrl) ? body.returnUrl : `${origin}/book/paymentx`

    const promoCode = typeof body?.promoCode === 'string' ? body.promoCode : null
    const useWallet = body?.useWallet === true

    // Server-derived test flag (never from the request body).
    const isTest = isTestBooking(getHostname(req))

    const service = getServiceSupabase()

    // ── Mode A: blocks[] — lock slots + insert pending bookings ────────────
    const rawBlocks = body?.blocks as unknown[] | undefined
    if (Array.isArray(rawBlocks) && rawBlocks.length > 0) {
      if (!rawBlocks.every(isValidBlock)) {
        return NextResponse.json({ error: 'Invalid blocks' }, { status: 400 })
      }
      const blocks = rawBlocks as Block[]
      if (blocks.some((b) => !isValidSlotStart(b.date, b.startHour))) {
        return NextResponse.json({ error: 'Invalid blocks' }, { status: 400 })
      }
      if (blocks.some((b) => !isSlotStillBookable(slotStartInHongKong(b.date, b.startHour)))) {
        return NextResponse.json({ error: 'Slot unavailable', reason: 'booking_cutoff' }, { status: 409 })
      }

      const periods = await loadPeriods()
      const tier = await resolveTierForUser(user.id)

      // Server-derived price per block (never trust the client), then lock all
      // slots atomically — find_or_lock_slot(s) is the authoritative guard.
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
          p_user_id: user.id,
          p_slots: pSlots,
          p_lock_minutes: 15,
        })
        const conflict = error?.code === 'P0001' || /slot_unavailable|overlapping_request/.test(error?.message ?? '')
        if (error) {
          return NextResponse.json(
            { error: 'Slot unavailable', reason: 'unavailable' },
            { status: conflict ? 409 : 500 },
          )
        }
        const result = parseRpc('find_or_lock_slots', data, isLockSlotsResult)
        if (!result.success) {
          return NextResponse.json(
            { error: 'Slot unavailable', reason: result.reason ?? 'unavailable' },
            { status: 409 },
          )
        }
        slotIds = result.slot_ids ?? []
      } else {
        const b = blocks[0]
        const { data, error } = await service.rpc('find_or_lock_slot', {
          p_user_id: user.id,
          p_date: b.date,
          p_start_time: `${String(b.startHour).padStart(2, '0')}:00:00`,
          p_duration_hours: b.duration,
          p_table_number: b.tableNumber,
          p_price: pSlots[0].price,
          p_lock_minutes: 15,
        })
        const conflict = error?.code === 'P0001' || /slot_unavailable/.test(error?.message ?? '')
        if (error) {
          return NextResponse.json(
            { error: 'Slot unavailable', reason: 'unavailable' },
            { status: conflict ? 409 : 500 },
          )
        }
        const result = parseRpc('find_or_lock_slot', data, isLockSlotResult)
        if (!result.success) {
          return NextResponse.json(
            { error: 'Slot unavailable', reason: result.reason ?? 'unavailable' },
            { status: 409 },
          )
        }
        slotIds = [result.slot_id!]
      }

      // UAT: stamp is_test on every locked slot so the availability queries can
      // filter them out for production customers. The flag is server-derived
      // (hostname) — never client-supplied — matching the bookings.is_test logic.
      if (isTest && slotIds.length > 0) {
        const { error: stampErr } = await service
          .from('slots')
          .update({ is_test: true })
          .in('id', slotIds)
        if (stampErr) {
          console.error('[paymentx/create] failed to stamp slots.is_test', stampErr.message)
          // Non-fatal: the booking still proceeds, but the slot may bleed into
          // prod availability until cleaned up. Log and continue.
        }
      }

      // Insert one pending booking per locked slot. Read the slot row back from
      // the DB (validateSlotLock) so end_time/period come from the slot record —
      // identical to create-intent, and correct across midnight.
      const bookingIds: string[] = []
      let totalAmount = 0
      // Billed hours across the whole order — only consumed by the UAT
      // per_hour test-price override; it does not affect normal pricing.
      let totalDurationHours = 0

      for (const slotId of slotIds) {
        const slot = await validateSlotLock(slotId, user.id)
        if (!slot) {
          return NextResponse.json({ error: 'Slot lock no longer valid' }, { status: 409 })
        }

        // Guard against a confirmed booking that landed between the lock being
        // acquired and payment being finalised. The DB unique constraint is the
        // authoritative barrier; this gives callers a clean 409 + localised
        // message instead of a raw constraint error.
        const { data: confirmedBooking } = await service
          .from('bookings')
          .select('id')
          .eq('slot_id', slot.id)
          .eq('status', 'confirmed')
          .maybeSingle()
        if (confirmedBooking) {
          return NextResponse.json(
            {
              error: 'Slot already booked',
              message: '此時段剛被預訂，請重新選擇時段。',
              reason: 'slot_confirmed',
            },
            { status: 409 },
          )
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

        // ── UAT PayMe test: adjust base_price to carry .81/.82 decimal ──
        // prepare_checkout copies base_price → total_price, so the decimal
        // flows naturally to KPay without any client-side override.
        const uatDecimal = 0

        const { error: insErr } = await service.from('bookings').insert({
          id: newId,
          user_id: user.id,
          slot_id: slot.id,
          date: slot.date,
          start_time: slot.start_time,
          end_time: slot.end_time,
          duration_hours: slot.duration_hours,
          period,
          total_price: quote.total + uatDecimal,
          // base_price/subtotal are the pre-discount snapshot prepare_checkout
          // re-derives from, so a re-prepare can restore the undiscounted total.
          base_price: quote.total + uatDecimal,
          subtotal: quote.total + uatDecimal,
          status: 'pending',
          table_number: slot.table_number,
          is_free_booking: false,
          // Server-derived from the request host — never client-supplied. Keeps
          // UAT traffic out of revenue/stats queries, which already filter on
          // is_test = false, and gates the test-price override below.
          is_test: isTest,
          order_group_id: orderGroupId,
          human_code: humanReadableCode(newId),
          // The customer-selected rail, persisted BEFORE payment succeeds. The
          // webhook confirms with this value rather than inferring one.
          payment_method: 'paymentx',
        })
        if (insErr) {
          console.error('[paymentx/create] pending_booking_insert_error', {
            message: insErr.message,
            code: insErr.code,
            userId: user.id,
            slotId: slot.id,
          })
          await logSiteError('paymentx/create', 'error', 'pending booking insert failed', {
            message: insErr.message,
            code: insErr.code,
            userId: user.id,
            slotId: slot.id,
          })
          return NextResponse.json({ error: 'Could not create booking' }, { status: 500 })
        }
        bookingIds.push(newId)
        totalAmount += quote.total
        totalDurationHours += slot.duration_hours
      }

      // Reserve the discount and take the authoritative total from the database.
      // prepare_checkout writes the discounted total onto every row in the group,
      // so the provider amount and the booking rows cannot disagree.
      const prepared = await prepareForCheckout({
        service,
        bookingId: bookingIds[0],
        userId: user.id,
        promoCode,
        useWallet,
        quotedTotal: totalAmount,
        isTest: isTest,
        durationHours: totalDurationHours,
        bookingIds,
      })
      if ('error' in prepared) return prepared.error

      return await createPaymentXOrder({
        service,
        hostname,
        userId: user.id,
        primaryBookingId: bookingIds[0],
        humanCode: humanReadableCode(bookingIds[0]),
        siblingIds: bookingIds.slice(1),
        orderGroupId,
        totalAmount: prepared.total,
        mode,
        origin,
        returnBase,
        isTest,
        extra: { orderGroupId, bookingIds },
      })
    }

    // ── Mode B: existing bookingId ─────────────────────────────────────────
    const bookingId = body?.bookingId as string | undefined
    if (!bookingId) {
      return NextResponse.json({ error: 'Missing bookingId or blocks' }, { status: 400 })
    }

    const { data: booking, error: bookingErr } = await service
      .from('bookings')
      .select('id, status, total_price, human_code, order_group_id, is_test, duration_hours')
      .eq('id', bookingId)
      .eq('user_id', user.id)
      .single()
    if (bookingErr || !booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    if (booking.status === 'confirmed') {
      return NextResponse.json({ bookingId: booking.id, existing: true, paid: true })
    }
    if (booking.status !== 'pending') {
      return NextResponse.json({ error: 'Booking is not pending' }, { status: 409 })
    }
    if (!booking.human_code) return NextResponse.json({ error: 'Booking missing human_code' }, { status: 500 })

    const groupId = booking.order_group_id ?? null
    const methodQuery = service
      .from('bookings')
      .update({ payment_method: 'paymentx', payment_provider: 'paymentx' })
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .select('id')
    const { data: stamped, error: methodErr } = groupId
      ? await methodQuery.eq('order_group_id', groupId)
      : await methodQuery.eq('id', bookingId)
    if (methodErr || !stamped || stamped.length === 0) {
      return NextResponse.json({ error: 'Booking is no longer available for payment' }, { status: 409 })
    }

    const prepared = await prepareForCheckout({
      service,
      bookingId,
      userId: user.id,
      promoCode,
      useWallet,
      quotedTotal: booking.total_price,
      isTest: booking.is_test === true || isTest,
      durationHours: typeof booking.duration_hours === 'number' ? booking.duration_hours : 1,
      bookingIds: [bookingId],
    })
    if ('error' in prepared) return prepared.error

    return await createPaymentXOrder({
      service,
      hostname,
      userId: user.id,
      primaryBookingId: bookingId,
      humanCode: booking.human_code,
      siblingIds: [],
      orderGroupId: groupId,
      totalAmount: prepared.total,
      mode,
      origin,
      returnBase,
      isTest: booking.is_test === true || isTest,
    })
  } catch (err) {
    const e = err as Error
    console.error('[paymentx/create] error', { message: e.message, stack: e.stack })
    if (e.message.startsWith('PaymentX 未配置完成')) {
      return NextResponse.json({ error: e.message }, { status: 503 })
    }
    if (e.message.startsWith('PaymentX 建單失敗') || e.message.includes('timeout')) {
      return NextResponse.json({ error: e.message }, { status: 502 })
    }
    await logSiteError('paymentx/create', 'error', 'unhandled exception', { message: e.message, stack: e.stack })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// Reserves the discount and returns the amount KPay should charge. Returns an
// error response instead of throwing so both entry modes can return it directly.
//
// A non-positive prepared total means a discount covered the whole booking; KPay
// cannot create a zero-amount order, so the reservation is released rather than
// left holding the customer's points against an order that was never created.
async function prepareForCheckout(args: {
  service: ReturnType<typeof getServiceSupabase>
  bookingId: string
  userId: string
  promoCode: string | null
  useWallet: boolean
  quotedTotal: number
  /** Server-derived test flag. When false the UAT override is never consulted. */
  isTest: boolean
  /** Billed hours across the whole order — drives per_hour override mode. */
  durationHours: number
  /** Every booking row in this order, so an override stays consistent DB-wide. */
  bookingIds: string[]
}): Promise<{ total: number } | { error: Response }> {
  const {
    service, bookingId, userId, promoCode, useWallet, quotedTotal,
    isTest, durationHours, bookingIds,
  } = args

  const outcome = await prepareCheckout(service, {
    bookingId,
    userId,
    promoCode,
    walletAmount: useWallet ? quotedTotal : 0,
  })

  if (!outcome.ok) {
    const { reason, availablePoints } = outcome.failure
    console.log('[paymentx/create] prepare_checkout rejected', { bookingId, reason })
    return {
      error: NextResponse.json(
        {
          error: reason,
          ...(availablePoints !== undefined ? { availablePoints } : {}),
        },
        { status: prepareFailureStatus(reason) },
      ),
    }
  }

  const { prepared } = outcome
  if (prepared.total <= 0) {
    await releaseCheckoutHolds(service, { bookingId, orderGroupId: null })
    console.warn('[paymentx/create] non_positive_total_after_discount', {
      bookingId,
      quotedTotal,
      discount: prepared.discountAmount,
    })
    return {
      error: NextResponse.json(
        { error: 'Zero-amount bookings are not supported' },
        { status: 400 },
      ),
    }
  }

  // ── UAT test-price override ────────────────────────────────────────────────
  // Applied AFTER prepare_checkout has written the authoritative discounted
  // total, and BEFORE that number reaches provider.createOrder. For a normal
  // booking (isTest === false) applyTestPriceOverride is a pure no-op: it does
  // not query uat_test_pricing at all, so the production pricing path here is
  // byte-for-byte the behaviour it had before this feature.
  const override = await applyTestPriceOverride({
    service,
    isTest,
    total: prepared.total,
    durationHours,
    bookingId,
  })

  if (!override.applied) return { total: prepared.total }

  // prepare_checkout wrote the real total onto every row in the group, so the
  // rows must be re-stamped or the DB would disagree with the KPay charge.
  // total_price is what the charge and the receipt are read from; base_price and
  // subtotal are re-baselined too so a later re-prepare cannot resurrect the
  // real price mid-checkout.
  const { error: syncErr } = await service
    .from('bookings')
    .update({
      total_price: override.total,
      base_price: override.total,
      subtotal: override.total,
    })
    .in('id', bookingIds.length ? bookingIds : [bookingId])

  if (syncErr) {
    // Failing closed here would strand a prepared booking; charging the real
    // price is the safe outcome, but it must be visible rather than silent.
    console.error('[paymentx/create] uat_override_row_sync_failed_charging_real_price', {
      bookingId,
      message: syncErr.message,
      intendedTotal: override.total,
      realTotal: prepared.total,
    })
    return { total: prepared.total }
  }

  console.log('[paymentx/create] uat_test_price_applied', {
    bookingId,
    realTotal: override.originalTotal,
    chargedTotal: override.total,
    quotedTotal,
  })

  return { total: override.total }
}

// ── Single order-creation path ───────────────────────────────────────────────
type CreateArgs = {
  service: ReturnType<typeof getServiceSupabase>
  hostname: string
  userId: string
  primaryBookingId: string
  humanCode: string
  siblingIds: string[]
  orderGroupId: string | null
  totalAmount: number
  mode: 'qr' | 'h5'
  origin: string
  returnBase: string
  isTest: boolean
  extra?: Record<string, unknown>
}

const ORDER_COLUMNS =
  'id, booking_id, order_group_id, user_id, managed_out_trade_no, managed_order_no, amount, status, paid_order_no, is_test, updated_at'

async function createPaymentXOrder(args: CreateArgs): Promise<Response> {
  const {
    service, hostname, userId, primaryBookingId, humanCode, siblingIds, orderGroupId,
    totalAmount, mode, origin, returnBase, isTest, extra,
  } = args
  const db = getLegacyServiceSupabase()
  const client = new PaymentXClient(hostname)
  const cashierMode = mode === 'h5' ? 'h5' : 'web'
  const returnUrl = `${returnBase}?bookingId=${encodeURIComponent(primaryBookingId)}`

  const respond = (managedOrderNo: string, existing: boolean) =>
    NextResponse.json({
      bookingId: primaryBookingId,
      providerOrderNo: managedOrderNo,
      payInfo: client.buildCashierUrl(managedOrderNo, cashierMode),
      kind: 'redirect',
      existing,
      paymentxVersion: PAYMENTX_VERSION,
      ...extra,
    })

  // 1. A live order for this booking? Reuse it instead of opening a second one.
  const { data: liveRows } = await db
    .from('paymentx_orders')
    .select(ORDER_COLUMNS)
    .eq('booking_id', primaryBookingId)
    .in('status', ['creating', 'pending'])
    .limit(1)
  const live = ((liveRows ?? [])[0] as (PaymentXOrderRow & { updated_at: string }) | undefined) ?? undefined

  if (live) {
    if (live.status === 'creating') {
      // Another request is mid-flight. A row stuck in 'creating' (crashed request) is retired after 90 s.
      const stuck = Date.now() - new Date(live.updated_at).getTime() > 90_000
      if (!stuck) {
        return NextResponse.json({ error: 'payment_in_progress', message: '付款單建立中，請稍候再試' }, { status: 409 })
      }
      await db.from('paymentx_orders').update({ status: 'failed', failure_reason: 'creating_stuck', updated_at: new Date().toISOString() }).eq('id', live.id)
    } else {
      const outcome = await settlePaymentXOrder(live, 'status_poll', hostname)
      if (outcome === 'confirmed' || outcome === 'already_confirmed') {
        return NextResponse.json({ bookingId: primaryBookingId, existing: true, paid: true, ...extra })
      }
      if (outcome === 'needs_review') {
        return NextResponse.json({ bookingId: primaryBookingId, existing: true, needsReview: true, ...extra })
      }
      if (outcome === 'unknown') {
        // Never open a second order on a failed lookup: the first might be paid.
        return NextResponse.json({ error: 'verify_failed', message: '暫時未能核實付款狀態，請稍後再試' }, { status: 503 })
      }
      if (outcome === 'pending' && live.managed_order_no) {
        if (Math.abs(Number(live.amount) - totalAmount) < 0.009) {
          return respond(live.managed_order_no, true)
        }
        // Amount changed (wallet / promo toggled): the old cashier order cannot be edited. Retire it;
        // if it is paid later the settle step compares against the booking and sends it to review.
        await db
          .from('paymentx_orders')
          .update({ status: 'cancelled', failure_reason: 'amount_changed', updated_at: new Date().toISOString() })
          .eq('id', live.id)
        await logPaymentXEvent({ kind: 'order_replaced', bookingId: primaryBookingId, managedOrderNo: live.managed_order_no, note: `amount ${live.amount} -> ${totalAmount}` })
      }
    }
  }

  // 2. New managed order. KPay needs a unique reference per managed order, so a second order
  //    for the same booking gets a suffix.
  const { count } = await db.from('paymentx_orders').select('id', { count: 'exact', head: true }).eq('booking_id', primaryBookingId)
  const managedOutTradeNo = count && count > 0 ? `${humanCode}-X${count}` : humanCode

  const { data: inserted, error: insErr } = await db
    .from('paymentx_orders')
    .insert({
      booking_id: primaryBookingId,
      order_group_id: orderGroupId,
      user_id: userId,
      managed_out_trade_no: managedOutTradeNo,
      amount: totalAmount,
      status: 'creating',
      is_test: isTest,
    })
    .select('id')
    .single()
  if (insErr || !inserted) {
    if ((insErr as { code?: string } | null)?.code === '23505') {
      return NextResponse.json({ error: 'payment_in_progress', message: '付款單建立中，請稍候再試' }, { status: 409 })
    }
    await logSiteError('paymentx/create', 'error', 'paymentx_orders insert failed', { bookingId: primaryBookingId, message: insErr?.message })
    return NextResponse.json({ error: 'Unable to create payment order' }, { status: 500 })
  }
  const rowId = (inserted as { id: string }).id

  let managedOrderNo: string
  try {
    const created = await client.createManagedOrder({
      managedOutTradeNo,
      amount: totalAmount,
      itemName: `Space8 預約 ${humanCode}`,
      baseUrl: origin,
      returnUrl,
      remark: humanCode,
    })
    managedOrderNo = created.managedOrderNo
  } catch (err) {
    const e = err as Error
    await db
      .from('paymentx_orders')
      .update({ status: 'failed', failure_reason: e.message.slice(0, 240), updated_at: new Date().toISOString() })
      .eq('id', rowId)
    await releaseCheckoutHolds(service, { bookingId: primaryBookingId, orderGroupId })
    await logSiteError('paymentx/create', 'error', 'managed order creation failed', { bookingId: primaryBookingId, message: e.message })
    throw err
  }

  await db
    .from('paymentx_orders')
    .update({ status: 'pending', managed_order_no: managedOrderNo, updated_at: new Date().toISOString() })
    .eq('id', rowId)

  // 3. Mark the booking(s) as PaymentX (provider_order_no stays empty on purpose: the live KPay
  //    flow's lookups must never try to query a managed order number).
  const ids = [primaryBookingId, ...siblingIds]
  const stamp = service.from('bookings').update({ payment_provider: 'paymentx', payment_method: 'paymentx' }).eq('user_id', userId)
  const { error: stampErr } = orderGroupId ? await stamp.eq('order_group_id', orderGroupId) : await stamp.in('id', ids)
  if (stampErr) console.error('[paymentx/create] booking stamp failed', stampErr.message)

  await logPaymentEvent({
    bookingId: primaryBookingId,
    orderGroupId,
    event: 'paymentx_order_created',
    source: 'user',
    providerOrderNo: managedOrderNo,
    meta: { managedOutTradeNo, amount: totalAmount, version: PAYMENTX_VERSION },
  })
  await logPaymentXEvent({ kind: 'order_created', bookingId: primaryBookingId, managedOrderNo, note: `${managedOutTradeNo} HK$${totalAmount}` })

  return respond(managedOrderNo, false)
}

export const POST = withSecurity(handlePaymentXCreate, {
  csrf: true,
  rateLimit: {
    bucket: 'paymentx_create',
    max: 20,
    windowSeconds: 60,
    identifierType: 'both',
  },
})
