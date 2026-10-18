import { getServiceSupabase } from '@/lib/supabase/service'
import { num, str, type Row } from '@/lib/data/adminReadHelpers'
import { logSiteError } from '@/lib/errors/log'
import { getHiddenUserList } from '@/lib/data/getHiddenUserIds'
import {
  emptyTotals,
  type PromoUsageRow,
  type RevenueBucket,
  type RevenueDetailRow,
  type RevenueTotals,
} from '@/lib/admin/revenue-definitions'

// Shared loader for /admin/revenue and the Excel export. Both read this file so
// the screen and the workbook cannot disagree.
//
// Recognition rules (Luca, 2026-10-18 — see revenue-definitions.ts):
//   • Money is bucketed on `bookings.date`, the play date, not `created_at`.
//     A September purchase for an October session belongs to October.
//   • `bookings.date` is a plain date, so a "day" is already a Hong Kong
//     calendar day. No UTC shifting is applied and none should be.
//   • 收入 = Σ total_price where status = 'confirmed' (amount collected).
//   • 退款 = Σ refund_amount on rows that have one, any status — a refund can
//     sit on a booking whose status is no longer 'confirmed'.
//
// Hidden accounts are filtered here, in the shared loader — never in the
// browser. A hidden-list failure is a load failure, not a silent include.

const DETAIL_PAGE_SIZE = 50

export type AdminRevenueQuery = {
  /** Inclusive, `bookings.date`, YYYY-MM-DD. */
  from: string
  /** Inclusive, `bookings.date`, YYYY-MM-DD. */
  to: string
  paymentMethod?: string | null
  includeTest?: boolean
  includeHidden?: boolean
  detailPage?: number
  /**
   * Skip detail paging and return every row. The Excel export needs the full
   * set; the screen pages it so a big month doesn't render 10k rows.
   */
  allDetail?: boolean
}

export type AdminRevenueDailyRow = {
  date: string
  revenue: number
  count: number
  refund: number
}

export type AdminRevenueReconciliation = {
  /** payment_attempts rows whose created_at falls in the range. */
  attemptsInRange: number
  /** Of those, how many carry a booking_id that exists. */
  linkedToBooking: number
  /** attemptsInRange − linkedToBooking. */
  orphaned: number
  /** Stated on the page — the table has no amount column. */
  note: string
}

export type AdminRevenueResult = {
  totals: RevenueTotals
  daily: AdminRevenueDailyRow[]
  byMethod: RevenueBucket[]
  byTable: RevenueBucket[]
  byPeriod: RevenueBucket[]
  promos: PromoUsageRow[]
  detail: RevenueDetailRow[]
  detailTotal: number
  detailPage: number
  detailPageSize: number
  reconciliation: AdminRevenueReconciliation
  /** Non-null means the figures are NOT a real zero — the UI must banner it. */
  error: string | null
}

function emptyResult(query: AdminRevenueQuery, error: string | null): AdminRevenueResult {
  return {
    totals: emptyTotals(),
    daily: [],
    byMethod: [],
    byTable: [],
    byPeriod: [],
    promos: [],
    detail: [],
    detailTotal: 0,
    detailPage: Math.max(1, query.detailPage ?? 1),
    detailPageSize: DETAIL_PAGE_SIZE,
    reconciliation: {
      attemptsInRange: 0,
      linkedToBooking: 0,
      orphaned: 0,
      note: 'payment_attempts 沒有金額欄位，對帳只能核對預約關聯，不能核對金額。',
    },
    error,
  }
}

function bucketAdd(map: Map<string, RevenueBucket>, key: string, label: string, amount: number, count: number): void {
  const existing = map.get(key)
  if (existing) {
    existing.revenue += amount
    existing.count += count
    return
  }
  map.set(key, { key, label, revenue: amount, count })
}

const PERIOD_LABELS: Record<string, string> = {
  morning: '早上',
  afternoon: '下午',
  evening: '晚上',
  night: '深夜',
}

function periodLabel(value: string | null): string {
  if (value === null) return '未填'
  return PERIOD_LABELS[value] ?? value
}

const METHOD_LABELS: Record<string, string> = {
  card: '信用卡',
  alipay: 'Alipay HK',
  alipay_cn: '支付寶',
  google_pay: 'Google Pay',
  apple_pay: 'Apple Pay',
  wechat_pay: '微信支付',
  credit: 'Credit',
  cash: '現金',
}

function methodLabel(value: string | null): string {
  if (value === null) return '未填'
  return METHOD_LABELS[value] ?? value
}

export async function getAdminRevenue(query: AdminRevenueQuery): Promise<AdminRevenueResult> {
  const from = query.from
  const to = query.to
  const paymentMethod = query.paymentMethod ?? null
  const includeTest = query.includeTest === true
  const includeHidden = query.includeHidden === true
  const detailPage = Math.max(1, query.detailPage ?? 1)

  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || from > to) {
    return emptyResult(query, '日期範圍無效')
  }

  const service = getServiceSupabase()

  let hiddenIds: Set<string>
  try {
    hiddenIds = (await getHiddenUserList()).ids
  } catch (hiddenErr) {
    const message = hiddenErr instanceof Error ? hiddenErr.message : String(hiddenErr)
    console.error('[admin/revenue] hidden-user list failed', hiddenErr)
    await logSiteError('admin.revenue', 'error', '隱藏帳戶清單載入失敗', { message })
    return emptyResult(query, `隱藏帳戶清單載入失敗：${message}`)
  }

  const dropHidden = !includeHidden && hiddenIds.size > 0

  // Money columns pulled in one pass; the row count is small (a month of venue
  // bookings) and every figure below is derived from this set, so the KPI tiles
  // and the Excel sheets are guaranteed to see the same rows.
  const SELECT = [
    'id',
    'human_code',
    'date',
    'start_time',
    'table_number',
    'status',
    'payment_method',
    'period',
    'total_price',
    'promo_code',
    'promo_discount',
    'points_discount',
    'credit_discount',
    'refund_amount',
    'is_test',
    'user_id',
    'member_code',
    'created_at',
  ].join(', ')

  let rows: Row[]
  try {
    let q = service
      .from('bookings')
      .select(SELECT)
      .gte('date', from)
      .lte('date', to)
      .order('date', { ascending: true })
      .order('start_time', { ascending: true })
    if (!includeTest) q = q.eq('is_test', false)
    if (paymentMethod) q = q.eq('payment_method', paymentMethod)
    const { data, error } = await q
    if (error) throw error
    // `SELECT` is built with `.join(', ')`, so the generated type collapses to
    // `GenericStringError`. The rows are real; read them through `unknown`.
    rows = (data ?? []) as unknown as Row[]
  } catch (queryErr) {
    const message = queryErr instanceof Error ? queryErr.message : String(queryErr)
    console.error('[admin/revenue] bookings query failed', queryErr)
    await logSiteError('admin.revenue', 'error', '收入資料載入失敗', { message })
    return emptyResult(query, `收入資料載入失敗：${message}`)
  }

  // User display fields live on `users`; resolve in one batch (no declared FK,
  // same reason getAdminBookings falls back to a merge).
  const userIds = Array.from(
    new Set(rows.map((r) => r.user_id).filter((v): v is string => typeof v === 'string'))
  )
  const usersById = new Map<string, { name: string | null; phone: string | null; code: string | null }>()
  if (userIds.length > 0) {
    try {
      const { data: users, error: usersErr } = await service
        .from('users')
        .select('id, display_name, phone, member_code')
        .in('id', userIds.slice(0, 1000))
      if (usersErr) throw usersErr
      // Supabase's generated select type collapses to `GenericStringError` for
      // this column list; the rows are real, so read them through `unknown`.
      for (const u of ((users ?? []) as unknown as Row[])) {
        usersById.set(String(u.id), {
          name: str(u, ['display_name']),
          phone: str(u, ['phone']),
          code: str(u, ['member_code']),
        })
      }
    } catch (usersErr) {
      const message = usersErr instanceof Error ? usersErr.message : String(usersErr)
      console.error('[admin/revenue] users lookup failed', usersErr)
      await logSiteError('admin.revenue', 'error', '收入會員資料載入失敗', { message })
      return emptyResult(query, `收入會員資料載入失敗：${message}`)
    }
  }

  const totals = emptyTotals()
  const dailyMap = new Map<string, AdminRevenueDailyRow>()
  const methodMap = new Map<string, RevenueBucket>()
  const tableMap = new Map<string, RevenueBucket>()
  const periodMap = new Map<string, RevenueBucket>()
  const promoMap = new Map<string, PromoUsageRow>()
  const detail: RevenueDetailRow[] = []
  let hiddenDropped = 0

  for (const row of rows) {
    const userId = typeof row.user_id === 'string' ? row.user_id : null
    const isHiddenUser = userId !== null && hiddenIds.has(userId)
    if (dropHidden && isHiddenUser) {
      hiddenDropped += 1
      continue
    }

    const day = str(row, ['date']) ?? ''
    const status = str(row, ['status']) ?? 'unknown'
    const price = num(row, ['total_price'], 0)
    const refund = num(row, ['refund_amount'], 0)
    const promoDiscount = num(row, ['promo_discount'], 0)
    const pointsDiscount = num(row, ['points_discount'], 0)
    const creditDiscount = num(row, ['credit_discount'], 0)
    const isConfirmed = status === 'confirmed'

    // 退款 counts wherever a refund amount exists, regardless of status.
    totals.refund += refund

    if (isConfirmed) {
      totals.revenue += price
      totals.bookingCount += 1
      totals.promoDiscount += promoDiscount
      totals.pointsDiscount += pointsDiscount
      totals.creditDiscount += creditDiscount

      const method = str(row, ['payment_method'])
      const table = num(row, ['table_number'], 0)
      const period = str(row, ['period'])
      bucketAdd(methodMap, method ?? 'unspecified', methodLabel(method), price, 1)
      bucketAdd(tableMap, String(table), `#${table}`, price, 1)
      bucketAdd(periodMap, period ?? 'unspecified', periodLabel(period), price, 1)

      const code = str(row, ['promo_code'])
      if (code !== null) {
        const existing = promoMap.get(code)
        if (existing) {
          existing.uses += 1
          existing.totalDiscount += promoDiscount
        } else {
          promoMap.set(code, { code, uses: 1, totalDiscount: promoDiscount })
        }
      }
    }

    if (day !== '') {
      let d = dailyMap.get(day)
      if (!d) {
        d = { date: day, revenue: 0, count: 0, refund: 0 }
        dailyMap.set(day, d)
      }
      if (isConfirmed) {
        d.revenue += price
        d.count += 1
      }
      d.refund += refund
    }

    const user = userId !== null ? usersById.get(userId) ?? null : null
    detail.push({
      id: String(row.id ?? ''),
      humanCode: str(row, ['human_code']),
      date: day,
      startTime: str(row, ['start_time']) ?? '',
      tableNumber: typeof row.table_number === 'number' ? row.table_number : null,
      memberName: user?.name ?? null,
      memberPhone: user?.phone ?? null,
      memberCode: user?.code ?? str(row, ['member_code']),
      status,
      paymentMethod: str(row, ['payment_method']),
      amount: price,
      promoCode: str(row, ['promo_code']),
      promoDiscount,
      refundAmount: refund,
      isTest: row.is_test === true,
      isHiddenUser,
    })
  }

  totals.net = totals.revenue - totals.refund
  totals.averagePerBooking =
    totals.bookingCount > 0 ? Math.round((totals.revenue / totals.bookingCount) * 100) / 100 : 0

  // Fill missing days so the chart has a continuous x-axis across the range.
  const daily: AdminRevenueDailyRow[] = []
  {
    const cursor = new Date(`${from}T00:00:00Z`)
    const end = new Date(`${to}T00:00:00Z`)
    while (cursor.getTime() <= end.getTime()) {
      const key = cursor.toISOString().slice(0, 10)
      daily.push(dailyMap.get(key) ?? { date: key, revenue: 0, count: 0, refund: 0 })
      cursor.setUTCDate(cursor.getUTCDate() + 1)
    }
  }

  // Reconciliation against payment_attempts. The table has no amount column, so
  // this can only report how many attempts fail to link to a booking — stated
  // on the page rather than papered over.
  let reconciliation: AdminRevenueReconciliation = {
    attemptsInRange: 0,
    linkedToBooking: 0,
    orphaned: 0,
    note: 'payment_attempts 沒有金額欄位，對帳只能核對預約關聯，不能核對金額。',
  }
  try {
    const { data: attempts, error: attemptsErr } = await service
      .from('payment_attempts')
      .select('id, booking_id, created_at')
      .gte('created_at', `${from}T00:00:00+08:00`)
      .lte('created_at', `${to}T23:59:59+08:00`)
    if (attemptsErr) throw attemptsErr
    const list = (attempts ?? []) as Row[]
    const linked = list.filter((a) => typeof a.booking_id === 'string' && a.booking_id !== '').length
    reconciliation = {
      attemptsInRange: list.length,
      linkedToBooking: linked,
      orphaned: list.length - linked,
      note: 'payment_attempts 沒有金額欄位，對帳只能核對預約關聯，不能核對金額。',
    }
  } catch (reconErr) {
    // Reconciliation is advisory — a failure must not blank the money figures.
    console.error('[admin/revenue] reconciliation failed', reconErr)
    reconciliation = {
      attemptsInRange: 0,
      linkedToBooking: 0,
      orphaned: 0,
      note: 'payment_attempts 對帳查詢失敗，未能核對預約關聯。',
    }
  }

  const detailTotal = detail.length
  const detailStart = (detailPage - 1) * DETAIL_PAGE_SIZE
  const detailPageRows = query.allDetail === true
    ? detail
    : detail.slice(detailStart, detailStart + DETAIL_PAGE_SIZE)

  if (hiddenDropped > 0) {
    console.info(`[admin/revenue] excluded ${hiddenDropped} booking(s) from hidden accounts`)
  }

  return {
    totals,
    daily,
    byMethod: [...methodMap.values()].sort((a, b) => b.revenue - a.revenue),
    byTable: [...tableMap.values()].sort((a, b) => Number(a.key) - Number(b.key)),
    byPeriod: [...periodMap.values()].sort((a, b) => b.revenue - a.revenue),
    promos: [...promoMap.values()].sort((a, b) => b.totalDiscount - a.totalDiscount),
    detail: detailPageRows,
    detailTotal,
    detailPage,
    detailPageSize: DETAIL_PAGE_SIZE,
    reconciliation,
    error: null,
  }
}
