import { NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { createClient } from '@/lib/supabase/server'
import { getServiceSupabase } from '@/lib/supabase/service'
import { getPaymentProvider, getPaymentMethodSettings } from '@/lib/payments'
import { calculatePrice } from '@/lib/pricing'
import { humanReadableCode } from '@/lib/qr/jwt'
import {
  loadPeriods,
  resolveTierForUser,
  validateSlotLock,
  slotBounds,
  periodForStart,
} from '@/lib/booking/server'
import { rateLimit } from '@/lib/rate-limit'
import { logSiteError } from '@/lib/errors/log'
import { prepareCheckout, prepareFailureStatus, releaseCheckoutHolds } from '@/lib/checkout/prepare'
import type { PaymentMethod } from '@/lib/payments/types'
import { isSlotStillBookable, isValidSlotStart, slotStartInHongKong } from '@/lib/booking/slot-cutoff'

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

const MAX_BLOCKS = 6

// POST /api/checkout/create
// Creates a KPay order (QR or H5) for a set of blocks OR an existing booking.
//
// Mode A — blocks[] (the KPay path has NOT created a Stripe booking yet):
//   { blocks: [{ date, startHour, duration, tableNumber }], method, mode }
//   → locks slots, inserts pending bookings (mirroring create-intent — the
//     slot RPC is the source of truth for end_time, so cross-midnight works),
//     creates the KPay order, returns the primary bookingId.
//
// Mode B — bookingId (existing pending booking, e.g. after a re-create):
//   { bookingId, orderGroupId?, method, mode }
//   → uses the existing booking, creates the KPay order.
//
// Idempotent: if the booking already has a provider_order_no, returns the
// existing one instead of creating a new KPay order.
export async function POST(req: Request) {
  const startTime = Date.now()
  console.log('[checkout/create] === REQUEST START ===', new Date().toISOString(), '| start_time:', startTime)

  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const allowed = await rateLimit('checkout_create', `user:${user.id}`, 20, 60)
    if (!allowed) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    }

    const body = await req.json().catch(() => null)
    if (!body?.agreedToTerms) {
      return NextResponse.json(
        { error: '請先同意條款與細則' },
        { status: 400 },
      )
    }
    const method = body?.method as string | undefined
    const mode: 'qr' | 'h5' = body?.mode === 'h5' ? 'h5' : 'qr'

    // ── Explicit deny: Apple Pay / Google Pay are UI-only "coming soon" ────
    if (method === 'apple_pay' || method === 'google_pay') {
      return NextResponse.json(
        { error: 'Apple Pay 及 Google Pay 尚未開放，請使用其他付款方式' },
        { status: 400 },
      )
    }

    if (!method || !['card', 'fps', 'payme', 'octopus', 'alipay', 'alipayhk', 'wechat', 'unionpay_qp'].includes(method)) {
      return NextResponse.json({ error: 'Invalid payment method' }, { status: 400 })
    }

    const paymentMethod = method as PaymentMethod

    // Discount selection. Promo code and points are mutually exclusive —
    // prepare_checkout rejects the combination rather than silently dropping one.
    const promoCode = typeof body?.promoCode === 'string' ? body.promoCode : null
    const rawPoints = body?.pointsAmount
    const pointsAmount = typeof rawPoints === 'number' ? rawPoints : Number(rawPoints ?? 0)
    if (!Number.isInteger(pointsAmount) || pointsAmount < 0) {
      return NextResponse.json({ error: 'Invalid pointsAmount' }, { status: 400 })
    }

    // ── Check payment method is enabled in settings ────────────────────────
    const settings = await getPaymentMethodSettings(paymentMethod)
    if (!settings || !settings.enabled) {
      return NextResponse.json(
        { error: `付款方式未開啟：${method}（請於後台開啟後再試）` },
        { status: 400 },
      )
    }

    const service = getServiceSupabase()
    const provider = getPaymentProvider()

    // ── Mode A: blocks[] — lock slots + insert pending bookings ────────────
    const rawBlocks = body?.blocks as unknown[] | undefined
    if (Array.isArray(rawBlocks) && rawBlocks.length > 0) {
      if (rawBlocks.length > MAX_BLOCKS || !rawBlocks.every(isValidBlock)) {
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
        if (error || !data?.success) {
          return NextResponse.json(
            { error: 'Slot unavailable', reason: data?.reason ?? 'unavailable' },
            { status: conflict ? 409 : 500 },
          )
        }
        slotIds = (data.slot_ids as string[]) ?? []
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
        if (error || !data?.success) {
          return NextResponse.json(
            { error: 'Slot unavailable', reason: data?.reason ?? 'unavailable' },
            { status: conflict ? 409 : 500 },
          )
        }
        slotIds = [data.slot_id]
      }

      // Insert one pending booking per locked slot. Read the slot row back from
      // the DB (validateSlotLock) so end_time/period come from the slot record —
      // identical to create-intent, and correct across midnight.
      const bookingIds: string[] = []
      let totalAmount = 0

      for (const slotId of slotIds) {
        const slot = await validateSlotLock(slotId, user.id)
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
          user_id: user.id,
          slot_id: slot.id,
          date: slot.date,
          start_time: slot.start_time,
          end_time: slot.end_time,
          duration_hours: slot.duration_hours,
          period,
          total_price: quote.total,
          // base_price/subtotal are the pre-discount snapshot prepare_checkout
          // re-derives from, so a re-prepare can restore the undiscounted total.
          base_price: quote.total,
          subtotal: quote.total,
          status: 'pending',
          table_number: slot.table_number,
          is_free_booking: false,
          order_group_id: orderGroupId,
          human_code: humanReadableCode(newId),
          // The customer-selected rail, persisted BEFORE payment succeeds. The
          // webhook confirms with this value rather than inferring one.
          payment_method: paymentMethod,
        })
        if (insErr) {
          console.error('[checkout/create] pending_booking_insert_error', {
            message: insErr.message,
            code: insErr.code,
            userId: user.id,
            slotId: slot.id,
          })
          await logSiteError('checkout/create', 'error', 'pending booking insert failed', {
            message: insErr.message,
            code: insErr.code,
            userId: user.id,
            slotId: slot.id,
          })
          return NextResponse.json({ error: 'Could not create booking' }, { status: 500 })
        }
        bookingIds.push(newId)
        totalAmount += quote.total
      }

      // Reserve the discount and take the authoritative total from the database.
      // prepare_checkout writes the discounted total onto every row in the group,
      // so the provider amount and the booking rows cannot disagree.
      const prepared = await prepareForCheckout({
        service,
        bookingId: bookingIds[0],
        userId: user.id,
        promoCode,
        pointsAmount,
        quotedTotal: totalAmount,
      })
      if ('error' in prepared) return prepared.error

      // Converge on the shared path — Mode A does not create the order itself.
      return await createAndStamp({
        service,
        provider,
        userId: user.id,
        primaryBookingId: bookingIds[0],
        outTradeNo: humanReadableCode(bookingIds[0]),
        siblingIds: bookingIds.slice(1),
        orderGroupId,
        totalAmount: prepared.total,
        paymentMethod,
        mode,
        origin: new URL(req.url).origin,
        extra: { orderGroupId, bookingIds },
      })
    }

    // ── Mode B: existing bookingId ─────────────────────────────────────────
    const bookingId = body?.bookingId as string | undefined
    const orderGroupId = body?.orderGroupId as string | undefined

    if (!bookingId) {
      return NextResponse.json({ error: 'Missing bookingId or blocks' }, { status: 400 })
    }

    // ── Load the primary booking ───────────────────────────────────────────
    const { data: booking, error: bookingErr } = await service
      .from('bookings')
      .select('id, status, total_price, human_code, order_group_id, payment_provider, provider_order_no, payment_method')
      .eq('id', bookingId)
      .eq('user_id', user.id)
      .single()

    if (bookingErr || !booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }
    if (booking.status !== 'pending') {
      return NextResponse.json({ error: 'Booking is not pending' }, { status: 409 })
    }
    if (!booking.human_code) {
      return NextResponse.json({ error: 'Booking missing human_code' }, { status: 500 })
    }

    // ── Idempotency: if already has a provider order, return it ────────────
    // A finalized external order owns its original payment rail; never rewrite
    // payment_method on this path.
    if (booking.payment_provider === 'kpay' && booking.provider_order_no) {
      return NextResponse.json({
        bookingId: booking.id,
        providerOrderNo: booking.provider_order_no,
        existing: true,
      })
    }

    // The row is still pending and unclaimed (the finalized-order guard above
    // already returned), so the customer may switch rails on a retry. Trust the
    // stored group id rather than the client-supplied one.
    const groupId = booking.order_group_id ?? null
    if (booking.payment_method !== paymentMethod) {
      const methodQuery = service
        .from('bookings')
        .update({ payment_method: paymentMethod })
        .eq('user_id', user.id)
        .eq('status', 'pending')
        .is('provider_order_no', null)
        .select('id')
      const { data: stamped, error: methodErr } = groupId
        ? await methodQuery.eq('order_group_id', groupId)
        : await methodQuery.eq('id', bookingId)
      if (methodErr) {
        console.error('[checkout/create] payment_method update failed', {
          bookingId,
          groupId,
          message: methodErr.message,
        })
        return NextResponse.json({ error: 'Could not update payment method' }, { status: 500 })
      }
      // Zero rows means the booking was claimed or confirmed between the guard
      // above and this update — a concurrent attempt won, so do not create a
      // second provider order for it.
      if (!stamped || stamped.length === 0) {
        return NextResponse.json(
          { error: 'Booking is no longer available for payment' },
          { status: 409 },
        )
      }
    }

    // Authoritative total for the booking or the whole group.
    const prepared = await prepareForCheckout({
      service,
      bookingId,
      userId: user.id,
      promoCode,
      pointsAmount,
      quotedTotal: booking.total_price,
    })
    if ('error' in prepared) return prepared.error

    // Same shared path as Mode A — one place calls createOrder, one place stamps.
    return await createAndStamp({
      service,
      provider,
      userId: user.id,
      primaryBookingId: bookingId,
      outTradeNo: booking.human_code,
      siblingIds: [],
      orderGroupId: groupId,
      totalAmount: prepared.total,
      paymentMethod,
      mode,
      origin: new URL(req.url).origin,
    })
  } catch (err) {
    const e = err as Error
    console.error('[checkout/create] error', { message: e.message, stack: e.stack })

    // Surface KPay configuration errors clearly (never silent 500)
    if (e.message.startsWith('KPay 未配置完成')) {
      return NextResponse.json({ error: e.message }, { status: 503 })
    }
    if (e.message.startsWith('KPay 建單失敗') || e.message.startsWith('KPay 取碼失敗')) {
      return NextResponse.json({ error: e.message }, { status: 502 })
    }

    await logSiteError('checkout/create', 'error', 'unhandled exception', { message: e.message, stack: e.stack })
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
  pointsAmount: number
  quotedTotal: number
}): Promise<{ total: number } | { error: Response }> {
  const { service, bookingId, userId, promoCode, pointsAmount, quotedTotal } = args

  const outcome = await prepareCheckout(service, {
    bookingId,
    userId,
    promoCode,
    points: pointsAmount,
  })

  if (!outcome.ok) {
    const { reason, availablePoints } = outcome.failure
    console.log('[checkout/create] prepare_checkout rejected', { bookingId, reason })
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
    console.warn('[checkout/create] non_positive_total_after_discount', {
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

  return { total: prepared.total }
}

// ── Single order-creation path ───────────────────────────────────────────────
//
// The ONLY place in this route that calls provider.createOrder. Both entry
// modes (first order, resume/retry) converge here, so there is exactly one
// create + stamp sequence.
//
// The duplicate-order guard is claim_payment_attempt, called BEFORE the external
// provider call. A database row claim prevents two serverless instances from both
// reaching KPay with different outTradeNo values for the same booking.
type CreateAndStampArgs = {
  service: ReturnType<typeof getServiceSupabase>
  provider: ReturnType<typeof getPaymentProvider>
  userId: string
  primaryBookingId: string
  outTradeNo: string
  siblingIds: string[]
  orderGroupId: string | null
  totalAmount: number
  paymentMethod: PaymentMethod
  mode: 'qr' | 'h5'
  origin: string
  extra?: Record<string, unknown>
}

async function createAndStamp(args: CreateAndStampArgs): Promise<Response> {
  const {
    service, provider, userId, primaryBookingId, outTradeNo, siblingIds,
    orderGroupId, totalAmount, paymentMethod, mode, origin, extra,
  } = args

  // ── 1. Claim payment attempt ───────────────────────────────────────────────
  // This is the cross-instance lock: the unique active-booking index prevents
  // two concurrent requests from both creating external orders.
  const idempotencyKey = `${primaryBookingId}:${Date.now()}`
  const { data: claimData, error: claimErr } = await service.rpc('claim_payment_attempt', {
    p_booking_id: primaryBookingId,
    p_user_id: userId,
    p_provider: 'kpay',
    p_idempotency_key: idempotencyKey,
  })

  if (claimErr) {
    console.error('[checkout/create] claim_payment_attempt failed', {
      primaryBookingId,
      message: claimErr.message,
    })
    await logSiteError('checkout/create', 'error', 'claim_payment_attempt failed', {
      bookingId: primaryBookingId,
      message: claimErr.message,
    })
    return NextResponse.json({ error: 'Unable to create payment order' }, { status: 500 })
  }

  const claim = claimData as Record<string, unknown> | null
  if (!claim || claim.success !== true) {
    return NextResponse.json({ error: 'Unable to claim payment attempt' }, { status: 500 })
  }

  const attemptId = typeof claim.attempt_id === 'string' ? claim.attempt_id : null
  const existingProviderOrderNo = typeof claim.provider_order_no === 'string' ? claim.provider_order_no : null
  const isExisting = claim.existing === true

  // ── 2. Return existing order if another request already created one ────────
  if (isExisting && existingProviderOrderNo) {
    console.log('[checkout/create] existing active attempt, returning its order', {
      primaryBookingId,
      attemptId,
      providerOrderNo: existingProviderOrderNo,
    })
    // Load the existing payInfo from the provider
    const orderStatus = await provider.queryOrder(existingProviderOrderNo)
    return NextResponse.json({
      bookingId: primaryBookingId,
      providerOrderNo: existingProviderOrderNo,
      existing: true,
    })
  }

  if (!attemptId) {
    return NextResponse.json({ error: 'Invalid attempt claim' }, { status: 500 })
  }

  // ── 3. Create order with external provider ─────────────────────────────────
  let result: { providerOrderNo: string; payInfo: string; kind: string; expiresInSeconds: number }
  try {
    result = await provider.createOrder({
      outTradeNo,
      bookingId: primaryBookingId,
      amount: totalAmount,
      method: paymentMethod,
      mode,
      baseUrl: origin,
    })
  } catch (err) {
    const e = err as Error
    console.error('[checkout/create] provider.createOrder failed', {
      primaryBookingId,
      attemptId,
      message: e.message,
    })
    await service.rpc('fail_payment_attempt', {
      p_attempt_id: attemptId,
      p_failure_code: null,
      p_failure_reason: e.message.slice(0, 240),
    })
    // No provider order exists, so the reservation must not keep the customer's
    // points locked while they retry with a different rail.
    await releaseCheckoutHolds(service, { bookingId: primaryBookingId, orderGroupId })
    throw err
  }

  // ── 4. Finalize attempt and stamp booking ──────────────────────────────────
  const { error: finalizeErr } = await service.rpc('finalize_payment_attempt', {
    p_attempt_id: attemptId,
    p_provider_order_no: result.providerOrderNo,
  })

  if (finalizeErr) {
    console.error('[checkout/create] finalize_payment_attempt failed', {
      primaryBookingId,
      attemptId,
      providerOrderNo: result.providerOrderNo,
      message: finalizeErr.message,
    })
  }

  // Stamp the booking row for backward compatibility with existing queries.
  const { error: stampErr } = await service
    .from('bookings')
    .update({
      payment_provider: 'kpay',
      provider_order_no: result.providerOrderNo,
      payment_method: paymentMethod,
    })
    .eq('id', primaryBookingId)
    .eq('user_id', userId)

  if (stampErr) {
    console.error('[checkout/create] booking stamp failed', {
      primaryBookingId,
      providerOrderNo: result.providerOrderNo,
      message: stampErr.message,
    })
  }

  // Siblings share the primary's provider order (grouped multi-slot checkout).
  const groupTargets = siblingIds.length > 0 ? siblingIds : null
  if (groupTargets || orderGroupId) {
    const q = service
      .from('bookings')
      .update({
        payment_provider: 'kpay',
        provider_order_no: result.providerOrderNo,
        payment_method: paymentMethod,
      })
      .eq('user_id', userId)
    const { error: groupErr } = groupTargets
      ? await q.in('id', groupTargets)
      : await q.eq('order_group_id', orderGroupId!).neq('id', primaryBookingId)

    if (groupErr) {
      console.error('[checkout/create] group stamp failed', {
        orderGroupId,
        providerOrderNo: result.providerOrderNo,
        message: groupErr.message,
      })
    }
  }

  console.log('[checkout/create] success', {
    primaryBookingId,
    attemptId,
    providerOrderNo: result.providerOrderNo,
    method: paymentMethod,
    mode,
    kind: result.kind,
    amount: totalAmount,
  })

  return NextResponse.json({
    bookingId: primaryBookingId,
    providerOrderNo: result.providerOrderNo,
    payInfo: result.payInfo,
    kind: result.kind,
    expiresInSeconds: result.expiresInSeconds,
    existing: false,
    ...extra,
  })
}