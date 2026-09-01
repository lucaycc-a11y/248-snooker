// Item 14: the backend must reject weak passwords on its own, not merely rely on
// the client-side strength meter.
//
// These tests import the real route handler and call it directly. No Supabase
// credentials are needed, because validatePassword() runs before rateLimit() and
// getServiceSupabase() — a weak password short-circuits at 422 without any I/O.
// That ordering is the property under test: if someone moves the password check
// below the service-client call, these tests start failing with a thrown
// "Service Supabase client requires ..." error instead of a 422, which is exactly
// the regression worth catching.
import { describe, expect, it } from 'vitest'
import { POST } from './route'

const VALID = { name: 'Test User', email: 'weak-password-probe@example.com', phone: '91234567' }

function post(body: unknown): Request {
  return new Request('http://localhost:3000/api/auth/signup', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.10' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/auth/signup password enforcement', () => {
  it.each([
    ['too short', 'Ab1cdef'],
    ['no uppercase', 'snooker248'],
    ['no lowercase', 'SNOOKER248'],
    ['no digit', 'SnookerClub'],
    ['empty', ''],
    ['beyond the bcrypt limit', `A1${'a'.repeat(72)}`],
  ])('rejects a password that is %s', async (_label, password) => {
    const response = await POST(post({ ...VALID, password }))
    expect(response.status).toBe(422)
    const json = (await response.json()) as { error?: string; reasons?: string[] }
    expect(json.error).toBe('weak_password')
    expect(Array.isArray(json.reasons) && json.reasons.length).toBeGreaterThan(0)
  })

  it('rejects a non-string password rather than coercing it', async () => {
    const response = await POST(post({ ...VALID, password: 12345678 }))
    expect(response.status).toBe(422)
    expect(((await response.json()) as { error?: string }).error).toBe('weak_password')
  })

  it('rejects missing identity fields before looking at the password', async () => {
    const response = await POST(post({ name: '', email: 'nope', phone: '', password: 'Snooker248' }))
    expect(response.status).toBe(422)
    expect(((await response.json()) as { error?: string }).error).toBe('invalid_input')
  })

  it('gets past the password gate with a compliant password', async () => {
    // Proves the 422s above come from the password rules and not from the
    // fixture being rejected for some unrelated reason. A compliant password
    // reaches the Supabase call, which has no credentials in this environment,
    // so the handler's catch returns 500 — anything but 422 weak_password.
    const response = await POST(post({ ...VALID, password: 'Snooker248' }))
    expect(response.status).not.toBe(422)
    expect(((await response.json()) as { error?: string }).error).not.toBe('weak_password')
  })
})
