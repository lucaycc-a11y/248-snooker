import { mimoChat } from '@/lib/ai/mimo'
import type { PilotInsights, PilotMatch, PilotStats } from '@/lib/member/pilot-rpc'

// AI 戰績分析 for the member Space Pilot page: a short written summary plus up to three tips.
// Only anonymous numbers go to the AI provider (no opponent names). If MiMo is not configured,
// is slow, or returns something unusable, a rule-based text is returned with source "rules".

export type CoachInput = {
  stats: PilotStats
  insights: PilotInsights | null
  matches: PilotMatch[]
}

export type CoachResult = {
  summary: string
  tips: string[]
  source: 'mimo' | 'rules'
  generatedAt: string
}

export const MIN_MATCHES_FOR_COACH = 3

function clean(v: unknown, max: number): string {
  return typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : ''
}

/** Plain facts the AI may use. No names. */
export function coachFacts(i: CoachInput): Record<string, unknown> {
  const finished = i.matches.filter((m) => m.finished)
  const recent = finished.slice(0, 10)
  const recentWins = recent.filter((m) => m.won).length
  const closeLosses = recent.filter((m) => !m.won && Math.abs(m.myScore - m.oppScore) <= 1).length
  const monthly = (i.insights?.monthly ?? []).slice(-6).map((m) => ({ 月份: m.month, 場數: m.matches, 勝率: m.winRate }))
  return {
    總場數: i.stats.matches,
    總勝場: i.stats.wins,
    總勝率: i.stats.winRate,
    最長連勝: i.stats.longestStreak,
    最近場數: recent.length,
    最近勝場: recentWins,
    最近一場結果: recent[0] ? (recent[0].won ? '勝' : '負') : null,
    最近落敗而分差不超過一分: closeLosses,
    近月勝率: monthly,
    最佳月份: i.insights?.recap.bestMonth ?? null,
    最常對手紀錄: i.stats.topOpponent ? { 場數: i.stats.topOpponent.matches, 我方勝場: i.stats.topOpponent.myWins } : null,
  }
}

export function rulesCoach(i: CoachInput): Pick<CoachResult, 'summary' | 'tips'> {
  const { stats } = i
  const recent = i.matches.filter((m) => m.finished).slice(0, 5)
  const recentWins = recent.filter((m) => m.won).length
  const tips: string[] = []
  if (stats.winRate >= 60) tips.push('保持目前節奏，可嘗試挑戰實力較強的對手。')
  else tips.push('勝率仍有提升空間，建議多練習穩定的基本功與走位。')
  if (recent.length >= 3 && recentWins <= 1) tips.push('近期連續落敗，不妨休息片刻、放鬆後再比賽。')
  if (stats.longestStreak >= 3) tips.push(`你曾取得 ${stats.longestStreak} 連勝，嘗試回想當時的節奏。`)
  return {
    summary: `累計 ${stats.matches} 場，勝 ${stats.wins} 場，勝率 ${stats.winRate}%；最近 ${recent.length} 場中勝 ${recentWins} 場。`,
    tips: tips.slice(0, 3),
  }
}

const SYSTEM =
  '你是香港自助桌球室 SPACE8 的戰績分析助手。根據提供的統計數字，用繁體中文書面語為球手寫一段戰績總結及最多三項實用建議。' +
  '語氣友善、具體、鼓勵為主。只可使用提供的數字，不可虛構對手姓名、比分或球技細節；數據不足時請坦白說明。' +
  '只輸出 JSON：{"summary":"最多 80 字","tips":["每項最多 40 字，最多 3 項"]}'

export function parseCoachJson(text: string): { summary: string; tips: string[] } | null {
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
  const summary = clean(o.summary, 120)
  if (!summary) return null
  const tips = Array.isArray(o.tips) ? o.tips.map((t) => clean(t, 60)).filter((t) => t !== '').slice(0, 3) : []
  return { summary, tips }
}

export async function buildCoach(input: CoachInput): Promise<CoachResult> {
  const generatedAt = new Date().toISOString()
  try {
    const out = await mimoChat({
      system: SYSTEM,
      user: JSON.stringify(coachFacts(input)),
      task: 'explain',
      maxTokens: 500,
      timeoutMs: 12_000,
    })
    const parsed = parseCoachJson(out.text)
    if (parsed) return { ...parsed, source: 'mimo', generatedAt }
  } catch (err) {
    console.warn('[pilot/coach] MiMo unavailable, using rules:', err instanceof Error ? err.message : 'unknown')
  }
  return { ...rulesCoach(input), source: 'rules', generatedAt }
}
