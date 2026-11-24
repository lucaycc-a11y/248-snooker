import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { looseRpc, parseInsights, parseMatches, parseStats } from '@/lib/member/pilot-rpc'
import { buildCoach, MIN_MATCHES_FOR_COACH, type CoachResult } from '@/lib/pilot/coach'

export const dynamic = 'force-dynamic'
export const maxDuration = 20

// GET /api/member/pilot/coach — AI 戰績分析 for the signed-in member (admin-only beta, like the rest of Space Pilot).
// Best-effort per-instance cache so a refresh button cannot burn AI quota.
const CACHE_MS = 10 * 60_000
const cache = new Map<string, { at: number; sig: string; result: CoachResult }>()

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rpc = looseRpc(supabase)
  const [statsRes, insightsRes, matchesRes] = await Promise.all([
    rpc('pilot_my_stats'),
    rpc('pilot_my_insights'),
    rpc('pilot_my_matches', { p_limit: 30 }),
  ])
  if (statsRes.error || matchesRes.error) {
    console.error('[member/pilot/coach] rpc failed', statsRes.error?.message, matchesRes.error?.message)
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }
  const stats = parseStats(statsRes.data)
  if (!stats) return NextResponse.json({ enabled: false })
  if (stats.matches < MIN_MATCHES_FOR_COACH) {
    return NextResponse.json({ enabled: true, ready: false, needed: MIN_MATCHES_FOR_COACH })
  }

  const insights = insightsRes.error ? null : parseInsights(insightsRes.data)
  const { matches } = parseMatches(matchesRes.data)
  const sig = `${stats.matches}:${stats.wins}`
  const hit = cache.get(user.id)
  if (hit && hit.sig === sig && Date.now() - hit.at < CACHE_MS) {
    return NextResponse.json({ enabled: true, ready: true, ...hit.result })
  }
  const result = await buildCoach({ stats, insights, matches })
  cache.set(user.id, { at: Date.now(), sig, result })
  return NextResponse.json({ enabled: true, ready: true, ...result })
}
