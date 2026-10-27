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

const DEFAULT_MODELS: Record<MimoTask, string> = {
  triage: 'mimo-v2.6',
  explain: 'mimo-v2.6',
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
}): Promise<MimoCompletion> {
  const apiKey = process.env.MIMO_API_KEY
  if (!apiKey) throw new MimoConfigError()
  const baseUrl = (process.env.MIMO_BASE_URL ?? 'https://api.xiaomimimo.com/v1').replace(/\/+$/, '')
  const model = mimoModelFor(input.task)

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), input.timeoutMs ?? 45_000)
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
    if (!res.ok) throw new Error(`MiMo 回應錯誤 ${res.status}`)
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
