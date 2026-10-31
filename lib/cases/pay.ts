import { getLegacyServiceSupabase } from '@/lib/supabase/legacy'
import { PaymentXClient } from '@/lib/paymentx/client'
import { logPaymentXEvent } from '@/lib/paymentx/events'
import { siteUrl, type CaseRow } from './service'
import { PAYABLE_STATUSES } from './scenarios'

// Start (or resume) a hosted-cashier payment for a violation case.
//
// A KPay managed order only lives ~10 minutes, so a pay link in an email cannot point at a
// cashier URL directly. Instead the link opens /pay/case/<token>; this function runs when the
// member taps "pay": it reuses a still-fresh live order, otherwise closes the stale one and
// opens a new order (decided from KPay's own order state). At most one order per case is live (unique index in the migration), so a
// double tap can never produce two payable orders.

type PaymentRow = {
  id: string
  case_id: string
  managed_out_trade_no: string
  managed_order_no: string | null
  amount: number | string
  status: string
  created_at: string
}

const PAYMENT_COLUMNS = 'id, case_id, managed_out_trade_no, managed_order_no, amount, status, created_at'

export type StartPayResult =
  | { ok: true; payUrl: string; existing: boolean }
  | { ok: false; error: string; code: 'not_payable' | 'amount' | 'config' | 'gateway' | 'busy' }

export async function startCasePayment(c: CaseRow, hostname: string, mode: 'web' | 'h5'): Promise<StartPayResult> {
  if (!PAYABLE_STATUSES.includes(c.status)) return { ok: false, code: 'not_payable', error: '此個案目前不需要繳付' }
  if (!(c.amount >= 1.5)) return { ok: false, code: 'amount', error: '此個案沒有需要繳付的金額' }

  let client: PaymentXClient
  try {
    client = new PaymentXClient(hostname)
  } catch (e) {
    console.error('[cases/pay] client init failed', (e as Error).message)
    return { ok: false, code: 'config', error: '付款系統暫時未能使用，請稍後再試或聯絡我們' }
  }

  const db = getLegacyServiceSupabase()
  const now = Date.now()

  const { data: liveRows } = await db
    .from('violation_case_payments')
    .select(PAYMENT_COLUMNS)
    .eq('case_id', c.id)
    .in('status', ['creating', 'pending'])
    .order('created_at', { ascending: false })
    .limit(1)
  const live = ((liveRows ?? [])[0] as PaymentRow | undefined) ?? undefined

  if (live) {
    if (live.status === 'creating' && now - new Date(live.created_at).getTime() < 30_000) {
      return { ok: false, code: 'busy', error: '付款正在建立中，請稍候數秒再試' }
    }
    // Ask KPay, not our clock: an order stays payable until KPay says otherwise, so opening a
    // second order while the first is still open could let the member pay twice.
    if (live.managed_order_no) {
      try {
        const result = await client.queryManagedOrder({ managedOrderNo: live.managed_order_no })
        if (result.state === 'paid') return { ok: false, code: 'busy', error: '系統正在確認你的付款，請稍後重新整理頁面' }
        if (result.state === 'pending') {
          return { ok: true, payUrl: client.buildCashierUrl(live.managed_order_no, mode), existing: true }
        }
      } catch {
        return { ok: false, code: 'gateway', error: '暫時未能確認付款狀態，請稍後再試' }
      }
    }
    await db
      .from('violation_case_payments')
      .update({ status: 'expired', updated_at: new Date().toISOString(), completed_at: new Date().toISOString() })
      .eq('id', live.id)
  }

  const { count } = await db.from('violation_case_payments').select('id', { count: 'exact', head: true }).eq('case_id', c.id)
  const managedOutTradeNo = `${c.case_no}-${(count ?? 0) + 1}`

  const { data: inserted, error: insertError } = await db
    .from('violation_case_payments')
    .insert({ case_id: c.id, managed_out_trade_no: managedOutTradeNo, amount: c.amount, status: 'creating' })
    .select(PAYMENT_COLUMNS)
    .single()
  if (insertError || !inserted) {
    // 23505 on the one-live-per-case index = another tap won the race.
    if (insertError?.code === '23505') return { ok: false, code: 'busy', error: '付款正在建立中，請稍候數秒再試' }
    console.error('[cases/pay] insert failed', insertError?.message)
    return { ok: false, code: 'gateway', error: '未能建立付款，請稍後再試' }
  }
  const row = inserted as PaymentRow

  try {
    const base = siteUrl()
    const created = await client.createManagedOrder({
      managedOutTradeNo,
      amount: c.amount,
      itemName: `${c.title}（個案 ${c.case_no}）`,
      baseUrl: base,
      returnUrl: `${base}/pay/case/${c.pay_token}?from=kpay`,
      remark: c.case_no,
    })
    await db
      .from('violation_case_payments')
      .update({ managed_order_no: created.managedOrderNo, status: 'pending', updated_at: new Date().toISOString() })
      .eq('id', row.id)
    await logPaymentXEvent({ kind: 'case_order_created', managedOrderNo: created.managedOrderNo, note: `${managedOutTradeNo} HK$${c.amount}` })
    return { ok: true, payUrl: client.buildCashierUrl(created.managedOrderNo, mode), existing: false }
  } catch (e) {
    const message = (e as Error).message
    await db
      .from('violation_case_payments')
      .update({ status: 'failed', failure_reason: message.slice(0, 300), updated_at: new Date().toISOString(), completed_at: new Date().toISOString() })
      .eq('id', row.id)
    await logPaymentXEvent({ kind: 'case_order_failed', note: `${managedOutTradeNo}: ${message}` })
    return { ok: false, code: 'gateway', error: '未能連接付款系統，請稍後再試' }
  }
}
