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

function num(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
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
