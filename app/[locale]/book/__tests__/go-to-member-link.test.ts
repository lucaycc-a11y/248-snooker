import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// Screen4 is a private component inside a Next page file (pages may not add named
// exports), so this guards the markup at source level instead of rendering it.
const src = readFileSync(resolve(__dirname, '../page.tsx'), 'utf8')

function goToMemberElement(): string {
  const idx = src.indexOf('data-testid="go-to-member"')
  expect(idx).toBeGreaterThan(-1)
  const open = src.lastIndexOf('<a', idx)
  const close = src.indexOf('>\n', src.indexOf('style={{', idx))
  return src.slice(open, close)
}

describe('booking success: 前往會員中心 button', () => {
  it('is a real link to /member (no locale prefix, no JS router)', () => {
    const el = goToMemberElement()
    expect(el.startsWith('<a')).toBe(true)
    expect(el).toContain('href="/member"')
    expect(el).not.toContain('router.push')
  })

  it('lives in the ticket card footer, so it cannot be covered by the ticket printer scene', () => {
    const idx = src.indexOf('data-testid="go-to-member"')
    const printer = src.lastIndexOf('<TicketPrinter', idx)
    const footer = src.lastIndexOf('cardFooter={', idx)
    expect(printer).toBeGreaterThan(-1)
    expect(footer).toBeGreaterThan(printer)
  })
})
