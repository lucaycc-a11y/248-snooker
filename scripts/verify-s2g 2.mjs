import { chromium, devices } from 'playwright'

const PATHS = { 'zh-HK': '/', 'zh-CN': '/zh-CN', en: '/en' }

// Warm every route over plain HTTP first. Next dev compiles a route on first
// request, and that cold compile (7-16s here) was eating the Playwright
// locator timeout and reading as "the section never rendered".
const warm = async () => {
  for (const p of Object.values(PATHS)) {
    const r = await fetch(`http://localhost:3000${p}`)
    await r.text()
    console.error(`warm ${p} -> ${r.status}`)
  }
}

const measure = () =>
  [...document.querySelectorAll('.s2-line')].map((el) => {
    const cs = getComputedStyle(el)
    const lh = parseFloat(cs.lineHeight)
    // Intrinsic single-line width, measured on a hidden nowrap clone, so the
    // report says how much room the copy actually needs rather than just
    // whether it happened to wrap at this width.
    const probe = el.cloneNode(true)
    probe.style.cssText = 'position:absolute;visibility:hidden;white-space:nowrap;max-width:none;left:-9999px;'
    probe.style.font = cs.font
    probe.style.letterSpacing = cs.letterSpacing
    document.body.appendChild(probe)
    const need = Math.round(probe.getBoundingClientRect().width)
    probe.remove()
    const box = el.getBoundingClientRect()
    return {
      lines: Math.round(box.height / lh),
      fontPx: +parseFloat(cs.fontSize).toFixed(1),
      needPx: need,
      availPx: Math.round(box.width),
      fitsOneLine: need <= Math.round(box.width) + 1,
      text: el.textContent.trim().slice(0, 34),
    }
  })

const run = async () => {
  await warm()
  const browser = await chromium.launch()
  const out = {}

  for (const vp of [
    { label: 'desktop-1440', opts: { viewport: { width: 1440, height: 900 } } },
    { label: 'mobile-390', opts: { ...devices['iPhone 12'] } },
    { label: 'mobile-375', opts: { ...devices['iPhone SE'] } },
  ]) {
    out[vp.label] = {}
    for (const [loc, path] of Object.entries(PATHS)) {
      const ctx = await browser.newContext(vp.opts)
      const page = await ctx.newPage()
      await page.goto(`http://localhost:3000${path}`, { waitUntil: 'domcontentloaded', timeout: 90000 })
      await page.waitForSelector('.s2-stage', { timeout: 90000 })
      await page.evaluate(() => document.fonts.ready)
      await page.locator('.s2-stage').scrollIntoViewIfNeeded({ timeout: 90000 })
      await page.waitForTimeout(700)
      out[vp.label][loc] = await page.evaluate(measure)
      await ctx.close()
    }
  }

  await browser.close()
  console.log(JSON.stringify(out, null, 2))
}

run().catch((e) => { console.error('FAIL', e); process.exit(1) })
