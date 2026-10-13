import { describe, it, expect, vi } from 'vitest'
import {
  checkOnboardingGate,
  isOnboardingGatedPath,
  type OnboardingGateDeps,
  type OnboardingRow,
} from './onboarding-gate'

function deps(opts: {
  userId?: string | null
  admin?: boolean
  row?: OnboardingRow | null
  throws?: boolean
}): OnboardingGateDeps & { calls: { getUserId: ReturnType<typeof vi.fn> } } {
  const getUserId = vi.fn(async () => {
    if (opts.throws) throw new Error('boom')
    return opts.userId === undefined ? 'u1' : opts.userId
  })
  return {
    getUserId,
    isActiveAdmin: async () => opts.admin ?? false,
    getOnboarding: async () => (opts.row === undefined ? null : opts.row),
    calls: { getUserId },
  }
}

const INCOMPLETE: OnboardingRow = { onboarding_status: 'pending_second_identity', profile_complete: false }
const COMPLETE: OnboardingRow = { onboarding_status: 'complete', profile_complete: true }

describe('checkOnboardingGate', () => {
  it('lets a complete user through', async () => {
    expect(await checkOnboardingGate('/member', '', deps({ row: COMPLETE }))).toBeNull()
  })

  it('lets a legacy profile_complete user through', async () => {
    const row = { onboarding_status: null, profile_complete: true }
    expect(await checkOnboardingGate('/book', '', deps({ row }))).toBeNull()
  })

  it('redirects an incomplete user to /login with the original path', async () => {
    expect(await checkOnboardingGate('/member', '', deps({ row: INCOMPLETE }))).toBe(
      '/login?returnUrl=%2Fmember',
    )
    expect(await checkOnboardingGate('/zh-HK/book', '?date=2026-10-09', deps({ row: INCOMPLETE }))).toBe(
      '/login?returnUrl=%2Fzh-HK%2Fbook%3Fdate%3D2026-10-09',
    )
  })

  it('redirects a user with no public.users row yet', async () => {
    expect(await checkOnboardingGate('/member/wallet', '', deps({ row: null }))).toBe(
      '/login?returnUrl=%2Fmember%2Fwallet',
    )
  })

  it('lets an active admin through even with an incomplete profile', async () => {
    expect(await checkOnboardingGate('/book', '', deps({ admin: true, row: INCOMPLETE }))).toBeNull()
  })

  it('lets signed-out visitors through (pages run their own login step)', async () => {
    expect(await checkOnboardingGate('/book', '', deps({ userId: null }))).toBeNull()
  })

  it('fails open on lookup errors', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(await checkOnboardingGate('/member', '', deps({ throws: true }))).toBeNull()
    expect(spy).toHaveBeenCalledOnce()
    spy.mockRestore()
  })

  it.each(['/login', '/auth/callback', '/api/checkout/create', '/api/member/x', '/admin', '/admin/bookings', '/membership', '/zh-HK/membership', '/', '/book.png', '/member/logo.svg'])(
    'never gates %s (and never even reads the session)',
    async (path) => {
      const d = deps({ row: INCOMPLETE })
      expect(await checkOnboardingGate(path, '', d)).toBeNull()
      expect(d.calls.getUserId).not.toHaveBeenCalled()
    },
  )

  it('redirect target is itself never gated (no loop)', () => {
    expect(isOnboardingGatedPath('/login')).toBe(false)
  })
})

describe('isOnboardingGatedPath', () => {
  it.each(['/member', '/member/manage', '/book', '/book/checkout', '/zh-HK/book', '/en/book/confirm'])(
    'gates %s',
    (p) => expect(isOnboardingGatedPath(p)).toBe(true),
  )
})
