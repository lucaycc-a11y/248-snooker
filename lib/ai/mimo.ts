// Xiaomi MiMo client (OpenAI-compatible chat completions).
// Docs: https://mimo.mi.com/static/docs/quick-start/summary/first-api-call.md
//   POST {base}/chat/completions, header `api-key`, body uses `max_completion_tokens`.
// Used only to EXPLAIN figures that code has already computed — never to compute them.

export class MimoConfigError extends Error {
  constructor() {
    super('MiMo 未設定（缺少 MIMO_API_KEY）')
    this.name = 'MimoConfigError'
  }
}

export type MimoResult = { text: string; model: string }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function extractText(body: unknown): string | null {
  if (!isRecord(body)) return null
  const choices = body.choices
  if (!Array.isArray(choices) || choices.length === 0) return null
  const first: unknown = choices[0]
  if (!isRecord(first) || !isRecord(first.message)) return null
  const content = first.message.content
  return typeof content === 'string' && content.trim() !== '' ? content.trim() : null
}

export async function mimoChat(input: {
  system: string
  user: string
  maxTokens?: number
  timeoutMs?: number
}): Promise<MimoResult> {
  const apiKey = process.env.MIMO_API_KEY
  if (!apiKey) throw new MimoConfigError()
  const baseUrl = (process.env.MIMO_BASE_URL ?? 'https://api.xiaomimimo.com/v1').replace(/\/+$/, '')
  const model = process.env.MIMO_MODEL ?? 'mimo-v2.6-pro'

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), input.timeoutMs ?? 45_000)
  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': apiKey,
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: input.system },
          { role: 'user', content: input.user },
        ],
        max_completion_tokens: input.maxTokens ?? 900,
        temperature: 0.3,
        top_p: 0.95,
        stream: false,
      }),
      signal: controller.signal,
    })
    if (!res.ok) {
      throw new Error(`MiMo 回應錯誤 ${res.status}`)
    }
    const text = extractText(await res.json())
    if (!text) throw new Error('MiMo 沒有返回內容')
    return { text, model }
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') throw new Error('MiMo 逾時')
    throw err
  } finally {
    clearTimeout(timer)
  }
}
