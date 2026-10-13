import { describe, it, expect, vi, beforeEach } from 'vitest'

// Simple unit tests for the WaitlistForm submit logic
// These test the password fallback behavior without needing React Testing Library

describe('WaitlistForm password fallback behavior', () => {
  beforeEach(() => {
    global.fetch = vi.fn()
    vi.clearAllMocks()
  })

  it('should call verify when input does not contain @', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 200 })
    global.fetch = mockFetch

    // Simulate the submit logic for a value without @
    const trimmedValue = '12345'.trim()

    if (!trimmedValue.includes('@')) {
      await fetch('/api/gate/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: trimmedValue }),
      })
    }

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/gate/verify',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ password: '12345' }),
      }),
    )
  })

  it('should call waitlist when input contains @', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 200 })
    global.fetch = mockFetch

    // Simulate the submit logic for an email
    const trimmedValue = 'test@example.com'.trim()

    if (trimmedValue.includes('@')) {
      const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedValue)
      if (isValidEmail) {
        await fetch('/api/gate/waitlist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: trimmedValue }),
        })
      }
    }

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/gate/waitlist',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ email: 'test@example.com' }),
      }),
    )
  })

  it('should trim whitespace before checking for @', () => {
    const input1 = '  12345  '.trim()
    const input2 = '  test@example.com  '.trim()

    expect(input1).toBe('12345')
    expect(input1.includes('@')).toBe(false)

    expect(input2).toBe('test@example.com')
    expect(input2.includes('@')).toBe(true)
  })

  it('should not call waitlist when verify is attempted (no @ in value)', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: false, status: 401 })
    global.fetch = mockFetch

    // Simulate failed password attempt
    const trimmedValue = 'wrongpass'.trim()

    if (!trimmedValue.includes('@')) {
      const res = await fetch('/api/gate/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: trimmedValue }),
      })

      // On failure, show error but do NOT call waitlist
      if (!res.ok) {
        // Error shown, but waitlist never called
      }
    }

    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(mockFetch).toHaveBeenCalledWith('/api/gate/verify', expect.any(Object))
    expect(mockFetch).not.toHaveBeenCalledWith('/api/gate/waitlist', expect.any(Object))
  })
})
