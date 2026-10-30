/**
 * Spark inside the CS centre: READ-ONLY investigation (Vercel logs, database health, payments,
 * bookings, members) and reply drafting. Unlike the Spark chat this has no propose_* tools, so
 * it can never change data. Customer names / emails never reach the model: customers appear as
 * member codes, and drafts carry a {{name}} placeholder that the server fills in.
 */

import { mimoComplete, friendlyAiError, type ChatMessage, type MimoToolDef } from '@/lib/ai/mimo'
import { READ_TOOLS } from '@/lib/spark/readTools'
import { AGENT_TOOLS, runAgentTool } from '@/lib/admin/agentTools'
import { CS_CATEGORIES, CS_CATEGORY_LABEL, isCsCategory, type CsCase, type CsCategory, type CsNote } from './core'
import { redact } from './verdict'

const MAX_ROUNDS = 6
const BUDGET_MS = 50_000
const MAX_TOOL_TEXT = 6000

const READ_BY_NAME = new Map(READ_TOOLS.map((t) => [t.def.name, t]))
const DEFS: MimoToolDef[] = [...READ_TOOLS.map((t) => t.def), ...AGENT_TOOLS.map((t) => t.def)]

function hkNow(): string {
  return new Date().toLocaleString('zh-HK', { timeZone: 'Asia/Hong_Kong', hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'long', hour: '2-digit', minute: '2-digit' })
}

const DIAGNOSE_SYSTEM = [
  '你是 Spark，Space8 桌球室客務中心的 AI 助手，現在時間（香港）：{NOW}。你幫管理員調查客人遇到的問題。',
  '做法：先用工具查（付款時間線、KPay 即時狀態、預約、會員、全託管訂單、Vercel 日誌、資料庫健康快照、網站錯誤），看結果，不夠再查，最後才下結論。所有數字和狀態必須來自工具結果，查不到就直說，不要猜。',
  '你只能查詢，不能改任何資料，也不能退款。需要人手處理（例如退款、補確認預約）就講清楚叫管理員去做乜。',
  '你看不到客人姓名、電話、電郵，只看到會員編號和預約編號。',
  '輸出格式（繁體中文，香港用語，直接簡短，不用 emoji，不提工具名稱）：',
  '**結論**：一句話講原因／狀態。',
  '**證據**：2–5 點，講查到什麼。',
  '**是否網站問題**：是／否／未能確定（一句原因）。',
  '**建議下一步**：管理員要做什麼（按步驟）。',
  '最後另起一行，輸出機器可讀判斷，格式必須完全一致（只可用以下選項）：',
  'VERDICT {"type":"user_error|payment_unconfirmed|payment_failed|website_bug|slot_conflict|account|unknown","website":"yes|no|unknown","action":"payment_link|check_payment|review_booking|reply_only|escalate"}',
  'action 說明：payment_link=客人付唔到款，需要全託管付款連結；check_payment=客人已付款但預約未確認；review_booking=要檢查或改預約；reply_only=只需回覆客人；escalate=需要開發者跟進。',
].join('\n')

const ASK_SYSTEM = [
  '你是 Spark，Space8 桌球室客務中心的 AI 助手，現在時間（香港）：{NOW}。管理員會問你網站、付款、預約或客人問題，也可能要你起草回覆客人的訊息。',
  '先用工具查（付款時間線、KPay 即時狀態、預約、會員、全託管訂單、Vercel 日誌、資料庫健康快照、網站錯誤），看結果，不夠再查，最後才作答。所有數字和狀態必須來自工具結果，查不到就直說，不要猜。',
  '你只能查詢，不能改任何資料，也不能退款。你看不到客人姓名、電話、電郵，只看到會員編號和預約編號。',
  '用繁體中文（香港用語），先講結論，再講證據和建議下一步；直接簡短，不用 emoji，不提工具名稱。如果被要求起草客人回覆，稱呼用 {{name}} 佔位符，結尾署名「Space8 客務團隊」。',
].join('\n')

const REPLY_SYSTEM = [
  '你是 Space8 桌球室的客務人員，幫管理員起草回覆客人嘅訊息。現在時間（香港）：{NOW}。',
  '先用工具核實事實（付款、預約、KPay 狀態等），回覆內容只可包含查到嘅事實，不可承諾工具結果沒有支持的事（例如未確認的退款日期）。',
  '語氣：有禮貌、簡短、直接，用香港書面語加少量口語（「我哋」「你」），不用 emoji。稱呼用 {{name}} 這個佔位符，不要編客人名字。如果需要付款連結，用 {{link}} 佔位符。',
  '只輸出可以直接貼給客人的回覆正文，不要加標題、不要解釋你做了什麼。結尾署名「Space8 客務團隊」。',
].join('\n')

export type CsSparkStep = { tool: string; ok: boolean; ms: number }
export type CsSparkResult = { text: string | null; error: string | null; steps: CsSparkStep[] }

function caseBrief(c: CsCase, notes: CsNote[], memberCode: string | null, extra: string): string {
  const recent = notes
    .filter((n) => n.kind !== 'otp')
    .slice(-8)
    .map((n) => `- [${n.kind}] ${redact(n.body).slice(0, 200)}`)
    .join('\n')
  return [
    `工單類別：${CS_CATEGORY_LABEL[c.category]}`,
    `標題：${redact(c.subject)}`,
    c.detail ? `詳情：${redact(c.detail)}` : null,
    memberCode ? `會員編號：${memberCode}` : null,
    c.booking_code ? `預約編號：${c.booking_code}` : null,
    recent ? `工單紀錄：\n${recent}` : null,
    extra ? `管理員補充：${extra.slice(0, 600)}` : null,
  ]
    .filter(Boolean)
    .join('\n')
}

async function runLoop(system: string, user: string): Promise<CsSparkResult> {
  const started = Date.now()
  const steps: CsSparkStep[] = []
  const messages: ChatMessage[] = [
    { role: 'system', content: system.replace('{NOW}', hkNow()) },
    { role: 'user', content: user },
  ]
  try {
    for (let round = 0; round < MAX_ROUNDS; round += 1) {
      const left = BUDGET_MS - (Date.now() - started)
      if (left < 6_000) break
      const out = await mimoComplete({ task: 'investigate', messages, tools: DEFS, maxTokens: 1600, timeoutMs: Math.min(30_000, left) })
      if (out.toolCalls.length === 0) {
        if (out.content) return { text: out.content, error: null, steps }
        break
      }
      messages.push({ role: 'assistant', content: out.content, toolCalls: out.toolCalls, reasoning: out.reasoning })
      for (const [i, call] of out.toolCalls.entries()) {
        if (i >= 4) {
          messages.push({ role: 'tool', toolCallId: call.id, content: '一次最多調用 4 個工具，這個沒有執行，需要的話下一輪再調用。' })
          continue
        }
        const t0 = Date.now()
        let ok = true
        let text: string
        const read = READ_BY_NAME.get(call.name)
        if (read) {
          try {
            const parsed: unknown = call.arguments.trim() === '' ? {} : JSON.parse(call.arguments)
            const args = typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {}
            const json = JSON.stringify(await read.run(args))
            text = json.length > MAX_TOOL_TEXT ? `${json.slice(0, MAX_TOOL_TEXT)}…（結果太長，已截短）` : json
          } catch (e) {
            ok = false
            text = `工具執行失敗：${e instanceof Error ? e.message : '未知錯誤'}`
          }
        } else {
          const r = await runAgentTool(call.name, call.arguments)
          ok = r.ok
          text = r.text.length > MAX_TOOL_TEXT ? `${r.text.slice(0, MAX_TOOL_TEXT)}…（結果太長，已截短）` : r.text
        }
        steps.push({ tool: call.name, ok, ms: Date.now() - t0 })
        messages.push({ role: 'tool', toolCallId: call.id, content: text })
      }
    }
    const left = BUDGET_MS - (Date.now() - started)
    if (left > 4_000) {
      messages.push({ role: 'user', content: '請根據目前已查到的資料作答，不要再調用工具。查不到的部分請明確說明。' })
      const out = await mimoComplete({ task: 'investigate', messages, maxTokens: 1200, timeoutMs: Math.min(25_000, left) })
      if (out.content) return { text: out.content, error: null, steps }
    }
    return { text: null, error: 'Spark 未能在時限內完成，請稍後再試。', steps }
  } catch (e) {
    return { text: null, error: `Spark 暫時無法回應：${friendlyAiError(e)}`, steps }
  }
}

export function sparkDiagnose(c: CsCase, notes: CsNote[], memberCode: string | null, extra: string): Promise<CsSparkResult> {
  return runLoop(DIAGNOSE_SYSTEM, `請調查這張客務工單：\n${caseBrief(c, notes, memberCode, extra)}`)
}

export function sparkDraftReply(c: CsCase, notes: CsNote[], memberCode: string | null, extra: string): Promise<CsSparkResult> {
  return runLoop(REPLY_SYSTEM, `請為以下工單起草回覆客人的訊息：\n${caseBrief(c, notes, memberCode, extra)}`)
}

export function sparkAsk(prompt: string): Promise<CsSparkResult> {
  return runLoop(ASK_SYSTEM, prompt.slice(0, 800))
}

/* ── Lightweight single-shot helpers (no tools) ─────────────── */

export type CsTriage = { category: CsCategory; subject: string; detail: string; bookingCode: string }

/** Turns the customer's own words into a structured case. Emails / phone numbers are redacted first. */
export async function sparkTriage(raw: string): Promise<{ ok: true; triage: CsTriage } | { ok: false; error: string }> {
  const text = redact(raw).slice(0, 1500)
  try {
    const out = await mimoComplete({
      task: 'triage',
      maxTokens: 500,
      timeoutMs: 25_000,
      messages: [
        {
          role: 'system',
          content:
            '你是 Space8 桌球室客務助手。把客人的訊息整理成工單，只輸出一個 JSON 物件，不要其他文字：' +
            `{"category":"${CS_CATEGORIES.join('|')}","subject":"不超過 30 字的標題","detail":"重點整理（客人遇到什麼、什麼時候、已試過什麼）","bookingCode":"訊息內出現的預約編號，沒有就空字串"}。` +
            'category 說明：payment=付款／退款，booking=預約／改期／取消，account=登入／會員，website=網站報錯或無法使用，other=其他。繁體中文（香港用語）。',
        },
        { role: 'user', content: text },
      ],
    })
    const m = /\{[\s\S]*\}/.exec(out.content ?? '')
    if (!m) return { ok: false, error: 'Spark 未能整理，請手動填寫' }
    const r: unknown = JSON.parse(m[0])
    if (typeof r !== 'object' || r === null) return { ok: false, error: 'Spark 未能整理，請手動填寫' }
    const o = r as Record<string, unknown>
    const str = (v: unknown, n: number) => (typeof v === 'string' ? v.trim().slice(0, n) : '')
    const subject = str(o.subject, 200)
    if (!subject) return { ok: false, error: 'Spark 未能整理，請手動填寫' }
    const code = str(o.bookingCode, 40)
    return { ok: true, triage: { category: isCsCategory(o.category) ? o.category : 'other', subject, detail: str(o.detail, 2000), bookingCode: /^[A-Za-z0-9_-]{4,40}$/.test(code) ? code : '' } }
  } catch (e) {
    return { ok: false, error: `Spark 暫時無法回應：${friendlyAiError(e)}` }
  }
}

/** Drafts the 解決方法 line from the case timeline. */
export async function sparkResolution(c: CsCase, notes: CsNote[]): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  const timeline = notes
    .filter((n) => n.kind !== 'otp')
    .slice(-14)
    .map((n) => `[${n.kind}] ${redact(n.body).slice(0, 300)}`)
    .join('\n')
  try {
    const out = await mimoComplete({
      task: 'explain',
      maxTokens: 300,
      timeoutMs: 25_000,
      messages: [
        { role: 'system', content: '你是 Space8 客務助手。根據工單紀錄，用一至兩句繁體中文（香港用語）寫出「解決方法」：做咗什麼、結果如何。只可寫紀錄內有的事實，不要編造。只輸出那一至兩句。' },
        { role: 'user', content: `類別：${CS_CATEGORY_LABEL[c.category]}\n標題：${redact(c.subject)}\n紀錄：\n${timeline}` },
      ],
    })
    const text = (out.content ?? '').trim().slice(0, 500)
    return text ? { ok: true, text } : { ok: false, error: 'Spark 沒有回應' }
  } catch (e) {
    return { ok: false, error: `Spark 暫時無法回應：${friendlyAiError(e)}` }
  }
}
