/**
 * Sticky / pinned section lock regression.
 *
 * For every position:sticky element on each route, scroll through its parent
 * and assert it stays pinned (rect.top ≈ its sticky `top`) for the whole
 * pinned range. Catches ancestors that silently break sticky, e.g.
 * `overflow-x: hidden` on both html and body turning body into a scroll
 * container.
 */
import { test, expect, devices } from '@playwright/test'

const BASE = process.env.TEST_URL || 'http://localhost:3000'

// iPad Pro 11 landscape, 1194×834, touch (matches the screen recording)
test.use({ ...devices['iPad Pro 11 landscape'], locale: 'zh-HK' })

const ROUTES = ['/zh-HK', '/zh-HK/venue', '/zh-HK/about', '/zh-HK/membership']

interface StickyReport {
  label: string
  stickyTop: number
  pinnedRange: number
  samples: number
  drift: number
}

for (const route of ROUTES) {
  test(`${route}: sticky sections stay locked`, async ({ page }) => {
    test.setTimeout(90000)
    await page.goto(`${BASE}${route}`)
    await page.waitForLoadState('networkidle')

    const env = await page.evaluate(() => {
      const h = getComputedStyle(document.documentElement)
      const b = getComputedStyle(document.body)
      return {
        html: `${h.overflowX}/${h.overflowY}`,
        body: `${b.overflowX}/${b.overflowY}`,
        bodyIsScroller: document.body.scrollHeight > document.body.clientHeight && b.overflowY !== 'visible',
      }
    })
    console.log(`\n${route} overflow html=${env.html} body=${env.body}`)

    // Collect sticky elements whose parent gives them real pinned range
    const targets = await page.evaluate(() => {
      const out: Array<{ idx: number; label: string; top: number; start: number; end: number }> = []
      const all = Array.from(document.querySelectorAll<HTMLElement>('body *'))
      all.forEach((el, idx) => {
        const cs = getComputedStyle(el)
        if (cs.position !== 'sticky' && cs.position !== '-webkit-sticky') return
        const parent = el.parentElement
        if (!parent) return
        const pr = parent.getBoundingClientRect()
        const er = el.getBoundingClientRect()
        const top = parseFloat(cs.top) || 0
        const range = pr.height - er.height
        if (range < 200 || er.height < 100) return // ignore trivial/nav stickies
        el.setAttribute('data-sticky-probe', String(idx))
        const start = pr.top + window.scrollY - top
        out.push({
          idx,
          label: `${el.tagName.toLowerCase()}.${(el.className || '').toString().slice(0, 40)}`,
          top,
          start,
          end: start + range,
        })
      })
      return out
    })

    const reports: StickyReport[] = []
    for (const t of targets) {
      let maxDrift = 0
      let samples = 0
      // Sample the middle 80% of the pinned range
      const from = t.start + (t.end - t.start) * 0.1
      const to = t.start + (t.end - t.start) * 0.9
      for (let y = from; y <= to; y += Math.max(40, (to - from) / 10)) {
        await page.evaluate((sy) => window.scrollTo({ top: sy, behavior: 'instant' as ScrollBehavior }), y)
        await page.waitForTimeout(30)
        const rectTop = await page.evaluate(
          (i) => document.querySelector(`[data-sticky-probe="${i}"]`)?.getBoundingClientRect().top ?? NaN,
          t.idx
        )
        maxDrift = Math.max(maxDrift, Math.abs(rectTop - t.top))
        samples++
      }
      reports.push({ label: t.label, stickyTop: t.top, pinnedRange: Math.round(t.end - t.start), samples, drift: Math.round(maxDrift) })
    }

    reports.forEach((r) =>
      console.log(`  ${r.drift <= 2 ? 'LOCKED ' : 'BROKEN '} drift=${String(r.drift).padStart(5)}px range=${r.pinnedRange}px ${r.label}`)
    )

    expect(reports.filter((r) => r.drift > 2)).toEqual([])
  })
}
