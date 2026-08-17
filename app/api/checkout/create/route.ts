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
import type { PaymentMethod } from '@/lib/payments/types'

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
          status: 'pending',
          table_number: slot.table_number,
          is_free_booking: false,
          order_group_id: orderGroupId,
          human_code: humanReadableCode(newId),
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

      const primaryBookingId = bookingIds[0]
      const origin = new URL(req.url).origin

      // Create the KPay order against the PRIMARY booking's human code.
      const result = await provider.createOrder({
        outTradeNo: humanReadableCode(primaryBookingId),
        bookingId: primaryBookingId,
        amount: totalAmount,
        method: paymentMethod,
        mode,
        baseUrl: origin,
      })

      // Stamp provider info on every booking in the group.
      const { error: stampErr } = await service
        .from('bookings')
        .update({ payment_provider: 'kpay', provider_order_no: result.providerOrderNo })
        .eq('user_id', user.id)
        .in('id', bookingIds)
      if (stampErr) {
        // Non-fatal: the KPay order exists; the webhook stamps on confirmation.
        console.error('[checkout/create] group provider_order_no stamp failed', {
          bookingIds,
          providerOrderNo: result.providerOrderNo,
          error: stampErr.message,
        })
      }

      console.log('[checkout/create] blocks-mode success', {
        bookingIds,
        providerOrderNo: result.providerOrderNo,
        method,
        mode,
        amount: totalAmount,
      })

      return NextResponse.json({
        bookingId: primaryBookingId,
        orderGroupId,
        bookingIds,
        providerOrderNo: result.providerOrderNo,
        payInfo: result.payInfo,
        kind: result.kind,
        expiresInSeconds: result.expiresInSeconds,
        existing: false,
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
      .select('id, status, total_price, human_code, order_group_id, payment_provider, provider_order_no')
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
    if (booking.payment_provider === 'kpay' && booking.provider_order_no) {
      return NextResponse.json({
        bookingId: booking.id,
        providerOrderNo: booking.provider_order_no,
        existing: true,
      })
    }

    // ── Calculate total for the group (or single booking) ──────────────────
    let totalAmount = booking.total_price
    if (orderGroupId) {
      const { data: groupRows } = await service
        .from('bookings')
        .select('total_price')
        .eq('order_group_id', orderGroupId)
        .eq('user_id', user.id)
      if (groupRows && groupRows.length > 0) {
        totalAmount = groupRows.reduce((sum, r) => sum + r.total_price, 0)
      }
    }

    // ── Create the KPay order ──────────────────────────────────────────────
    // Concurrency note: the guard against a duplicate KPay order is the
    // conditional stamp below (.is('provider_order_no', null)), not an
    // in-process lock — serverless instances share no memory, so a Map-based
    // lock cannot see a request handled by another instance.
    const origin = new URL(req.url).origin
    const outTradeNo = booking.human_code

    const result = await provider.createOrder({
      outTradeNo,
      bookingId,
      amount: totalAmount,
      method: paymentMethod,
      mode,
      baseUrl: origin,
    })

    // ── Persist provider info on the booking ───────────────────────────────
    // Conditional on provider_order_no still being NULL: if a concurrent
    // request already stamped one, this matches 0 rows and we surface THAT
    // order instead of handing back two different orders for one booking.
    const { data: stamped, error: updateErr } = await service
      .from('bookings')
      .update({
        payment_provider: 'kpay',
        provider_order_no: result.providerOrderNo,
      })
      .eq('id', bookingId)
      .is('provider_order_no', null)
      .select('id')

    if (updateErr) {
      console.error('[checkout/create] provider_order_no stamp failed', {
        bookingId,
        providerOrderNo: result.providerOrderNo,
        error: updateErr.message,
      })
      await logSiteError('checkout/create', 'warning', 'provider_order_no stamp failed', {
        bookingId,
        providerOrderNo: result.providerOrderNo,
        message: updateErr.message,
      })
    }

    if (!updateErr && (!stamped || stamped.length === 0)) {
      const { data: winner } = await service
        .from('bookings')
        .select('provider_order_no')
        .eq('id', bookingId)
        .single()

      if (winner?.provider_order_no && winner.provider_order_no !== result.providerOrderNo) {
        console.warn('[checkout/create] concurrent stamp detected — returning existing order', {
          bookingId,
          ours: result.providerOrderNo,
          existing: winner.provider_order_no,
        })
        return NextResponse.json({
          bookingId: booking.id,
          providerOrderNo: winner.provider_order_no,
          existing: true,
        })
      }
    }

    // ── For grouped orders, stamp provider_order_no on all siblings ────────
    if (orderGroupId) {
      const { error: groupUpdateErr } = await service
        .from('bookings')
        .update({
          payment_provider: 'kpay',
          provider_order_no: result.providerOrderNo,
        })
        .eq('order_group_id', orderGroupId)
        .eq('user_id', user.id)
        .neq('id', bookingId)

      if (groupUpdateErr) {
        console.error('[checkout/create] group provider_order_no stamp failed', {
          orderGroupId,
          providerOrderNo: result.providerOrderNo,
          error: groupUpdateErr.message,
        })
      }
    }

    console.log('[checkout/create] success', {
      bookingId,
      providerOrderNo: result.providerOrderNo,
      method,
      mode,
      amount: totalAmount,
      elapsedMs: Date.now() - startTime,
    })

    return NextResponse.json({
      bookingId: booking.id,
      providerOrderNo: result.providerOrderNo,
      payInfo: result.payInfo,
      kind: result.kind,
      expiresInSeconds: result.expiresInSeconds,
      existing: false,
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