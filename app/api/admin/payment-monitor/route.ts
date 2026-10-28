/**
 * GET /api/admin/payment-monitor[?q=<reference>][&test=1]
 *
 * One read-only snapshot for the admin 付款監控 page. Everything is read from the
 * database as it is right now — nothing is estimated or cached:
 *  - totals      today / last 7 days (non-test bookings)
 *  - issues      things that need a human or a decision, ranked by severity
 *  - live        payment attempts still claimed / pending
 *  - events      latest payment_events rows (the timeline written by the payment code)
 *  - errors      unresolved site_error_log rows from payment code
 *  - timeline    with ?q= : every record found for one reference (booking code, KPay order no)
 *
 * Auth: getAdminData().
 */
import { NextResponse } from 'next/server'
import { getAdminData } from '@/lib/data/getAdmin'
import { getLegacyServiceSupabase } from '@/lib/supabase/legacy'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type Row = Record<string, unknown>
type Severity = 'critical' | 'warning' | 'info'

export type MonitorIssue = {
  id: string
  severity: Severity
  kind: string
  title: string
  detail: string
  bookingId: string | null
  humanCode: string | null
  providerOrderNo: string | null
  at: string | null
  /** Manual mark set by an admin; null = untouched. */
  mark: 'fixed' | 'pending' | null
  markedBy: string | null
  markedAt: string | null
}

export type TimelineEntry = {
  at: string
  source: 'booking' | 'attempt' | 'webhook' | 'event' | 'error'
  title: string
  detail: string
  tone: 'ok' | 'warn' | 'bad' | 'neutral'
}

const s = (v: unknown): string | null => (typeof v === 'string' && v.trim() !== '' ? v : null)
const n = (v: unknown): number => (typeof v === 'number' ? v : typeof v === 'string' && v !== '' && !Number.isNaN(Number(v)) ? Number(v) : 0)
const minutesSince = (iso: string | null): number => (iso ? Math.round((Date.now() - new Date(iso).getTime()) / 60_000) : 0)

function hkDayStartIso(): string {
  const hk = new Date(Date.now() + 8 * 3600_000)
  const start = Date.UTC(hk.getUTCFullYear(), hk.getUTCMonth(), hk.getUTCDate()) - 8 * 3600_000
  return new Date(start).toISOString()
}

export async function GET(req: Request) {
  const admin = await getAdminData()
  if (!admin) return NextResponse.json({ error: 'Unauthorized — admin only' }, { status: 401 })

  const url = new URL(req.url)
  const includeTest = url.searchParams.get('test') === '1'
  const q = (url.searchParams.get('q') ?? '').trim().slice(0, 64)
  const db = getLegacyServiceSupabase()
  const since48 = new Date(Date.now() - 48 * 3600_000).toISOString()
  const since7d = new Date(Date.now() - 7 * 24 * 3600_000).toISOString()

  try {
    // ── Totals ─────────────────────────────────────────────────────────────
    let bq = db
      .from('bookings')
      .select('id, status, total_price, created_at, is_test')
      .gte('created_at', since7d)
      .limit(5000)
    if (!includeTest) bq = bq.eq('is_test', false)
    const { data: recent } = await bq
    const dayStart = hkDayStartIso()
    const paid = new Set(['confirmed', 'completed'])
    const sum = (rows: Row[]) => rows.reduce((acc, r) => acc + n(r.total_price), 0)
    const recentRows = (recent ?? []) as Row[]
    const todayRows = recentRows.filter((r) => (s(r.created_at) ?? '') >= dayStart)
    const bucket = (rows: Row[]) => {
      const ok = rows.filter((r) => paid.has(String(r.status)))
      return {
        bookings: rows.length,
        paidCount: ok.length,
        paidAmount: sum(ok),
        pendingCount: rows.filter((r) => r.status === 'pending').length,
        failedCount: rows.filter((r) => ['payment_failed', 'expired', 'cancelled'].includes(String(r.status))).length,
        reviewCount: rows.filter((r) => r.status === 'payment_review').length,
      }
    }
    const totals = { today: bucket(todayRows), last7d: bucket(recentRows) }

    // ── Live attempts + booking info ───────────────────────────────────────
    const { data: liveRaw } = await db
      .from('payment_attempts')
      .select('id, booking_id, provider_order_no, status, created_at')
      .in('status', ['claimed', 'pending'])
      .order('created_at', { ascending: false })
      .limit(80)
    const liveAttempts = (liveRaw ?? []) as Row[]

    // Recent bookings that are not in a good state, last 48h.
    let sq = db
      .from('bookings')
      .select('id, human_code, status, total_price, date, start_time, table_number, created_at, updated_at, admin_note, is_test, order_group_id')
      .gte('created_at', since48)
      .in('status', ['pending', 'payment_review', 'payment_failed', 'cancelled', 'expired'])
      .order('created_at', { ascending: false })
      .limit(300)
    if (!includeTest) sq = sq.eq('is_test', false)
    const { data: oddRaw } = await sq
    const odd = (oddRaw ?? []) as Row[]

    const attemptsByBooking = new Map<string, Row[]>()
    const oddIds = odd.map((b) => String(b.id))
    if (oddIds.length) {
      const { data: att } = await db
        .from('payment_attempts')
        .select('id, booking_id, provider_order_no, status, created_at, failure_code')
        .in('booking_id', oddIds)
      for (const a of (att ?? []) as Row[]) {
        const k = String(a.booking_id)
        attemptsByBooking.set(k, [...(attemptsByBooking.get(k) ?? []), a])
      }
    }

    // ── Paid webhooks (KPay says money arrived) vs booking state ───────────
    const { data: whRaw } = await db
      .from('webhook_events')
      .select('id, received_at, status, error, payload')
      .gte('received_at', since48)
      .eq('payload->>transactionState', '2')
      .limit(500)
    const paidHooks = (whRaw ?? []) as Row[]
    const codes = [...new Set(paidHooks.map((w) => s((w.payload as Row | null)?.outTradeNo)).filter((v): v is string => !!v))]
    const hookBookings = new Map<string, Row>()
    if (codes.length) {
      const { data: hb } = await db.from('bookings').select('id, human_code, status, total_price, is_test').in('human_code', codes)
      for (const b of (hb ?? []) as Row[]) hookBookings.set(String(b.human_code), b)
    }

    // ── Issues ─────────────────────────────────────────────────────────────
    const issues: MonitorIssue[] = []
    const push = (i: Omit<MonitorIssue, 'id' | 'mark' | 'markedBy' | 'markedAt'>, key?: string) =>
      issues.push({ id: `${i.kind}:${key ?? i.bookingId ?? i.providerOrderNo ?? issues.length}`, mark: null, markedBy: null, markedAt: null, ...i })

    for (const b of odd) {
      const id = String(b.id)
      const code = s(b.human_code)
      const status = String(b.status)
      const atts = attemptsByBooking.get(id) ?? []
      const liveOrder = atts.find((a) => ['claimed', 'pending'].includes(String(a.status)) && s(a.provider_order_no))
      const age = minutesSince(s(b.created_at))
      const price = `HK$${n(b.total_price)}`

      if (status === 'payment_review') {
        push({
          severity: 'critical', kind: 'payment_review',
          title: '已收款但訂位需要處理',
          detail: `${code ?? id.slice(0, 8)} · ${price} · ${s(b.admin_note) ?? '未有備註'}`,
          bookingId: id, humanCode: code, providerOrderNo: s(atts[0]?.provider_order_no), at: s(b.updated_at),
        })
      } else if (liveOrder && ['cancelled', 'expired', 'payment_failed'].includes(status)) {
        push({
          severity: 'warning', kind: 'order_still_open',
          title: '訂位已取消，但 KPay 訂單可能仍可付款',
          detail: `${code ?? id.slice(0, 8)} · ${price} · 已 ${age} 分鐘 · 按「查詢 KPay」確認狀態`,
          bookingId: id, humanCode: code, providerOrderNo: s(liveOrder.provider_order_no), at: s(b.created_at),
        })
      } else if (status === 'pending' && age > 20 && !liveOrder) {
        push({
          severity: 'warning', kind: 'stuck_pending',
          title: '待付款訂位超過 20 分鐘仍未處理',
          detail: `${code ?? id.slice(0, 8)} · ${price} · 已 ${age} 分鐘 · 沒有進行中的付款`,
          bookingId: id, humanCode: code, providerOrderNo: null, at: s(b.created_at),
        })
      }
    }

    const seenCodes = new Map<string, Set<string>>()
    for (const w of paidHooks) {
      const p = (w.payload ?? {}) as Row
      const code = s(p.outTradeNo)
      const orderNo = s(p.orderNo)
      if (!code) continue
      const bk = hookBookings.get(code)
      if (!bk) continue
      if (!includeTest && bk.is_test === true) continue
      const set = seenCodes.get(code) ?? new Set<string>()
      if (orderNo) set.add(orderNo)
      seenCodes.set(code, set)
      if (!paid.has(String(bk.status)) && bk.status !== 'payment_review') {
        push({
          severity: 'critical', kind: 'paid_not_confirmed',
          title: 'KPay 已收款，但訂位未確認',
          detail: `${code} · 訂位狀態 ${String(bk.status)} · KPay 訂單 ${orderNo ?? '—'} · 系統應自動確認，可按「對賬」`,
          bookingId: String(bk.id), humanCode: code, providerOrderNo: orderNo, at: s(w.received_at),
        })
      }
    }
    for (const [code, orders] of seenCodes) {
      if (orders.size > 1) {
        const bk = hookBookings.get(code)
        push({
          severity: 'critical', kind: 'duplicate_payment',
          title: '同一訂位收到多於一筆付款',
          detail: `${code} · ${[...orders].join(' / ')} · 其中一筆需要在 KPay 後台退款`,
          bookingId: bk ? String(bk.id) : null, humanCode: code, providerOrderNo: [...orders][0] ?? null, at: null,
        })
      }
    }

    const { data: badHooks } = await db
      .from('webhook_events')
      .select('id, received_at, status, error, payload')
      .gte('received_at', since48)
      .not('status', 'in', '(processed,received)')
      .order('received_at', { ascending: false })
      .limit(20)
    for (const w of (badHooks ?? []) as Row[]) {
      const p = (w.payload ?? {}) as Row
      push({
        severity: 'warning', kind: 'webhook_problem',
        title: `Webhook 處理異常（${String(w.status)}）`,
        detail: `${s(p.outTradeNo) ?? '—'} · ${s(w.error) ?? '沒有錯誤訊息'}`,
        bookingId: null, humanCode: s(p.outTradeNo), providerOrderNo: s(p.orderNo), at: s(w.received_at),
      }, String(w.id))
    }

    // Apply admin marks (fixed / pending). Table may not exist yet — then nothing is marked.
    if (issues.length) {
      const { data: markRaw } = await db
        .from('payment_issue_marks')
        .select('issue_id, status, marked_by, marked_at')
        .in('issue_id', issues.map((i) => i.id))
      const marks = new Map<string, Row>(((markRaw ?? []) as Row[]).map((m) => [String(m.issue_id), m]))
      for (const i of issues) {
        const m = marks.get(i.id)
        if (!m) continue
        i.mark = m.status === 'fixed' ? 'fixed' : m.status === 'pending' ? 'pending' : null
        i.markedBy = s(m.marked_by)
        i.markedAt = s(m.marked_at)
      }
    }

    const rank: Record<Severity, number> = { critical: 0, warning: 1, info: 2 }
    issues.sort((a, b) => rank[a.severity] - rank[b.severity] || (b.at ?? '').localeCompare(a.at ?? ''))

    // ── Live list (joined to booking) ──────────────────────────────────────
    const liveIds = [...new Set(liveAttempts.map((a) => s(a.booking_id)).filter((v): v is string => !!v))]
    const liveBookings = new Map<string, Row>()
    if (liveIds.length) {
      const { data: lb } = await db.from('bookings').select('id, human_code, status, total_price, is_test').in('id', liveIds)
      for (const b of (lb ?? []) as Row[]) liveBookings.set(String(b.id), b)
    }
    const live = liveAttempts
      .map((a) => {
        const b = liveBookings.get(String(a.booking_id))
        return {
          attemptId: String(a.id),
          bookingId: s(a.booking_id),
          humanCode: s(b?.human_code),
          bookingStatus: s(b?.status),
          amount: n(b?.total_price),
          providerOrderNo: s(a.provider_order_no),
          status: String(a.status),
          ageMin: minutesSince(s(a.created_at)),
          isTest: b?.is_test === true,
        }
      })
      .filter((a) => includeTest || !a.isTest)

    // ── Events + errors ────────────────────────────────────────────────────
    const { data: evRaw, error: evErr } = await db
      .from('payment_events')
      .select('id, created_at, human_code, provider_order_no, event, source, from_state, to_state, reason')
      .order('created_at', { ascending: false })
      .limit(40)
    const eventsAvailable = !evErr
    const { data: errRaw } = await db
      .from('site_error_log')
      .select('id, source, severity, message, created_at, resolved')
      .eq('resolved', false)
      .or('source.ilike.payments%,source.ilike.webhooks%,source.ilike.wallet%,source.ilike.checkout%,source.ilike.booking%')
      .order('created_at', { ascending: false })
      .limit(15)

    // ── Search timeline ────────────────────────────────────────────────────
    let timeline: TimelineEntry[] | null = null
    let timelineHeader: string | null = null
    if (q) {
      timeline = []
      const like = `%${q.replace(/[%_,()]/g, '')}%`
      const found = new Map<string, Row>()
      const { data: byCode } = await db
        .from('bookings')
        .select('id, human_code, status, total_price, date, start_time, table_number, created_at, admin_note')
        .ilike('human_code', like)
        .limit(5)
      for (const b of (byCode ?? []) as Row[]) found.set(String(b.id), b)
      const { data: byOrder } = await db.from('payment_attempts').select('booking_id').ilike('provider_order_no', like).limit(5)
      const extra = ((byOrder ?? []) as Row[]).map((r) => s(r.booking_id)).filter((v): v is string => !!v && !found.has(v))
      if (extra.length) {
        const { data: more } = await db
          .from('bookings')
          .select('id, human_code, status, total_price, date, start_time, table_number, created_at, admin_note')
          .in('id', extra)
        for (const b of (more ?? []) as Row[]) found.set(String(b.id), b)
      }

      for (const b of found.values()) {
        const id = String(b.id)
        const code = s(b.human_code)
        timelineHeader = `${code ?? id.slice(0, 8)} · ${String(b.status)} · HK$${n(b.total_price)} · ${s(b.date) ?? ''} ${s(b.start_time) ?? ''} · ${n(b.table_number)} 號枱`
        timeline.push({
          at: String(b.created_at), source: 'booking', title: '建立訂位',
          detail: `HK$${n(b.total_price)} · ${s(b.date) ?? ''} ${s(b.start_time) ?? ''}`, tone: 'neutral',
        })
        const { data: atts } = await db
          .from('payment_attempts')
          .select('id, provider, provider_order_no, status, failure_code, failure_reason, created_at, completed_at')
          .eq('booking_id', id)
        for (const a of (atts ?? []) as Row[]) {
          const st = String(a.status)
          timeline.push({
            at: String(a.created_at), source: 'attempt', title: `付款嘗試（${st}）`,
            detail: `${s(a.provider) ?? ''} · 訂單 ${s(a.provider_order_no) ?? '未建立'}${s(a.failure_code) ? ` · ${String(a.failure_code)}` : ''}`,
            tone: st === 'succeeded' ? 'ok' : st === 'failed' ? 'bad' : 'warn',
          })
        }
        if (code) {
          const { data: hooks } = await db
            .from('webhook_events')
            .select('id, received_at, status, error, payload')
            .eq('payload->>outTradeNo', code)
          for (const w of (hooks ?? []) as Row[]) {
            const p = (w.payload ?? {}) as Row
            const st = String(p.transactionState ?? '')
            timeline.push({
              at: String(w.received_at), source: 'webhook',
              title: `KPay 通知 · ${st === '2' ? '已付款' : st === '3' ? '訂單已關閉' : `狀態 ${st || '?'}`}`,
              detail: `訂單 ${s(p.orderNo) ?? '—'} · ${s(p.payAmount) ?? n(p.payAmount) ?? ''} · 處理結果 ${String(w.status)}${s(w.error) ? ` · ${String(w.error)}` : ''}`,
              tone: st === '2' ? 'ok' : st === '3' ? 'warn' : 'neutral',
            })
          }
        }
        const { data: evs } = await db
          .from('payment_events')
          .select('created_at, event, source, from_state, to_state, reason')
          .eq('booking_id', id)
        for (const e of (evs ?? []) as Row[]) {
          const ev = String(e.event)
          timeline.push({
            at: String(e.created_at), source: 'event', title: ev,
            detail: [s(e.source), s(e.from_state) && s(e.to_state) ? `${String(e.from_state)} → ${String(e.to_state)}` : null, s(e.reason)]
              .filter(Boolean)
              .join(' · '),
            tone: /confirmed|paid/.test(ev) ? 'ok' : /refused|review|duplicate|conflict/.test(ev) ? 'bad' : 'neutral',
          })
        }
      }
      timeline.sort((a, b) => a.at.localeCompare(b.at))
    }

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      includeTest,
      eventsAvailable,
      totals,
      issues,
      live,
      events: (evRaw ?? []) as Row[],
      errors: (errRaw ?? []) as Row[],
      query: q || null,
      timeline,
      timelineHeader,
    })
  } catch (e) {
    console.error('[admin/payment-monitor] failed', { message: (e as Error).message })
    return NextResponse.json({ error: '載入失敗，請重試' }, { status: 500 })
  }
}
