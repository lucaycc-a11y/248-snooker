import { describe, it, expect, vi, beforeEach } from 'vitest'

// --- mocks -------------------------------------------------------------------
type SessionUser = {
  id: string
  email?: string
  phone?: string
  phone_confirmed_at?: string | null
  email_confirmed_at?: string | null
}
let sessionUser: SessionUser | null = null
let ledgerRows: Array<{ user_id: string; identifier: string; verified_at: string }> = []
let otherEmailOwner: { id: string } | null = null
const upserts: unknown[] = []

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: sessionUser }, error: null }) },
  }),
}))

const bindVerifiedPhone = vi.fn(async (userId: string, phone: string) => {
  ledgerRows.push({ user_id: userId, identifier: phone, verified_at: '2026-10-07T00:00:00Z' })
  return { ok: true as const }
})
vi.mock('@/lib/auth/phone-binding', () => ({
  bindVerifiedPhone: (userId: string, phone: string) => bindVerifiedPhone(userId, phone),
}))

// Minimal chainable fake of the supabase-js query builder.
function query(table: string) {
  const filters: Record<string, unknown> = {}
  let neqId: unknown = null
  const q = {
    select: () => q,
    eq: (col: string, val: unknown) => ((filters[col] = val), q),
    neq: (_col: string, val: unknown) => ((neqId = val), q),
    ilike: () => q,
    limit: () => q,
    upsert: async (row: unknown) => (upserts.push(row), { error: null }),
    maybeSingle: async () => {
      if (table === 'auth_identities') {
        const row = ledgerRows.find(
          (r) => r.user_id === filters.user_id && r.identifier === filters.identifier,
        )
        return { data: row ? { verified_at: row.verified_at } : null, error: null }
      }
      if (table === 'users' && neqId) return { data: otherEmailOwner, error: null }
      return { data: null, error: null } // existing member_code / code clash
    },
  }
  return q
}
vi.mock('@/lib/supabase/service', () => ({
  getServiceSupabase: () => ({ from: (t: string) => query(t) }),
}))

import { POST } from './route'

const body = {
  name: 'Test User',
  email: 'test@example.com',
  phone: '91234567',
}
const post = (b: unknown = body) =>
  POST(new Request('http://x/api/profile/complete', { method: 'POST', body: JSON.stringify(b) }))

beforeEach(() => {
  sessionUser = null
  ledgerRows = []
  otherEmailOwner = null
  upserts.length = 0
  bindVerifiedPhone.mockClear()
})

describe('POST /api/profile/complete — phone-OTP users without a ledger row', () => {
  it('binds the session phone and succeeds when GoTrue confirmed the same phone', async () => {
    sessionUser = { id: 'u1', phone: '85291234567', phone_confirmed_at: '2026-10-07T00:00:00Z' }
    const res = await post()
    expect(res.status).toBe(200)
    expect(bindVerifiedPhone).toHaveBeenCalledWith('u1', '+85291234567')
    expect(upserts).toHaveLength(1)
  })

  it('422 phone_not_verified when the session phone is not confirmed', async () => {
    sessionUser = { id: 'u1', phone: '85291234567', phone_confirmed_at: null }
    const res = await post()
    expect(res.status).toBe(422)
    expect(await res.json()).toMatchObject({ error: 'phone_not_verified' })
    expect(bindVerifiedPhone).not.toHaveBeenCalled()
  })

  it('422 phone_not_verified when the submitted phone differs from the session phone', async () => {
    sessionUser = { id: 'u1', phone: '85298765432', phone_confirmed_at: '2026-10-07T00:00:00Z' }
    const res = await post()
    expect(res.status).toBe(422)
    expect(await res.json()).toMatchObject({ error: 'phone_not_verified' })
    expect(bindVerifiedPhone).not.toHaveBeenCalled()
  })

  it('422 email_taken when another account already owns the email', async () => {
    sessionUser = { id: 'u1', phone: '85291234567', phone_confirmed_at: '2026-10-07T00:00:00Z' }
    otherEmailOwner = { id: 'u2' }
    const res = await post()
    expect(res.status).toBe(422)
    expect(await res.json()).toMatchObject({ error: 'email_taken', field: 'email' })
    expect(upserts).toHaveLength(0)
  })
})
