/**
 * Extra read-only Spark tools used by the CS centre (and available in the Spark chat):
 * Vercel runtime logs, a database health snapshot and PaymentX hosted-cashier orders.
 * SELECT / GET only — nothing here writes. Customers appear as booking codes only.
 */

import { getLegacyServiceSupabase } from '@/lib/supabase/legacy'
import type { ReadTool } from './readTools'

type Row = Record<string, unknown>

const VERCEL_PROJECT_ID = process.env.VERCEL_PROJECT_ID?.trim() || 'prj_JXjsQQWd9kUTRwU70Lwya9SBbHki'
const VERCEL_TEAM_SLUG = process.env.VERCEL_TEAM_SLUG?.trim() || 'lucaycc-3022s-projects'

const str = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null)
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : Number(v) || 0)
const hk = (iso: unknown): string | null => {
  const s = str(iso)
  if (!s) return null
  const t = new Date(s)
  return Number.isNaN(t.getTime()) ? null : new Date(t.getTime() + 8 * 3600_000).toISOString().slice(0, 16).replace('T', ' ')
}
const rows = (v: unknown): Row[] => (Array.isArray(v) ? (v as Row[]) : [])

/** Strip anything that looks like a secret, an email or a long token before it reaches the model. */
function scrub(text: string): string {
  return text
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[email]')
    .replace(/(Bearer\s+)[A-Za-z0-9._~+/=-]+/gi, '$1[redacted]')
    .replace(/\b[A-Za-z0-9_-]{32,}\b/g, '[token]')
    .slice(0, 300)
}

type VercelDeployment = { uid?: string; url?: string; state?: string; readyState?: string; createdAt?: number; target?: string | null }

async function vercelGet(path: string, token: string, signal: AbortSignal): Promise<Response> {
  const sep = path.includes('?') ? '&' : '?'
  return fetch(`https://api.vercel.com${path}${sep}slug=${encodeURIComponent(VERCEL_TEAM_SLUG)}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal,
    cache: 'no-store',
  })
}

/** `needles` (user id, booking ids, booking codes): runtime-log lines that mention one are kept even if they are not errors. */
export async function fetchVercelRuntimeProblems(minutes: number, needles: string[] = []): Promise<Record<string, unknown>> {
  const token = process.env.VERCEL_TOKEN
  if (!token) return { available: false, reason: '未設定 VERCEL_TOKEN，無法讀取 Vercel 日誌' }
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 12_000)
  try {
    const dRes = await vercelGet(`/v6/deployments?projectId=${VERCEL_PROJECT_ID}&target=production&limit=3`, token, controller.signal)
    if (!dRes.ok) return { available: false, reason: `Vercel API ${dRes.status}` }
    const dJson = (await dRes.json()) as { deployments?: VercelDeployment[] }
    const deployments = dJson.deployments ?? []
    const latest = deployments[0]
    const summary = deployments.map((d) => ({ state: d.state ?? d.readyState ?? null, at: d.createdAt ? hk(new Date(d.createdAt).toISOString()) : null }))
    if (!latest?.uid) return { available: true, deployments: summary, problems: [], note: '找不到生產部署' }

    const since = Date.now() - minutes * 60_000
    const lRes = await vercelGet(`/v1/projects/${VERCEL_PROJECT_ID}/deployments/${latest.uid}/runtime-logs`, token, controller.signal)
    if (!lRes.ok || !lRes.body) return { available: true, deployments: summary, problems: [], note: `未能讀取運行日誌（${lRes.status}）` }

    // The runtime-logs endpoint streams newline-delimited JSON; read a bounded amount only.
    const reader = lRes.body.getReader()
    const decoder = new TextDecoder()
    let buf = ''
    while (buf.length < 400_000) {
      const { done, value } = await reader.read()
      if (done) break
      buf += decoder.decode(value, { stream: true })
    }
    void reader.cancel().catch(() => undefined)

    const problems: { at: string | null; level: string; status: number | null; path: string | null; message: string; account?: boolean }[] = []
    for (const line of buf.split('\n')) {
      if (!line.trim()) continue
      let rec: Row
      try {
        rec = JSON.parse(line) as Row
      } catch {
        continue
      }
      const ts = num(rec.timestampInMs)
      if (ts && ts < since) continue
      const level = str(rec.level) ?? 'info'
      const status = num(rec.responseStatusCode) || null
      const hit = needles.length > 0 && needles.some((n) => n.length >= 6 && line.includes(n))
      if (!(hit || level === 'error' || level === 'warning' || (status !== null && status >= 500))) continue
      problems.push({
        account: hit || undefined,
        at: ts ? hk(new Date(ts).toISOString()) : null,
        level,
        status,
        path: str(rec.requestPath),
        message: scrub(str(rec.message) ?? ''),
      })
      if (problems.length >= 40) break
    }
    return {
      available: true,
      latestDeployment: { state: latest.state ?? latest.readyState ?? null, at: latest.createdAt ? hk(new Date(latest.createdAt).toISOString()) : null },
      deployments: summary,
      windowMinutes: minutes,
      problemCount: problems.length,
      problems,
    }
  } catch (e) {
    return { available: false, reason: e instanceof Error && e.name === 'AbortError' ? 'Vercel 回應逾時' : '讀取 Vercel 日誌失敗' }
  } finally {
    clearTimeout(timer)
  }
}

export async function databaseHealthSnapshot(): Promise<Record<string, unknown>> {
  const db = getLegacyServiceSupabase()
  const t0 = Date.now()
  const ping = await db.from('config').select('key', { head: true, count: 'exact' }).limit(1)
  const pingMs = Date.now() - t0
  const ago = (min: number) => new Date(Date.now() - min * 60_000).toISOString()
  const count = async (q: PromiseLike<{ count: number | null; error: { message: string } | null }>) => {
    const r = await q
    return r.error ? null : r.count
  }
  const [stalePending, stuckAttempts, creatingOrders, review, errors1h, errors24h] = await Promise.all([
    count(db.from('bookings').select('id', { head: true, count: 'exact' }).eq('status', 'pending').lt('created_at', ago(30)).gte('created_at', ago(24 * 60)).or('is_test.is.null,is_test.eq.false')),
    count(db.from('payment_attempts').select('id', { head: true, count: 'exact' }).in('status', ['claimed', 'pending']).lt('created_at', ago(20)).gte('created_at', ago(24 * 60))),
    count(db.from('paymentx_orders').select('id', { head: true, count: 'exact' }).eq('status', 'creating').lt('updated_at', ago(2))),
    count(db.from('bookings').select('id', { head: true, count: 'exact' }).eq('status', 'payment_review')),
    count(db.from('site_error_log').select('id', { head: true, count: 'exact' }).eq('resolved', false).not('source', 'like', 'admin.door%').gte('created_at', ago(60))),
    count(db.from('site_error_log').select('id', { head: true, count: 'exact' }).eq('resolved', false).not('source', 'like', 'admin.door%').gte('created_at', ago(24 * 60))),
  ])
  const topSources = rows((await db.from('site_error_log').select('source').eq('resolved', false).not('source', 'like', 'admin.door%').gte('created_at', ago(24 * 60)).limit(300)).data)
  const bySource: Record<string, number> = {}
  for (const r of topSources) {
    const s = str(r.source) ?? 'unknown'
    bySource[s] = (bySource[s] ?? 0) + 1
  }
  return {
    reachable: !ping.error,
    pingError: ping.error ? scrub(ping.error.message) : null,
    pingMs,
    staleUnpaidBookingsOver30min: stalePending,
    stuckPaymentAttemptsOver20min: stuckAttempts,
    paymentxOrdersStuckCreating: creatingOrders,
    bookingsNeedingPaymentReview: review,
    unresolvedSiteErrorsLastHour: errors1h,
    unresolvedSiteErrorsLast24h: errors24h,
    errorSourcesLast24h: Object.entries(bySource).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([source, n]) => ({ source, n })),
  }
}

export const CS_READ_TOOLS: ReadTool[] = [
  {
    def: {
      name: 'get_account_logs',
      description: '查一位會員的帳戶紀錄：最近預約、付款嘗試和付款事件、與該會員有關的網站錯誤、通知（電郵）失敗，以及 Vercel 日誌中提到該會員或其預約的行。客人遇到問題需要找 bug 時先用呢個。用會員編號查。',
      parameters: { type: 'object', properties: { memberCode: { type: 'string' }, hours: { type: 'integer', description: 'Vercel 日誌回看小時數，預設 6，最多 24' } }, required: ['memberCode'] },
    },
    run: async (a) => {
      const code = typeof a.memberCode === 'string' ? a.memberCode.trim().toUpperCase().slice(0, 80) : ''
      if (!code) return { error: '請提供會員編號' }
      const hours = typeof a.hours === 'number' && Number.isInteger(a.hours) && a.hours > 0 ? Math.min(a.hours, 24) : 6
      const db = getLegacyServiceSupabase()
      const { data: u } = await db.from('users').select('id, member_code').eq('member_code', code).maybeSingle()
      if (!u) return { found: false, memberCode: code }
      const uid = String((u as Row).id)
      const bookings = rows((await db.from('bookings').select('id, human_code, date, start_time, status, total_price, payment_method, created_at, confirmation_email_sent_at').eq('user_id', uid).order('created_at', { ascending: false }).limit(8)).data)
      const ids = bookings.map((b) => String(b.id))
      const codes = bookings.map((b) => str(b.human_code)).filter((x): x is string => x !== null)
      const [attempts, events, errs, notifs] = await Promise.all([
        ids.length ? db.from('payment_attempts').select('booking_id, provider, status, failure_code, failure_reason, created_at, completed_at').in('booking_id', ids).order('created_at', { ascending: false }).limit(15) : Promise.resolve({ data: [] }),
        ids.length ? db.from('payment_events').select('booking_id, event, source, from_state, to_state, reason, created_at').in('booking_id', ids).order('created_at', { ascending: false }).limit(25) : Promise.resolve({ data: [] }),
        db.from('site_error_log').select('source, severity, message, created_at, detail').gte('created_at', new Date(Date.now() - 7 * 86_400_000).toISOString()).or(`detail->>userId.eq.${uid},detail->>user_id.eq.${uid}${ids.length ? `,detail->>bookingId.in.(${ids.join(',')})` : ''}`).order('created_at', { ascending: false }).limit(15),
        ids.length ? db.from('notification_log').select('booking_id, channel, type, status, error_message, sent_at').in('booking_id', ids).neq('status', 'sent').order('sent_at', { ascending: false }).limit(10) : Promise.resolve({ data: [] }),
      ])
      const codeOf = new Map(bookings.map((b) => [String(b.id), str(b.human_code)]))
      const vercel = await fetchVercelRuntimeProblems(hours * 60, [uid, ...ids, ...codes])
      return {
        memberCode: code,
        bookings: bookings.map((b) => ({ code: str(b.human_code), date: b.date, time: String(b.start_time ?? '').slice(0, 5), status: b.status, hkd: num(b.total_price), method: b.payment_method, confirmationEmailSent: b.confirmation_email_sent_at !== null, createdAt: hk(b.created_at) })),
        paymentAttempts: rows(attempts.data).map((r) => ({ booking: codeOf.get(String(r.booking_id)) ?? null, provider: r.provider, status: r.status, failure: scrub(`${str(r.failure_code) ?? ''} ${str(r.failure_reason) ?? ''}`), at: hk(r.created_at) })),
        paymentEvents: rows(events.data).map((r) => ({ booking: codeOf.get(String(r.booking_id)) ?? null, event: r.event, source: r.source, to: r.to_state, reason: scrub(str(r.reason) ?? ''), at: hk(r.created_at) })),
        siteErrors: rows(errs.data).map((r) => ({ source: r.source, severity: r.severity, message: scrub(str(r.message) ?? ''), at: hk(r.created_at) })),
        notificationFailures: rows(notifs.data).map((r) => ({ booking: codeOf.get(String(r.booking_id)) ?? null, channel: r.channel, type: r.type, error: scrub(str(r.error_message) ?? ''), at: hk(r.sent_at) })),
        vercel,
      }
    },
  },
  {
    def: {
      name: 'get_vercel_logs',
      description: '讀取 Vercel 生產環境最近的部署狀態和運行日誌中的錯誤／5xx（預設最近 30 分鐘，最多 25 條）。懷疑網站掛咗、出錯或剛部署後有問題時用。',
      parameters: { type: 'object', properties: { minutes: { type: 'integer', description: '回看分鐘數，預設 30，最多 240' } } },
    },
    run: async (a) => {
      const m = typeof a.minutes === 'number' && Number.isInteger(a.minutes) && a.minutes > 0 ? Math.min(a.minutes, 240) : 30
      return fetchVercelRuntimeProblems(m)
    },
  },
  {
    def: {
      name: 'get_db_health',
      description: '資料庫與付款管道健康快照：資料庫連線／回應時間、超過 30 分鐘未付款的預約、卡住的付款嘗試、卡在建立中的 PaymentX 訂單、待審核付款、近 1 小時／24 小時未處理網站錯誤及主要來源。',
      parameters: { type: 'object', properties: {} },
    },
    run: async () => databaseHealthSnapshot(),
  },
  {
    def: {
      name: 'get_paymentx_orders',
      description: '查 KPay 全託管（PaymentX）訂單：用預約編號查該預約的所有託管訂單狀態；不指定則列最近 10 張。',
      parameters: { type: 'object', properties: { bookingCode: { type: 'string' } } },
    },
    run: async (a) => {
      const db = getLegacyServiceSupabase()
      const code = typeof a.bookingCode === 'string' ? a.bookingCode.trim().slice(0, 40) : ''
      let bookingId: string | null = null
      if (code) {
        if (!/^[A-Za-z0-9_-]+$/.test(code)) return { error: '預約編號格式不正確' }
        const { data } = await db.from('bookings').select('id').or(`human_code.eq.${code},booking_reference.eq.${code}`).limit(1).maybeSingle()
        bookingId = data ? String((data as { id: unknown }).id) : null
        if (!bookingId) return { found: false, bookingCode: code }
      }
      let q = db.from('paymentx_orders').select('booking_id, managed_out_trade_no, status, amount, failure_reason, created_at, completed_at, is_test').order('created_at', { ascending: false }).limit(10)
      if (bookingId) q = q.eq('booking_id', bookingId)
      const list = rows((await q).data)
      return {
        orders: list.map((r) => ({
          ref: str(r.managed_out_trade_no),
          status: r.status,
          amountHkd: num(r.amount),
          failure: str(r.failure_reason)?.slice(0, 120) ?? null,
          createdAt: hk(r.created_at),
          completedAt: hk(r.completed_at),
          test: r.is_test === true,
        })),
      }
    },
  },
]
