/**
 * Admin Sales Report API — §11.2.
 *
 * GET /api/admin/sales-report?from=YYYY-MM-DD&to=YYYY-MM-DD
 * Returns: { rows: DailyRow[], summary: Summary }
 *
 * Aggregates from bookings + payment_attempts tables.
 * Security: requires admin auth (getAdminData).
 * Design system: admin-theme.css variables only. NO inline hex, NO shadows, NO `any`.
 */

import { NextResponse } from 'next/server'
import { getAdminData } from '@/lib/data/getAdmin'
import { getServiceSupabase } from '@/lib/supabase/service'

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function num(row: Record<string, unknown>, key: string, fallback: number): number {
  const v = row[key]
  return typeof v === 'number' ? v : fallback
}

function str(row: Record<string, unknown>, key: string): string | null {
  const v = row[key]
  return typeof v === 'string' && v.length > 0 ? v : null
}

export async function GET(req: Request) {
  try {
    const admin = await getAdminData()
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const url = new URL(req.url)
    const from = url.searchParams.get('from')
    const to = url.searchParams.get('to')

    if (!from || !to) {
      return NextResponse.json({ error: 'from and to query params required' }, { status: 400 })
    }

    const service = getServiceSupabase()

    // Fetch all bookings in range with payment info
    const { data: bookings, error: bookingErr } = await service
      .from('bookings')
      .select('id, created_at, total_price, status')
      .gte('created_at', `${from}T00:00:00`)
      .lte('created_at', `${to}T23:59:59`)
      .order('created_at', { ascending: true })

    if (bookingErr) {
      console.error('[admin/sales-report] bookings query error', { message: bookingErr.message })
      return NextResponse.json({ error: 'Query failed' }, { status: 500 })
    }

    // Fetch payment attempts in range
    const { data: payments, error: paymentErr } = await service
      .from('payment_attempts')
      .select('id, booking_id, method, amount, status, created_at')
      .gte('created_at', `${from}T00:00:00`)
      .lte('created_at', `${to}T23:59:59`)
      .order('created_at', { ascending: true })

    if (paymentErr) {
      console.error('[admin/sales-report] payments query error', { message: paymentErr.message })
      // Non-fatal — continue without payment method breakdown
    }

    // Build daily aggregation
    const dailyMap: Record<string, {
      revenue: number
      bookings: number
      paidCount: number
      pendingCount: number
      failedCount: number
      methods: Record<string, number>
    }> = {}

    // Iterate bookings
    const bookingList = Array.isArray(bookings) ? bookings : []
    for (const b of bookingList) {
      if (!isRecord(b)) continue
      const createdAt = str(b as Record<string, unknown>, 'created_at')
      if (!createdAt) continue
      const day = createdAt.slice(0, 10)

      if (!dailyMap[day]) {
        dailyMap[day] = { revenue: 0, bookings: 0, paidCount: 0, pendingCount: 0, failedCount: 0, methods: {} }
      }

      dailyMap[day].bookings += 1

      const status = str(b as Record<string, unknown>, 'status')
      if (status === 'confirmed' || status === 'completed') {
        dailyMap[day].paidCount += 1
        dailyMap[day].revenue += num(b as Record<string, unknown>, 'total_price', 0)
      } else if (status === 'pending' || status === 'awaiting_payment') {
        dailyMap[day].pendingCount += 1
      } else if (status === 'cancelled' || status === 'failed') {
        dailyMap[day].failedCount += 1
      }
    }

    // Overlay payment method breakdown
    const paymentList = Array.isArray(payments) ? payments : []
    for (const p of paymentList) {
      if (!isRecord(p)) continue
      const createdAt = str(p as Record<string, unknown>, 'created_at')
      if (!createdAt) continue
      const day = createdAt.slice(0, 10)
      const payStatus = str(p as Record<string, unknown>, 'status')
      if (payStatus !== 'success') continue

      if (!dailyMap[day]) {
        dailyMap[day] = { revenue: 0, bookings: 0, paidCount: 0, pendingCount: 0, failedCount: 0, methods: {} }
      }

      const method = str(p as Record<string, unknown>, 'method') ?? 'other'
      dailyMap[day].methods[method] = (dailyMap[day].methods[method] ?? 0) + 1
    }

    // Build rows array (fill missing days with zeros)
    const rows: {
      date: string
      revenue: number
      bookings: number
      avgOrderValue: number
      method_breakdown: Record<string, number>
    }[] = []

    let totalRevenue = 0
    let totalBookings = 0
    let paidCount = 0
    let pendingCount = 0
    let failedCount = 0

    // Generate all dates in range
    const start = new Date(`${from}T00:00:00`)
    const end = new Date(`${to}T00:00:00`)
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const day = d.toISOString().slice(0, 10)
      const entry = dailyMap[day] ?? { revenue: 0, bookings: 0, paidCount: 0, pendingCount: 0, failedCount: 0, methods: {} }

      rows.push({
        date: day,
        revenue: entry.revenue,
        bookings: entry.bookings,
        avgOrderValue: entry.paidCount > 0 ? Math.round(entry.revenue / entry.paidCount) : 0,
        method_breakdown: entry.methods,
      })

      totalRevenue += entry.revenue
      totalBookings += entry.bookings
      paidCount += entry.paidCount
      pendingCount += entry.pendingCount
      failedCount += entry.failedCount
    }

    return NextResponse.json({
      rows,
      summary: {
        totalRevenue,
        totalBookings,
        avgOrderValue: paidCount > 0 ? Math.round(totalRevenue / paidCount) : 0,
        paidCount,
        pendingCount,
        failedCount,
      },
    })
  } catch (err) {
    console.error('[admin/sales-report] GET error', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
