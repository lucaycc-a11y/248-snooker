import { describe, it, expect } from 'vitest'
import { validateRedirectUrl } from '../route-guards'

describe('validateRedirectUrl', () => {
  describe('same-origin redirects', () => {
    it('should allow valid relative paths', () => {
      expect(validateRedirectUrl('/member')).toBe('/member')
      expect(validateRedirectUrl('/member/settings')).toBe('/member/settings')
      expect(validateRedirectUrl('/booking/confirm')).toBe('/booking/confirm')
    })

    it('should allow paths with query strings', () => {
      expect(validateRedirectUrl('/member?tab=inbox')).toBe('/member?tab=inbox')
    })

    it('should allow paths with hash fragments', () => {
      expect(validateRedirectUrl('/member#settings')).toBe('/member#settings')
    })

    it('should allow paths with both query and hash', () => {
      expect(validateRedirectUrl('/member?tab=inbox#top')).toBe('/member?tab=inbox#top')
    })
  })

  describe('protocol-relative URLs (security)', () => {
    it('should reject URLs starting with //', () => {
      expect(validateRedirectUrl('//evil.com/phish')).toBe('/')
    })

    it('should reject URLs starting with ///', () => {
      expect(validateRedirectUrl('///evil.com/phish')).toBe('/')
    })
  })

  describe('absolute URLs with protocols', () => {
    it('should reject http: URLs', () => {
      expect(validateRedirectUrl('http://evil.com/phish')).toBe('/')
    })

    it('should reject https: URLs', () => {
      expect(validateRedirectUrl('https://evil.com/phish')).toBe('/')
    })

    it('should reject javascript: URLs', () => {
      expect(validateRedirectUrl('javascript:alert(1)')).toBe('/')
    })

    it('should reject data: URLs', () => {
      expect(validateRedirectUrl('data:text/html,<script>alert(1)</script>')).toBe('/')
    })

    it('should reject file: URLs', () => {
      expect(validateRedirectUrl('file:///etc/passwd')).toBe('/')
    })
  })

  describe('allowed external origins', () => {
    it('should allow URLs from allowedOrigins list', () => {
      const url = 'https://trusted.space8.com.hk/callback'
      const allowed = ['https://trusted.space8.com.hk']
      expect(validateRedirectUrl(url, allowed)).toBe(url)
    })

    it('should reject URLs not in allowedOrigins list', () => {
      const url = 'https://untrusted.com/callback'
      const allowed = ['https://trusted.space8.com.hk']
      expect(validateRedirectUrl(url, allowed)).toBe('/')
    })
  })

  describe('malformed URLs', () => {
    it('should normalize malformed input as relative paths', () => {
      // URL constructor treats these as relative paths, which is safe
      expect(validateRedirectUrl('not a url at all')).toBe('/not%20a%20url%20at%20all')
    })

    it('should return / for empty strings', () => {
      expect(validateRedirectUrl('')).toBe('/')
    })
  })
})
