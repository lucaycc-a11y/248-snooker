// Shared defensive-read helpers for querying tables whose exact schema isn't
// pinned by a migration (bookings/users/points_ledger — see the comment in
// getMember.ts and the admin equivalents). Extracted from getMember.ts so
// admin queries against the same tables don't duplicate this logic.

export type Row = Record<string, unknown>

export function num(row: Row, keys: string[], fallback = 0): number {
  for (const k of keys) {
    const v = row[k]
    if (typeof v === 'number') return v
    if (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v))) return Number(v)
  }
  return fallback
}

export function str(row: Row, keys: string[]): string | null {
  for (const k of keys) {
    const v = row[k]
    if (typeof v === 'string' && v.trim() !== '') return v
  }
  return null
}

// Stable-enough fallback id for rows missing one. Avoids relying on
// crypto.randomUUID being present in every runtime.
let idCounter = 0
export function genId(prefix: string): string {
  idCounter += 1
  return `${prefix}-${Date.now().toString(36)}-${idCounter}`
}
