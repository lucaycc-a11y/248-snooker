/**
 * Spark's agent loop — the same shape as a coding agent:
 *   think → call tools → read results → think again → … → answer.
 *
 *  • Read tools (the investigator's tools) run immediately.
 *  • `show_*` tools run a query AND hand the browser a ready-made card (income, member stats).
 *  • `propose_*` tools never change anything. They store a pending proposal that the admin must
 *    confirm on a card; the model is told so and must not claim the change happened.
 *
 * The browser sees a stream of events (steps, cards, text). The model never sees names, phone
 * numbers, emails or user ids — only member codes, amounts and statuses.
 */

import { friendlyAiError, mimoComplete, type ChatMessage, type MimoToolDef } from '@/lib/ai/mimo'
import { AGENT_TOOLS, runAgentTool } from '@/lib/admin/agentTools'
import { getAdminRevenue } from '@/lib/data/getAdminRevenue'
import { proposeAction, type ActionCtx, type SparkActionView, isActionKind } from './actions'
import { SPARK_LIMITS } from './limits'
import { resolveMemberCodes } from './members'
import { READ_TOOLS } from './readTools'

const MAX_ROUNDS = 8
const MAX_CALLS_PER_ROUND = 4
const BUDGET_MS = 55_000

export type IncomeBlock = {
  type: 'income'
  from: string
  to: string
  revenue: number
  bookings: number
  average: number
  refund: number
  net: number
  daily: { date: string; revenue: number }[]
  byMethod: { label: string; revenue: number; count: number }[]
}
export type MemberStatsBlock = {
  type: 'member_stats'
  total: number
  newLast7Days: number
  newLast30Days: number
  booked: number
  neverBooked: number
  repeat: number
  bookedPercent: number
  blacklisted: number
  totalSpend: number
  tiers: Record<string, number>
}
export type ActionBlock = { type: 'action'; action: SparkActionView }
/** Shows the member search box in the chat; picking one sends the member code back to Spark. */
export type MemberPickerBlock = { type: 'member_picker'; query: string }
/** A fill-in form (member + amount + reason) that creates a confirm card when submitted. */
export type FormBlock = { type: 'form'; kind: 'adjust_credit' | 'adjust_points'; memberCode: string; amount: number | null; reason: string }
export type SparkBlock = IncomeBlock | MemberStatsBlock | ActionBlock | MemberPickerBlock | FormBlock

export type SparkStep = { id: string; tool: string; label: string; status: 'running' | 'ok' | 'error'; ms?: number; detail?: string }
export type SparkEvent =
  | { type: 'step'; step: SparkStep }
  | { type: 'block'; block: SparkBlock }
  | { type: 'text'; text: string }
  | { type: 'error'; message: string }

export type SparkHistoryItem = { role: 'user' | 'assistant'; content: string }

const STEP_LABEL: Record<string, string> = {
  get_booking: '查預約',
  search_bookings: '搜尋預約',
  get_payment_attempts: '查付款嘗試',
  get_payment_timeline: '查付款時間線',
  check_kpay_order: '即時問 KPay',
  get_payment_problems: '查付款問題',
  get_webhook_events: '查 KPay 通知',
  get_recent_errors: '查網站錯誤',
  get_revenue_summary: '查收入',
  run_revenue_check: '執行收入核對',
  get_user_payment_history: '查客人付款記錄',
  get_slot_occupancy: '查時段佔用',
  get_member_stats: '查會員總覽',
  search_members: '搜尋會員',
  show_income: '整理收入',
  show_member_stats: '整理會員數字',
  get_overview: '查全店概覽',
  list_promos: '列出優惠碼',
  get_promo: '查優惠碼',
  get_member: '查會員檔案',
  get_day_bookings: '查某日預約',
  get_cancellations: '查取消紀錄',
  get_audit_log: '查審計紀錄',
  get_config: '讀取設定',
  get_maintenance: '查封枱紀錄',
  get_bug_reports: '查問題回報',
  get_notification_failures: '查通知失敗',
  list_coupon_templates: '查優惠券範本',
  propose_create_promo: '準備建立優惠碼',
  find_member: '搵會員',
  show_member_picker: '顯示會員選擇器',
  show_form: '顯示填寫表格',
  propose_adjust_credit: '準備調整錢包額度',
  propose_adjust_points: '準備調整積分',
  propose_set_tier: '準備更改會員等級',
  propose_set_blacklist: '準備更新黑名單',
  propose_send_message: '準備發送訊息',
  propose_cancel_booking: '準備取消預約',
  propose_set_promo_status: '準備更改優惠碼狀態',
  propose_set_promo_expiry: '準備更改優惠碼有效期',
}

type Args = Record<string, unknown>
type SparkToolCtx = ActionCtx & { emit: (e: SparkEvent) => void }
type SparkTool = { def: MimoToolDef; run: (args: Args, ctx: SparkToolCtx) => Promise<string> }

const dateRe = /^\d{4}-\d{2}-\d{2}$/
const asNum = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
const asRec = (v: unknown): Record<string, unknown> => (typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : {})

function propose(kind: string, description: string, properties: Record<string, unknown>, required: string[]): SparkTool {
  return {
    def: { name: `propose_${kind}`, description, parameters: { type: 'object', properties, required } },
    run: async (args, ctx) => {
      if (!isActionKind(kind)) return '不支援的操作'
      const res = await proposeAction(kind, args, ctx)
      if (!res.ok) return `無法建立操作：${res.error}。請向管理員說明原因，或請他補充資料。`
      ctx.emit({ type: 'block', block: { type: 'action', action: res.action } })
      return `已建立「待確認」操作：${res.action.summary}。管理員會在畫面上的確認卡按「確認」才會執行，現在還未執行任何更改。你只可以說「已準備好，請按確認」，不可說已完成。`
    },
  }
}

const memberCode = { type: 'string', description: '會員編號，例如 SPACE8-ABC123-4（用查詢工具取得，不要憑空猜）' }
const reason = { type: 'string', description: '原因，至少 5 個字，會記入紀錄' }

const SPARK_TOOLS: SparkTool[] = [
  {
    def: {
      name: 'show_income',
      description: '查某段日期的收入並在畫面顯示收入卡片（總額、預約數、平均、退款、每日走勢、付款方式）。問收入、營業額時用這個，不要自己重打數字。日期按遊玩日期，格式 YYYY-MM-DD。',
      parameters: { type: 'object', properties: { from: { type: 'string' }, to: { type: 'string' } }, required: ['from', 'to'] },
    },
    run: async (a, ctx) => {
      const from = typeof a.from === 'string' && dateRe.test(a.from) ? a.from : null
      const to = typeof a.to === 'string' && dateRe.test(a.to) ? a.to : null
      if (!from || !to || from > to) return '日期範圍不正確（格式 YYYY-MM-DD，開始不能晚於結束）'
      const r = await getAdminRevenue({ from, to })
      if (r.error) return `收入資料載入失敗：${r.error}`
      ctx.emit({
        type: 'block',
        block: {
          type: 'income', from, to,
          revenue: r.totals.revenue, bookings: r.totals.bookingCount, average: Math.round(r.totals.averagePerBooking),
          refund: r.totals.refund, net: r.totals.net,
          daily: r.daily.map((d) => ({ date: d.date, revenue: d.revenue })),
          byMethod: r.byMethod.map((m) => ({ label: m.label, revenue: m.revenue, count: m.count })),
        },
      })
      return JSON.stringify({ shownToAdmin: true, from, to, totals: r.totals, byMethod: r.byMethod.map((m) => ({ method: m.label, revenue: m.revenue, count: m.count })), note: '收入卡片已顯示，文字只需補充重點，不要重複全部數字。' })
    },
  },
  {
    def: {
      name: 'show_member_stats',
      description: '查會員總覽並在畫面顯示會員卡片（總數、新增、有預約、回頭客、黑名單、總消費、等級分佈）。問「有幾多會員」「新會員表現」時用這個。',
      parameters: { type: 'object', properties: {} },
    },
    run: async (_a, ctx) => {
      const tool = AGENT_TOOLS.find((t) => t.def.name === 'get_member_stats')
      if (!tool) return '會員統計暫時不可用'
      const s = asRec(await tool.run({}))
      ctx.emit({
        type: 'block',
        block: {
          type: 'member_stats',
          total: asNum(s.total), newLast7Days: asNum(s.newLast7Days), newLast30Days: asNum(s.newLast30Days),
          booked: asNum(s.booked), neverBooked: asNum(s.neverBooked), repeat: asNum(s.repeat), bookedPercent: asNum(s.bookedPercent),
          blacklisted: asNum(s.blacklisted), totalSpend: asNum(s.totalSpend),
          tiers: Object.fromEntries(Object.entries(asRec(s.tiers)).map(([k, v]) => [k, asNum(v)])),
        },
      })
      return JSON.stringify({ shownToAdmin: true, ...s, note: '會員卡片已顯示，文字只需補充重點。' })
    },
  },
  {
    def: {
      name: 'find_member',
      description: '用管理員打出的電郵、電話、姓名或會員編號搵會員，只回傳會員編號（最多 6 個，不含任何個人資料）。管理員給咗電郵／電話／名就用呢個。剛好 1 個就直接用嗰個編號；0 個就話搵唔到；多過 1 個就用 show_member_picker 叫管理員揀。',
      parameters: { type: 'object', properties: { query: { type: 'string', description: '電郵、電話、姓名或編號' } }, required: ['query'] },
    },
    run: async (a) => {
      const q = typeof a.query === 'string' ? a.query.trim().slice(0, 60) : ''
      if (q.length < 2) return '請提供至少 2 個字的搜尋條件'
      const r = await resolveMemberCodes(q)
      return JSON.stringify(r.total === 0 ? { total: 0, note: '搵唔到會員' } : { total: r.total, codes: r.codes })
    },
  },
  {
    def: {
      name: 'show_member_picker',
      description: '喺畫面顯示「搜尋會員」選擇器，讓管理員自己搜尋並揀人（可預先填入搜尋字）。管理員未講明邊位會員、或 find_member 搵到多過 1 個時用。顯示後請簡短叫管理員揀，然後結束回覆；佢揀完會自動發送會員編號俾你。',
      parameters: { type: 'object', properties: { query: { type: 'string' } } },
    },
    run: async (a, ctx) => {
      ctx.emit({ type: 'block', block: { type: 'member_picker', query: typeof a.query === 'string' ? a.query.slice(0, 60) : '' } })
      return '已顯示會員選擇器，等管理員揀。請簡短提示，然後結束回覆，不要再調用工具。'
    },
  },
  {
    def: {
      name: 'show_form',
      description: '喺畫面顯示填寫表格（揀會員、金額、原因），讓管理員自己填好再提交，提交後會出現確認卡。加／扣 credit 或積分而資料不齊全時用。可預先填入已知資料。',
      parameters: { type: 'object', properties: { kind: { type: 'string', enum: ['adjust_credit', 'adjust_points'] }, memberCode: { type: 'string' }, amount: { type: 'integer' }, reason: { type: 'string' } }, required: ['kind'] },
    },
    run: async (a, ctx) => {
      const kind = a.kind === 'adjust_points' ? 'adjust_points' : 'adjust_credit'
      ctx.emit({ type: 'block', block: { type: 'form', kind, memberCode: typeof a.memberCode === 'string' ? a.memberCode.slice(0, 80) : '', amount: typeof a.amount === 'number' && Number.isInteger(a.amount) ? a.amount : null, reason: typeof a.reason === 'string' ? a.reason.slice(0, 200) : '' } })
      return '已顯示填寫表格，等管理員填寫並提交。請簡短提示，然後結束回覆。'
    },
  },
  propose('adjust_credit', `提議加或扣會員的錢包額度（HK$）。加用正數、扣用負數。單次上限 HK$${SPARK_LIMITS.maxCreditPerAction}，每日合計上限 HK$${SPARK_LIMITS.maxCreditPerDay}。不會直接執行，要管理員確認。`, { memberCode, amount: { type: 'integer', description: 'HK$，正數加、負數扣' }, reason }, ['memberCode', 'amount', 'reason']),
  propose('adjust_points', `提議加或扣會員積分。單次上限 ${SPARK_LIMITS.maxPointsPerAction}。不會直接執行，要管理員確認。`, { memberCode, delta: { type: 'integer', description: '正數加、負數扣' }, reason }, ['memberCode', 'delta', 'reason']),
  propose('set_tier', '提議更改會員等級（amateur 業餘／century 百分／maximum 滿分）。不會直接執行，要管理員確認。', { memberCode, tier: { type: 'string', enum: ['amateur', 'century', 'maximum'] }, reason }, ['memberCode', 'tier', 'reason']),
  propose('set_blacklist', '提議將會員加入或移出黑名單。不會直接執行，要管理員確認。', { memberCode, blacklisted: { type: 'boolean' }, reason }, ['memberCode', 'blacklisted', 'reason']),
  propose('send_message', '提議發送站內訊息給一位會員。不會直接執行，要管理員確認。', { memberCode, title: { type: 'string' }, message: { type: 'string' } }, ['memberCode', 'title', 'message']),
  propose('cancel_booking', `提議取消一張已確認的預約，可同時退回錢包 credit（0–${SPARK_LIMITS.maxCancelCredit}，不可多過預約金額）。取消無法還原。必須有取消原因和 WhatsApp／客戶聯絡參考，管理員沒提供就先問，不要自己編。不會直接執行，要管理員確認。`, { bookingCode: { type: 'string', description: '預約編號，例如 S8-xxxx 或 SPACE8-…' }, reason, whatsappRef: { type: 'string', description: 'WhatsApp／客戶聯絡參考，至少 3 個字' }, creditAmount: { type: 'integer', description: '退回錢包的 HK$，0 = 不退款' } }, ['bookingCode', 'reason', 'whatsappRef']),
  propose('set_promo_status', '提議啟用或停用一個優惠碼（優惠碼不會被刪除）。不會直接執行，要管理員確認。', { code: { type: 'string' }, status: { type: 'string', enum: ['active', 'disabled'] } }, ['code', 'status']),
  propose('create_promo', '提議建立新優惠碼。折扣類型 percentage（上限 50%）或 fixed_amount（上限 HK$200）；必須有名稱與結束日期（最長一年）。不會直接執行，要管理員確認。', {
    code: { type: 'string' }, name: { type: 'string' }, discountType: { type: 'string', enum: ['percentage', 'fixed_amount'] }, discountValue: { type: 'integer' },
    validUntil: { type: 'string', description: 'YYYY-MM-DD' }, audience: { type: 'string', enum: ['all', 'new_users'] },
    maxUses: { type: 'integer' }, perUserLimit: { type: 'integer' }, minCartAmount: { type: 'integer' },
  }, ['code', 'name', 'discountType', 'discountValue', 'validUntil']),
  propose('set_promo_expiry', '提議更改優惠碼的有效期限（YYYY-MM-DD，當日香港時間 23:59 止）。不會直接執行，要管理員確認。', { code: { type: 'string' }, validUntil: { type: 'string' } }, ['code', 'validUntil']),
]

const MAX_TOOL_TEXT = 7000
const READ_AS_SPARK: SparkTool[] = READ_TOOLS.map((t) => ({
  def: t.def,
  run: async (args) => {
    const text = JSON.stringify(await t.run(args))
    return text.length > MAX_TOOL_TEXT ? `${text.slice(0, MAX_TOOL_TEXT)}…（結果太長，已截短）` : text
  },
}))
SPARK_TOOLS.push(...READ_AS_SPARK)

const TOOLS_BY_NAME = new Map(SPARK_TOOLS.map((t) => [t.def.name, t]))
const ALL_DEFS: MimoToolDef[] = [...SPARK_TOOLS.map((t) => t.def), ...AGENT_TOOLS.map((t) => t.def)]

function hkNow(): string {
  return new Date().toLocaleString('zh-HK', { timeZone: 'Asia/Hong_Kong', hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'long', hour: '2-digit', minute: '2-digit' })
}

export const SPARK_SYSTEM = [
  '你是 Spark，由 FORM 開發的 AI 助手，服務 Space8 桌球室的店主和管理員。現在時間（香港）：{NOW}。查「今日／本月／上月」等相對日期一律以此為準，年份不可估錯。',
  '被問你是什麼模型或誰做的，只說「我是 Spark，由 FORM 開發」，不要提任何其他公司或模型名稱。',
  '',
  '你有一大批查詢工具覆蓋：全店概覽、收入、預約（單張／搜尋／某日）、付款嘗試與 KPay 通知、會員（總覽／搜尋／完整檔案）、優惠碼（列表／詳情／使用）、取消紀錄、審計紀錄、價目與設定、封枱、問題回報、通知失敗。凡係查得到嘅都要用工具查，絕對不可以話「冇工具」或叫管理員自己去後台睇。',
  '查付款問題的做法：先用 get_payment_problems 睇有冇待處理，再用 get_payment_timeline 睇該張預約由開單到現在發生過什麼，需要時用 check_kpay_order 即時問 KPay 是否已付款。結論要講清楚：客人有冇被收錢、預約而家是什麼狀態、需不需要管理員人手處理（例如退款）。系統不會自動退款，要退款一律叫管理員到 KPay 後台處理。',
  '工作方式（像工程師的 agent 一樣）：先想需要什麼資料，用工具查，看結果，不夠就再查，最後才回答。查得到的不要問管理員。',
  '1. 所有數字、狀態必須來自工具結果；查不到就直說查不到，不要猜。',
  '2. 問收入用 show_income、問會員總覽用 show_member_stats——畫面會顯示卡片，文字只講重點和判斷，不要重複全部數字。',
  '3. 你只能「提議」更改（propose_*），不能直接改任何資料。提議後管理員要在畫面上按「確認」才會執行，所以你只可以說「已準備好，請按確認」，絕對不可說「已完成」「已加」「已取消」。',
  '4. 每次更改前先用查詢工具確認對象（會員編號、預約編號、優惠碼）真的存在；不要憑空猜編號。',
  '5. 取消預約必須有取消原因和聯絡參考；管理員沒給就先問，不要自己編。',
  '6. 資料不足或指示不清（例如沒說金額、沒說對象）就先問一個簡短問題，不要亂提議。',
  '7. 你看不到客人姓名、電話、電郵，只看到會員編號。管理員俾電郵／電話／名時用 find_member 搵編號；搵到剛好 1 個就直接用；搵到多個或管理員冇講邊位就用 show_member_picker；加減 credit 或積分而資料不齊時用 show_form。不要叫管理員自己去查編號。',
  '8. 嚴格遵守上限：單次 credit 最多 HK$' + SPARK_LIMITS.maxCreditPerAction + '，每日合計 HK$' + SPARK_LIMITS.maxCreditPerDay + '，單次積分最多 ' + SPARK_LIMITS.maxPointsPerAction + '。超出就告訴管理員要到後台手動處理。',
  '',
  '回答格式：繁體中文（香港用語），語氣直接簡短。用 Markdown：重點加粗、清單用 -、比較用表格。先講結論，再講原因和下一步。不要用 emoji。不要提及工具名稱或內部運作。',
].join('\n')

function friendlyError(err: unknown): string {
  return `Spark 暫時無法回應：${friendlyAiError(err)}。請稍後再試。`
}

export type SparkRunResult = { text: string | null; error: string | null; model: string | null }

export async function runSpark(input: {
  history: SparkHistoryItem[]
  prompt: string
  ctx: ActionCtx
  emit: (e: SparkEvent) => void
}): Promise<SparkRunResult> {
  const started = Date.now()
  const messages: ChatMessage[] = [
    { role: 'system', content: SPARK_SYSTEM.replace('{NOW}', hkNow()) },
    ...input.history.slice(-14).map((m): ChatMessage => (m.role === 'user' ? { role: 'user', content: m.content } : { role: 'assistant', content: m.content })),
    { role: 'user', content: input.prompt },
  ]
  const toolCtx: SparkToolCtx = { ...input.ctx, emit: input.emit }
  let model: string | null = null
  let n = 0

  try {
    for (let round = 0; round < MAX_ROUNDS; round += 1) {
      const left = BUDGET_MS - (Date.now() - started)
      if (left < 5_000) break
      const out = await mimoComplete({ task: 'investigate', messages, tools: ALL_DEFS, maxTokens: 1800, timeoutMs: Math.min(30_000, left) })
      model = out.model

      if (out.toolCalls.length === 0) {
        if (out.content) return { text: out.content, error: null, model }
        break
      }
      messages.push({ role: 'assistant', content: out.content, toolCalls: out.toolCalls, reasoning: out.reasoning })
      for (const [i, call] of out.toolCalls.entries()) {
        if (i >= MAX_CALLS_PER_ROUND) {
          messages.push({ role: 'tool', toolCallId: call.id, content: '一次最多調用 4 個工具，這個沒有執行，需要的話下一輪再調用。' })
          continue
        }
        n += 1
        const id = `s${n}`
        const label = STEP_LABEL[call.name] ?? call.name
        input.emit({ type: 'step', step: { id, tool: call.name, label, status: 'running' } })
        const t0 = Date.now()
        let ok = true
        let text: string
        const spark = TOOLS_BY_NAME.get(call.name)
        if (spark) {
          try {
            const parsed: unknown = call.arguments.trim() === '' ? {} : JSON.parse(call.arguments)
            text = await spark.run(asRec(parsed), toolCtx)
          } catch (e) {
            ok = false
            text = `工具執行失敗：${e instanceof Error ? e.message : '未知錯誤'}`
          }
        } else {
          const r = await runAgentTool(call.name, call.arguments)
          ok = r.ok
          text = r.text
        }
        if (text.startsWith('無法建立操作') || text.startsWith('日期範圍不正確')) ok = false
        input.emit({ type: 'step', step: { id, tool: call.name, label, status: ok ? 'ok' : 'error', ms: Date.now() - t0, detail: ok ? undefined : text.slice(0, 120) } })
        messages.push({ role: 'tool', toolCallId: call.id, content: text })
      }
    }

    const left = BUDGET_MS - (Date.now() - started)
    if (left > 4_000 && messages.length > 2) {
      messages.push({ role: 'user', content: '請根據目前已查到的資料回答管理員，不要再調用工具。查不到的部分請明確說明。' })
      const out = await mimoComplete({ task: 'investigate', messages, maxTokens: 1200, timeoutMs: Math.min(25_000, left) })
      model = out.model
      if (out.content) return { text: out.content, error: null, model }
    }
    return { text: null, error: 'Spark 未能在限時內完成，請把問題拆細一點再試。', model }
  } catch (err) {
    console.error('[spark] run failed', err)
    return { text: null, error: friendlyError(err), model }
  }
}
