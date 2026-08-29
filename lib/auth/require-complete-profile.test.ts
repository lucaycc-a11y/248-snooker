// Item 2: an incomplete profile must actually BLOCK booking, not merely have a
// screen that exists while the API accepts the request anyway.
//
// The guard is tested directly with a stubbed query builder rather than through
// the route handlers, because the routes need Supabase credentials to get past
// createClient(). What matters here is the decision table — and especially that
// a lookup FAILURE blocks rather than allows. rateLimit() in the same routes
// deliberately fails open; if someone copies that pattern into this guard, an
// unreachable users table would silently reopen the booking path to unverified
// accounts. That inversion is the regression this file is here to catch.
import { describe, expect, it, vi } from 'vitest'
import { requireCompleteProfile } from './require-complete-profile'
import type { SupabaseClient } from '@supabase/supabase-js'

type Row = { profile_complete: boolean | null }

// Minimal stand-in for the from().select().eq().maybeSingle() chain the guard
// uses. Returned as SupabaseClient because the guard only touches .from().
function clientReturning(result: {
  data: Row | null
  error: { message: string; code?: string } | null
}): SupabaseClient {
  const maybeSingle = vi.fn().mockResolvedValue(result)
  const eq = vi.fn(() => ({ maybeSingle }))
  const select = vi.fn(() => ({ eq }))
  const from = vi.fn(() => ({ select }))
  return { from } as unknown as SupabaseClient
}

const USER_ID = '00000000-0000-4000-8000-000000000001'

describe('requireCompleteProfile', () => {
  it('allows a user whose profile is complete', async () => {
    const result = await requireCompleteProfile(
      clientReturning({ data: { profile_complete: true }, error: null }),
      USER_ID,
    )
    expect(result).toEqual({ ok: true })
  })

  it.each([
    ['explicitly incomplete', { profile_complete: false } as Row],
    ['null (never completed)', { profile_complete: null } as Row],
    ['missing row entirely', null],
  ])('blocks with 403 profile_incomplete when the profile is %s', async (_label, data) => {
    const result = await requireCompleteProfile(clientReturning({ data, error: null }), USER_ID)
    expect(result).toEqual({ ok: false, status: 403, error: 'profile_incomplete' })
  })

  it('fails CLOSED with 503 when the lookup errors', async () => {
    const result = await requireCompleteProfile(
      clientReturning({ data: null, error: { message: 'connection reset', code: '08006' } }),
      USER_ID,
    )
    expect(result).toEqual({ ok: false, status: 503, error: 'profile_check_unavailable' })
  })

  it('reads profile_complete for the given user from the users table', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: { profile_complete: true }, error: null })
    const eq = vi.fn(() => ({ maybeSingle }))
    const select = vi.fn(() => ({ eq }))
    const from = vi.fn(() => ({ select }))
    await requireCompleteProfile({ from } as unknown as SupabaseClient, USER_ID)
    expect(from).toHaveBeenCalledWith('users')
    expect(select).toHaveBeenCalledWith('profile_complete')
    expect(eq).toHaveBeenCalledWith('id', USER_ID)
  })
})
