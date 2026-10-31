import { getLegacyServiceSupabase } from '@/lib/supabase/legacy'
import { PaymentXClient } from '@/lib/paymentx/client'
import { logPaymentXEvent } from '@/lib/paymentx/events'
import { adminMailShell, mailFacts, sendAdminMail } from '@/lib/admin/alertMail'
import { sendCaseEmail } from './email'
import { CASE_COLUMNS, casePayUrl, toCaseRow } from './service'

// settleCasePayment — the one place that turns "KPay says this managed order is paid" into a
// paid violation case. Called from the pay-page poll and the KPay notify route, so the two can
// never disagree. The notify body is only a trigger: the real state is always asked from KPay.
//
//   paid    → mark the attempt + case paid, email a receipt. Idempotent.
//   amount differs from what we asked / case no longer payable → needs_review (money was
//             collected, a human decides; this code NEVER refunds)
//   pending / unknown → nothing changes (never decide on a failed lookup)
//   expired / closed → attempt marked, case stays payable so the member can open a new order

export type CasePaymentRow = {
  id: string
  case_id: string
  managed_out_trade_no: string
  managed_order_no: string | null
  amount: number | string
  status: string
}

export type CaseSettleOutcome = 'paid' | 'already_paid' | 'needs_review' | 'pending' | 'closed' | 'unknown' | 'not_found'

export const CASE_PAYMENT_COLUMNS = 'id, case_id, managed_out_trade_no, managed_order_no, amount, status'

export async function findCasePayment(ref: { managedOrderNo?: string; managedOutTradeNo?: string }): Promise<CasePaymentRow | null> {
  const db = getLegacyServiceSupabase()
  const lookups: [string, string | undefined][] = [
    ['managed_order_no', ref.managedOrderNo],
    ['managed_out_trade_no', ref.managedOutTradeNo],
  ]
  for (const [column, value] of lookups) {
    if (!value) continue
    const { data } = await db.from('violation_case_payments').select(CASE_PAYMENT_COLUMNS).eq(column, value).order('created_at', { ascending: false }).limit(1)
    const row = ((data ?? [])[0] as CasePaymentRow | undefined) ?? undefined
    if (row) return row
  }
  return null
}

export async function settleCasePayment(payment: CasePaymentRow, hostname: string): Promise<CaseSettleOutcome> {
  if (payment.status === 'paid') return 'already_paid'
  if (payment.status === 'needs_review') return 'needs_review'
  if (!payment.managed_order_no) return 'pending'

  const db = getLegacyServiceSupabase()
  const client = new PaymentXClient(hostname)
  const result = await client.queryManagedOrder({ managedOrderNo: payment.managed_order_no })
  const now = new Date().toISOString()

  if (result.state === 'pending') return 'pending'
  if (result.state === 'unknown') return 'unknown'

  if (result.state === 'expired' || result.state === 'closed') {
    await db
      .from('violation_case_payments')
      .update({ status: result.state === 'expired' ? 'expired' : 'closed', updated_at: now, completed_at: now })
      .eq('id', payment.id)
      .in('status', ['creating', 'pending'])
    return 'closed'
  }

  if (result.state !== 'paid') return 'unknown'

  const { data: caseRaw } = await db.from('violation_cases').select(CASE_COLUMNS).eq('id', payment.case_id).maybeSingle()
  const c = toCaseRow(caseRaw)
  const expected = Number(payment.amount)
  const paidOrderNo = result.paidOrderNo

  const park = async (reason: string): Promise<CaseSettleOutcome> => {
    // Never overwrite an attempt another request already settled as paid.
    const { data: parked } = await db
      .from('violation_case_payments')
      .update({ status: 'needs_review', paid_order_no: paidOrderNo, failure_reason: reason, updated_at: now, completed_at: now })
      .eq('id', payment.id)
      .in('status', ['creating', 'pending', 'expired', 'closed'])
      .select('id')
    if (!parked || parked.length === 0) return 'already_paid'
    await logPaymentXEvent({ kind: 'case_needs_review', managedOrderNo: payment.managed_order_no, note: reason })
    console.error('[cases/settle] needs_review', payment.managed_out_trade_no, reason)
    // Money was collected but the case cannot take it: tell every admin, once (the guard above makes this run once).
    try {
      await sendAdminMail({
        audience: 'all-admins',
        subject: `【需處理】違規個案收到款項但需人手核對（${c?.case_no ?? payment.managed_out_trade_no}）`,
        html: adminMailShell(
          '違規個案款項需核對',
          mailFacts([
            ['個案', c?.case_no ?? '—'],
            ['KPay 訂單', payment.managed_order_no ?? '—'],
            ['金額', `HK$${expected}`],
            ['原因', reason],
          ]),
          'critical',
          '請到 KPay 後台核對，需要時退款，不會自動退款',
        ),
      })
    } catch (e) {
      console.error('[cases/settle] alert mail failed', (e as Error).message)
    }
    return 'needs_review'
  }

  if (!c) return park('case_missing')
  const amountOk = result.payAmount !== null && Math.abs(result.payAmount - expected) < 0.005
  if (!amountOk) return park(`amount_mismatch kpay=${result.payAmount} expected=${expected}`)
  // Waived / cancelled while the member was already in the cashier: money arrived for a closed case.
  // A second payment for a case that is already paid (e.g. the first cashier order was still open): park it.
  if (c.status === 'paid') return park('duplicate_payment_case_already_paid')
  if (c.status !== 'notified' && c.status !== 'overdue') return park(`case_${c.status}_but_paid`)

  await db
    .from('violation_case_payments')
    .update({ status: 'paid', paid_order_no: paidOrderNo, updated_at: now, completed_at: now })
    .eq('id', payment.id)
    .in('status', ['creating', 'pending'])

  // The status guard makes a concurrent notify + poll settle exactly once.
  const { data: flipped } = await db
    .from('violation_cases')
    .update({ status: 'paid', paid_at: now, updated_at: now })
    .eq('id', c.id)
    .in('status', ['notified', 'overdue'])
    .select('id')
  if (!flipped || flipped.length === 0) return 'already_paid'

  await logPaymentXEvent({ kind: 'case_paid', managedOrderNo: payment.managed_order_no, note: `${c.case_no} HK$${expected}` })

  const { data: member } = await db.from('users').select('email, display_name, is_blacklisted').eq('id', c.user_id).maybeSingle()
  const m = member as { email?: string | null; display_name?: string | null; is_blacklisted?: boolean } | null
  if (m?.email) {
    await sendCaseEmail('paid', {
      to: m.email,
      memberName: m.display_name ?? '',
      caseNo: c.case_no,
      scenario: c.scenario,
      title: c.title,
      detail: c.detail,
      amount: c.amount,
      incidentAt: c.incident_at,
      dueAt: c.due_at,
      payUrl: casePayUrl(c.pay_token),
      blacklisted: m.is_blacklisted === true,
    })
  }
  await db.from('admin_notifications').insert({ user_id: c.user_id, title: '違規個案已繳付', message: `個案 ${c.case_no}（${c.title}）費用 HK$${c.amount} 已收到，個案已結案。`, type: 'system', read: false })
  return 'paid'
}
