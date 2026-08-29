import { describe, expect, it } from 'vitest'
import { PASSWORD_MAX_LENGTH, scorePassword, validatePassword } from './password'

describe('validatePassword', () => {
  it('accepts a password meeting every rule', () => {
    expect(validatePassword('Snooker248')).toEqual({ ok: true })
  })

  it('rejects a password shorter than eight characters', () => {
    const result = validatePassword('Ab1cdef')
    expect(result.ok).toBe(false)
    expect(result.ok === false && result.reasons).toContain('too_short')
  })

  it('rejects a password with no uppercase letter', () => {
    const result = validatePassword('snooker248')
    expect(result.ok === false && result.reasons).toEqual(['no_upper'])
  })

  it('rejects a password with no lowercase letter', () => {
    const result = validatePassword('SNOOKER248')
    expect(result.ok === false && result.reasons).toEqual(['no_lower'])
  })

  it('rejects a password with no digit', () => {
    const result = validatePassword('SnookerClub')
    expect(result.ok === false && result.reasons).toEqual(['no_digit'])
  })

  it('reports every broken rule at once', () => {
    const result = validatePassword('short')
    expect(result.ok === false && result.reasons).toEqual(['too_short', 'no_upper', 'no_digit'])
  })

  it('rejects a password beyond the bcrypt truncation limit', () => {
    const result = validatePassword(`A1${'a'.repeat(PASSWORD_MAX_LENGTH)}`)
    expect(result.ok === false && result.reasons).toContain('too_long')
  })

  it.each([undefined, null, 42, {}, []])('rejects the non-string value %s', (value) => {
    expect(validatePassword(value).ok).toBe(false)
  })
})

describe('scorePassword', () => {
  it('scores an empty password zero', () => {
    expect(scorePassword('')).toBe(0)
  })

  it('increases as the password gains length and character classes', () => {
    const weak = scorePassword('abcdefgh')
    const better = scorePassword('Abcdefgh')
    const strong = scorePassword('Abcdefgh1234')
    const strongest = scorePassword('Abcdefgh1234!')

    expect(weak).toBeLessThan(better)
    expect(better).toBeLessThan(strong)
    expect(strong).toBeLessThanOrEqual(strongest)
    expect(strongest).toBe(4)
  })

  it('never exceeds the maximum score', () => {
    expect(scorePassword(`Aa1!${'x'.repeat(60)}`)).toBe(4)
  })

  it('can score a password that still fails validation', () => {
    // Guards the documented contract: the meter is feedback, not a gate.
    expect(scorePassword('Aa1!def')).toBeGreaterThan(0)
    expect(validatePassword('Aa1!def').ok).toBe(false)
  })
})
