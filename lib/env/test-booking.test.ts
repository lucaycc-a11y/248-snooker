import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { isTestBooking } from './test-booking'

describe('isTestBooking', () => {
  let originalVercelEnv: string | undefined
  let originalNodeEnv: string | undefined

  beforeEach(() => {
    originalVercelEnv = process.env.VERCEL_ENV
    originalNodeEnv = process.env.NODE_ENV
  })

  afterEach(() => {
    // Restore original values
    if (originalVercelEnv === undefined) {
      delete (process.env as any).VERCEL_ENV
    } else {
      process.env.VERCEL_ENV = originalVercelEnv
    }
    if (originalNodeEnv === undefined) {
      delete (process.env as any).NODE_ENV
    } else {
      (process.env as any).NODE_ENV = originalNodeEnv
    }
  })

  describe('Production hostnames (always false, fail-safe)', () => {
    it('production host + VERCEL_ENV undefined -> false', () => {
      delete (process.env as any).VERCEL_ENV
      delete (process.env as any).NODE_ENV
      expect(isTestBooking('space8.com.hk')).toBe(false)
      expect(isTestBooking('www.space8.com.hk')).toBe(false)
    })

    it('production host + VERCEL_ENV=preview -> false (fail-safe)', () => {
      process.env.VERCEL_ENV = 'preview'
      expect(isTestBooking('space8.com.hk')).toBe(false)
      expect(isTestBooking('www.space8.com.hk')).toBe(false)
    })

    it('production host + VERCEL_ENV=development -> false (fail-safe)', () => {
      process.env.VERCEL_ENV = 'development'
      expect(isTestBooking('space8.com.hk')).toBe(false)
      expect(isTestBooking('www.space8.com.hk')).toBe(false)
    })

    it('production host + VERCEL_ENV=production -> false', () => {
      process.env.VERCEL_ENV = 'production'
      expect(isTestBooking('space8.com.hk')).toBe(false)
      expect(isTestBooking('www.space8.com.hk')).toBe(false)
    })

    it('production host + NODE_ENV=development -> false (fail-safe)', () => {
      delete (process.env as any).VERCEL_ENV
      const env = process.env as any
      env.NODE_ENV = 'development'
      expect(isTestBooking('space8.com.hk')).toBe(false)
      expect(isTestBooking('www.space8.com.hk')).toBe(false)
    })
  })

  describe('UAT hostname (always true)', () => {
    it('uat.space8.com.hk -> true', () => {
      delete (process.env as any).VERCEL_ENV
      delete (process.env as any).NODE_ENV
      expect(isTestBooking('uat.space8.com.hk')).toBe(true)
    })

    it('uat.space8.com.hk + VERCEL_ENV=production -> true', () => {
      process.env.VERCEL_ENV = 'production'
      expect(isTestBooking('uat.space8.com.hk')).toBe(true)
    })
  })

  describe('Non-production runtime detection', () => {
    it('localhost + NODE_ENV=development -> true', () => {
      delete (process.env as any).VERCEL_ENV
      const env = process.env as any
      env.NODE_ENV = 'development'
      expect(isTestBooking('localhost')).toBe(true)
      expect(isTestBooking('localhost:3000')).toBe(true)
    })

    it('preview URL + VERCEL_ENV=preview -> true', () => {
      process.env.VERCEL_ENV = 'preview'
      delete (process.env as any).NODE_ENV
      expect(isTestBooking('space8-git-feature-branch.vercel.app')).toBe(true)
    })

    it('preview URL + VERCEL_ENV=development -> true', () => {
      process.env.VERCEL_ENV = 'development'
      delete (process.env as any).NODE_ENV
      expect(isTestBooking('space8-git-dev.vercel.app')).toBe(true)
    })
  })

  describe('Fail-safe: unknown environment defaults to false (production)', () => {
    it('unknown host + no env -> false', () => {
      delete (process.env as any).VERCEL_ENV
      delete (process.env as any).NODE_ENV
      expect(isTestBooking('unknown-domain.com')).toBe(false)
      expect(isTestBooking('evil.example.com')).toBe(false)
    })

    it('localhost + no env -> false (fail-safe)', () => {
      delete (process.env as any).VERCEL_ENV
      delete (process.env as any).NODE_ENV
      expect(isTestBooking('localhost')).toBe(false)
    })

    it('preview URL + VERCEL_ENV=production -> false', () => {
      process.env.VERCEL_ENV = 'production'
      delete (process.env as any).NODE_ENV
      expect(isTestBooking('space8-git-feature.vercel.app')).toBe(false)
    })

    it('null hostname -> false', () => {
      delete (process.env as any).VERCEL_ENV
      delete (process.env as any).NODE_ENV
      expect(isTestBooking(null)).toBe(false)
    })

    it('undefined hostname -> false', () => {
      delete (process.env as any).VERCEL_ENV
      delete (process.env as any).NODE_ENV
      expect(isTestBooking(undefined)).toBe(false)
    })

    it('empty hostname -> false', () => {
      delete (process.env as any).VERCEL_ENV
      delete (process.env as any).NODE_ENV
      expect(isTestBooking('')).toBe(false)
    })
  })

  describe('Critical: VERCEL_ENV !== production is UNSAFE', () => {
    it('production host + VERCEL_ENV undefined would be true if using !== check (UNSAFE)', () => {
      // This test demonstrates why we MUST NOT use: VERCEL_ENV !== 'production'
      // If VERCEL_ENV is undefined (not exposed), undefined !== 'production' is true
      delete (process.env as any).VERCEL_ENV
      const unsafeCheck = process.env.VERCEL_ENV !== 'production' // true when undefined!
      expect(unsafeCheck).toBe(true) // This is why we need the safe approach

      // Our safe implementation returns false
      expect(isTestBooking('space8.com.hk')).toBe(false)
    })
  })
})
