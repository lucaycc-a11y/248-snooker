// MiMo watches a saved highlight (video understanding) and says whether a ball was potted.
// Accuracy on our own tables is unknown: the verdict is stored and shown, nothing is deleted automatically.
// Docs: MP4/MOV/AVI/WMV only (WebM is not listed), Base64 up to 50MB, fps 0.1–10, media_resolution default|max.

export type ClipVerdict = { potted: boolean | null; description: string; model: string }

const PROMPT =
  '呢段係桌球（中式八球／九球）枱面嘅短片。請只用片入面睇到嘅嘢回答，唔好估。' +
  '只輸出 JSON：{"potted":true|false,"balls":"入袋嘅球（例如 黑八、5 號；睇唔清就寫 不明）","description":"一句廣東話描述，最多 40 字"}。' +
  '「potted」只係喺你清楚睇到有球入袋先寫 true；清楚冇球入袋寫 false。'

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

export function parseVerdict(text: string, model: string): ClipVerdict | null {
  const a = text.indexOf('{')
  const b = text.lastIndexOf('}')
  if (a < 0 || b <= a) return null
  let raw: unknown
  try {
    raw = JSON.parse(text.slice(a, b + 1))
  } catch {
    return null
  }
  if (!isRecord(raw)) return null
  const potted = typeof raw.potted === 'boolean' ? raw.potted : null
  const balls = typeof raw.balls === 'string' ? raw.balls.trim() : ''
  const desc = typeof raw.description === 'string' ? raw.description.trim() : ''
  const description = [balls && balls !== '不明' ? balls : '', desc].filter((s) => s !== '').join('：').slice(0, 200)
  return { potted, description, model }
}

/** mime must be a type MiMo accepts; returns null (skip) for WebM. */
export function videoMimeFor(path: string, blobType: string): string | null {
  if (/\.mp4$/i.test(path) || blobType === 'video/mp4') return 'video/mp4'
  if (/\.mov$/i.test(path) || blobType === 'video/quicktime') return 'video/quicktime'
  return null
}

export async function verifyClipVideo(bytes: ArrayBuffer, mime: string): Promise<ClipVerdict | null> {
  const apiKey = process.env.MIMO_API_KEY
  if (!apiKey) return null
  const baseUrl = (process.env.MIMO_BASE_URL ?? 'https://api.xiaomimimo.com/v1').replace(/\/+$/, '')
  const model = process.env.MIMO_MODEL_VIDEO?.trim() || 'mimo-v2.6-flash'
  const b64 = Buffer.from(bytes).toString('base64')
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 40_000)
  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'api-key': apiKey, Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        max_completion_tokens: 400,
        temperature: 0.1,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'video_url', video_url: { url: `data:${mime};base64,${b64}` }, fps: 4, media_resolution: 'max' },
              { type: 'text', text: PROMPT },
            ],
          },
        ],
      }),
      signal: controller.signal,
    })
    if (!res.ok) {
      console.warn('[pilot/ai-video] MiMo HTTP', res.status)
      return null
    }
    const body: unknown = await res.json()
    if (!isRecord(body) || !Array.isArray(body.choices)) return null
    const first: unknown = body.choices[0]
    const content = isRecord(first) && isRecord(first.message) ? first.message.content : null
    return typeof content === 'string' ? parseVerdict(content, model) : null
  } catch (err) {
    console.warn('[pilot/ai-video] failed', err instanceof Error ? err.message : 'unknown')
    return null
  } finally {
    clearTimeout(timer)
  }
}
