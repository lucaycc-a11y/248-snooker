import { mimoChat } from '@/lib/ai/mimo'

// AI caption for a Space Pilot highlight. MiMo is the main model; if it is not configured, times out or
// returns something unusable, a plain rule-based caption is returned with source "rules" so the caller
// (e.g. the iPad, which can use Apple Intelligence on-device) knows it may write a better one itself.

export type HighlightInput = {
  kind: string
  label: string
  scoreA: number
  scoreB: number
  players: string[]
  game: string
}

export type HighlightText = {
  title: string
  caption: string
  tags: string[]
  source: 'mimo' | 'rules'
}

const KIND_TITLE: Record<string, string> = {
  streak: '連續得分',
  key_ball: '逆轉時刻',
  finish: '完場',
  score: '得分',
  manual: 'Replay',
}

export function rulesText(i: HighlightInput): HighlightText {
  const title = KIND_TITLE[i.kind] ?? 'Replay'
  const names = i.players.slice(0, 2).join(' vs ')
  const caption = `${names ? names + '，' : ''}比分 ${i.scoreA}:${i.scoreB}${i.label ? '（' + i.label + '）' : ''}`
  return { title, caption: caption.slice(0, 60), tags: [i.kind], source: 'rules' }
}

const SYSTEM =
  '你係香港自助桌球場 SPACE8 嘅精華剪輯助手。根據比賽資料寫繁體中文（廣東話口語）嘅短標題同一句說明。' +
  '只用提供嘅資料，唔好作人名、比分或球技細節。只輸出 JSON：{"title":"最多 12 字","caption":"最多 40 字","tags":["最多 3 個短標籤"]}'

function clean(v: unknown, max: number): string {
  return typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : ''
}

export function parseHighlightJson(text: string): Omit<HighlightText, 'source'> | null {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  let raw: unknown
  try {
    raw = JSON.parse(text.slice(start, end + 1))
  } catch {
    return null
  }
  if (typeof raw !== 'object' || raw === null) return null
  const o = raw as Record<string, unknown>
  const title = clean(o.title, 12)
  const caption = clean(o.caption, 60)
  if (!title || !caption) return null
  const tags = Array.isArray(o.tags) ? o.tags.map((t) => clean(t, 12)).filter((t) => t !== '').slice(0, 3) : []
  return { title, caption, tags }
}

export async function analyzeHighlight(input: HighlightInput): Promise<HighlightText> {
  try {
    const out = await mimoChat({
      system: SYSTEM,
      user: JSON.stringify({
        遊戲: input.game,
        事件: KIND_TITLE[input.kind] ?? input.kind,
        提示: input.label,
        比分: `${input.scoreA}:${input.scoreB}`,
        球員: input.players.slice(0, 4),
      }),
      task: 'explain',
      maxTokens: 300,
      timeoutMs: 6_000,
    })
    const parsed = parseHighlightJson(out.text)
    return parsed ? { ...parsed, source: 'mimo' } : rulesText(input)
  } catch (err) {
    console.warn('[pilot/ai] MiMo unavailable, using rules:', err instanceof Error ? err.message : 'unknown')
    return rulesText(input)
  }
}
