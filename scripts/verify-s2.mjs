import { chromium, devices } from 'playwright'

const VIEWPORTS = [
  { label: 'desktop', opts: { viewport: { width: 1440, height: 900 } } },
  { label: 'mobile-375', opts: { ...devices['iPhone SE'] } },
]

const run = async () => {
  const browser = await chromium.launch()
  const report = {}

  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext(vp.opts)
    const page = await ctx.newPage()
    const consoleMsgs = []
    page.on('console', (m) => {
      if (m.type() === 'error' || m.type() === 'warning') consoleMsgs.push(`${m.type()}: ${m.text()}`)
    })
    page.on('pageerror', (e) => consoleMsgs.push(`pageerror: ${e.message}`))

    await page.goto('http://localhost:3000/', { waitUntil: 'networkidle', timeout: 60000 })

    const stage = page.locator('.s2-stage')
    await stage.waitFor({ state: 'attached', timeout: 20000 })
    await stage.scrollIntoViewIfNeeded()
    await page.waitForTimeout(400)

    const samples = []
    const box = await stage.boundingBox()
    const pageTop = await page.evaluate(() => window.scrollY)
    const stageTop = pageTop + box.y
    const stageH = box.height
    const vh = vp.opts.viewport.height

    // Sample across the whole pinned range.
    for (const frac of [0, 0.25, 0.5, 0.75, 1]) {
      const target = Math.round(stageTop + frac * (stageH - vh))
      await page.evaluate((y) => window.scrollTo(0, y), target)
      await page.waitForTimeout(180)
      const s = await page.evaluate(() => {
        const pin = document.querySelector('.s2-pin')
        const st = document.querySelector('.s2-stage')
        const layers = [...document.querySelectorAll('[data-value-layer]')]
        return {
          pinTop: Math.round(pin.getBoundingClientRect().top),
          pinH: Math.round(pin.getBoundingClientRect().height),
          stageTop: Math.round(st.getBoundingClientRect().top),
          op: layers.map((l) => Number(getComputedStyle(l).opacity).toFixed(3)),
        }
      })
      samples.push({ frac, ...s })
    }

    // Font check on the QR Code keyword.
    const font = await page.evaluate(async () => {
      const kw = document.querySelector('.s2-kw')
      if (!kw) return null
      const fam = getComputedStyle(kw).fontFamily
      const loaded = document.fonts.check(`1em 'Good Times'`)
      let goodTimesFaces = 0
      document.fonts.forEach((f) => {
        if (f.family.replace(/["']/g, '') === 'Good Times') goodTimesFaces += 1
      })
      return { fontFamily: fam, checkGoodTimes: loaded, faces: goodTimesFaces, text: kw.textContent }
    })

    report[vp.label] = { samples, font, console: consoleMsgs }
    await ctx.close()
  }

  await browser.close()
  console.log(JSON.stringify(report, null, 2))
}

run().catch((e) => {
  console.error('FAIL', e)
  process.exit(1)
})
