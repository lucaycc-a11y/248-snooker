import { getLegacyServiceSupabase } from '@/lib/supabase/legacy'
import { getAdminRevenue } from '@/lib/data/getAdminRevenue'
import { getHiddenUserList } from '@/lib/data/getHiddenUserIds'
import { num, str, type Row } from '@/lib/data/adminReadHelpers'
import { runRevenueCheck } from '@/lib/admin/revenueCheck'
import type { MimoToolDef } from '@/lib/ai/mimo'

// Read-only tools the AI investigator may call. Hard rules:
//   • every tool only SELECTs — nothing here writes, cancels, refunds or messages anyone;
//   • results are small (row caps, text caps) so a runaway query can't flood the model;
//   • personal details never leave the database: no names, phones, emails or user ids.
//     A customer appears only as 「會員等級／帳戶年齡／付款歷史」, which is enough to judge a payment.
//   • door-card errors (admin.door*) are excluded on purpose.
// Test bookings and hidden (admin) accounts are left out unless a tool is told otherwise.

type Args = Record<string, unknown>
export type AgentTool = { def: MimoToolDef; run: (args: Args) => Promise<unknown> }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const CODE_RE = /^[A-Za-z0-9_-]{3,60}$/
const WORD_RE = /^[A-Za-z0-9_.-]{1,40}$/
const MAX_OUT = 6000

function argStr(a: Args, key: string): string | null {
  const v = a[key]
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : null
}
function argInt(a: Args, key: string, fallback: number, max: number): number {
  const v = a[key]
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN
  return Number.isFinite(n) ? Math.min(max, Math.max(1, Math.floor(n))) : fallback
}
function argBool(a: Args, key: string): boolean {
  return a[key] === true
}
function isoDate(a: Args, key: string): string | null {
  const v = argStr(a, key)
  return v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null
}
function sinceHours(hours: number): string {
  return new Date(Date.now() - hours * 3600_000).toISOString()
}
function ago(iso: string | null): string | null {
  if (!iso) return null
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return null
  const m = Math.floor((Date.now() - t) / 60_000)
  return m < 60 ? `${m} 分鐘前` : m < 2880 ? `${Math.floor(m / 60)} 小時前` : `${Math.floor(m / 1440)} 日前`
}
function hkTime(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleString('zh-HK', { timeZone: 'Asia/Hong_Kong', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
}

const BOOKING_COLS =
  'id, human_code, booking_reference, user_id, date, start_time, end_time, table_number, total_price, status, payment_method, provider_order_no, is_test, created_at, refund_amount'

function compactBooking(r: Row) {
  return {
    code: str(r, ['human_code', 'booking_reference']),
    date: str(r, ['date']),
    time: `${(str(r, ['start_time']) ?? '').slice(0, 5)}-${(str(r, ['end_time']) ?? '').slice(0, 5)}`,
    table: num(r, ['table_number'], 0),
    price: num(r, ['total_price'], 0),
    status: str(r, ['status']),
    method: str(r, ['payment_method']),
    isTest: r.is_test === true,
    createdAt: hkTime(str(r, ['created_at'])),
    refund: num(r, ['refund_amount'], 0),
  }
}

async function findBooking(codeOrId: string): Promise<Row | null> {
  const service = getLegacyServiceSupabase()
  if (UUID_RE.test(codeOrId)) {
    const { data, error } = await service.from('bookings').select(BOOKING_COLS).eq('id', codeOrId).maybeSingle()
    if (error) throw new Error(error.message)
    return (data as unknown as Row | null) ?? null
  }
  if (!CODE_RE.test(codeOrId)) throw new Error('預約編號格式不正確')
  for (const col of ['human_code', 'booking_reference', 'provider_order_no']) {
    const { data, error } = await service.from('bookings').select(BOOKING_COLS).eq(col, codeOrId).limit(1)
    if (error) throw new Error(error.message)
    const row = ((data ?? []) as unknown as Row[])[0]
    if (row) return row
  }
  return null
}

function compactAttempt(r: Row, booking?: { code: string | null; method: string | null; status: string | null }) {
  return {
    attempt: String(r.id ?? '').slice(0, 8),
    booking: booking?.code ?? null,
    bookingStatus: booking?.status ?? null,
    method: booking?.method ?? null,
    provider: str(r, ['provider']),
    status: str(r, ['status']),
    failureCode: str(r, ['failure_code']),
    failureReason: (str(r, ['failure_reason']) ?? '').slice(0, 160) || null,
    created: hkTime(str(r, ['created_at'])),
    createdAgo: ago(str(r, ['created_at'])),
    completed: hkTime(str(r, ['completed_at'])),
  }
}

export const AGENT_TOOLS: AgentTool[] = [
  {
    def: {
      name: 'get_booking',
      description: '用預約編號（如 SPACE8-XXXXX-N 或 S8-xxxx）或 KPay 訂單號查一張預約，連同它的付款嘗試、付款事件和通知狀態。查單一預約時先用這個。',
      parameters: { type: 'object', properties: { code: { type: 'string', description: '預約編號、預約 id 或 KPay 訂單號' } }, required: ['code'] },
    },
    run: async (a) => {
      const code = argStr(a, 'code')
      if (!code) throw new Error('缺少 code')
      const row = await findBooking(code)
      if (!row) return { found: false }
      const id = String(row.id)
      const service = getLegacyServiceSupabase()
      const [attempts, events, notes] = await Promise.all([
        service.from('payment_attempts').select('id, provider, status, failure_code, failure_reason, created_at, completed_at').eq('booking_id', id).order('created_at'),
        service.from('payment_events').select('created_at, event, source, from_state, to_state, reason').eq('booking_id', id).order('created_at'),
        service.from('notification_log').select('sent_at, channel, type, status').eq('booking_id', id),
      ])
      const b = compactBooking(row)
      return {
        found: true,
        booking: b,
        attempts: ((attempts.data ?? []) as unknown as Row[]).map((r) => compactAttempt(r, { code: b.code, method: b.method, status: b.status })),
        events: ((events.data ?? []) as unknown as Row[]).map((r) => ({
          at: hkTime(str(r, ['created_at'])),
          event: str(r, ['event']),
          source: str(r, ['source']),
          change: [str(r, ['from_state']), str(r, ['to_state'])].filter(Boolean).join(' → ') || null,
          reason: (str(r, ['reason']) ?? '').slice(0, 160) || null,
        })),
        notifications: ((notes.data ?? []) as unknown as Row[]).map((r) => ({ channel: str(r, ['channel']), type: str(r, ['type']), status: str(r, ['status']) })),
      }
    },
  },
  {
    def: {
      name: 'search_bookings',
      description: '按條件搜尋預約（最多 20 張）。預設排除測試預約和管理員帳戶。',
      parameters: {
        type: 'object',
        properties: {
          status: { type: 'string', description: 'confirmed、pending、cancelled、admin_cancelled、expired、payment_failed、payment_review' },
          date_from: { type: 'string', description: '遊玩日期起，YYYY-MM-DD' },
          date_to: { type: 'string', description: '遊玩日期止，YYYY-MM-DD' },
          method: { type: 'string', description: '付款方式，如 payme、alipayhk、fps、card、wechat' },
          include_test: { type: 'boolean', description: '是否包括測試預約，預設否' },
          limit: { type: 'integer', description: '最多幾張，預設 10，上限 20' },
        },
      },
    },
    run: async (a) => {
      const service = getLegacyServiceSupabase()
      let q = service.from('bookings').select(BOOKING_COLS).order('date', { ascending: false }).order('created_at', { ascending: false })
      const status = argStr(a, 'status')
      if (status) {
        if (!WORD_RE.test(status)) throw new Error('status 格式不正確')
        q = q.eq('status', status)
      }
      const from = isoDate(a, 'date_from')
      const to = isoDate(a, 'date_to')
      if (from) q = q.gte('date', from)
      if (to) q = q.lte('date', to)
      const method = argStr(a, 'method')
      if (method) {
        if (!WORD_RE.test(method)) throw new Error('method 格式不正確')
        q = q.eq('payment_method', method)
      }
      const includeTest = argBool(a, 'include_test')
      if (!includeTest) q = q.or('is_test.is.null,is_test.eq.false')
      const { data, error } = await q.limit(argInt(a, 'limit', 10, 20))
      if (error) throw new Error(error.message)
      const hidden = includeTest ? null : await getHiddenUserList()
      const rows = ((data ?? []) as unknown as Row[]).filter((r) => !(hidden && str(r, ['user_id']) && hidden.ids.has(String(r.user_id))))
      return { count: rows.length, bookings: rows.map(compactBooking) }
    },
  },
  {
    def: {
      name: 'get_payment_attempts',
      description: '查最近的付款嘗試（成功、失敗、逾時），可按狀態或預約篩選。用來看有沒有客人付款失敗、失敗原因代碼是什麼。',
      parameters: {
        type: 'object',
        properties: {
          hours: { type: 'integer', description: '過去幾小時，預設 24，上限 168' },
          status: { type: 'string', description: 'succeeded、failed、expired、cancelled、pending' },
          booking: { type: 'string', description: '只看某張預約（預約編號）' },
          include_test: { type: 'boolean' },
          limit: { type: 'integer', description: '預設 15，上限 30' },
        },
      },
    },
    run: async (a) => {
      const service = getLegacyServiceSupabase()
      let q = service
        .from('payment_attempts')
        .select('id, booking_id, user_id, provider, status, failure_code, failure_reason, created_at, completed_at')
        .gte('created_at', sinceHours(argInt(a, 'hours', 24, 168)))
        .order('created_at', { ascending: false })
      const status = argStr(a, 'status')
      if (status) {
        if (!WORD_RE.test(status)) throw new Error('status 格式不正確')
        q = q.eq('status', status)
      }
      const bookingCode = argStr(a, 'booking')
      if (bookingCode) {
        const b = await findBooking(bookingCode)
        if (!b) return { count: 0, attempts: [] }
        q = q.eq('booking_id', String(b.id))
      }
      const { data, error } = await q.limit(argInt(a, 'limit', 15, 30))
      if (error) throw new Error(error.message)
      const rows = (data ?? []) as unknown as Row[]
      const ids = [...new Set(rows.map((r) => str(r, ['booking_id'])).filter((v): v is string => v !== null))]
      const info = new Map<string, { code: string | null; method: string | null; status: string | null; test: boolean; userId: string | null }>()
      if (ids.length > 0) {
        const { data: bs, error: bErr } = await service.from('bookings').select('id, human_code, payment_method, status, is_test, user_id').in('id', ids)
        if (bErr) throw new Error(bErr.message)
        for (const b of (bs ?? []) as unknown as Row[]) {
          info.set(String(b.id), { code: str(b, ['human_code']), method: str(b, ['payment_method']), status: str(b, ['status']), test: b.is_test === true, userId: str(b, ['user_id']) })
        }
      }
      const includeTest = argBool(a, 'include_test')
      const hidden = includeTest ? null : await getHiddenUserList()
      const kept = rows.filter((r) => {
        const b = info.get(String(r.booking_id))
        if (includeTest) return true
        return !(b?.test || (b?.userId && hidden?.ids.has(b.userId)))
      })
      return { count: kept.length, attempts: kept.map((r) => compactAttempt(r, info.get(String(r.booking_id)))) }
    },
  },
  {
    def: {
      name: 'get_webhook_events',
      description: '查 KPay 通知（webhook）的處理結果，含付款金額、錢包類型和失敗原因。用來判斷客人是否已付款但系統沒處理。',
      parameters: {
        type: 'object',
        properties: {
          hours: { type: 'integer', description: '預設 48，上限 168' },
          status: { type: 'string', description: 'processed 或 failed，不填為全部' },
          limit: { type: 'integer', description: '預設 10，上限 20' },
        },
      },
    },
    run: async (a) => {
      const service = getLegacyServiceSupabase()
      let q = service
        .from('webhook_events')
        .select('id, type, status, error, received_at, payload')
        .gte('received_at', sinceHours(argInt(a, 'hours', 48, 168)))
        .order('received_at', { ascending: false })
      const status = argStr(a, 'status')
      if (status) {
        if (!WORD_RE.test(status)) throw new Error('status 格式不正確')
        q = q.eq('status', status)
      }
      const { data, error } = await q.limit(argInt(a, 'limit', 10, 20))
      if (error) throw new Error(error.message)
      return {
        events: ((data ?? []) as unknown as Row[]).map((r) => {
          const p = typeof r.payload === 'object' && r.payload !== null ? (r.payload as Record<string, unknown>) : {}
          return {
            id: str(r, ['id']),
            type: str(r, ['type']),
            status: str(r, ['status']),
            error: (str(r, ['error']) ?? '').slice(0, 200) || null,
            received: hkTime(str(r, ['received_at'])),
            orderNo: typeof p.orderNo === 'string' ? p.orderNo : null,
            amount: typeof p.payAmount === 'number' ? p.payAmount : null,
            currency: typeof p.payCurrency === 'string' ? p.payCurrency : null,
            wallet: typeof p.walletType === 'string' && p.walletType !== '' ? p.walletType : null,
          }
        }),
      }
    },
  },
  {
    def: {
      name: 'get_recent_errors',
      description: '查網站錯誤記錄，按來源和訊息歸類並計次。不包括門禁卡錯誤。',
      parameters: {
        type: 'object',
        properties: {
          hours: { type: 'integer', description: '預設 6，上限 72' },
          source_prefix: { type: 'string', description: '只看某來源開頭，如 api.payment' },
          limit: { type: 'integer', description: '預設 15，上限 30' },
        },
      },
    },
    run: async (a) => {
      const service = getLegacyServiceSupabase()
      let q = service
        .from('site_error_log')
        .select('source, severity, message, created_at')
        .not('source', 'like', 'admin.door%')
        .gte('created_at', sinceHours(argInt(a, 'hours', 6, 72)))
        .order('created_at', { ascending: false })
      const prefix = argStr(a, 'source_prefix')
      if (prefix) {
        if (!WORD_RE.test(prefix)) throw new Error('source_prefix 格式不正確')
        q = q.like('source', `${prefix}%`)
      }
      const { data, error } = await q.limit(300)
      if (error) throw new Error(error.message)
      const groups = new Map<string, { source: string | null; severity: string | null; message: string; count: number; last: string | null }>()
      for (const r of (data ?? []) as unknown as Row[]) {
        const message = (str(r, ['message']) ?? '').slice(0, 160)
        const key = `${str(r, ['source'])}|${message}`
        const g = groups.get(key)
        if (g) g.count += 1
        else groups.set(key, { source: str(r, ['source']), severity: str(r, ['severity']), message, count: 1, last: hkTime(str(r, ['created_at'])) })
      }
      return { groups: [...groups.values()].sort((x, y) => y.count - x.count).slice(0, argInt(a, 'limit', 15, 30)) }
    },
  },
  {
    def: {
      name: 'get_revenue_summary',
      description: '取得某段日期的收入總額、預約數、退款和各付款方式分佈（與收入頁同一來源，按遊玩日期）。',
      parameters: { type: 'object', properties: { from: { type: 'string' }, to: { type: 'string' } }, required: ['from', 'to'] },
    },
    run: async (a) => {
      const from = isoDate(a, 'from')
      const to = isoDate(a, 'to')
      if (!from || !to || from > to) throw new Error('日期範圍不正確')
      const r = await getAdminRevenue({ from, to })
      if (r.error) throw new Error(r.error)
      return { totals: r.totals, byMethod: r.byMethod.map((m) => ({ method: m.label, revenue: m.revenue, count: m.count })) }
    },
  },
  {
    def: {
      name: 'run_revenue_check',
      description: '執行完整的收入核對（收入 vs 預約 vs 付款嘗試 vs KPay 通知），返回異常清單。範圍最多 93 日。',
      parameters: { type: 'object', properties: { from: { type: 'string' }, to: { type: 'string' } }, required: ['from', 'to'] },
    },
    run: async (a) => {
      const from = isoDate(a, 'from')
      const to = isoDate(a, 'to')
      if (!from || !to) throw new Error('日期範圍不正確')
      const r = await runRevenueCheck({ from, to })
      if (r.error && !r.totals) throw new Error(r.error)
      return {
        totals: r.totals,
        steps: r.steps.map((s) => ({ step: s.label, status: s.status, detail: s.detail })),
        findings: r.findings.slice(0, 15).map((f) => ({ severity: f.severity, kind: f.kind, code: f.code, title: f.title, detail: f.detail })),
      }
    },
  },
  {
    def: {
      name: 'get_user_payment_history',
      description: '查某張預約的客人近期付款記錄：過去 7 日付款成功／失敗次數、最近幾次嘗試、會員等級、帳戶年齡、已確認預約數。不會返回姓名、電話或電郵。判斷是客人自己問題、重複失敗還是系統問題時使用。',
      parameters: { type: 'object', properties: { booking: { type: 'string', description: '預約編號' } }, required: ['booking'] },
    },
    run: async (a) => {
      const code = argStr(a, 'booking')
      if (!code) throw new Error('缺少 booking')
      const b = await findBooking(code)
      const userId = b ? str(b, ['user_id']) : null
      if (!b || !userId) return { found: false }
      const service = getLegacyServiceSupabase()
      const [user, attempts, confirmed] = await Promise.all([
        service.from('users').select('tier, created_at, phone_verified, is_blacklisted').eq('id', userId).maybeSingle(),
        service.from('payment_attempts').select('id, booking_id, provider, status, failure_code, failure_reason, created_at, completed_at').eq('user_id', userId).gte('created_at', sinceHours(168)).order('created_at', { ascending: false }).limit(30),
        service.from('bookings').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('status', 'confirmed'),
      ])
      const u = (user.data ?? null) as unknown as Row | null
      const rows = (attempts.data ?? []) as unknown as Row[]
      const count = (s: string) => rows.filter((r) => str(r, ['status']) === s).length
      const created = u ? str(u, ['created_at']) : null
      return {
        member: u ? { tier: str(u, ['tier']), accountAgeDays: created ? Math.floor((Date.now() - new Date(created).getTime()) / 86_400_000) : null, phoneVerified: u.phone_verified === true, blacklisted: u.is_blacklisted === true } : null,
        confirmedBookings: confirmed.count ?? 0,
        last7Days: { succeeded: count('succeeded'), failed: count('failed'), expired: count('expired'), cancelled: count('cancelled') },
        recentAttempts: rows.slice(0, 8).map((r) => compactAttempt(r)),
      }
    },
  },
  {
    def: {
      name: 'get_slot_occupancy',
      description: '查某日某房間的預約佔用情況（已確認和待付款），用來判斷時段衝突，例如付款後預約「無法確認」是否因時段已被佔用。',
      parameters: { type: 'object', properties: { date: { type: 'string', description: 'YYYY-MM-DD' }, table: { type: 'integer', description: '房號，不填為全部' } }, required: ['date'] },
    },
    run: async (a) => {
      const date = isoDate(a, 'date')
      if (!date) throw new Error('date 格式不正確')
      const service = getLegacyServiceSupabase()
      let q = service
        .from('bookings')
        .select(BOOKING_COLS)
        .eq('date', date)
        .in('status', ['confirmed', 'pending', 'payment_review'])
        .or('is_test.is.null,is_test.eq.false')
        .order('start_time')
        .limit(40)
      const table = typeof a.table === 'number' ? Math.floor(a.table) : null
      if (table !== null) q = q.eq('table_number', table)
      const { data, error } = await q
      if (error) throw new Error(error.message)
      return { date, bookings: ((data ?? []) as unknown as Row[]).map(compactBooking) }
    },
  },
]

const BY_NAME = new Map(AGENT_TOOLS.map((t) => [t.def.name, t]))

export function toolDefs(): MimoToolDef[] {
  return AGENT_TOOLS.map((t) => t.def)
}

/** Runs one tool by name. Never throws: errors come back as text the model can read. */
export async function runAgentTool(name: string, rawArgs: string): Promise<{ ok: boolean; text: string }> {
  const tool = BY_NAME.get(name)
  if (!tool) return { ok: false, text: `沒有這個工具：${name}` }
  let args: Args = {}
  try {
    const parsed: unknown = rawArgs.trim() === '' ? {} : JSON.parse(rawArgs)
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) args = parsed as Args
  } catch {
    return { ok: false, text: '工具參數不是有效的 JSON' }
  }
  try {
    const result = await tool.run(args)
    const text = JSON.stringify(result)
    return { ok: true, text: text.length > MAX_OUT ? `${text.slice(0, MAX_OUT)}…（結果太長，已截短）` : text }
  } catch (err) {
    return { ok: false, text: `工具執行失敗：${err instanceof Error ? err.message : '未知錯誤'}` }
  }
}
