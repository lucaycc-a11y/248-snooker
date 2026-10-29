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
import { prepareCheckout, prepareFailureStatus, releaseCheckoutHolds } from '@/lib/checkout/prepare'
import { releaseStaleCheckout } from '@/lib/checkout/release-stale'
import { getAccountCheckoutLock } from '@/lib/checkout/supersede'
import { parseRpc, isLockSlotResult, isLockSlotsResult } from '@/lib/supabase/rpc-parse'
import { withSecurity } from '@/lib/security/api-wrapper'
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
//   - Exactly one booking per KPay attempt. If a pending booking for this admin
//     and these exact blocks already exists (the page's own prepare step,
//     /api/payment/create-intent, minted it), that row is ADOPTED rather than a
//     second one inserted. Creating a second booking makes prepare_checkout ask
//     for the same wallet credits twice and fail with `insufficient_credits`.
//   - A booking this request INSERTS has bookings.is_test = the LITERAL true.
//     Deliberately NOT derived from hostname: isTestBooking() returns false on
//     production, which would stamp a real booking and leak it into
//     availability + revenue. Adopted rows keep whatever is_test they already
//     carry — the page's prepare step writes false in production.
//   - Every abort after a row exists cancels the rows THIS request created
//     (status = 'cancelled', never a hard delete) and releases the wallet hold.
//     An adopted booking is never cancelled: it is not ours.
//   - prepare_checkout is called at most once per checkout. If a live
//     credit_hold already exists for these bookings it is not called again.
//   - slots.is_test is stamped true unconditionally, so the slot vanishes
//     from availability for everyone else while the test is in flight.
//   - The provider is a directly-constructed KPayProvider pinned to
//     PRODUCTION. getPaymentProvider() reads PAYMENT_PROVIDER=stripe and
//     would silently charge Stripe; getKPayEnv() defaults to UAT when
//     KPAY_ENV is unset. Neither is used here.
//   - Every attempt, success or failure, writes one audit_log row.
//
// Amount policy: KPay is charged the SAME discounted total the real checkout
// computes — credits + promo, reserved by prepare_checkout and read back from
// it. Never recomputed here, never taken from the client. The client sends its
// `expectedTotal` only as a consistency check: on mismatch we return 409 and
// make no KPay call. No test override — this is a real production payment.
// KPAY_MIN_AMOUNT_HKD is enforced here explicitly as well as in the provider.
//
// Body shape matches /api/checkout/create so the original KPayPayment
// component can post here unmodified: Mode A `{ blocks }`, Mode B
// `{ bookingId }`. `uat_payme` is ignored — no UAT simulation in production.
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

/** Identity of a requested slot, matching the columns Mode A writes onto bookings. */
function blockKey(b: Block): string {
  return `${b.date}|${String(b.startHour).padStart(2, '0')}:00:00|${b.duration}|${b.tableNumber}`
}

function bookingKey(row: Record<string, unknown>): string {
  return [
    String(row.date ?? ''),
    String(row.start_time ?? '').slice(0, 8),
    String(row.duration_hours ?? ''),
    String(row.table_number ?? ''),
  ].join('|')
}

/**
 * Finds a pending booking this admin already owns for every requested block.
 *
 * The page's own prepare step (/api/payment/create-intent) mints a pending
 * booking and, with the wallet on, a credit_hold. Creating a second booking for
 * the same blocks makes prepare_checkout ask for the same credits twice and get
 * `insufficient_credits`, because available = balance - already-held. So one
 * KPay attempt must adopt that booking (Mode B semantics) rather than insert.
 *
 * Ownership is the gate: `user_id = adminUserId` is what stops this from ever
 * adopting a real customer booking. is_test is NOT required — the page's own
 * prepare step writes is_test = false in production.
 */
async function findReusableBookings(
  service: ReturnType<typeof getServiceSupabase>,
  adminUserId: string,
  blocks: Block[],
): Promise<Record<string, unknown>[] | null> {
  const dates = [...new Set(blocks.map((b) => b.date))]
  const { data, error } = await service
    .from('bookings')
    .select(
      'id, user_id, total_price, status, order_group_id, human_code, date, start_time, end_time, duration_hours, table_number, subtotal, credit_discount, promo_discount, discount_snapshot',
    )
    .eq('user_id', adminUserId)
    .eq('status', 'pending')
    .in('date', dates)
  if (error || !data || data.length === 0) return null

  const pool = (data as Record<string, unknown>[]).filter((row) => row.user_id === adminUserId)
  const claimed = new Set<string>()
  const chosen: Record<string, unknown>[] = []
  for (const block of blocks) {
    const key = blockKey(block)
    const match = pool.find((row) => !claimed.has(String(row.id)) && bookingKey(row) === key)
    if (!match) return null
    claimed.add(String(match.id))
    chosen.push(match)
  }
  return chosen
}

/** True when this checkout already has a live wallet reservation. */
async function hasLiveCreditHold(
  service: ReturnType<typeof getServiceSupabase>,
  adminUserId: string,
  bookingIds: string[],
  orderGroupId: string | null,
): Promise<boolean> {
  const { data } = await service
    .from('credit_holds')
    .select('id, booking_id, order_group_id')
    .eq('user_id', adminUserId)
    .eq('status', 'held')
  if (!data) return false
  return (data as Record<string, unknown>[]).some((row) => {
    const rowBooking = row.booking_id === null ? null : String(row.booking_id)
    const rowGroup = row.order_group_id === null ? null : String(row.order_group_id)
    return (rowBooking !== null && bookingIds.includes(rowBooking)) || (orderGroupId !== null && rowGroup === orderGroupId)
  })
}

/**
 * Frees a wallet reservation for this checkout. `release_checkout_holds` predates
 * `credit_holds` (20260828 vs 20261014) and only releases points_holds and
 * promo_code_usages, so the credit rows are released here directly.
 */
async function releaseCreditHolds(
  service: ReturnType<typeof getServiceSupabase>,
  adminUserId: string,
  bookingIds: string[],
): Promise<void> {
  const { error } = await service
    .from('credit_holds')
    .update({ status: 'released', released_at: new Date().toISOString() })
    .eq('user_id', adminUserId)
    .eq('status', 'held')
    .in('booking_id', bookingIds)
  if (error) {
    console.error('[payment-dev/kpay] failed to release credit_holds', { bookingIds, message: error.message })
  }
}

async function handleAdminKpayCreate(req: Request) {
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

  // ── 1b. Pin KPay to PRODUCTION and fail closed on missing credentials ──
  // Names only, never values. If any is absent there is no production
  // config to charge with — refuse rather than silently fall back to UAT.
  const requiredKpayEnv = ['KPAY_MERCHANT_CODE', 'KPAY_PRIVATE_KEY', 'KPAY_PLATFORM_PUBLIC_KEY'] as const
  const missingKpayEnv = requiredKpayEnv.filter((name) => !process.env[name])
  if (missingKpayEnv.length > 0) {
    console.error('[payment-dev/kpay] missing KPay production credentials', { missing: missingKpayEnv })
    return NextResponse.json(
      {
        error: 'KPay production is not configured',
        missingEnv: missingKpayEnv,
        hint: 'Set the listed KPay_* variables to production values. This route will not fall back to UAT.',
      },
      { status: 503 },
    )
  }
  // Base URL is forced to https://payment.kpay-group.com. Request hostname,
  // NEXT_PUBLIC_APP_ENV and KPAY_ENV are all ignored — see getKpayBaseUrl's
  // forceEnv branch in lib/payments/kpay.ts.
  const KPAY_GATEWAY_ENV = 'production'

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

    // ── 3b. Discount inputs. Requests only — the amounts are never trusted ─
    // Mirrors /api/payment/create-intent: the client says whether it wants
    // credits and which promo it is showing; prepare_checkout reserves the real
    // figures. `expectedTotal` is only a consistency check (see step 7b).
    const rawBody = body as Record<string, unknown>
    const useWallet = rawBody.useWallet === true
    const rawPromo = rawBody.promoCode
    const promoCode = typeof rawPromo === 'string' && rawPromo.trim() ? rawPromo.trim() : null
    const expectedTotal =
      typeof rawBody.expectedTotal === 'number' && Number.isFinite(rawBody.expectedTotal)
        ? rawBody.expectedTotal
        : null

    // ── 4. Mode A (blocks) or Mode B (existing bookingId) ────────────────
    // Body shape matches /api/checkout/create so KPayPayment can post here
    // unmodified. Mode A creates the booking; Mode B re-creates a KPay order
    // against an existing booking after expiry. Both are restricted to rows
    // this admin owns — that ownership check is what stops a real customer
    // booking from ever being charged here.
    const rawBlocks = (body as Record<string, unknown>).blocks
    const rawExistingBookingId = (body as Record<string, unknown>).bookingId
    const modeBBookingId =
      typeof rawExistingBookingId === 'string' && rawExistingBookingId.length > 0 ? rawExistingBookingId : null

    let blocks: Block[] = []
    if (!modeBBookingId) {
      if (!Array.isArray(rawBlocks) || rawBlocks.length === 0 || !rawBlocks.every(isValidBlock)) {
        return NextResponse.json({ error: 'Invalid blocks' }, { status: 400 })
      }
      blocks = rawBlocks as Block[]
    }

    const service = getServiceSupabase()
    // KPay pinned to PRODUCTION. Second arg is the forceEnv override — see
    // the file header. getPaymentProvider() is deliberately not used: it
    // reads PAYMENT_PROVIDER=stripe and would charge Stripe.
    const provider = new KPayProvider(undefined, 'prod')

    // Hoisted so both modes fill them and the tail below is shared.
    const bookingIds: string[] = []
    let bookingTotal = 0
    const slotSummary: Json[] = []
    let orderGroupId: string | null = null
    // Rows THIS request inserted. Only these are cancelled on abort — a booking
    // adopted from the page's prepare step is not ours to cancel.
    const createdBookingIds: string[] = []

    // Abort path for every refusal after a booking row exists. Cancels ONLY what
    // this request created — never an adopted booking — and frees the wallet
    // reservation, so a rejected attempt leaves neither a pending orphan nor a
    // stranded credit_hold. Releasing the hold is also what lets the next
    // attempt re-run prepare_checkout and pick up a changed wallet/promo.
    const abortAttempt = async () => {
      if (createdBookingIds.length > 0) {
        const { error: cancelErr } = await service
          .from('bookings')
          .update({ status: 'cancelled' })
          .in('id', createdBookingIds)
        if (cancelErr) {
          console.error('[payment-dev/kpay] failed to cancel created booking', {
            bookingIds: createdBookingIds,
            message: cancelErr.message,
          })
        }
      }
      if (bookingIds.length > 0) {
        await releaseCheckoutHolds(service, { bookingId: bookingIds[0], orderGroupId })
        await releaseCreditHolds(service, adminUserId, bookingIds)
      }
    }
    // Discount breakdown for the audit_log row (req: record amount AND discount).
    const discount: Json = {
      subtotal: 0,
      discountAmount: 0,
      creditDiscount: 0,
      promoDiscount: 0,
      kind: 'none',
      code: null,
    }

    // ── 4b. Mode B: adopt an existing admin test booking ─────────────────
    if (modeBBookingId) {
      const { data: existing, error: existingErr } = await service
        .from('bookings')
        .select(
          'id, user_id, is_test, total_price, status, order_group_id, human_code, date, start_time, table_number, subtotal, credit_discount, promo_discount, discount_snapshot',
        )
        .eq('id', modeBBookingId)
        .maybeSingle()
      if (existingErr || !existing) {
        return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
      }
      const row = existing as Record<string, unknown>
      // Fail closed on anything that is not this admin's own booking. Ownership
      // is the real guard — it is what stops this from ever charging a customer
      // booking. is_test is deliberately NOT required: the page's own prepare
      // step (/api/payment/create-intent) writes is_test = false in production,
      // and the auto-reuse path below adopts those rows.
      if (row.user_id !== adminUserId) {
        return NextResponse.json({ error: 'Not an admin booking' }, { status: 403 })
      }
      if (row.status === 'cancelled' || row.status === 'expired') {
        return NextResponse.json({ error: 'Booking is no longer payable' }, { status: 409 })
      }
      // A grouped cart (several slots) must be re-created as ONE order for the
      // whole group. Pricing only the row the client remembered made every
      // retry of a multi-slot cart fail the expectedTotal check, which the page
      // then showed as "slot taken".
      const groupId = typeof row.order_group_id === 'string' ? row.order_group_id : null
      let rows: Record<string, unknown>[] = [row]
      if (groupId) {
        const { data: siblings } = await service
          .from('bookings')
          .select(
            'id, user_id, total_price, status, order_group_id, human_code, date, start_time, end_time, table_number, subtotal, credit_discount, promo_discount, discount_snapshot',
          )
          .eq('order_group_id', groupId)
          .eq('user_id', adminUserId)
          .in('status', ['pending', 'payment_failed'])
          .order('date', { ascending: true })
          .order('start_time', { ascending: true })
        if (siblings && siblings.length > 0) rows = siblings as Record<string, unknown>[]
      }
      orderGroupId = groupId
      let sumSubtotal = 0
      let sumCredit = 0
      let sumPromo = 0
      for (const r of rows) {
        const price = typeof r.total_price === 'number' ? r.total_price : 0
        bookingIds.push(String(r.id))
        bookingTotal += price
        sumSubtotal += typeof r.subtotal === 'number' ? r.subtotal : price
        sumCredit += typeof r.credit_discount === 'number' ? r.credit_discount : 0
        sumPromo += typeof r.promo_discount === 'number' ? r.promo_discount : 0
        if (r.discount_snapshot && typeof r.discount_snapshot === 'object') {
          const snap = r.discount_snapshot as Record<string, unknown>
          if (typeof snap.code === 'string') discount.code = snap.code
        }
        slotSummary.push({
          slotId: '',
          date: String(r.date ?? ''),
          startTime: String(r.start_time ?? ''),
          endTime: typeof r.end_time === 'string' ? r.end_time : '',
          tableNumber: Number(r.table_number ?? 0),
          price,
        })
      }
      discount.subtotal = sumSubtotal
      discount.creditDiscount = sumCredit
      discount.promoDiscount = sumPromo
      discount.discountAmount = sumCredit + sumPromo
      discount.kind = sumCredit > 0 && sumPromo > 0 ? 'both' : sumCredit > 0 ? 'credits' : sumPromo > 0 ? 'promo' : 'none'
    } else {
    // ── 5. Adopt a pending booking the page's prepare step already minted ─
    // One KPay attempt must produce exactly one booking. If a pending booking
    // for this admin and these exact blocks already exists (it was created by
    // /api/payment/create-intent when the page's gateway mounted), adopt it
    // instead of inserting a second one — prepare_checkout would otherwise ask
    // for the same wallet credits twice and fail with insufficient_credits.
    const reusedRows = blocks.length > 0 ? await findReusableBookings(service, adminUserId, blocks) : null
    if (reusedRows && reusedRows.length > 0) {
      let reusedSubtotal = 0
      let reusedCredit = 0
      let reusedPromo = 0
      for (const row of reusedRows) {
        const id = String(row.id)
        const price = typeof row.total_price === 'number' ? row.total_price : 0
        bookingIds.push(id)
        bookingTotal += price
        const group = typeof row.order_group_id === 'string' ? row.order_group_id : null
        if (group && orderGroupId === null) orderGroupId = group
        reusedSubtotal += typeof row.subtotal === 'number' ? row.subtotal : price
        reusedCredit += typeof row.credit_discount === 'number' ? row.credit_discount : 0
        reusedPromo += typeof row.promo_discount === 'number' ? row.promo_discount : 0
        if (row.discount_snapshot && typeof row.discount_snapshot === 'object') {
          const snap = row.discount_snapshot as Record<string, unknown>
          if (typeof snap.code === 'string') discount.code = snap.code
        }
        slotSummary.push({
          slotId: '',
          date: String(row.date ?? ''),
          startTime: String(row.start_time ?? ''),
          endTime: String(row.end_time ?? ''),
          tableNumber: Number(row.table_number ?? 0),
          price,
        })
      }
      discount.subtotal = reusedSubtotal
      discount.creditDiscount = reusedCredit
      discount.promoDiscount = reusedPromo
      discount.discountAmount = reusedCredit + reusedPromo
      discount.kind =
        reusedCredit > 0 && reusedPromo > 0 ? 'both' : reusedCredit > 0 ? 'credits' : reusedPromo > 0 ? 'promo' : 'none'
    } else {
    // Account lock (same rule as /api/checkout/create): another checkout of this account still has
    // a payable KPay order, so a second one must not start and re-use its credit.
    const accountLock = await getAccountCheckoutLock(service, adminUserId, new URL(req.url).hostname)
    if (accountLock.paidBookingId) {
      return NextResponse.json({ error: 'payment_received', bookingId: accountLock.paidBookingId }, { status: 409 })
    }
    if (accountLock.lockedBookingId) {
      return NextResponse.json(
        { error: 'checkout_locked', bookingId: accountLock.lockedBookingId, lockedUntil: accountLock.lockedUntil },
        { status: 409 },
      )
    }

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

    orderGroupId = blocks.length > 1 ? randomUUID() : null
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
    for (const slotId of slotIds) {
      const slot = await validateSlotLock(slotId, adminUserId)
      if (!slot) {
        await abortAttempt()
        return NextResponse.json({ error: 'Slot lock no longer valid' }, { status: 409 })
      }

      const startHour = parseInt(slot.start_time.slice(0, 2), 10)
      const { slotStart, slotEnd } = slotBounds(slot.date, startHour, slot.duration_hours)
      const quote = calculatePrice(slotStart, slotEnd, tier, periods)
      if (quote.amountInCents <= 0) {
        await abortAttempt()
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
        await abortAttempt()
        return NextResponse.json({ error: 'Could not create booking' }, { status: 500 })
      }

      bookingIds.push(newId)
      createdBookingIds.push(newId)
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
    } // end reuse-or-create / else
    } // end Mode A / else

    // ── 7. prepare_checkout ───────────────────────────────────────────────
    // Writes the authoritative discounted total onto the booking rows AND
    // reserves the credits/promo. Skipped when this checkout already has a live
    // reservation (Mode B, or an adopted booking whose prepare step already
    // held the wallet): calling prepare_checkout twice for one checkout asks
    // for the same credits a second time and gets `insufficient_credits`, since
    // available = balance - already-held.

    const holdAlreadyLive = await hasLiveCreditHold(service, adminUserId, bookingIds, orderGroupId)
    if (!modeBBookingId && !holdAlreadyLive) {
      // Credits capped at subtotal, exactly as /api/payment/create-intent does.
      // The client only says WHETHER it wants credits; the balance is read here.
      let walletCredits = 0
      if (useWallet) {
        const { data: userData } = await service
          .from('users')
          .select('credits')
          .eq('id', adminUserId)
          .maybeSingle()
        walletCredits = Math.min(userData?.credits ?? 0, bookingTotal)
      }

      const prepared = await prepareCheckout(service, {
        bookingId: bookingIds[0],
        userId: adminUserId,
        promoCode,
        walletAmount: walletCredits,
      })
      // An adopted booking whose provider order is already stamped has an
      // immutable discount selection (prepare_checkout answers
      // 'discount_selection_locked'). That is not an error for a retry: the
      // booking already carries the right totals, so reuse them instead of
      // failing the whole checkout (the page used to show this as "slot taken").
      if (!prepared.ok && prepared.failure.reason === 'discount_selection_locked') {
        const { data: lockedRow } = await service
          .from('bookings')
          .select('total_price, subtotal, credit_discount, promo_discount, discount_snapshot')
          .eq('id', bookingIds[0])
          .maybeSingle()
        if (lockedRow) {
          const snap =
            lockedRow.discount_snapshot && typeof lockedRow.discount_snapshot === 'object'
              ? (lockedRow.discount_snapshot as Record<string, unknown>)
              : {}
          const creditD = Number(lockedRow.credit_discount ?? 0)
          const promoD = Number(lockedRow.promo_discount ?? 0)
          bookingTotal = Number(lockedRow.total_price)
          discount.subtotal = Number(lockedRow.subtotal ?? bookingTotal + creditD + promoD)
          discount.discountAmount = creditD + promoD
          discount.creditDiscount = creditD
          discount.promoDiscount = promoD
          discount.kind = typeof snap.kind === 'string' ? snap.kind : 'none'
          discount.code = typeof snap.code === 'string' ? snap.code : null
        }
      }
      const preparedLockedReuse =
        !prepared.ok && prepared.failure.reason === 'discount_selection_locked'
      if (!prepared.ok && !preparedLockedReuse) {
        console.warn('[payment-dev/kpay] prepare_checkout rejected', {
          bookingId: bookingIds[0],
          reason: prepared.failure.reason,
          createdBookingIds,
        })
        await abortAttempt()
        return NextResponse.json(
          {
            error: prepared.failure.reason,
            message:
              'Discounts could not be reserved for this checkout. The booking created by this attempt has been cancelled and any wallet hold released.',
          },
          { status: prepareFailureStatus(prepared.failure.reason) },
        )
      }
      if (prepared.ok) {
        bookingTotal = prepared.prepared.total
        discount.subtotal = prepared.prepared.subtotal
        discount.discountAmount = prepared.prepared.discountAmount
        discount.creditDiscount = prepared.prepared.creditDiscount
        discount.promoDiscount = prepared.prepared.promoDiscount
        discount.kind = prepared.prepared.kind
        discount.code = prepared.prepared.code
      }
    }

    // ── 7b. expectedTotal guard. The UI total is advisory; the server decides.
    // A mismatch means the client is showing a stale figure (credits moved,
    // promo expired, price changed). Refuse BEFORE any KPay call so no order is
    // ever created at an amount the admin did not see.
    if (expectedTotal !== null) {
      const expectedCents = Math.round(expectedTotal * 100)
      const serverCents = Math.round(bookingTotal * 100)
      if (expectedCents !== serverCents) {
        console.warn('[payment-dev/kpay] price_mismatch', {
          bookingIds,
          expectedCents,
          serverCents,
        })
        await abortAttempt()
        const mismatchAudit: Json = {
          outcome: 'price_mismatch',
          expectedCents,
          serverCents,
          bookingTotal,
          discount,
          ip,
        }
        await writeAdminAudit({
          adminUserId,
          adminEmail,
          action: 'payment_dev_kpay',
          targetTable: 'bookings',
          targetId: bookingIds[0],
          beforeValue: null,
          afterValue: mismatchAudit,
          ipAddress: ip,
        })
        // An ADOPTED booking (not created by this request) survives the abort
        // above, still carrying its old discount selection and any live provider
        // order. Return its id so the client can release it through
        // /api/checkout/cancel; otherwise every retry re-adopts the same locked
        // booking and hits this mismatch forever.
        const staleBookingId = createdBookingIds.length === 0 ? bookingIds[0] ?? null : null
        // Release the stale booking here instead of relying on the browser to ask for it: a
        // page that does not send the follow-up cancel (older cached JS, closed tab) would
        // otherwise re-adopt the same locked booking on every attempt. A PAID order is never
        // released. `released: true` tells the page it can create a fresh order straight away.
        const staleReleased = staleBookingId
          ? await releaseStaleCheckout(service, {
              userId: adminUserId,
              bookingId: staleBookingId,
              hostname: new URL(req.url).hostname,
              reason: 'price_changed_open_order_released',
            })
          : false
        return NextResponse.json(
          {
            error: 'price_changed',
            code: 'price_changed',
            total: bookingTotal,
            walletApplied: discount.creditDiscount,
            released: staleReleased,
            ...(staleBookingId ? { bookingId: staleBookingId } : {}),
            ...(staleBookingId && orderGroupId ? { orderGroupId } : {}),
          },
          { status: 409 },
        )
      }
    }

    // ── 7c. Refuse amounts KPay cannot take. Both cases release the holds so
    // an aborted admin test cannot strand the wallet credits. ──────────────
    if (bookingTotal <= 0) {
      await abortAttempt()
      return NextResponse.json(
        {
          error: 'credit_covers_full_price',
          message:
            'Discounted total is HK$0 — credits/promo cover the whole price, so there is nothing for KPay to charge. Clear the discount or use the free-booking confirm path.',
          total: bookingTotal,
          discount,
        },
        { status: 422 },
      )
    }
    if (bookingTotal < KPAY_MIN_AMOUNT_HKD) {
      await abortAttempt()
      return NextResponse.json(
        {
          error: 'below_kpay_minimum',
          message: `Discounted total HK$${bookingTotal.toFixed(2)} is below KPay's minimum of HK$${KPAY_MIN_AMOUNT_HKD.toFixed(2)} (KPay rejects it with 1047 無效金額). Reduce the discount or charge the full amount.`,
          total: bookingTotal,
          minimum: KPAY_MIN_AMOUNT_HKD,
          discount,
        },
        { status: 422 },
      )
    }

    // ── 8. Claim payment attempt ──────────────────────────────────────────
    const primaryBookingId = bookingIds[0]
    // KPay rejects a reused merchant order number (30006 商戶訂單號已存在) and it
    // registers the number even when the order itself fails (e.g. 29542 no payment
    // channel), so any retry or method switch on a booking needs a number KPay has
    // never seen. Counting payment_attempts rows is not reliable for that (a claim
    // can reuse a row), so every admin attempt gets a unique time-based suffix.
    // The KPay webhook strips `-A<suffix>` as a fallback lookup.
    const baseOutTradeNo = humanReadableCode(primaryBookingId)
    const outTradeNo = `${baseOutTradeNo}-A${Date.now().toString(36).toUpperCase()}`
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

    // ── 9. Create the KPay order at the booking's real total ─────────────
    // Real production amount — no test override. prepare_checkout's returned
    // total is the only authoritative figure; never a client-supplied one.
    const kpayAmount = bookingTotal
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
      // A KPay order that never got created cannot be paid, so the reserved
      // credits/promo must not stay locked against this admin's wallet — and the
      // booking this attempt created must not stay pending.
      await abortAttempt()
      const friendlyError = /29542|匹配支付渠道失敗/.test(e.message)
        ? 'KPay has no available channel for this method on the production merchant. Ask KPay to enable it. (' + e.message + ')'
        : e.message
      const failedAudit: Json = {
        method: paymentMethod,
        mode,
        gatewayEnv: KPAY_GATEWAY_ENV,
        outcome: 'create_order_failed',
        error: e.message.slice(0, 240),
        bookingTotal,
        kpayAmount,
        discount,
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
      return NextResponse.json({ error: friendlyError }, { status: 502 })
    }

    // ── 10. Record the KPay order on the payment attempt ──────────────────
    // Without this the attempt stays 'claimed' forever: the webhook's
    // complete_payment_attempt only matches 'pending' rows with an order number,
    // so a paid booking kept an open attempt and the reconcile cron treated it
    // as "no order created". Same call the public route makes.
    if (attemptId) {
      const { error: finalizeErr } = await service.rpc('finalize_payment_attempt', {
        p_attempt_id: attemptId,
        p_provider_order_no: created.providerOrderNo,
      })
      if (finalizeErr) {
        console.error('[payment-dev/kpay] finalize_payment_attempt failed', {
          bookingId: primaryBookingId,
          attemptId,
          message: finalizeErr.message,
        })
      }
    }

    // ── 10b. Stamp the provider order onto the booking group ──────────────
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
      gatewayEnv: KPAY_GATEWAY_ENV,
      outcome: 'order_created',
      providerOrderNo: created.providerOrderNo,
      attemptId,
      orderGroupId,
      bookingIds,
      bookingTotal,
      kpayAmount,
      discount,
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

// Real-money order creation: same-origin only + throttled per admin and IP.
export const POST = withSecurity(handleAdminKpayCreate, {
  csrf: true,
  rateLimit: {
    bucket: 'admin_kpay_create',
    max: 10,
    windowSeconds: 60,
    identifierType: 'both',
  },
})
