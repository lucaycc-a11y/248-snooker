// Space Pilot RPC helpers.
//
// The generated Database types do not know the pilot_* functions yet, so calls go
// through a narrow, explicit signature instead of `any`. Every result is validated
// with the guards below before it reaches the UI.

type RpcResult = { data: unknown; error: { message: string } | null }
type LooseRpc = (fn: string, args?: Record<string, unknown>) => PromiseLike<RpcResult>

export function looseRpc(client: { rpc: unknown }): LooseRpc {
  return (client.rpc as LooseRpc).bind(client)
}

export type PilotMatch = {
  id: string
  startedAt: string
  roomName: string
  game: string
  scoring: string
  finished: boolean
  myScore: number
  oppScore: number
  won: boolean
  opponents: string[]
}

export type PilotPhotoRow = {
  id: string
  kind: string
  createdAt: string
  path: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function str(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

function num(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

export function parseMatches(data: unknown): { enabled: boolean; matches: PilotMatch[] } {
  if (!isRecord(data)) return { enabled: false, matches: [] }
  const rows = Array.isArray(data.matches) ? data.matches : []
  const matches: PilotMatch[] = []
  for (const row of rows) {
    if (!isRecord(row) || typeof row.id !== 'string') continue
    matches.push({
      id: row.id,
      startedAt: str(row.started_at),
      roomName: str(row.room_name),
      game: str(row.game),
      scoring: str(row.scoring),
      finished: row.finished === true,
      myScore: num(row.my_score),
      oppScore: num(row.opp_score),
      won: row.won === true,
      opponents: Array.isArray(row.opponents)
        ? row.opponents.filter((name): name is string => typeof name === 'string')
        : [],
    })
  }
  return { enabled: data.enabled === true, matches }
}

export function parsePhotos(data: unknown): { enabled: boolean; photos: PilotPhotoRow[] } {
  if (!isRecord(data)) return { enabled: false, photos: [] }
  const rows = Array.isArray(data.photos) ? data.photos : []
  const photos: PilotPhotoRow[] = []
  for (const row of rows) {
    if (!isRecord(row) || typeof row.id !== 'string' || typeof row.path !== 'string') continue
    photos.push({ id: row.id, kind: str(row.kind), createdAt: str(row.created_at), path: row.path })
  }
  return { enabled: data.enabled === true, photos }
}

export type PilotStats = {
  matches: number
  wins: number
  winRate: number
  longestStreak: number
  topOpponent: { name: string; matches: number; myWins: number } | null
}

export function parseStats(data: unknown): PilotStats | null {
  if (!isRecord(data) || data.enabled !== true) return null
  const opp = data.top_opponent
  return {
    matches: num(data.matches),
    wins: num(data.wins),
    winRate: num(data.win_rate),
    longestStreak: num(data.longest_streak),
    topOpponent:
      isRecord(opp) && typeof opp.name === 'string'
        ? { name: opp.name, matches: num(opp.matches), myWins: num(opp.my_wins) }
        : null,
  }
}

export type PilotRival = {
  name: string
  matches: number
  myWins: number
  theirWins: number
  lastPlayed: string
}

export type PilotMonth = { month: number; matches: number; wins: number; winRate: number }

export type PilotInsights = {
  enabled: boolean
  year: number
  rivals: PilotRival[]
  monthly: PilotMonth[]
  recap: { matches: number; wins: number; bestMonth: number | null; busiestMonth: number | null }
}

function monthOrNull(v: unknown): number | null {
  return typeof v === 'number' && v >= 1 && v <= 12 ? v : null
}

export function parseInsights(data: unknown): PilotInsights | null {
  if (typeof data !== 'object' || data === null) return null
  const d = data as Record<string, unknown>
  if (d.enabled !== true) return null
  const rivals = (Array.isArray(d.rivals) ? d.rivals : []).flatMap((r): PilotRival[] => {
    if (typeof r !== 'object' || r === null) return []
    const o = r as Record<string, unknown>
    if (typeof o.name !== 'string') return []
    return [{ name: o.name, matches: num(o.matches), myWins: num(o.my_wins), theirWins: num(o.their_wins), lastPlayed: typeof o.last_played === 'string' ? o.last_played : '' }]
  })
  const monthly = (Array.isArray(d.monthly) ? d.monthly : []).flatMap((m): PilotMonth[] => {
    if (typeof m !== 'object' || m === null) return []
    const o = m as Record<string, unknown>
    return [{ month: num(o.month), matches: num(o.matches), wins: num(o.wins), winRate: num(o.win_rate) }]
  })
  const rc = typeof d.recap === 'object' && d.recap !== null ? (d.recap as Record<string, unknown>) : {}
  return {
    enabled: true,
    year: num(d.year),
    rivals,
    monthly,
    recap: { matches: num(rc.matches), wins: num(rc.wins), bestMonth: monthOrNull(rc.best_month), busiestMonth: monthOrNull(rc.busiest_month) },
  }
}

// ── Rotations (輪流賽) ───────────────────────────────────────────────────────

export type RotationStyle = 'winnerStays' | 'roundRobin' | 'other'

export type RotationPlayer = {
  side: number
  name: string
  userId: string | null
  isMe: boolean
  score: number
  isWinner: boolean
}

export type RotationMatch = {
  id: string
  seq: number
  startedAt: string
  scoreA: number
  scoreB: number
  players: RotationPlayer[]
}

export type PilotRotation = {
  id: string
  style: RotationStyle
  startedAt: string
  roomName: string
  matches: RotationMatch[]
}

export type RotationRow = {
  key: string
  name: string
  isMe: boolean
  wins: number
  losses: number
  rank: number
  mvp: boolean
}

function parseRotationPlayer(v: unknown): RotationPlayer | null {
  if (!isRecord(v)) return null
  const name = str(v.name).trim()
  return {
    side: num(v.side),
    name: name || '—',
    userId: typeof v.user_id === 'string' ? v.user_id : null,
    isMe: v.is_me === true,
    score: num(v.score),
    isWinner: v.is_winner === true,
  }
}

export function parseRotations(data: unknown): { enabled: boolean; rotations: PilotRotation[] } {
  if (!isRecord(data) || data.enabled !== true) return { enabled: false, rotations: [] }
  const rows = Array.isArray(data.rotations) ? data.rotations : []
  const rotations: PilotRotation[] = []
  for (const row of rows) {
    if (!isRecord(row) || typeof row.id !== 'string') continue
    const matches: RotationMatch[] = []
    for (const m of Array.isArray(row.matches) ? row.matches : []) {
      if (!isRecord(m) || typeof m.id !== 'string') continue
      const players = (Array.isArray(m.players) ? m.players : [])
        .map(parseRotationPlayer)
        .filter((p): p is RotationPlayer => p !== null)
      matches.push({ id: m.id, seq: num(m.seq), startedAt: str(m.started_at), scoreA: num(m.score_a), scoreB: num(m.score_b), players })
    }
    matches.sort((a, b) => a.seq - b.seq || a.startedAt.localeCompare(b.startedAt))
    const style: RotationStyle = row.style === 'winnerStays' || row.style === 'roundRobin' ? row.style : 'other'
    rotations.push({ id: row.id, style, startedAt: str(row.started_at), roomName: str(row.room_name), matches })
  }
  return { enabled: true, rotations }
}

/** Standings: wins / losses per player; equal wins share a rank; rank 1 (including ties) is MVP. */
export function rotationStandings(rotation: PilotRotation): RotationRow[] {
  const map = new Map<string, RotationRow>()
  for (const m of rotation.matches) {
    for (const p of m.players) {
      const key = p.userId ?? `g:${p.name}`
      const row = map.get(key) ?? { key, name: p.name, isMe: false, wins: 0, losses: 0, rank: 0, mvp: false }
      if (p.isMe) row.isMe = true
      if (p.isWinner) row.wins += 1
      else row.losses += 1
      map.set(key, row)
    }
  }
  const rows = [...map.values()].sort((a, b) => b.wins - a.wins || a.losses - b.losses || a.name.localeCompare(b.name))
  let rank = 0
  rows.forEach((r, i) => {
    if (i === 0 || r.wins !== rows[i - 1].wins) rank = i + 1
    r.rank = rank
    r.mvp = rank === 1 && r.wins > 0
  })
  return rows
}

/** Round robin progress: played matches vs n·(n−1)/2 for n players. */
export function roundRobinProgress(rotation: PilotRotation): { played: number; total: number } {
  const players = new Set<string>()
  for (const m of rotation.matches) for (const p of m.players) players.add(p.userId ?? `g:${p.name}`)
  const n = players.size
  return { played: rotation.matches.length, total: (n * (n - 1)) / 2 }
}
