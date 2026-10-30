/**
 * Admin-made KPay 全託管 (hosted cashier) payment links, for when the website cannot take a
 * payment itself. The cashier page is KPay's, so the link works even if space8.com.hk is down.
 *
 *   createCsPaymentLink → holds the slot for the customer, creates a pending PaymentX booking at
 *                         the server-side price, opens ONE managed order and returns signed links.
 *   refreshCsPaymentLink → asks KPay what happened; if still open, returns fresh signed links.
 *
 * Paying books the slot through settlePaymentXOrder (webhook / admin 核實), which also sends the
 * booking confirmation email. Nothing here refunds or moves money.
 */

import { randomUUID } from 'node:crypto'
import { getServiceSupabase } from '@/lib/supabase/service'
import { getLegacyServiceSupabase } from '@/lib/supabase/legacy'
import { calculatePrice } from '@/lib/pricing'
import { humanReadableCode } from '@/lib/qr/jwt'
import { loadPeriods, resolveTierForUser, validateSlotLock, slotBounds, periodForStart } from '@/lib/booking/server'
import { isSlotStillBookable, isValidSlotStart, slotStartInHongKong } from '@/lib/booking/slot-cutoff'
import { isTestBooking } from '@/lib/env/test-booking'
import { prepareCheckout, releaseCheckoutHolds } from '@/lib/checkout/prepare'
import { parseRpc, isLockSlotResult } from '@/lib/supabase/rpc-parse'
import { PaymentXClient } from '@/lib/paymentx/client'
import { logPaymentXEvent } from '@/lib/paymentx/events'
import { settlePaymentXOrder, type PaymentXOrderRow, type SettleOutcome } from '@/lib/paymentx/settle'
import { logPaymentEvent } from '@/lib/payments/payment-events'
import { logSiteError } from '@/lib/errors/log'
import { writeAdminActionLog } from '@/lib/admin/audit'
import { getResend } from '@/lib/resend/client'
import { emailButton, emailParagraph, escapeHtml, renderEmailLayout } from '@/lib/resend/layout'
import { addCaseNote, getCustomer } from './core'

// Matches the 25-minute window the stale-booking sweep gives an open hosted-cashier order.
const HOLD_MINUTES = 25

export type CsLinkResult =
  | {
      ok: true
      bookingId: string
      humanCode: string
      amount: number
      standardAmount: number
      managedOrderNo: string
      phoneUrl: string
      desktopUrl: string
      holdMinutes: number
    }
  | { ok: false; error: string }

type Admin = { id: string; email: string }

export async function createCsPaymentLink(input: {
  admin: Admin
  userId: string
  date: string
  startHour: number
  duration: number
  tableNumber: 1 | 2
  caseId?: string | null
  origin: string
  hostname: string
  /** Admin-set price in HK$. Omitted = the standard server-side price. */
  customPrice?: number | null
}): Promise<CsLinkResult> {
  const { admin, userId, date, startHour, duration, tableNumber } = input
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isInteger(startHour) || !Number.isInteger(duration) || duration < 1 || duration > 8) {
    return { ok: false, error: '日期、開始時間或時數不正確' }
  }
  if (!isValidSlotStart(date, startHour)) return { ok: false, error: '開始時間不正確' }
  if (!isSlotStillBookable(slotStartInHongKong(date, startHour))) return { ok: false, error: '呢個時段已過截止時間，不能再預約' }
  const customer = await getCustomer(userId)
  if (!customer) return { ok: false, error: '找不到這位會員' }

  const service = getServiceSupabase()
  const db = getLegacyServiceSupabase()
  const isTest = isTestBooking(input.hostname)

  const periods = await loadPeriods()
  const tier = await resolveTierForUser(userId)
  const { slotStart, slotEnd } = slotBounds(date, startHour, duration)
  const quote = calculatePrice(slotStart, slotEnd, tier, periods)
  if (quote.amountInCents <= 0) return { ok: false, error: '金額為 0，不能用付款連結' }

  // 1. Hold the slot for this customer (authoritative guard against double booking).
  const { data: lockData, error: lockErr } = await service.rpc('find_or_lock_slot', {
    p_user_id: userId,
    p_date: date,
    p_start_time: `${String(startHour).padStart(2, '0')}:00:00`,
    p_duration_hours: duration,
    p_table_number: tableNumber,
    p_price: quote.total,
    p_lock_minutes: HOLD_MINUTES,
  })
  if (lockErr) return { ok: false, error: '呢個時段暫時未能預留（可能已被預約）' }
  const lock = parseRpc('find_or_lock_slot', lockData, isLockSlotResult)
  if (!lock.success || !lock.slot_id) return { ok: false, error: '呢個時段已被預約或鎖定，請揀其他時段' }

  const slot = await validateSlotLock(lock.slot_id, userId)
  if (!slot) return { ok: false, error: '時段鎖定失敗，請重試' }
  if (isTest) await service.from('slots').update({ is_test: true }).eq('id', slot.id)

  const { data: taken } = await service.from('bookings').select('id').eq('slot_id', slot.id).eq('status', 'confirmed').maybeSingle()
  if (taken) return { ok: false, error: '呢個時段啱啱俾人訂咗' }

  // 2. Pending booking at the server-side price.
  const bookingId = randomUUID()
  const humanCode = humanReadableCode(bookingId)
  const isWeekend = slotStart.getDay() === 0 || slotStart.getDay() === 6
  const { error: insErr } = await service.from('bookings').insert({
    id: bookingId,
    user_id: userId,
    slot_id: slot.id,
    date: slot.date,
    start_time: slot.start_time,
    end_time: slot.end_time,
    duration_hours: slot.duration_hours,
    period: periodForStart(startHour, isWeekend, periods),
    total_price: quote.total,
    base_price: quote.total,
    subtotal: quote.total,
    status: 'pending',
    table_number: slot.table_number,
    is_free_booking: false,
    is_test: isTest,
    human_code: humanCode,
    payment_method: 'paymentx',
    payment_provider: 'paymentx',
    admin_note: `客務付款連結（管理員：${admin.email}）`,
  })
  if (insErr) {
    await logSiteError('cs/payment-link', 'error', 'pending booking insert failed', { message: insErr.message, userId })
    return { ok: false, error: '建立預約失敗' }
  }

  const prepared = await prepareCheckout(service, { bookingId, userId, promoCode: null, walletAmount: 0 })
  if (!prepared.ok) {
    await releaseCheckoutHolds(service, { bookingId, orderGroupId: null })
    return { ok: false, error: `未能準備付款（${prepared.failure.reason}）` }
  }
  let total = prepared.prepared.total
  const standardTotal = total
  const custom = input.customPrice
  if (custom !== undefined && custom !== null && (Number.isNaN(custom) || Math.abs(custom - total) > 0.009)) {
    if (!Number.isFinite(custom) || custom < 1.5 || custom > 5000) {
      await releaseCheckoutHolds(service, { bookingId, orderGroupId: null })
      return { ok: false, error: '自訂價錢必須介乎 HK$1.5 至 HK$5000' }
    }
    const rounded = Math.round(custom * 100) / 100
    const { error: priceErr } = await service
      .from('bookings')
      .update({
        total_price: rounded,
        base_price: rounded,
        subtotal: rounded,
        admin_note: `客務付款連結（管理員：${admin.email}）；自訂價錢 HK$${rounded}（標準價 HK$${standardTotal}）`,
      })
      .eq('id', bookingId)
    if (priceErr) {
      await releaseCheckoutHolds(service, { bookingId, orderGroupId: null })
      return { ok: false, error: '未能設定價錢，請重試' }
    }
    total = rounded
  }
  if (total <= 0) {
    await releaseCheckoutHolds(service, { bookingId, orderGroupId: null })
    return { ok: false, error: '金額為 0，不能用付款連結' }
  }

  // 3. One hosted-cashier order for this booking.
  const { data: inserted, error: orderErr } = await db
    .from('paymentx_orders')
    .insert({ booking_id: bookingId, user_id: userId, managed_out_trade_no: humanCode, amount: total, status: 'creating', is_test: isTest })
    .select('id')
    .single()
  if (orderErr || !inserted) {
    await releaseCheckoutHolds(service, { bookingId, orderGroupId: null })
    return { ok: false, error: '建立付款單失敗' }
  }
  const rowId = (inserted as { id: string }).id

  let client: PaymentXClient
  let managedOrderNo: string
  try {
    client = new PaymentXClient(input.hostname)
    const created = await client.createManagedOrder({
      managedOutTradeNo: humanCode,
      amount: total,
      itemName: `Space8 預約 ${humanCode}`,
      baseUrl: input.origin,
      returnUrl: `${input.origin}/book/paymentx?bookingId=${encodeURIComponent(bookingId)}`,
      remark: humanCode,
    })
    managedOrderNo = created.managedOrderNo
  } catch (e) {
    const msg = e instanceof Error ? e.message : '未知錯誤'
    await db.from('paymentx_orders').update({ status: 'failed', failure_reason: msg.slice(0, 240), updated_at: new Date().toISOString() }).eq('id', rowId)
    await releaseCheckoutHolds(service, { bookingId, orderGroupId: null })
    await logSiteError('cs/payment-link', 'error', 'managed order creation failed', { bookingId, message: msg })
    return { ok: false, error: msg.startsWith('PaymentX') ? msg : `KPay 建單失敗：${msg}` }
  }

  await db.from('paymentx_orders').update({ status: 'pending', managed_order_no: managedOrderNo, updated_at: new Date().toISOString() }).eq('id', rowId)
  await db.from('cs_payment_links').insert({
    created_by: admin.email,
    case_id: input.caseId ?? null,
    user_id: userId,
    booking_id: bookingId,
    managed_order_no: managedOrderNo,
    amount: total,
    note: `${total !== standardTotal ? `自訂價 HK$${total}（標準 HK$${standardTotal}）· ` : ''}${date} ${String(startHour).padStart(2, '0')}:00 × ${duration}h 房${tableNumber}`,
  })
  await logPaymentEvent({
    bookingId,
    orderGroupId: null,
    event: 'paymentx_order_created',
    source: 'admin',
    providerOrderNo: managedOrderNo,
    meta: { managedOutTradeNo: humanCode, amount: total, via: 'cs_payment_link', admin: admin.email },
  })
  await logPaymentXEvent({ kind: 'order_created', bookingId, managedOrderNo, note: `CS link ${humanCode} HK$${total}` })
  try {
    await writeAdminActionLog({
      adminUserId: admin.id,
      adminEmail: admin.email,
      actionType: 'cs_payment_link_created',
      targetTable: 'bookings',
      targetId: bookingId,
      afterJsonb: { userId, date, startHour, duration, tableNumber, amount: total, standardAmount: standardTotal, customPrice: total !== standardTotal },
    })
  } catch {
    /* audit is best-effort */
  }
  if (input.caseId) {
    await addCaseNote(input.caseId, admin.email, 'payment_link', `已生成付款連結：${humanCode}，HK$${total}${total !== standardTotal ? `（自訂，標準價 HK$${standardTotal}）` : ''}，${date} ${String(startHour).padStart(2, '0')}:00 × ${duration}h 房${tableNumber}`)
  }

  return {
    ok: true,
    bookingId,
    humanCode,
    amount: total,
    standardAmount: standardTotal,
    managedOrderNo,
    phoneUrl: client.buildCashierUrl(managedOrderNo, 'h5'),
    desktopUrl: client.buildCashierUrl(managedOrderNo, 'web'),
    holdMinutes: HOLD_MINUTES,
  }
}

export type CsLinkStatus = {
  outcome: SettleOutcome
  bookingStatus: string | null
  humanCode: string | null
  phoneUrl?: string
  desktopUrl?: string
}

/** 核實付款 / 重新生成連結: asks KPay, confirms the booking if paid, else returns fresh signed links. */
export async function refreshCsPaymentLink(input: { bookingId: string; hostname: string; adminEmail: string; caseId?: string | null }): Promise<CsLinkStatus | null> {
  const db = getLegacyServiceSupabase()
  const { data } = await db
    .from('paymentx_orders')
    .select('id, booking_id, order_group_id, user_id, managed_out_trade_no, managed_order_no, amount, status, paid_order_no, is_test')
    .eq('booking_id', input.bookingId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  const order = data as PaymentXOrderRow | null
  if (!order) return null
  const outcome = await settlePaymentXOrder(order, 'admin', input.hostname)
  const { data: b } = await db.from('bookings').select('status, human_code').eq('id', input.bookingId).maybeSingle()
  const booking = b as { status: string; human_code: string | null } | null
  const result: CsLinkStatus = { outcome, bookingStatus: booking?.status ?? null, humanCode: booking?.human_code ?? null }
  if (outcome === 'pending' && order.managed_order_no) {
    const client = new PaymentXClient(input.hostname)
    result.phoneUrl = client.buildCashierUrl(order.managed_order_no, 'h5')
    result.desktopUrl = client.buildCashierUrl(order.managed_order_no, 'web')
  }
  if (input.caseId && (outcome === 'confirmed' || outcome === 'already_confirmed')) {
    await addCaseNote(input.caseId, input.adminEmail, 'payment_link', `付款已確認，預約 ${result.humanCode ?? ''} 已成功，確認電郵已發送`)
  }
  return result
}

/** Emails the payment link to the customer (works even while the website is down). */
export async function emailPaymentLinkToCustomer(input: {
  userId: string
  url: string
  humanCode: string
  amount: number
  summary: string
  adminEmail: string
  caseId?: string | null
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const customer = await getCustomer(input.userId)
  if (!customer?.email) return { ok: false, error: '這位會員沒有登記電郵' }
  const html = renderEmailLayout({
    locale: 'zh-HK',
    title: 'Space8 付款連結',
    preheader: `請完成付款 HK$${input.amount}`,
    bodyHtml:
      emailParagraph(escapeHtml(`你好${customer.displayName ? ` ${customer.displayName}` : ''}，`)) +
      emailParagraph('我哋網站暫時未能正常使用，已為你預留以下時段。請按下面按鈕完成付款，付款成功後系統會自動確認預約，並電郵確認書俾你。') +
      emailParagraph(escapeHtml(`${input.summary}　應付 HK$${input.amount}　（預約編號 ${input.humanCode}）`)) +
      emailButton(escapeHtml(input.url), '前往付款') +
      emailParagraph('時段只為你預留一段短時間，請盡快完成付款。如連結已過期，請聯絡我哋重新發出。', { muted: true, small: true }),
    footerHtml: 'Space8 · 如有疑問請 WhatsApp 我哋',
  })
  const { error } = await getResend().emails.send({
    from: 'SPACE8 <no-reply@space8.com.hk>',
    to: customer.email,
    subject: `Space8 付款連結 · ${input.humanCode}`,
    html,
  })
  if (error) return { ok: false, error: `電郵發送失敗：${error.message}` }
  if (input.caseId) await addCaseNote(input.caseId, input.adminEmail, 'payment_link', `已電郵付款連結（${input.humanCode}）俾客人`)
  return { ok: true }
}

/** Standard (server-side, config-driven) price for a slot, for the admin to see before overriding. */
export async function quoteCsSlot(input: { userId: string; date: string; startHour: number; duration: number }): Promise<{ ok: true; total: number } | { ok: false; error: string }> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date) || !Number.isInteger(input.startHour) || !Number.isInteger(input.duration) || input.duration < 1 || input.duration > 8) {
    return { ok: false, error: '請先填好日期、開始時間和時數' }
  }
  if (!isValidSlotStart(input.date, input.startHour)) return { ok: false, error: '開始時間不正確' }
  const periods = await loadPeriods()
  const tier = await resolveTierForUser(input.userId)
  const { slotStart, slotEnd } = slotBounds(input.date, input.startHour, input.duration)
  return { ok: true, total: calculatePrice(slotStart, slotEnd, tier, periods).total }
}

export type CsAvailability =
  | { ok: true; rooms: Record<'1' | '2', { free: boolean; conflict: string | null }>; pastCutoff: boolean }
  | { ok: false; error: string }

/**
 * Is [startHour, startHour + duration) free on each room? Mirrors the conflict rule in the
 * find_or_lock_slot RPC (booked slots, or someone else's live hold), so the admin sees the answer
 * before generating a link. The RPC remains the authoritative guard at creation time.
 */
export async function checkCsAvailability(input: { userId: string; date: string; startHour: number; duration: number; hostname: string }): Promise<CsAvailability> {
  const { userId, date, startHour, duration } = input
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isInteger(startHour) || !Number.isInteger(duration) || duration < 1 || duration > 8) {
    return { ok: false, error: '請先填好日期、開始時間和時數' }
  }
  const isTest = isTestBooking(input.hostname)
  const reqStart = Date.parse(`${date}T${String(startHour).padStart(2, '0')}:00:00Z`)
  const reqEnd = reqStart + duration * 3600_000
  const day = (offset: number) => new Date(Date.parse(`${date}T00:00:00Z`) + offset * 86_400_000).toISOString().slice(0, 10)
  const { data, error } = await getLegacyServiceSupabase()
    .from('slots')
    .select('table_number, date, start_time, duration_hours, status, locked_by, locked_until, is_test')
    .gte('date', day(-1))
    .lte('date', day(1))
    .in('table_number', [1, 2])
    .in('status', ['booked', 'locked'])
  if (error) return { ok: false, error: '暫時未能查詢時段' }
  const rooms: Record<'1' | '2', { free: boolean; conflict: string | null }> = { '1': { free: true, conflict: null }, '2': { free: true, conflict: null } }
  for (const r of (data ?? []) as Record<string, unknown>[]) {
    if (r.is_test === true && !isTest) continue
    const live = r.status === 'booked' || (r.status === 'locked' && typeof r.locked_until === 'string' && Date.parse(r.locked_until) > Date.now() && r.locked_by !== userId)
    if (!live) continue
    const start = Date.parse(`${String(r.date)}T${String(r.start_time).slice(0, 8)}Z`)
    const end = start + Number(r.duration_hours) * 3600_000
    if (start < reqEnd && end > reqStart) {
      const key = String(r.table_number) === '2' ? '2' : '1'
      if (rooms[key].free) {
        const hh = (ms: number) => new Date(ms).toISOString().slice(11, 16)
        rooms[key] = { free: false, conflict: `${hh(start)}–${hh(end)} ${r.status === 'booked' ? '已被預約' : '被預留中'}` }
      }
    }
  }
  return { ok: true, rooms, pastCutoff: !isSlotStillBookable(slotStartInHongKong(date, startHour)) }
}
