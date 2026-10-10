import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// Screen4 is a private component inside a Next page file (pages may not add named
// exports), so this guards the markup at source level instead of rendering it.
const src = readFileSync(resolve(__dirname, '../page.tsx'), 'utf8')

function goToMemberElement(): string {
  const idx = src.indexOf('data-testid="go-to-member"')
  expect(idx).toBeGreaterThan(-1)
  const open = src.lastIndexOf('<motion.', idx)
  const close = src.indexOf('>\n', src.indexOf('style={{', idx))
  return src.slice(open, close)
}

describe('booking success: 前往會員中心 button', () => {
  it('is a real link to /member (no locale prefix, no JS router)', () => {
    const el = goToMemberElement()
    expect(el.startsWith('<motion.a')).toBe(true)
    expect(el).toContain('href="/member"')
    expect(el).not.toContain('router.push')
  })

  it('stacks above the ticket printer scene that overlaps it (-96px margin)', () => {
    const el = goToMemberElement()
    expect(el).toMatch(/position: "relative"/)
    expect(el).toMatch(/zIndex: 1/)
  })
})
