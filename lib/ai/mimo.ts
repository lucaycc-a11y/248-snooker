// Xiaomi MiMo client (OpenAI-compatible chat completions, with tool calling).
// Docs: https://mimo.mi.com/static/docs/quick-start/summary/first-api-call.md
//   POST {base}/chat/completions, header `api-key`, body uses `max_completion_tokens`.
//   In thinking mode a tool-calling reply carries `reasoning_content`, which must be sent back
//   unchanged on the next request.
//
// Different jobs use different models:
//   triage      — "does this alert need an investigation?"   fast model
//   explain     — put computed figures into words             fast model
//   investigate — multi-step tool use over the database        stronger model
// Override per job with MIMO_MODEL_TRIAGE / MIMO_MODEL_EXPLAIN / MIMO_MODEL_INVESTIGATE,
// or all at once with MIMO_MODEL.

export class MimoConfigError extends Error {
  constructor() {
    super('MiMo 未設定（缺少 MIMO_API_KEY）')
    this.name = 'MimoConfigError'
  }
}

export type MimoTask = 'triage' | 'explain' | 'investigate'

/** The model the MiMo docs name; used when a configured model is rejected (400/404). */
export const MIMO_FALLBACK_MODEL = 'mimo-v2.6-pro'

export class MimoHttpError extends Error {
  readonly status: number
  readonly detail: string
  constructor(status: number, detail: string) {
    super(`MiMo 回應錯誤 ${status}${detail ? `：${detail}` : ''}`)
    this.name = 'MimoHttpError'
    this.status = status
    this.detail = detail
  }
}

// Only mimo-v2.6-pro is named in MiMo's docs, so it is the default everywhere. Set
// MIMO_MODEL_TRIAGE / MIMO_MODEL_EXPLAIN to a cheaper model your account has; a rejected model
// falls back to the pro model automatically (see mimoComplete).
const DEFAULT_MODELS: Record<MimoTask, string> = {
  triage: 'mimo-v2.6-pro',
  explain: 'mimo-v2.6-pro',
  investigate: 'mimo-v2.6-pro',
}

export function mimoModelFor(task: MimoTask): string {
  const perTask = {
    triage: process.env.MIMO_MODEL_TRIAGE,
    explain: process.env.MIMO_MODEL_EXPLAIN,
    investigate: process.env.MIMO_MODEL_INVESTIGATE,
  }[task]
  return perTask?.trim() || process.env.MIMO_MODEL?.trim() || DEFAULT_MODELS[task]
}

export type ToolCall = { id: string; name: string; arguments: string }

export type ChatMessage =
  | { role: 'system' | 'user'; content: string }
  | { role: 'assistant'; content: string | null; toolCalls?: ToolCall[]; reasoning?: string | null }
  | { role: 'tool'; toolCallId: string; content: string }

export type MimoToolDef = { name: string; description: string; parameters: Record<string, unknown> }

export type MimoCompletion = {
  content: string | null
  toolCalls: ToolCall[]
  reasoning: string | null
  model: string
  finishReason: string | null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function toWire(m: ChatMessage): Record<string, unknown> {
  if (m.role === 'tool') return { role: 'tool', tool_call_id: m.toolCallId, content: m.content }
  if (m.role === 'assistant') {
    return {
      role: 'assistant',
      content: m.content ?? '',
      ...(m.toolCalls && m.toolCalls.length > 0
        ? { tool_calls: m.toolCalls.map((c) => ({ id: c.id, type: 'function', function: { name: c.name, arguments: c.arguments } })) }
        : {}),
      ...(m.reasoning ? { reasoning_content: m.reasoning } : {}),
    }
  }
  return { role: m.role, content: m.content }
}

function parseCompletion(body: unknown, model: string): MimoCompletion | null {
  if (!isRecord(body) || !Array.isArray(body.choices) || body.choices.length === 0) return null
  const first: unknown = body.choices[0]
  if (!isRecord(first) || !isRecord(first.message)) return null
  const message = first.message
  const toolCalls: ToolCall[] = []
  if (Array.isArray(message.tool_calls)) {
    for (const raw of message.tool_calls as unknown[]) {
      if (!isRecord(raw) || !isRecord(raw.function)) continue
      const name = raw.function.name
      const args = raw.function.arguments
      if (typeof raw.id === 'string' && typeof name === 'string') {
        toolCalls.push({ id: raw.id, name, arguments: typeof args === 'string' ? args : JSON.stringify(args ?? {}) })
      }
    }
  }
  const content = typeof message.content === 'string' && message.content.trim() !== '' ? message.content.trim() : null
  return {
    content,
    toolCalls,
    reasoning: typeof message.reasoning_content === 'string' && message.reasoning_content !== '' ? message.reasoning_content : null,
    model,
    finishReason: typeof first.finish_reason === 'string' ? first.finish_reason : null,
  }
}

export async function mimoComplete(input: {
  task: MimoTask
  messages: ChatMessage[]
  tools?: MimoToolDef[]
  maxTokens?: number
  timeoutMs?: number
  /** Overrides the per-task model (used by the Spark chat). */
  model?: string
}): Promise<MimoCompletion> {
  const apiKey = process.env.MIMO_API_KEY
  if (!apiKey) throw new MimoConfigError()
  const baseUrl = (process.env.MIMO_BASE_URL ?? 'https://api.xiaomimimo.com/v1').replace(/\/+$/, '')
  const started = Date.now()
  const totalMs = input.timeoutMs ?? 45_000

  const attempt = async (model: string): Promise<MimoCompletion> => {
    const controller = new AbortController()
    const left = Math.max(3_000, totalMs - (Date.now() - started))
    const timer = setTimeout(() => controller.abort(), left)
    try {
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'api-key': apiKey, Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          messages: input.messages.map(toWire),
          ...(input.tools && input.tools.length > 0
            ? {
                tools: input.tools.map((t) => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.parameters } })),
                tool_choice: 'auto',
              }
            : {}),
          max_completion_tokens: input.maxTokens ?? 900,
          temperature: 0.3,
          top_p: 0.95,
          stream: false,
        }),
        signal: controller.signal,
      })
      if (!res.ok) {
        // Keep the provider's own explanation (e.g. "model not found") so a 400 can be diagnosed.
        const raw = await res.text().catch(() => '')
        let detail = raw
        try {
          const parsed: unknown = JSON.parse(raw)
          if (isRecord(parsed)) {
            const err = parsed.error
            if (isRecord(err) && typeof err.message === 'string') detail = err.message
            else if (typeof parsed.message === 'string') detail = parsed.message
          }
        } catch {
          /* keep raw text */
        }
        throw new MimoHttpError(res.status, detail.replace(/\s+/g, ' ').slice(0, 200))
      }
      const parsed = parseCompletion(await res.json(), model)
      if (!parsed) throw new Error('MiMo 回應格式不正確')
      return parsed
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') throw new Error('MiMo 逾時')
      throw err
    } finally {
      clearTimeout(timer)
    }
  }

  const model = input.model ?? mimoModelFor(input.task)
  try {
    return await attempt(model)
  } catch (err) {
    // A configured model the account does not have comes back as 400/404. Retry once on the
    // documented model instead of failing the whole feature.
    if (err instanceof MimoHttpError && (err.status === 400 || err.status === 404) && model !== MIMO_FALLBACK_MODEL) {
      console.warn(`[mimo] ${model} rejected (${err.status}: ${err.detail}); retrying with ${MIMO_FALLBACK_MODEL}`)
      return await attempt(MIMO_FALLBACK_MODEL)
    }
    throw err
  }
}

export type MimoResult = { text: string; model: string }

/** Single question, single answer, no tools. */
export async function mimoChat(input: {
  system: string
  user: string
  task?: MimoTask
  maxTokens?: number
  timeoutMs?: number
}): Promise<MimoResult> {
  const out = await mimoComplete({
    task: input.task ?? 'explain',
    messages: [
      { role: 'system', content: input.system },
      { role: 'user', content: input.user },
    ],
    maxTokens: input.maxTokens,
    timeoutMs: input.timeoutMs,
  })
  if (!out.content) throw new Error('MiMo 沒有返回內容')
  return { text: out.content, model: out.model }
}

/** Text safe to show an admin: no provider name, no raw API error. The raw error stays in server logs. */
export function friendlyAiError(err: unknown): string {
  if (err instanceof MimoConfigError) return 'AI 服務尚未設定金鑰'
  if (err instanceof MimoHttpError) {
    if (err.status === 401 || err.status === 403) return 'AI 服務金鑰無效或沒有權限'
    if (err.status === 429) return 'AI 服務太繁忙，請稍後再試'
    return `AI 服務暫時出錯（${err.status}）`
  }
  if (err instanceof Error && err.message.includes('逾時')) return 'AI 回應逾時'
  return 'AI 服務暫時無法使用'
}
