/**
 * GET /api/admin/payment-log
 *
 * Paginated payment_attempts query with anomaly detection.
 * Anomaly = payment_attempts.booking_id has no matching confirmed booking,
 * OR booking_id is null (orphaned payment).
 *
 * Auth: getAdminData() guard.
 */

import { NextResponse } from 'next/server'
import { getAdminData } from '@/lib/data/getAdmin'
import { getServiceSupabase } from '@/lib/supabase/service'
import { num, str } from '@/lib/data/adminReadHelpers'

export const runtime = 'nodejs'

const PAGE_SIZE = 30

type PaymentRow = Record<string, unknown>

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

    // ── Build base query ──────────────────────────────────────────────────
    let query = service
      .from('payment_attempts')
      .select(
        'id, booking_id, provider, provider_order_no, status, failure_code, failure_reason, amount, created_at, completed_at',
        { count: 'exact' },
      )
      .order('created_at', { ascending: false })

    if (status) query = query.eq('status', status)
    if (dateFrom) query = query.gte('created_at', `${dateFrom}T00:00:00`)
    if (dateTo) query = query.lte('created_at', `${dateTo}T23:59:59`)

    // When filtering anomaly-only, we fetch all (no pagination) then post-filter
    // because the anomaly check is a cross-table LEFT JOIN we do in JS.
    // For normal queries, paginate normally.
    if (!anomalyOnly) {
      const from = (page - 1) * PAGE_SIZE
      query = query.range(from, from + PAGE_SIZE - 1)
    }

    const { data, error, count } = await query
    if (error) {
      console.error('[payment-log] query_failed', { message: error.message })
      return NextResponse.json({ error: 'Query failed' }, { status: 500 })
    }

    const rows = (data ?? []) as PaymentRow[]

    // ── Anomaly detection: check booking_id references ────────────────────
    // Collect unique booking_ids to batch-check
    const bookingIds = [
      ...new Set(
        rows
          .map((r) => str(r, ['booking_id']))
          .filter((id): id is string => typeof id === 'string' && id.length > 0),
      ),
    ]

    // Map of booking_id → status (only for bookings that exist)
    const bookingStatusMap = new Map<string, string>()
    if (bookingIds.length > 0) {
      // Batch in chunks of 50 to avoid overly large IN clauses
      for (let i = 0; i < bookingIds.length; i += 50) {
        const chunk = bookingIds.slice(i, i + 50)
        const { data: bookings } = await service
          .from('bookings')
          .select('id, status')
          .in('id', chunk)

        for (const b of (bookings ?? []) as PaymentRow[]) {
          const bid = str(b, ['id'])
          const bstatus = str(b, ['status'])
          if (bid && bstatus) bookingStatusMap.set(bid, bstatus)
        }
      }
    }

    // ── Classify each row ─────────────────────────────────────────────────
    const enriched = rows.map((r) => {
      const bookingId = str(r, ['booking_id'])
      let anomaly: string | null = null

      if (!bookingId) {
        anomaly = 'orphaned' // payment has no booking_id at all
      } else if (!bookingStatusMap.has(bookingId)) {
        anomaly = 'no_match' // booking_id points to non-existent booking
      } else {
        const bStatus = bookingStatusMap.get(bookingId)!
        if (bStatus !== 'confirmed' && bStatus !== 'completed') {
          anomaly = 'unconfirmed' // booking exists but is not confirmed
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
        amount: num(r, ['amount'], 0),
        createdAt: str(r, ['created_at']),
        completedAt: r.completed_at ? String(r.completed_at) : null,
        anomaly,
      }
    })

    // Filter anomaly-only if requested
    const filtered = anomalyOnly
      ? enriched.filter((r) => r.anomaly !== null)
      : enriched

    // Paginate anomaly results (since we fetched all)
    const paginated = anomalyOnly
      ? filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
      : filtered

    return NextResponse.json({
      payments: paginated,
      total: anomalyOnly ? filtered.length : (count ?? 0),
      page,
      pageSize: PAGE_SIZE,
    })
  } catch (err) {
    const e = err as Error
    console.error('[payment-log] error', { message: e.message, stack: e.stack })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
