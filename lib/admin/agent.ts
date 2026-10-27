import { friendlyAiError, mimoChat, mimoComplete, type ChatMessage, type ToolCall } from '@/lib/ai/mimo'
import { runAgentTool, toolDefs } from '@/lib/admin/agentTools'

// The investigator: a bounded tool-calling loop. The model decides which read-only tool to
// call next, sees the result, and stops when it can answer. Limits keep it cheap and safe:
//   • at most MAX_ROUNDS model calls, MAX_CALLS_PER_ROUND tool calls each;
//   • an overall time budget (the scheduler gives us ~60 seconds);
//   • tools are read-only (see agentTools.ts) — the agent cannot change anything.

const MAX_ROUNDS = 6
const MAX_CALLS_PER_ROUND = 4

export type AgentStep = { tool: string; args: string; ok: boolean; preview: string; ms: number }

export type AgentResult = {
  answer: string | null
  steps: AgentStep[]
  model: string | null
  rounds: number
  error: string | null
}

function hkNowLabel(): string {
  return new Date().toLocaleString('zh-HK', { timeZone: 'Asia/Hong_Kong', hour12: false })
}

export const INVESTIGATOR_SYSTEM = [
  '你是 Space8 桌球室後台的調查助手，對象是店主。現在時間（香港）：',
  '{NOW}。',
  '',
  '你有一組只讀工具，可查預約、付款嘗試、KPay 通知、網站錯誤、收入。你不能修改、取消、退款或聯絡任何人。',
  '做法：',
  '1. 先想要查什麼，再調用工具；需要時連續調用多個。不要在未查證前下結論。',
  '2. 每個結論都要有工具結果支持，並引用預約編號、狀態、時間或錯誤代碼。查不到就明確說「查不到」，不可猜測或編造任何數字。',
  '3. 注意：測試預約和管理員帳戶已預設排除；KPay 上線於 2026-10-24，之前的 Stripe 預約沒有付款嘗試記錄，這是正常的。',
  '4. 如發現「客人已付款但預約未確認」或「重複扣款」，在結論第一句標明【緊急】。',
  '5. 最終回答用繁體中文書面語，不超過 260 字，格式：',
  '   結論：一句話',
  '   原因：根據查到的證據',
  '   建議下一步：誰做什麼（例如到 KPay 後台核實、在後台聯絡客人）。如無須處理就寫「無須處理」。',
  '6. 不要提及你的工具名稱或內部運作。',
].join('\n')

export const MEMBER_ANALYST_SYSTEM = [
  '你是 Space8 桌球室後台的會員分析助手，對象是店主。現在時間（香港）：',
  '{NOW}。',
  '',
  '你只可以用只讀工具查會員數字，不能修改、聯絡或標記任何會員。你看不到會員姓名、電話或電郵，只有會員編號、等級、加入日數、預約次數、消費和積分。',
  '做法：',
  '1. 先用 get_member_stats 看整體，再按需要用 search_members 找具體名單。',
  '2. 所有數字必須來自工具結果；查不到就說「查不到」，不要猜測。樣本很小時（例如少於 10 人）要明確提醒，不要誇大趨勢。',
  '3. 提到個別會員時一律用會員編號原文（例如 SPACE8-PRE-ABCD-E），不要改寫，方便店主在列表中點開。',
  '4. 注意：網站在 2026-10-24 才正式開放，會員和預約資料還很新；已排除隱藏帳戶和測試預約。',
  '5. 最終回答用繁體中文書面語，不超過 260 字，格式：',
  '   結論：一句話',
  '   數據：根據查到的數字',
  '   建議：店主可以做什麼（例如推出新客優惠、跟進未預約的新會員）。如無須處理就寫「無須處理」。',
  '6. 不要提及工具名稱或內部運作。',
].join('\n')

export async function runAgent(input: {
  prompt: string
  /** Defaults to the payment investigator prompt. */
  system?: string
  maxRounds?: number
  budgetMs?: number
}): Promise<AgentResult> {
  const started = Date.now()
  const budget = input.budgetMs ?? 45_000
  const maxRounds = Math.min(MAX_ROUNDS, input.maxRounds ?? MAX_ROUNDS)
  const steps: AgentStep[] = []
  const messages: ChatMessage[] = [
    { role: 'system', content: (input.system ?? INVESTIGATOR_SYSTEM).replace('{NOW}', hkNowLabel()) },
    { role: 'user', content: input.prompt },
  ]
  const tools = toolDefs()
  let model: string | null = null
  let rounds = 0

  try {
    while (rounds < maxRounds) {
      const left = budget - (Date.now() - started)
      if (left < 4_000) break
      rounds += 1
      const out = await mimoComplete({
        task: 'investigate',
        messages,
        tools,
        maxTokens: 1400,
        timeoutMs: Math.min(25_000, left),
      })
      model = out.model

      if (out.toolCalls.length === 0) {
        if (out.content) return { answer: out.content, steps, model, rounds, error: null }
        break
      }

      messages.push({ role: 'assistant', content: out.content, toolCalls: out.toolCalls, reasoning: out.reasoning })
      const calls: ToolCall[] = out.toolCalls
      for (const [i, call] of calls.entries()) {
        if (i >= MAX_CALLS_PER_ROUND) {
          messages.push({ role: 'tool', toolCallId: call.id, content: '一次最多調用 4 個工具，這個沒有執行，需要的話下一輪再調用。' })
          continue
        }
        const t0 = Date.now()
        const res = await runAgentTool(call.name, call.arguments)
        steps.push({ tool: call.name, args: call.arguments.slice(0, 200), ok: res.ok, preview: res.text.slice(0, 280), ms: Date.now() - t0 })
        messages.push({ role: 'tool', toolCallId: call.id, content: res.text })
      }
    }

    // Out of rounds or time: force a conclusion from what was found, without tools.
    const left = budget - (Date.now() - started)
    if (left > 3_000 && messages.length > 2) {
      messages.push({ role: 'user', content: '請根據目前已查到的資料作結論，按指定格式回答，不要再調用工具。查不到的部分請明確說明。' })
      const out = await mimoComplete({ task: 'investigate', messages, maxTokens: 900, timeoutMs: Math.min(20_000, left) })
      model = out.model
      if (out.content) return { answer: out.content, steps, model, rounds, error: null }
    }
    return { answer: null, steps, model, rounds, error: '調查未能在限時內完成' }
  } catch (err) {
    return { answer: null, steps, model, rounds, error: friendlyAiError(err) }
  }
}

// ── Triage: "should I ask the AI to investigate this?" ────────────────────────────────

export type Triage = { investigate: boolean; reason: string; model: string | null; error: string | null }

const TRIAGE_SYSTEM = [
  '你是 Space8 桌球室後台的分流助手。系統剛發現一個事件，你要決定「是否值得啟動 AI 調查」（調查會花費時間和費用）。',
  '需要調查：原因不明、涉及金錢（可能已扣款）、同一客人重複失敗、疑似系統或 KPay 問題、錯誤突然增加。',
  '不需要調查：原因已很明顯且屬客人自己操作（例如客人在 PayMe／銀行 App 取消、逾時未付款而之後已重新付款成功）、已知的測試金額、單一輕微事件而無金錢風險。',
  '只回答一個 JSON，不要其他文字：{"investigate": true 或 false, "reason": "一句繁體中文書面語理由"}',
].join('\n')

function parseTriage(text: string): { investigate: boolean; reason: string } | null {
  const m = /\{[\s\S]*\}/.exec(text)
  if (!m) return null
  try {
    const parsed: unknown = JSON.parse(m[0])
    if (typeof parsed !== 'object' || parsed === null) return null
    const rec = parsed as Record<string, unknown>
    if (typeof rec.investigate !== 'boolean') return null
    return { investigate: rec.investigate, reason: typeof rec.reason === 'string' ? rec.reason.slice(0, 200) : '' }
  } catch {
    return null
  }
}

export async function triageEvent(event: { kind: string; title: string; detail: string; facts: Record<string, unknown> }): Promise<Triage> {
  try {
    const out = await mimoChat({
      task: 'triage',
      system: TRIAGE_SYSTEM,
      user: JSON.stringify(event),
      maxTokens: 300,
      timeoutMs: 15_000,
    })
    const parsed = parseTriage(out.text)
    if (!parsed) return { investigate: false, reason: '', model: out.model, error: '分流回應格式不正確' }
    return { ...parsed, model: out.model, error: null }
  } catch (err) {
    // If the model is unreachable we do NOT investigate; the plain alert email still goes out.
    return { investigate: false, reason: '', model: null, error: friendlyAiError(err) }
  }
}
