import { getLegacyServiceSupabase } from '@/lib/supabase/legacy'
import { getAdminRevenue } from '@/lib/data/getAdminRevenue'
import { getHiddenUserList } from '@/lib/data/getHiddenUserIds'
import { num, str, type Row } from '@/lib/data/adminReadHelpers'

// 收入核對 — read-only, deterministic. Every number and every finding here is
// computed by code from the database; the AI step (revenueCheckAi.ts) only
// explains them in words. Nothing in this file writes to any table.
//
// Rules are tuned to the real data (checked 27 Oct 2026):
//   • payment_attempts only exists for KPay, which went live on 24 Oct 2026.
//     Earlier (Stripe-era) bookings have no attempt rows, so the
//     「已確認但無成功付款記錄」 rule only looks at bookings created on/after that day.
//   • payment_attempts has no amount column, so amounts can't be matched to
//     attempts — only to bookings (stated, not papered over).
//   • Test and hidden-account bookings are excluded, exactly as in getAdminRevenue.

export const KPAY_LIVE_FROM = '2026-10-24T00:00:00+08:00'
const STUCK_PENDING_MINUTES = 30
const BOOKING_LIMIT = 2000
const MAX_RANGE_DAYS = 93

export type FindingKind =
  | 'paid_not_confirmed'
  | 'confirmed_no_payment'
  | 'duplicate_payment'
  | 'payment_review'
  | 'stuck_pending'
  | 'webhook_failed'
  | 'revenue_mismatch'
  | 'test_method_real_user'

export type CheckSeverity = 'high' | 'medium' | 'low'

export type CheckFinding = {
  /** Stable across runs, so the monitor can de-duplicate alerts. */
  id: string
  kind: FindingKind
  severity: CheckSeverity
  title: string
  detail: string
  bookingId: string | null
  code: string | null
  evidence: string[]
}

export type CheckStep = {
  key: string
  label: string
  status: 'ok' | 'warn' | 'fail'
  detail: string
  ms: number
}

export type CheckTotals = {
  revenue: number
  bookingCount: number
  refund: number
  net: number
  checkedBookings: number
  attempts: { succeeded: number; failed: number; expired: number; other: number }
}

export type RevenueCheckResult = {
  from: string
  to: string
  steps: CheckStep[]
  findings: CheckFinding[]
  totals: CheckTotals | null
  error: string | null
}

type BookingRow = {
  id: string
  code: string | null
  userId: string | null
  date: string | null
  price: number
  status: string
  method: string | null
  createdAt: string | null
}

type AttemptRow = {
  bookingId: string
  status: string
  provider: string | null
  failureCode: string | null
  failureReason: string | null
  createdAt: string | null
}

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime())
}

function money(value: number): string {
  return `HK$${Math.round(value * 100) / 100}`
}

function minutesAgo(iso: string | null, now: number): number | null {
  if (!iso) return null
  const t = new Date(iso).getTime()
  return Number.isNaN(t) ? null : Math.floor((now - t) / 60_000)
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

const SEVERITY_RANK: Record<CheckSeverity, number> = { high: 0, medium: 1, low: 2 }

export async function runRevenueCheck(input: { from: string; to: string }): Promise<RevenueCheckResult> {
  const { from, to } = input
  const steps: CheckStep[] = []
  const findings: CheckFinding[] = []
  const empty: RevenueCheckResult = { from, to, steps, findings, totals: null, error: null }

  if (!isIsoDate(from) || !isIsoDate(to) || from > to) {
    return { ...empty, error: '日期範圍不正確' }
  }
  const days = (new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime()) / 86_400_000 + 1
  if (days > MAX_RANGE_DAYS) {
    return { ...empty, error: `核對範圍最多 ${MAX_RANGE_DAYS} 日` }
  }

  const service = getLegacyServiceSupabase()
  const now = Date.now()

  async function step<T>(
    key: string,
    label: string,
    fn: () => Promise<{ value: T; status: CheckStep['status']; detail: string }>,
  ): Promise<T | null> {
    const started = Date.now()
    try {
      const out = await fn()
      steps.push({ key, label, status: out.status, detail: out.detail, ms: Date.now() - started })
      return out.value
    } catch (err) {
      const message = err instanceof Error ? err.message : '未知錯誤'
      steps.push({ key, label, status: 'fail', detail: message, ms: Date.now() - started })
      console.error(`[admin/revenue-check] ${key} failed`, err)
      return null
    }
  }

  // 1. Revenue from the one shared source.
  const revenue = await step('revenue', '取得該期收入（與收入頁同一來源）', async () => {
    const r = await getAdminRevenue({ from, to })
    if (r.error) throw new Error(r.error)
    return {
      value: r,
      status: 'ok' as const,
      detail: `收入 ${money(r.totals.revenue)}，已確認預約 ${r.totals.bookingCount} 張，退款 ${money(r.totals.refund)}`,
    }
  })
  if (!revenue) return { ...empty, error: '無法取得收入數字，核對已停止' }

  // 2. Bookings in range, same exclusions as revenue.
  const bookings = await step('bookings', '載入範圍內預約（排除測試及隱藏帳戶）', async () => {
    const hidden = await getHiddenUserList()
    const { data, error } = await service
      .from('bookings')
      .select('id, human_code, booking_reference, user_id, date, total_price, status, payment_method, is_test, created_at')
      .gte('date', from)
      .lte('date', to)
      .or('is_test.is.null,is_test.eq.false')
      .order('date', { ascending: true })
      .limit(BOOKING_LIMIT)
    if (error) throw new Error(`預約載入失敗：${error.message}`)
    const rows: BookingRow[] = ((data ?? []) as unknown as Row[])
      .map((r) => ({
        id: String(r.id ?? ''),
        code: str(r, ['human_code', 'booking_reference']),
        userId: str(r, ['user_id']),
        date: str(r, ['date']),
        price: num(r, ['total_price'], 0),
        status: str(r, ['status']) ?? 'unknown',
        method: str(r, ['payment_method']),
        createdAt: str(r, ['created_at']),
      }))
      .filter((b) => b.id !== '' && !(b.userId && hidden.ids.has(b.userId)))
    const capped = (data ?? []).length >= BOOKING_LIMIT
    return {
      value: rows,
      status: capped ? ('warn' as const) : ('ok' as const),
      detail: capped ? `已載入 ${rows.length} 張，達到上限 ${BOOKING_LIMIT}，請縮短日期範圍` : `共 ${rows.length} 張預約`,
    }
  })
  if (!bookings) return { ...empty, error: '無法載入預約，核對已停止' }

  // 3. Cross-check: Σ confirmed here must equal the revenue page's figure.
  await step('crosscheck', '交叉核對：預約合計 vs 收入頁數字', async () => {
    const sum = bookings.filter((b) => b.status === 'confirmed').reduce((s, b) => s + b.price, 0)
    const diff = Math.round((sum - revenue.totals.revenue) * 100) / 100
    if (Math.abs(diff) >= 0.01) {
      findings.push({
        id: `revenue_mismatch:${from}:${to}`,
        kind: 'revenue_mismatch',
        severity: 'high',
        title: '收入頁數字與預約合計不一致',
        detail: `收入頁 ${money(revenue.totals.revenue)}，逐張預約加總 ${money(sum)}，相差 ${money(diff)}`,
        bookingId: null,
        code: null,
        evidence: [`範圍 ${from} 至 ${to}`],
      })
      return { value: null, status: 'warn' as const, detail: `相差 ${money(diff)}` }
    }
    return { value: null, status: 'ok' as const, detail: `兩者一致：${money(sum)}` }
  })

  // 4. Payment attempts for those bookings.
  const attempts = await step('attempts', '載入這些預約的付款嘗試', async () => {
    const map = new Map<string, AttemptRow[]>()
    let total = 0
    for (const ids of chunk(bookings.map((b) => b.id), 150)) {
      const { data, error } = await service
        .from('payment_attempts')
        .select('booking_id, status, provider, failure_code, failure_reason, created_at')
        .in('booking_id', ids)
      if (error) throw new Error(`付款嘗試載入失敗：${error.message}`)
      for (const r of (data ?? []) as unknown as Row[]) {
        const bookingId = str(r, ['booking_id'])
        if (!bookingId) continue
        const list = map.get(bookingId) ?? []
        list.push({
          bookingId,
          status: str(r, ['status']) ?? 'unknown',
          provider: str(r, ['provider']),
          failureCode: str(r, ['failure_code']),
          failureReason: str(r, ['failure_reason']),
          createdAt: str(r, ['created_at']),
        })
        map.set(bookingId, list)
        total += 1
      }
    }
    return { value: map, status: 'ok' as const, detail: `共 ${total} 次付款嘗試（只有 KPay 有記錄，無金額欄位）` }
  })

  const counts = { succeeded: 0, failed: 0, expired: 0, other: 0 }
  if (attempts) {
    for (const list of attempts.values()) {
      for (const a of list) {
        if (a.status === 'succeeded') counts.succeeded += 1
        else if (a.status === 'failed') counts.failed += 1
        else if (a.status === 'expired' || a.status === 'cancelled') counts.expired += 1
        else counts.other += 1
      }
    }
  }

  // 5. Per-booking rules.
  await step('rules', '逐張預約核對（已付款、重複付款、卡住、待確認）', async () => {
    if (!attempts) throw new Error('沒有付款嘗試資料，無法逐張核對')
    for (const b of bookings) {
      const list = attempts.get(b.id) ?? []
      const succeeded = list.filter((a) => a.status === 'succeeded')
      const label = b.code ?? b.id.slice(0, 8)
      const base = { bookingId: b.id, code: b.code }

      if (succeeded.length > 0 && ['pending', 'payment_failed', 'expired', 'payment_review'].includes(b.status)) {
        findings.push({
          ...base,
          id: `paid_not_confirmed:${b.id}`,
          kind: 'paid_not_confirmed',
          severity: 'high',
          title: `${label}：KPay 顯示已付款，但預約未確認`,
          detail: `預約狀態為「${b.status}」，但有 ${succeeded.length} 次成功付款記錄。客人可能已扣款而未得到預約。`,
          evidence: [`預約 ${money(b.price)}，${b.date ?? '—'}`, `付款嘗試：${list.map((a) => a.status).join('、')}`],
        })
      }
      if (succeeded.length > 1) {
        findings.push({
          ...base,
          id: `duplicate_payment:${b.id}`,
          kind: 'duplicate_payment',
          severity: 'high',
          title: `${label}：同一預約有 ${succeeded.length} 次成功付款`,
          detail: '可能重複扣款，需要在 KPay 後台核實並按需要退款。',
          evidence: succeeded.map((a) => `成功付款 ${a.createdAt ?? '—'}`),
        })
      }
      if (b.status === 'payment_review') {
        findings.push({
          ...base,
          id: `payment_review:${b.id}`,
          kind: 'payment_review',
          severity: 'high',
          title: `${label}：付款待人手確認`,
          detail: '系統已將此預約標記為待人手處理。',
          evidence: [`預約 ${money(b.price)}，${b.date ?? '—'}`],
        })
      }
      if (b.status === 'pending') {
        const age = minutesAgo(b.createdAt, now)
        if (age !== null && age > STUCK_PENDING_MINUTES) {
          findings.push({
            ...base,
            id: `stuck_pending:${b.id}`,
            kind: 'stuck_pending',
            severity: 'medium',
            title: `${label}：待付款超過 ${STUCK_PENDING_MINUTES} 分鐘仍未處理`,
            detail: `建立已 ${age} 分鐘。系統每 2 分鐘會自動釋放逾時預約，此單未被釋放。`,
            evidence: [`建立時間 ${b.createdAt ?? '—'}`],
          })
        }
      }
      if (
        b.status === 'confirmed' &&
        b.price > 0 &&
        b.createdAt !== null &&
        b.createdAt >= KPAY_LIVE_FROM &&
        succeeded.length === 0 &&
        b.method !== 'free' &&
        b.method !== 'test' &&
        b.method !== 'cash' &&
        b.method !== 'credit'
      ) {
        findings.push({
          ...base,
          id: `confirmed_no_payment:${b.id}`,
          kind: 'confirmed_no_payment',
          severity: 'medium',
          title: `${label}：已確認，但找不到成功付款記錄`,
          detail: `付款方式「${b.method ?? '未填'}」，${money(b.price)}。可能是後台手動建立，或付款記錄遺失。`,
          evidence: [`建立時間 ${b.createdAt}`, `付款嘗試：${(attempts.get(b.id) ?? []).map((a) => a.status).join('、') || '無'}`],
        })
      }
      if (b.method === 'test' && b.status === 'confirmed') {
        findings.push({
          ...base,
          id: `test_method_real_user:${b.id}`,
          kind: 'test_method_real_user',
          severity: 'medium',
          title: `${label}：付款方式為 test，但未標記為測試預約`,
          detail: `此預約的 ${money(b.price)} 已計入收入。若是測試，請標記為測試或隱藏該帳戶。`,
          evidence: [`日期 ${b.date ?? '—'}`],
        })
      }
    }
    const high = findings.filter((f) => f.severity === 'high').length
    return {
      value: null,
      status: findings.length > 0 ? ('warn' as const) : ('ok' as const),
      detail: findings.length > 0 ? `找到 ${findings.length} 項需要留意（其中 ${high} 項嚴重）` : '沒有發現異常',
    }
  })

  // 6. KPay webhooks that failed in the range.
  await step('webhooks', '檢查 KPay 通知處理失敗', async () => {
    const { data, error } = await service
      .from('webhook_events')
      .select('id, type, provider, status, error, received_at, payload')
      .eq('status', 'failed')
      .gte('received_at', new Date(`${from}T00:00:00+08:00`).toISOString())
      .lt('received_at', new Date(new Date(`${to}T00:00:00+08:00`).getTime() + 86_400_000).toISOString())
      .order('received_at', { ascending: false })
      .limit(50)
    if (error) throw new Error(`通知記錄載入失敗：${error.message}`)
    const all = (data ?? []) as unknown as Row[]

    // Match each failed notification to its booking through the KPay order number, so test
    // and hidden-account payments don't raise alarms and real ones carry the booking code.
    const orderNo = (r: Row): string | null => {
      const payload = typeof r.payload === 'object' && r.payload !== null ? (r.payload as Record<string, unknown>) : {}
      return typeof payload.orderNo === 'string' ? payload.orderNo : null
    }
    const orderNos = [...new Set(all.map(orderNo).filter((v): v is string => v !== null))]
    const byOrder = new Map<string, { id: string; code: string | null; skip: boolean }>()
    if (orderNos.length > 0) {
      const hidden = await getHiddenUserList()
      const { data: linked, error: linkError } = await service
        .from('bookings')
        .select('id, human_code, user_id, is_test, provider_order_no')
        .in('provider_order_no', orderNos)
      if (linkError) throw new Error(`通知對應預約載入失敗：${linkError.message}`)
      for (const b of (linked ?? []) as unknown as Row[]) {
        const key = str(b, ['provider_order_no'])
        if (!key) continue
        const userId = str(b, ['user_id'])
        byOrder.set(key, {
          id: String(b.id),
          code: str(b, ['human_code']),
          skip: b.is_test === true || (userId !== null && hidden.ids.has(userId)),
        })
      }
    }
    let skipped = 0
    const rows: Row[] = []
    for (const r of all) {
      const key = orderNo(r)
      const link = key ? byOrder.get(key) : undefined
      if (link?.skip) {
        skipped += 1
        continue
      }
      rows.push(r)
      const id = str(r, ['id']) ?? ''
      findings.push({
        id: `webhook_failed:${id}`,
        kind: 'webhook_failed',
        severity: 'medium',
        title: `KPay 通知處理失敗（${str(r, ['type']) ?? '未知類型'}）${link?.code ? `：${link.code}` : ''}`,
        detail: (str(r, ['error']) ?? '沒有錯誤訊息').slice(0, 200),
        bookingId: link?.id ?? null,
        code: link?.code ?? null,
        evidence: [`通知 ${id}`, `收到時間 ${str(r, ['received_at']) ?? '—'}`],
      })
    }
    return {
      value: null,
      status: rows.length > 0 ? ('warn' as const) : ('ok' as const),
      detail: rows.length > 0 ? `${rows.length} 個通知處理失敗` : skipped > 0 ? `沒有真實客人的失敗通知（已略過 ${skipped} 個測試／隱藏帳戶通知）` : '沒有失敗的通知',
    }
  })

  findings.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity])

  return {
    from,
    to,
    steps,
    findings,
    totals: {
      revenue: revenue.totals.revenue,
      bookingCount: revenue.totals.bookingCount,
      refund: revenue.totals.refund,
      net: revenue.totals.net,
      checkedBookings: bookings.length,
      attempts: counts,
    },
    error: steps.some((s) => s.status === 'fail') ? '部分步驟失敗，結果可能不完整' : null,
  }
}
