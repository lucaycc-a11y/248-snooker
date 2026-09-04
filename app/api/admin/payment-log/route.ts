/**
 * GET /api/admin/payment-log
 *
 * Paginated payment_attempts query with anomaly detection.
 *
 * Anomaly tiers:
 *  - Tier 1 ("orphaned"):  payment_attempts.booking_id IS NULL
 *  - Tier 1 ("no_match"):  payment_attempts.booking_id → no booking row exists
 *  - Tier 1 ("unconfirmed"): booking exists but status != confirmed
 *  - Tier 2 ("webhook_only"): kpay webhook with eventType='SALES' & transactionState=2
 *                            (authoritative payment success) but NO matching
 *                            payment_attempt — strongest evidence of a lost
 *                            booking attempt. Surfaced as a separate card on the
 *                            Payment Log page.
 *
 * Amount source:
 *  - Primary:  bookings.total_price (LEFT JOIN via booking_id)
 *  - Fallback: webhook_events.payload.payAmount (when booking_id is null AND
 *              a matching webhook exists via outTradeNo = bookings.human_code,
 *              OR via direct provider_order_no = webhook payload.orderNo for
 *              orphan payment_attempts)
 *
 * Auth: getAdminData() guard.
 */

import { NextResponse } from 'next/server'
import { getAdminData } from '@/lib/data/getAdmin'
import { getServiceSupabase } from '@/lib/supabase/service'
import { str } from '@/lib/data/adminReadHelpers'

export const runtime = 'nodejs'

const PAGE_SIZE = 30

type Row = Record<string, unknown>

// ── Tier 2 detection (webhook with no matching payment_attempt) ────────────
//
// A "lost" payment: kpay has authoritatively confirmed a sale (eventType=SALES,
// transactionState=2 means accepted/successful), but no payment_attempts row
// exists for that booking. We match by:
//   1) outTradeNo = bookings.human_code (the SPACE8 booking code)
//   2) payment_attempts.provider_order_no = webhook.payload.orderNo
// Both produce 14 paid webhooks total in the live data; 9 are unmatched → Tier 2.
//
// `payment_attempts.provider_order_no` always equals `webhook.payload.orderNo`
// when both exist (the gateway order number is identical in both tables). The
// kpay outTradeNo is the SPACE8 human_code, NOT the provider_order_no — that's
// why matching by provider_order_no alone misses orphan attempts that DO exist
// but were created with a different human_code.
type Tier2Entry = {
  outTradeNo: string | null
  orderNo: string | null
  bookingId: string | null
  bookingStatus: string | null
  amount: number | null
  receivedAt: string | null
}

async function fetchTier2Anomalies(service: ReturnType<typeof getServiceSupabase>): Promise<Tier2Entry[]> {
  // 1) All processed kpay webhooks for SALES with state=2 (authoritative success)
  //    PostgREST's jsonb filter: payload->>eventType = 'SALES' AND
  //    payload->>transactionState = '2' AND status = 'processed'
  const { data: paidWebhooks } = await service
    .from('webhook_events')
    .select('id, received_at, payload')
    .eq('status', 'processed')
    .eq('payload->>eventType', 'SALES')
    .eq('payload->>transactionState', '2')

  const paidRows = (paidWebhooks ?? []) as Row[]
  if (paidRows.length === 0) return []

  // 2) Collect outTradeNo + orderNo
  const outTradeNos = new Set<string>()
  const orderNos = new Set<string>()
  for (const w of paidRows) {
    const ot = str(w.payload as Row, ['outTradeNo'])
    const on = str(w.payload as Row, ['orderNo'])
    if (ot) outTradeNos.add(ot)
    if (on) orderNos.add(on)
  }

  // 3) Build lookup maps for matched payments + bookings
  const { data: matchedPas } = await service
    .from('payment_attempts')
    .select('id, provider_order_no, booking_id')
    .in('provider_order_no', [...orderNos])
  const matchedOrderNos = new Set((matchedPas ?? []).map((p) => p.provider_order_no))

  const { data: matchedBks } = await service
    .from('bookings')
    .select('id, human_code, status')
    .in('human_code', [...outTradeNos])
  const bkByCode = new Map<string, { id: string; status: string }>()
  for (const b of (matchedBks ?? []) as Row[]) {
    const code = str(b, ['human_code'])
    const id = str(b, ['id'])
    const status = str(b, ['status'])
    if (code && id && status) bkByCode.set(code, { id, status })
  }

  // 4) Webhooks that have NO matching payment_attempt (by provider_order_no)
  const tier2: Tier2Entry[] = []
  for (const w of paidRows) {
    const ot = str(w.payload as Row, ['outTradeNo'])
    const on = str(w.payload as Row, ['orderNo'])
    if (on && matchedOrderNos.has(on)) continue // has a payment_attempt → not Tier 2
    const bk = ot ? bkByCode.get(ot) : null
    tier2.push({
      outTradeNo: ot,
      orderNo: on,
      bookingId: bk?.id ?? null,
      bookingStatus: bk?.status ?? null,
      amount: typeof w.payload?.payAmount === 'number' ? (w.payload.payAmount as number) : null,
      receivedAt: str(w, ['received_at']),
    })
  }
  return tier2
}

export async function GET(req: Request) {
  try {
    const admin = await getAdminData()
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized — admin only' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1)
    const status = searchParams.get('status') ?? null
    const dateFrom = searchParams.get('dateFrom') ?? null
    const dateTo = searchParams.get('dateTo') ?? null
    const anomalyOnly = searchParams.get('anomaly') === '1'

    const service = getServiceSupabase()

    // ── Tier 2 anomalies (independent of payment_attempts listing) ──────────
    // Pulled first so the client can show a prominent card on top of the list.
    const tier2 = await fetchTier2Anomalies(service)

    // ── Build base query ───────────────────────────────────────────────────
    // NOTE: payment_attempts has NO `amount` column. Amount is sourced from
    // bookings.total_price (LEFT JOIN via booking_id) with webhook payload
    // fallback for orphaned payment_attempts.
    let query = service
      .from('payment_attempts')
      .select(
        'id, booking_id, provider, provider_order_no, status, failure_code, failure_reason, created_at, completed_at',
        { count: 'exact' },
      )
      .order('created_at', { ascending: false })

    if (status) query = query.eq('status', status)
    if (dateFrom) query = query.gte('created_at', `${dateFrom}T00:00:00`)
    if (dateTo) query = query.lte('created_at', `${dateTo}T23:59:59`)

    // When filtering anomaly-only, fetch all (no pagination) then post-filter
    // because the anomaly check needs a cross-table LEFT JOIN we do in JS.
    if (!anomalyOnly) {
      const from = (page - 1) * PAGE_SIZE
      query = query.range(from, from + PAGE_SIZE - 1)
    }

    const { data, error, count } = await query
    if (error) {
      console.error('[payment-log] query_failed', { message: error.message })
      return NextResponse.json({ error: 'Query failed' }, { status: 500 })
    }

    const rows = (data ?? []) as Row[]

    // ── Build lookup maps for amount source + Tier 1 anomaly check ──────────
    const bookingIds = [
      ...new Set(
        rows
          .map((r) => str(r, ['booking_id']))
          .filter((id): id is string => typeof id === 'string' && id.length > 0),
      ),
    ]

    const bookingStatusMap = new Map<string, string>()
    const bookingPriceMap = new Map<string, number>()
    if (bookingIds.length > 0) {
      for (let i = 0; i < bookingIds.length; i += 50) {
        const chunk = bookingIds.slice(i, i + 50)
        const { data: bookings } = await service
          .from('bookings')
          .select('id, status, total_price')
          .in('id', chunk)
        for (const b of (bookings ?? []) as Row[]) {
          const bid = str(b, ['id'])
          const bstatus = str(b, ['status'])
          const price = typeof b.total_price === 'number' ? b.total_price : null
          if (bid && bstatus) bookingStatusMap.set(bid, bstatus)
          if (bid && price !== null) bookingPriceMap.set(bid, price)
        }
      }
    }

    // ── Webhook-amount fallback for orphaned payment_attempts ───────────────
    // Orphaned = booking_id IS NULL. The provider_order_no matches
    // webhook_events.payload.orderNo, so we can recover the amount from there.
    const orphanOrderNos = [
      ...new Set(
        rows
          .filter((r) => !str(r, ['booking_id']))
          .map((r) => str(r, ['provider_order_no']))
          .filter((o): o is string => typeof o === 'string' && o.length > 0),
      ),
    ]
    const webhookAmountByOrderNo = new Map<string, { amount: number; outTradeNo: string | null }>()
    if (orphanOrderNos.length > 0) {
      const { data: whRows } = await service
        .from('webhook_events')
        .select('payload')
        .eq('status', 'processed')
        .in('payload->>orderNo', orphanOrderNos)
      for (const w of (whRows ?? []) as Row[]) {
        const p = w.payload as Row | undefined
        const on = str(p ?? {}, ['orderNo'])
        const amt = typeof p?.payAmount === 'number' ? (p.payAmount as number) : null
        const ot = str(p ?? {}, ['outTradeNo'])
        if (on && amt !== null) webhookAmountByOrderNo.set(on, { amount: amt, outTradeNo: ot })
      }
    }

    // ── Classify each row ──────────────────────────────────────────────────
    const enriched = rows.map((r) => {
      const bookingId = str(r, ['booking_id'])
      let anomaly: string | null = null

      if (!bookingId) {
        anomaly = 'orphaned'
      } else if (!bookingStatusMap.has(bookingId)) {
        anomaly = 'no_match'
      } else {
        const bStatus = bookingStatusMap.get(bookingId)!
        if (bStatus !== 'confirmed' && bStatus !== 'completed') {
          anomaly = 'unconfirmed'
        }
      }

      // Amount resolution: bookings.total_price first, webhook payload fallback
      let amount: number | null = null
      let amountSource: 'booking' | 'webhook' | null = null
      if (bookingId && bookingPriceMap.has(bookingId)) {
        amount = bookingPriceMap.get(bookingId)!
        amountSource = 'booking'
      } else {
        const on = str(r, ['provider_order_no'])
        const wb = on ? webhookAmountByOrderNo.get(on) : null
        if (wb) {
          amount = wb.amount
          amountSource = 'webhook'
        }
      }

      return {
        id: str(r, ['id']),
        bookingId,
        provider: str(r, ['provider']),
        providerOrderNo: r.provider_order_no ? String(r.provider_order_no) : null,
        status: str(r, ['status']),
        failureCode: r.failure_code ? String(r.failure_code) : null,
        failureReason: r.failure_reason ? String(r.failure_reason) : null,
        amount,
        amountSource,
        createdAt: str(r, ['created_at']),
        completedAt: r.completed_at ? String(r.completed_at) : null,
        anomaly,
      }
    })

    const filtered = anomalyOnly ? enriched.filter((r) => r.anomaly !== null) : enriched
    const paginated = anomalyOnly
      ? filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
      : filtered

    return NextResponse.json({
      payments: paginated,
      total: anomalyOnly ? filtered.length : (count ?? 0),
      page,
      pageSize: PAGE_SIZE,
      tier2Anomalies: tier2,
      tier2Total: tier2.length,
    })
  } catch (err) {
    const e = err as Error
    console.error('[payment-log] error', { message: e.message, stack: e.stack })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
