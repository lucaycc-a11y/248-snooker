import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// --- mocks -------------------------------------------------------------------
type BookingRow = {
  id: string
  user_id: string
  table_number: number
  date: string
  start_time: string
  duration_hours: number
  total_price: number
  human_code: string
  status: string
  payment_method: string | null
}

let sessionUser: { id: string } | null = null
let rows: BookingRow[] = []

// Minimal chainable fake of the supabase-js query builder that actually applies
// eq/neq/in filters to an in-memory table, so the test checks behaviour (which
// rows come back) rather than which methods were called.
function query() {
  const preds: Array<(r: BookingRow) => boolean> = []
  const field = (r: BookingRow, col: string): unknown => (r as Record<string, unknown>)[col]
  const q = {
    select: () => q,
    eq: (col: string, val: unknown) => (preds.push((r) => field(r, col) === val), q),
    // PostgREST neq never matches NULL (SQL three-valued logic) — mirror it.
    neq: (col: string, val: unknown) =>
      (preds.push((r) => field(r, col) !== null && field(r, col) !== val), q),
    in: (col: string, vals: readonly unknown[]) =>
      (preds.push((r) => vals.includes(field(r, col))), q),
    order: async () => ({ data: rows.filter((r) => preds.every((p) => p(r))), error: null }),
  }
  return q
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: {
      getUser: async () => ({
        data: { user: sessionUser },
        error: sessionUser ? null : { message: 'no session' },
      }),
    },
    from: () => query(),
  }),
}))

import { GET } from './route'

function booking(overrides: Partial<BookingRow>): BookingRow {
  return {
    id: 'b1',
    user_id: 'user-a',
    table_number: 1,
    date: '2026-10-20',
    start_time: '14:00:00',
    duration_hours: 2,
    total_price: 200,
    human_code: 'ABC123',
    status: 'confirmed',
    payment_method: 'card',
    ...overrides,
  }
}

async function ids(): Promise<string[]> {
  const res = await GET()
  expect(res.status).toBe(200)
  const body = (await res.json()) as { bookings: Array<{ id: string }> }
  return body.bookings.map((b) => b.id).sort()
}

describe('GET /api/member/bookings', () => {
  const originalEnv = process.env.NEXT_PUBLIC_APP_ENV

  beforeEach(() => {
    sessionUser = { id: 'user-a' }
    rows = []
  })
  afterEach(() => {
    process.env.NEXT_PUBLIC_APP_ENV = originalEnv
  })

  it('returns payment_method=test (and NULL) bookings even in production', async () => {
    process.env.NEXT_PUBLIC_APP_ENV = 'production'
    rows = [
      booking({ id: 'test-paid', payment_method: 'test' }),
      booking({ id: 'null-method', payment_method: null }),
      booking({ id: 'card', payment_method: 'card' }),
    ]
    expect(await ids()).toEqual(['card', 'null-method', 'test-paid'])
  })

  it('only returns bookings owned by the authenticated user', async () => {
    rows = [
      booking({ id: 'mine', user_id: 'user-a' }),
      booking({ id: 'theirs', user_id: 'user-b' }),
    ]
    expect(await ids()).toEqual(['mine'])
  })

  it('includes confirmed and completed bookings, excludes cancelled/pending/refunded', async () => {
    rows = [
      booking({ id: 'confirmed', status: 'confirmed' }),
      booking({ id: 'completed', status: 'completed', date: '2026-09-01' }),
      booking({ id: 'pending', status: 'pending' }),
      booking({ id: 'cancelled', status: 'cancelled' }),
      booking({ id: 'admin_cancelled', status: 'admin_cancelled' }),
      booking({ id: 'refunded', status: 'refunded' }),
      booking({ id: 'payment_failed', status: 'payment_failed' }),
    ]
    expect(await ids()).toEqual(['completed', 'confirmed'])
  })

  it('returns 401 when unauthenticated', async () => {
    sessionUser = null
    rows = [booking({ id: 'mine' })]
    const res = await GET()
    expect(res.status).toBe(401)
  })
})
