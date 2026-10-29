import { NextResponse } from 'next/server'
import { getLegacyServiceSupabase } from '@/lib/supabase/legacy'
import { rateLimit } from '@/lib/rate-limit'
import { getClientIp } from '@/lib/security/audit-log'
import { PaymentXClient } from '@/lib/paymentx/client'
import { logPaymentXEvent } from '@/lib/paymentx/events'
import { settlePaymentXOrder, type PaymentXOrderRow } from '@/lib/paymentx/settle'

export const runtime = 'nodejs'

// POST /api/webhooks/paymentx — KPay 全托管訂單結果通知.
//
// The notify body is only a TRIGGER: the order is found from whichever reference it carries and
// then settlePaymentXOrder asks KPay for the real state. So a body shape we did not expect can
// never confirm (or fail) a booking by itself. Every notify is stored in paymentx_events so the
// exact payload is visible in 後台 → PaymentX.

function flat(payload: Record<string, unknown>): Record<string, unknown> {
  const data = payload.data
  return typeof data === 'object' && data !== null && !Array.isArray(data)
    ? { ...payload, ...(data as Record<string, unknown>) }
    : payload
}

const text = (v: unknown): string => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '')

export async function POST(req: Request) {
  const rawBody = await req.text()
  const timestamp = req.headers.get('k-timestamp')
  const nonceStr = req.headers.get('k-nonce-str')
  const merchantCode = req.headers.get('k-merchant-code')
  const signature = req.headers.get('k-signature')
  const hostname = new URL(req.url).hostname

  let client: PaymentXClient
  try {
    client = new PaymentXClient(hostname)
  } catch (e) {
    console.error('[webhook/paymentx] client init failed', (e as Error).message)
    return new NextResponse('Server configuration error', { status: 500 })
  }

  const reject = async (reason: string): Promise<NextResponse> => {
    const ip = getClientIp(req)
    if (await rateLimit('paymentx_webhook_fail', `ip:${ip}`, 20, 60)) {
      await logPaymentXEvent({
        kind: 'notify_rejected',
        note: reason,
        payload: { body: rawBody.slice(0, 2000), hasHeaders: !!(timestamp && nonceStr && merchantCode && signature) },
      })
    }
    return new NextResponse(reason, { status: 401 })
  }

  if (!timestamp || !nonceStr || !merchantCode || !signature) return reject('missing signature headers')

  const ours = (process.env.KPAY_MERCHANT_CODE ?? '').trim()
  if (ours && merchantCode.trim() !== ours) return reject('merchant code mismatch')

  const pathname = new URL(req.url).pathname
  if (!client.verifyNotify(rawBody, { timestamp, nonceStr, merchantCode, signature }, pathname)) {
    return reject('invalid signature')
  }

  let payload: Record<string, unknown>
  try {
    payload = JSON.parse(rawBody) as Record<string, unknown>
  } catch {
    return new NextResponse('Invalid JSON', { status: 400 })
  }
  const p = flat(payload)

  const managedOrderNo = text(p.managedOrderNo)
  const managedOutTradeNo = text(p.managedOutTradeNo)
  const outTradeNo = text(p.outTradeNo)

  await logPaymentXEvent({
    kind: 'notify',
    managedOrderNo: managedOrderNo || null,
    note: `managedOutTradeNo=${managedOutTradeNo || '-'} outTradeNo=${outTradeNo || '-'} state=${text(p.managedOrderState) || text(p.transactionState) || text(p.result) || '-'}`,
    payload,
  })

  const db = getLegacyServiceSupabase()
  const columns = 'id, booking_id, order_group_id, user_id, managed_out_trade_no, managed_order_no, amount, status, paid_order_no, is_test'
  let order: PaymentXOrderRow | null = null
  const lookups: [string, string][] = [
    ['managed_order_no', managedOrderNo],
    ['managed_out_trade_no', managedOutTradeNo],
    ['managed_out_trade_no', outTradeNo],
  ]
  for (const [column, value] of lookups) {
    if (!value) continue
    const { data } = await db.from('paymentx_orders').select(columns).eq(column, value).order('created_at', { ascending: false }).limit(1)
    const row = ((data ?? [])[0] as PaymentXOrderRow | undefined) ?? undefined
    if (row) {
      order = row
      break
    }
  }

  if (!order) {
    await logPaymentXEvent({ kind: 'notify_unmatched', managedOrderNo: managedOrderNo || null, note: 'no PaymentX order matches this notify' })
    return new NextResponse('OK', { status: 200 })
  }

  try {
    const outcome = await settlePaymentXOrder(order, 'webhook', hostname)
    await logPaymentXEvent({ kind: 'notify_settled', bookingId: order.booking_id, managedOrderNo: order.managed_order_no, note: outcome })
  } catch (e) {
    console.error('[webhook/paymentx] settle threw', (e as Error).message)
    // 500 → KPay retries the notify later.
    return new NextResponse('Settle failed', { status: 500 })
  }
  return new NextResponse('OK', { status: 200 })
}
