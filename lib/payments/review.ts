/**
 * Manual resolution of a payment_review booking: the customer's money arrived
 * but the system could not confirm the booking (usually the slot went to
 * someone else). A person decides:
 *
 *   confirm  → try to confirm anyway. confirm_booking refuses status
 *              payment_review, so the row is first moved back to 'cancelled'
 *              (which the RPC accepts); the RPC re-checks the slot itself and
 *              either confirms, or puts the row back into payment_review.
 *   refunded → the admin refunded the customer in the KPay backend (this app
 *              never moves money). The booking is closed as 'refunded'.
 *
 * Every outcome is written to admin_note, payment_events and audit_log.
 */
import { getLegacyServiceSupabase } from '@/lib/supabase/legacy'
import { humanReadableCode } from '@/lib/qr/jwt'
import { logPaymentEvent } from '@/lib/payments/payment-events'

export type ReviewDecision = 'confirm' | 'refunded'
export type ReviewResult =
  | { ok: true; outcome: 'confirmed' | 'refunded' }
  | { ok: false; reason: 'not_found' | 'not_in_review' | 'no_payment_found' | 'slot_conflict' | 'failed'; message: string }

type Row = { id: string; status: string; order_group_id: string | null; total_price: number | null; admin_note: string | null; human_code: string | null }

export async function resolvePaymentReview(input: {
  bookingId: string
  decision: ReviewDecision
  note: string
  adminEmail: string
}): Promise<ReviewResult> {
  const db = getLegacyServiceSupabase()
  const { data: first } = await db
    .from('bookings')
    .select('id, status, order_group_id, total_price, admin_note, human_code')
    .eq('id', input.bookingId)
    .maybeSingle()
  const booking = first as Row | null
  if (!booking) return { ok: false, reason: 'not_found', message: '找不到預約' }
  if (booking.status !== 'payment_review') return { ok: false, reason: 'not_in_review', message: '這張預約已不在「待審核」狀態' }

  const { data: groupRows } = booking.order_group_id
    ? await db.from('bookings').select('id, status, order_group_id, total_price, admin_note, human_code').eq('order_group_id', booking.order_group_id)
    : { data: [booking] }
  const rows = ((groupRows ?? [booking]) as Row[]).filter((r) => r.status === 'payment_review')

  const { data: attempts } = await db
    .from('payment_attempts')
    .select('provider_order_no, created_at')
    .in('booking_id', rows.map((r) => r.id))
    .not('provider_order_no', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
  const orderNo = ((attempts ?? []) as { provider_order_no: string | null }[])[0]?.provider_order_no ?? null

  const stamp = new Date().toISOString()
  const noteLine = (text: string) => `[${stamp}] ${input.adminEmail}: ${text}${input.note ? `（${input.note}）` : ''}`
  const appendNote = async (r: Row, text: string) =>
    db.from('bookings').update({ admin_note: `${r.admin_note ? `${r.admin_note}\n` : ''}${noteLine(text)}` }).eq('id', r.id)

  if (input.decision === 'refunded') {
    for (const r of rows) {
      const { error } = await db
        .from('bookings')
        .update({
          status: 'refunded',
          refund_amount: r.total_price ?? 0,
          refunded_at: stamp,
          admin_note: `${r.admin_note ? `${r.admin_note}\n` : ''}${noteLine('審核：已在 KPay 退款，預約關閉')}`,
        })
        .eq('id', r.id)
        .eq('status', 'payment_review')
      if (error) return { ok: false, reason: 'failed', message: '更新失敗，請重試' }
    }
    await logPaymentEvent({ bookingId: booking.id, orderGroupId: booking.order_group_id, providerOrderNo: orderNo, event: 'review_refunded', source: 'admin', fromState: 'payment_review', toState: 'refunded', reason: input.note || null })
    return { ok: true, outcome: 'refunded' }
  }

  // decision === 'confirm'
  if (!orderNo) return { ok: false, reason: 'no_payment_found', message: '找不到這張預約的付款記錄，不能確認；請核對 KPay 後改用「已退款」' }

  for (const r of rows) {
    await db.from('bookings').update({ status: 'cancelled' }).eq('id', r.id).eq('status', 'payment_review')
  }
  let success = false
  let reason = ''
  try {
    if (booking.order_group_id) {
      const qr: Record<string, string> = {}
      for (const r of rows) qr[r.id] = r.human_code ?? humanReadableCode(r.id)
      const { data, error } = await db.rpc('confirm_booking_group', {
        p_order_group_id: booking.order_group_id,
        p_payment_intent_id: orderNo,
        p_payment_method: 'kpay',
        p_qr_codes: qr,
        p_event_id: `review:${orderNo}`,
      })
      const res = data as { success?: boolean; reason?: string } | null
      success = !error && res?.success !== false
      reason = res?.reason ?? error?.message ?? ''
    } else {
      const { data, error } = await db.rpc('confirm_booking', {
        p_booking_id: booking.id,
        p_payment_intent_id: orderNo,
        p_payment_method: 'kpay',
        p_qr_code: booking.human_code ?? humanReadableCode(booking.id),
        p_event_id: `review:${orderNo}`,
      })
      const res = data as { success?: boolean; reason?: string } | null
      success = !error && res?.success !== false
      reason = res?.reason ?? error?.message ?? ''
    }
  } catch (e) {
    reason = (e as Error).message
  }

  if (!success) {
    // Put every row back exactly as it was so nothing is lost.
    await db.from('bookings').update({ status: 'payment_review' }).in('id', rows.map((r) => r.id)).in('status', ['cancelled'])
    const conflict = /slot_conflict/.test(reason)
    for (const r of rows) await appendNote(r, conflict ? '審核：嘗試確認但時段已被佔用' : `審核：確認失敗（${reason || '未知原因'}）`)
    return conflict
      ? { ok: false, reason: 'slot_conflict', message: '時段已被其他客人佔用，不能確認。請在 KPay 退款後改用「已退款」' }
      : { ok: false, reason: 'failed', message: `確認失敗：${reason || '未知原因'}` }
  }

  await db.rpc('complete_payment_attempt', { p_provider_order_no: orderNo, p_provider: 'kpay' })
  for (const r of rows) await appendNote(r, '審核：已人手確認預約')
  await logPaymentEvent({ bookingId: booking.id, orderGroupId: booking.order_group_id, providerOrderNo: orderNo, event: 'review_confirmed', source: 'admin', fromState: 'payment_review', toState: 'confirmed', reason: input.note || null })
  return { ok: true, outcome: 'confirmed' }
}
