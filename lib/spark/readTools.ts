/**
 * Read-only lookup tools for Spark, on top of the investigator's tools in lib/admin/agentTools.ts.
 * Rules (same as the investigator):
 *  • SELECT only — nothing here writes.
 *  • No customer names, phones, emails or user ids ever leave this file; customers appear as
 *    member codes, bookings as booking codes. Admin staff appear as the part of their email
 *    before the @.
 *  • Results are small (row caps) so a broad question cannot flood the model.
 */

import { getLegacyServiceSupabase } from '@/lib/supabase/legacy'
import { getHiddenUserList } from '@/lib/data/getHiddenUserIds'
import type { MimoToolDef } from '@/lib/ai/mimo'
import { getLiveKPayState } from '@/lib/payments/live-order'

type Args = Record<string, unknown>
type Row = Record<string, unknown>
export type ReadTool = { def: MimoToolDef; run: (a: Args) => Promise<unknown> }

const svc = () => getLegacyServiceSupabase()
const str = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null)
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : Number(v) || 0)
const argStr = (a: Args, k: string, max = 60): string | null => (typeof a[k] === 'string' && a[k] !== '' ? String(a[k]).trim().slice(0, max) : null)
const argInt = (a: Args, k: string, d: number, max: number): number => {
  const n = typeof a[k] === 'number' ? a[k] : Number(a[k])
  return Number.isInteger(n) && n > 0 ? Math.min(n, max) : d
}
const isoDate = (a: Args, k: string): string | null => {
  const v = argStr(a, k, 10)
  return v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null
}
const hkToday = (): string => new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10)
const hkStamp = (iso: unknown): string | null => {
  const s = str(iso)
  if (!s) return null
  const t = new Date(s)
  return Number.isNaN(t.getTime()) ? null : new Date(t.getTime() + 8 * 3600_000).toISOString().slice(0, 16).replace('T', ' ')
}
const staff = (email: unknown): string | null => (typeof email === 'string' ? email.split('@')[0] : null)
/** Booking code / KPay order number only — keeps model-supplied text out of PostgREST filter strings. */
const refArg = (a: Args): string | null => {
  const v = argStr(a, 'reference', 40)
  return v && /^[A-Za-z0-9_-]+$/.test(v) ? v : null
}
const hhmm = (v: unknown): string => String(v ?? '').slice(0, 5)
const rows = (v: unknown): Row[] => (Array.isArray(v) ? (v as Row[]) : [])
const bookingCode = (r: Row): string | null => str(r.human_code) ?? str(r.booking_reference)

async function must<T>(p: PromiseLike<{ data: T | null; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await p
  if (error) throw new Error(error.message)
  return (data ?? ([] as unknown as T)) as T
}

function promoCompact(r: Row) {
  const until = str(r.valid_until)
  const expired = until !== null && new Date(until).getTime() < Date.now()
  return {
    code: r.code,
    name: str(r.name),
    status: str(r.status) ?? (r.is_active === true ? 'active' : 'disabled'),
    discount: r.discount_type === 'percentage' ? `${num(r.discount_value)}%` : `HK$${num(r.discount_value)}`,
    maxDiscountHkd: r.max_discount ?? null,
    used: num(r.used_count),
    maxUses: r.max_uses ?? null,
    perUserLimit: r.per_user_limit ?? null,
    minCartHkd: r.min_cart_amount ?? null,
    validFrom: hkStamp(r.valid_from)?.slice(0, 10) ?? null,
    validUntil: hkStamp(r.valid_until)?.slice(0, 10) ?? null,
    expired,
    audience: r.audience,
    audienceThreshold: r.audience_threshold ?? null,
    weekdays: r.weekdays ?? null,
    timeWindows: r.time_windows ?? null,
    stackableWithCredits: r.stackable_with_credits,
    stackableWithOtherCodes: r.stackable_with_other_codes,
  }
}

const CONFIG_KEYS = ['pricing_rates', 'booking_rules', 'tiers', 'points_system', 'venue', 'maintenance', 'door_access'] as const

export const READ_TOOLS: ReadTool[] = [
  {
    def: {
      name: 'get_overview',
      description: '全店即時概覽（香港今日）：今日預約數（按狀態）、今日收入、仍待處理的付款、近 24 小時新會員、未處理網站錯誤數、錢包 credit 總額、啟用中優惠碼數。管理員問「今日點」「有咩要處理」「整體情況」時先用呢個。',
      parameters: { type: 'object', properties: {} },
    },
    run: async () => {
      const s = svc()
      const today = hkToday()
      const dayAgo = new Date(Date.now() - 86_400_000).toISOString()
      const [bk, pend, newU, errs, wallet, promos] = await Promise.all([
        must(s.from('bookings').select('status, total_price, start_time').eq('date', today).or('is_test.is.null,is_test.eq.false').limit(500)),
        must(s.from('bookings').select('id', { count: 'exact', head: true }).in('status', ['pending', 'payment_review']).or('is_test.is.null,is_test.eq.false')),
        must(s.from('users').select('id', { count: 'exact', head: true }).gte('created_at', dayAgo)),
        must(s.from('site_error_log').select('id', { count: 'exact', head: true }).eq('resolved', false).not('source', 'like', 'admin.door%').gte('created_at', dayAgo)),
        must(s.from('users').select('credits, points').gt('credits', 0).limit(2000)),
        must(s.from('promotion_codes').select('id', { count: 'exact', head: true }).eq('status', 'active')),
      ])
      const byStatus: Record<string, number> = {}
      let revenue = 0
      for (const b of rows(bk)) {
        const st = String(b.status)
        byStatus[st] = (byStatus[st] ?? 0) + 1
        if (st === 'confirmed') revenue += num(b.total_price)
      }
      return {
        date: today,
        bookingsToday: byStatus,
        revenueTodayHkd: revenue,
        paymentsWaiting: (pend as unknown as { count?: number }).count ?? null,
        newMembersLast24h: (newU as unknown as { count?: number }).count ?? null,
        unresolvedSiteErrorsLast24h: (errs as unknown as { count?: number }).count ?? null,
        walletCreditOutstandingHkd: rows(wallet).reduce((n, r) => n + num(r.credits), 0),
        membersWithCredit: rows(wallet).length,
        activePromoCodes: (promos as unknown as { count?: number }).count ?? null,
      }
    },
  },
  {
    def: {
      name: 'list_promos',
      description: '列出優惠碼（最多 40 個）：狀態、折扣、已用／上限、有效期、對象、是否已過期。可按狀態篩選（active／disabled／draft）。管理員問「有咩優惠碼」「邊個優惠碼生效中」時用。',
      parameters: { type: 'object', properties: { status: { type: 'string', enum: ['active', 'disabled', 'draft'] } } },
    },
    run: async (a) => {
      let q = svc().from('promotion_codes').select('*').order('created_at', { ascending: false }).limit(40)
      const st = argStr(a, 'status', 10)
      if (st && ['active', 'disabled', 'draft'].includes(st)) q = q.eq('status', st)
      return { promos: rows(await must(q)).map(promoCompact) }
    },
  },
  {
    def: {
      name: 'get_promo',
      description: '查一個優惠碼的完整設定和使用情況：實際兌換次數、鎖定中次數、總折扣金額、最近 8 次使用（預約編號、折扣、狀態、日期）。',
      parameters: { type: 'object', properties: { code: { type: 'string' } }, required: ['code'] },
    },
    run: async (a) => {
      const code = argStr(a, 'code', 40)?.toUpperCase()
      if (!code) throw new Error('請提供優惠碼')
      const s = svc()
      const { data: p } = await s.from('promotion_codes').select('*').eq('code', code).maybeSingle()
      if (!p) return { found: false, code }
      const promo = p as Row
      const usages = rows(await must(s.from('promo_code_usages').select('booking_id, discount_amount, status, created_at, redeemed_at').eq('promo_code_id', String(promo.id)).order('created_at', { ascending: false }).limit(300)))
      const stats: Record<string, { count: number; discountHkd: number }> = {}
      for (const u of usages) {
        const k = String(u.status)
        stats[k] = stats[k] ?? { count: 0, discountHkd: 0 }
        stats[k].count += 1
        stats[k].discountHkd += num(u.discount_amount)
      }
      const recent = usages.slice(0, 8)
      const ids = recent.map((u) => String(u.booking_id)).filter((x) => x && x !== 'null')
      const codes = new Map<string, string | null>()
      if (ids.length > 0) for (const b of rows(await must(s.from('bookings').select('id, human_code, booking_reference').in('id', ids)))) codes.set(String(b.id), bookingCode(b))
      return {
        ...promoCompact(promo),
        usageByStatus: stats,
        recentUses: recent.map((u) => ({ booking: codes.get(String(u.booking_id)) ?? null, discountHkd: num(u.discount_amount), status: u.status, at: hkStamp(u.redeemed_at ?? u.created_at) })),
      }
    },
  },
  {
    def: {
      name: 'get_member',
      description: '查一位會員的完整檔案（用會員編號）：等級、積分、錢包 credit、加入日期、是否黑名單、預約統計（確認數、消費、取消數）、最近 8 張預約、最近 8 筆 credit 流水、最近 8 筆積分流水、未使用優惠券數。回答「呢位會員點」「佢啲 credit 點嚟」「佢最近訂過咩」時用。',
      parameters: { type: 'object', properties: { memberCode: { type: 'string' } }, required: ['memberCode'] },
    },
    run: async (a) => {
      const code = argStr(a, 'memberCode', 80)?.toUpperCase()
      if (!code) throw new Error('請提供會員編號')
      const s = svc()
      const { data: u } = await s.from('users').select('id, member_code, tier, points, credits, created_at, is_blacklisted, needs_manual_phone_reverify').eq('member_code', code).maybeSingle()
      if (!u) return { found: false, memberCode: code }
      const m = u as Row
      const uid = String(m.id)
      const hidden = (await getHiddenUserList()).ids.has(uid)
      const [bks, cl, pl, coupons] = await Promise.all([
        must(s.from('bookings').select('human_code, booking_reference, date, start_time, end_time, table_number, total_price, status, payment_method, is_test').eq('user_id', uid).order('date', { ascending: false }).limit(60)),
        must(s.from('credits_ledger').select('amount, type, note, balance_after, created_at').eq('user_id', uid).order('created_at', { ascending: false }).limit(8)),
        must(s.from('points_ledger').select('points, type, note, created_at').eq('user_id', uid).order('created_at', { ascending: false }).limit(8)),
        must(s.from('user_coupons').select('id', { count: 'exact', head: true }).eq('user_id', uid).eq('is_used', false)),
      ])
      const all = rows(bks).filter((b) => b.is_test !== true)
      const confirmed = all.filter((b) => b.status === 'confirmed')
      return {
        memberCode: code,
        hiddenAccount: hidden,
        tier: m.tier,
        points: num(m.points),
        walletCreditHkd: num(m.credits),
        joined: hkStamp(m.created_at)?.slice(0, 10),
        blacklisted: m.is_blacklisted === true,
        needsPhoneReverify: m.needs_manual_phone_reverify === true,
        bookings: {
          confirmed: confirmed.length,
          spendHkd: confirmed.reduce((n, b) => n + num(b.total_price), 0),
          cancelled: all.filter((b) => ['cancelled', 'admin_cancelled'].includes(String(b.status))).length,
          lastBookingDate: confirmed[0] ? confirmed[0].date : null,
          recent: all.slice(0, 8).map((b) => ({ code: bookingCode(b), date: b.date, time: `${hhmm(b.start_time)}-${hhmm(b.end_time)}`, room: b.table_number, hkd: num(b.total_price), status: b.status, method: b.payment_method })),
        },
        creditLedger: rows(cl).map((r) => ({ amount: num(r.amount), type: r.type, note: str(r.note)?.slice(0, 80) ?? null, balanceAfter: r.balance_after, at: hkStamp(r.created_at) })),
        pointsLedger: rows(pl).map((r) => ({ points: num(r.points), type: r.type, note: str(r.note)?.slice(0, 80) ?? null, at: hkStamp(r.created_at) })),
        unusedCoupons: (coupons as unknown as { count?: number }).count ?? 0,
      }
    },
  },
  {
    def: {
      name: 'get_day_bookings',
      description: '某一日所有預約（按時間排序）：預約編號、房間、時間、金額、狀態、付款方式。預設今日。管理員問「今日有邊啲預約」「聽日幾點有人」時用。',
      parameters: { type: 'object', properties: { date: { type: 'string', description: 'YYYY-MM-DD，預設今日（香港）' }, includeCancelled: { type: 'boolean' } } },
    },
    run: async (a) => {
      const date = isoDate(a, 'date') ?? hkToday()
      let q = svc().from('bookings').select('human_code, booking_reference, table_number, start_time, end_time, total_price, status, payment_method, is_test').eq('date', date).order('start_time', { ascending: true }).limit(80)
      if (a.includeCancelled !== true) q = q.in('status', ['confirmed', 'pending', 'payment_review'])
      const list = rows(await must(q)).filter((b) => b.is_test !== true)
      return { date, count: list.length, bookings: list.map((b) => ({ code: bookingCode(b), room: b.table_number, time: `${hhmm(b.start_time)}-${hhmm(b.end_time)}`, hkd: num(b.total_price), status: b.status, method: b.payment_method })) }
    },
  },
  {
    def: {
      name: 'get_cancellations',
      description: '最近的取消紀錄（後台取消）：預約編號、原因、補償方式和金額、時間。可指定最近幾日（預設 30，最多 90）。',
      parameters: { type: 'object', properties: { days: { type: 'integer' }, limit: { type: 'integer' } } },
    },
    run: async (a) => {
      const since = new Date(Date.now() - argInt(a, 'days', 30, 90) * 86_400_000).toISOString()
      const list = rows(await must(svc().from('cancellation_log').select('booking_id, reason, compensation_type, compensation_value, created_at').gte('created_at', since).order('created_at', { ascending: false }).limit(argInt(a, 'limit', 15, 30))))
      const ids = list.map((r) => String(r.booking_id))
      const codes = new Map<string, string | null>()
      if (ids.length > 0) for (const b of rows(await must(svc().from('bookings').select('id, human_code, booking_reference').in('id', ids)))) codes.set(String(b.id), bookingCode(b))
      return { count: list.length, cancellations: list.map((r) => ({ booking: codes.get(String(r.booking_id)) ?? null, reason: str(r.reason)?.slice(0, 100) ?? null, compensation: r.compensation_type, compensationValue: r.compensation_value, at: hkStamp(r.created_at) })) }
    },
  },
  {
    def: {
      name: 'get_audit_log',
      description: '後台操作審計紀錄：邊個管理員幾時做咗乜（包括 Spark 的確認／還原）。可按關鍵字（action）和最近幾小時（預設 72，最多 720）篩選，最多 30 條。',
      parameters: { type: 'object', properties: { hours: { type: 'integer' }, action: { type: 'string', description: 'action 包含的字，例如 promo、spark、credit' }, limit: { type: 'integer' } } },
    },
    run: async (a) => {
      const since = new Date(Date.now() - argInt(a, 'hours', 72, 720) * 3_600_000).toISOString()
      let q = svc().from('audit_log').select('action, target_table, admin_email, after_value, created_at').gte('created_at', since).order('created_at', { ascending: false }).limit(argInt(a, 'limit', 20, 30))
      const act = argStr(a, 'action', 30)
      if (act && /^[A-Za-z0-9_]+$/.test(act)) q = q.ilike('action', `%${act}%`)
      return { entries: rows(await must(q)).map((r) => ({ at: hkStamp(r.created_at), admin: staff(r.admin_email), action: r.action, table: r.target_table, detail: JSON.stringify(r.after_value ?? null).slice(0, 160) })) }
    },
  },
  {
    def: {
      name: 'get_config',
      description: '讀取網站設定（只讀）：pricing_rates（價目）、booking_rules（預訂規則）、tiers（會員等級）、points_system（積分制度）、venue（場地）、maintenance（維修日期）、door_access。回答價錢、規則、等級門檻時用，不要憑記憶答。',
      parameters: { type: 'object', properties: { key: { type: 'string', enum: [...CONFIG_KEYS] } }, required: ['key'] },
    },
    run: async (a) => {
      const key = CONFIG_KEYS.find((k) => k === a.key)
      if (!key) throw new Error(`key 必須是 ${CONFIG_KEYS.join('、')}`)
      const { data } = await svc().from('config').select('value, description, updated_at').eq('key', key).maybeSingle()
      if (!data) return { found: false, key }
      const r = data as Row
      return { key, description: r.description, updated: hkStamp(r.updated_at), value: r.value }
    },
  },
  {
    def: {
      name: 'get_maintenance',
      description: '封枱／維修紀錄：今日及之後被封的日期、房間、時段和原因。',
      parameters: { type: 'object', properties: {} },
    },
    run: async () => {
      const list = rows(await must(svc().from('maintenance_log').select('date, table_number, start_time, end_time, reason').gte('date', hkToday()).order('date', { ascending: true }).limit(30)))
      return { count: list.length, blocks: list.map((r) => ({ date: r.date, room: r.table_number ?? '全部', time: r.start_time ? `${hhmm(r.start_time)}-${hhmm(r.end_time)}` : '全日', reason: str(r.reason)?.slice(0, 80) ?? null })) }
    },
  },
  {
    def: {
      name: 'get_payment_timeline',
      description:
        '某張預約的完整付款時間線（取消、webhook、對賬、凍結、轉覆核等事件按時間排列），連同預約狀態、付款嘗試狀態。用預約編號（如 SPACE8-XXXXX-X）或 KPay 單號。查付款問題（付咗錢但冇確認、取消後被付款、卡住）時首先用這個。',
      parameters: { type: 'object', properties: { reference: { type: 'string' } }, required: ['reference'] },
    },
    run: async (a) => {
      const ref = refArg(a)
      if (!ref) return { error: '請提供預約編號或 KPay 單號' }
      const found = rows(await must(svc().from('bookings').select('id, human_code, status, total_price, provider_order_no, order_group_id, date, start_time, created_at, updated_at, admin_note').or(`human_code.ilike.%${ref}%,provider_order_no.eq.${ref}`).order('created_at', { ascending: false }).limit(3)))
      if (found.length === 0) return { error: '找不到這張預約' }
      const out = []
      for (const b of found) {
        const events = rows(await must(svc().from('payment_events').select('created_at, event, source, from_state, to_state, reason, provider_order_no').eq('booking_id', String(b.id)).order('created_at', { ascending: true }).limit(40)))
        const attempts = rows(await must(svc().from('payment_attempts').select('status, failure_code, provider_order_no, created_at').eq('booking_id', String(b.id)).order('created_at', { ascending: true }).limit(10)))
        out.push({
          booking: bookingCode(b),
          status: b.status,
          total: num(b.total_price),
          orderTail: str(b.provider_order_no)?.slice(-8) ?? null,
          createdAt: hkStamp(b.created_at),
          updatedAt: hkStamp(b.updated_at),
          note: str(b.admin_note)?.slice(0, 200) ?? null,
          attempts: attempts.map((x) => ({ status: x.status, failure: x.failure_code, at: hkStamp(x.created_at) })),
          timeline: events.map((e) => ({ at: hkStamp(e.created_at)?.slice(11) ?? null, event: e.event, source: e.source, from: e.from_state, to: e.to_state, reason: str(e.reason)?.slice(0, 80) ?? null })),
        })
      }
      return { bookings: out }
    },
  },
  {
    def: {
      name: 'check_kpay_order',
      description: '即時向 KPay 查某張預約的付款單現在是已付款 / 未付款(仍可付) / 已關閉 / 查詢失敗。用預約編號。只讀，不會改任何資料。',
      parameters: { type: 'object', properties: { reference: { type: 'string' } }, required: ['reference'] },
    },
    run: async (a) => {
      const ref = refArg(a)
      if (!ref) return { error: '請提供預約編號' }
      const b = rows(await must(svc().from('bookings').select('human_code, status, provider_order_no').ilike('human_code', `%${ref}%`).order('created_at', { ascending: false }).limit(1)))[0]
      if (!b) return { error: '找不到這張預約' }
      const live = await getLiveKPayState(str(b.provider_order_no))
      return { booking: bookingCode(b), bookingStatus: b.status, kpay: live, meaning: { paid: '已付款', pending: '未付款，付款頁仍可付', closed: '已關閉/失敗', unknown: '查詢失敗，未能確定', none: '沒有 KPay 單' }[live] }
    },
  },
  {
    def: {
      name: 'get_payment_problems',
      description: '最近需要處理的付款問題：payment_review（已付款但未能確認）、卡在 claimed/pending 太久的付款嘗試、最近 webhook 失敗。可指定最近幾小時（預設 24）。每日檢查或問「有冇付款問題」時用。',
      parameters: { type: 'object', properties: { hours: { type: 'integer' } } },
    },
    run: async (a) => {
      const since = new Date(Date.now() - argInt(a, 'hours', 24, 168) * 3_600_000).toISOString()
      const review = rows(await must(svc().from('bookings').select('human_code, total_price, provider_order_no, updated_at').eq('status', 'payment_review').order('updated_at', { ascending: false }).limit(15)))
      const stuck = rows(await must(svc().from('payment_attempts').select('booking_id, status, created_at').in('status', ['claimed', 'pending']).lt('created_at', new Date(Date.now() - 20 * 60_000).toISOString()).gte('created_at', since).order('created_at', { ascending: false }).limit(15)))
      const hooks = rows(await must(svc().from('site_error_log').select('created_at, message, detail').eq('source', 'webhooks/kpay').gte('created_at', since).order('created_at', { ascending: false }).limit(10)))
      return {
        needsReview: review.map((r) => ({ booking: bookingCode(r), amount: num(r.total_price), orderTail: str(r.provider_order_no)?.slice(-8) ?? null, at: hkStamp(r.updated_at) })),
        stuckAttempts: stuck.length,
        webhookFailures: hooks.map((r) => ({ at: hkStamp(r.created_at), message: str(r.message)?.slice(0, 80), detail: JSON.stringify(r.detail ?? {}).slice(0, 200) })),
      }
    },
  },
  {
    def: {
      name: 'get_bug_reports',
      description: '管理員提交的問題回報：嚴重程度、標題、狀態、時間（最多 15 條，預設只列未完成）。',
      parameters: { type: 'object', properties: { includeResolved: { type: 'boolean' } } },
    },
    run: async (a) => {
      let q = svc().from('admin_bug_reports').select('severity, title, status, created_at').order('created_at', { ascending: false }).limit(15)
      if (a.includeResolved !== true) q = q.neq('status', 'resolved')
      return { reports: rows(await must(q)).map((r) => ({ severity: r.severity, title: str(r.title)?.slice(0, 80), status: r.status, at: hkStamp(r.created_at) })) }
    },
  },
  {
    def: {
      name: 'get_notification_failures',
      description: '通知（電郵／推送）發送失敗紀錄：渠道、類型、錯誤、預約編號、時間。可指定最近幾小時（預設 72）。',
      parameters: { type: 'object', properties: { hours: { type: 'integer' } } },
    },
    run: async (a) => {
      const since = new Date(Date.now() - argInt(a, 'hours', 72, 720) * 3_600_000).toISOString()
      const list = rows(await must(svc().from('notification_log').select('booking_id, channel, type, status, error_message, sent_at').neq('status', 'sent').gte('sent_at', since).order('sent_at', { ascending: false }).limit(20)))
      const ids = list.map((r) => String(r.booking_id)).filter((x) => x && x !== 'null')
      const codes = new Map<string, string | null>()
      if (ids.length > 0) for (const b of rows(await must(svc().from('bookings').select('id, human_code, booking_reference').in('id', ids)))) codes.set(String(b.id), bookingCode(b))
      return { count: list.length, failures: list.map((r) => ({ booking: codes.get(String(r.booking_id)) ?? null, channel: r.channel, type: r.type, status: r.status, error: str(r.error_message)?.slice(0, 100) ?? null, at: hkStamp(r.sent_at) })) }
    },
  },
  {
    def: {
      name: 'list_coupon_templates',
      description: '優惠券範本（會員優惠券）：名稱、折扣、已發出／上限、有效期、是否啟用。',
      parameters: { type: 'object', properties: {} },
    },
    run: async () => {
      const list = rows(await must(svc().from('coupon_templates').select('name, discount_type, discount_value, max_uses, used_count, valid_from, valid_until, is_active').order('created_at', { ascending: false }).limit(20)))
      return { templates: list.map((r) => ({ name: r.name, discount: r.discount_type === 'percentage' ? `${num(r.discount_value)}%` : `HK$${num(r.discount_value)}`, used: num(r.used_count), max: r.max_uses ?? null, until: hkStamp(r.valid_until)?.slice(0, 10) ?? null, active: r.is_active === true })) }
    },
  },
]
