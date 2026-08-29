import { describe, expect, it } from 'vitest'
import { canFinalize, canVerifyEmail, canVerifyPhone, isExpired, type SignupStatus } from './signup-state'

const now = new Date('2026-08-29T12:00:00.000Z')
const future = '2026-08-29T12:10:00.000Z'
const past = '2026-08-29T11:50:00.000Z'

const verified = {
  status: 'phone_verified' as SignupStatus,
  email_verified_at: '2026-08-29T11:55:00.000Z',
  phone_verified_at: '2026-08-29T11:58:00.000Z',
  expires_at: future,
}

describe('canVerifyEmail', () => {
  it('allows the email code only while pending', () => {
    expect(canVerifyEmail('pending')).toBe(true)
  })

  it.each<SignupStatus>(['email_verified', 'phone_verified', 'completed', 'expired'])(
    'rejects the email code in status %s',
    (status) => {
      expect(canVerifyEmail(status)).toBe(false)
    },
  )
})

describe('canVerifyPhone', () => {
  it('allows the SMS code only after the email is verified', () => {
    expect(canVerifyPhone('email_verified')).toBe(true)
  })

  it('rejects the SMS code while still pending, so the email step cannot be skipped', () => {
    expect(canVerifyPhone('pending')).toBe(false)
  })

  it.each<SignupStatus>(['phone_verified', 'completed', 'expired'])('rejects the SMS code in status %s', (status) => {
    expect(canVerifyPhone(status)).toBe(false)
  })
})

describe('canFinalize', () => {
  it('allows account creation once both contacts are verified', () => {
    expect(canFinalize(verified, now)).toBe(true)
  })

  it('refuses when the email timestamp is missing', () => {
    expect(canFinalize({ ...verified, email_verified_at: null }, now)).toBe(false)
  })

  it('refuses when the phone timestamp is missing', () => {
    expect(canFinalize({ ...verified, phone_verified_at: null }, now)).toBe(false)
  })

  it('refuses an expired attempt even with both timestamps', () => {
    expect(canFinalize({ ...verified, expires_at: past }, now)).toBe(false)
  })

  it('refuses to finalize an already completed attempt', () => {
    expect(canFinalize({ ...verified, status: 'completed' }, now)).toBe(false)
  })

  it.each<SignupStatus>(['pending', 'email_verified', 'expired'])('refuses finalization in status %s', (status) => {
    expect(canFinalize({ ...verified, status }, now)).toBe(false)
  })
})

describe('isExpired', () => {
  it('treats the exact expiry instant as expired', () => {
    expect(isExpired('2026-08-29T12:00:00.000Z', now)).toBe(true)
  })

  it('treats a future expiry as live', () => {
    expect(isExpired(future, now)).toBe(false)
  })

  it('treats an unparseable expiry as expired', () => {
    expect(isExpired('not-a-date', now)).toBe(true)
  })
})
