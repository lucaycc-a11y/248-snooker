import { chromium, devices } from 'playwright'

const run = async () => {
  const browser = await chromium.launch()
  const out = {}

  for (const vp of [
    { label: 'desktop-1440', opts: { viewport: { width: 1440, height: 900 } } },
    { label: 'laptop-1024', opts: { viewport: { width: 1024, height: 768 } } },
    { label: 'mobile-390', opts: { ...devices['iPhone 12'] } },
    { label: 'mobile-375', opts: { viewport: { width: 375, height: 667 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } },
  ]) {
    const ctx = await browser.newContext(vp.opts)
    const page = await ctx.newPage()
    await page.goto('http://localhost:3100/', { waitUntil: 'networkidle', timeout: 60000 })
    await page.locator('.s2-stage').scrollIntoViewIfNeeded()
    await page.waitForTimeout(700)

    const lines = await page.evaluate(() =>
      [...document.querySelectorAll('.s2-line')].map((el) => {
        const cs = getComputedStyle(el)
        const lh = parseFloat(cs.lineHeight)
        return {
          rendered: Math.round(el.getBoundingClientRect().height / lh),
          fontPx: Math.round(parseFloat(cs.fontSize)),
          text: el.textContent.trim().slice(0, 40),
        }
      }),
    )

    // Scrub monotonicity: opacity must move with scroll, never jump backwards.
    const geom = await page.evaluate(() => {
      const st = document.querySelector('.s2-stage')
      const pin = document.querySelector('.s2-pin')
      return { top: Math.round(window.scrollY + st.getBoundingClientRect().top), h: st.offsetHeight, ph: pin.offsetHeight }
    })
    const track = []
    const steps = 16
    for (let i = 0; i <= steps; i++) {
      const y = Math.round(geom.top + ((geom.h - geom.ph) * i) / steps)
      await page.evaluate((t) => window.scrollTo(0, t), y)
      await page.waitForTimeout(140)
      track.push(
        await page.evaluate(() => {
          const st = document.querySelector('.s2-stage')
          const pin = document.querySelector('.s2-pin')
          return {
            pinTop: Math.round(pin.getBoundingClientRect().top),
            stageTop: Math.round(st.getBoundingClientRect().top),
            ops: [...document.querySelectorAll('[data-value-layer]')].map((l) => Number(getComputedStyle(l).opacity)),
          }
        }),
      )
    }

    const sumOk = track.every((t) => Math.abs(t.ops.reduce((a, b) => a + b, 0) - 1) < 0.02)
    const pinStuck = track.filter((t) => Math.abs(t.pinTop) <= 2).length
    const l3 = track.map((t) => t.ops[2])
    const mono = l3.every((v, i) => i === 0 || v >= l3[i - 1] - 0.001)
    const distinct = new Set(track.map((t) => t.ops.map((o) => o.toFixed(2)).join(','))).size

    out[vp.label] = {
      lines,
      multiLine: lines.filter((l) => l.rendered > 1).map((l) => l.text),
      pinStuckSamples: `${pinStuck}/${track.length}`,
      opacitySumsToOne: sumOk,
      layer3Monotonic: mono,
      distinctStates: distinct,
      stageMoved: track[0].stageTop - track[track.length - 1].stageTop,
    }
    await ctx.close()
  }

  await browser.close()
  console.log(JSON.stringify(out, null, 2))
}

run().catch((e) => { console.error('FAIL', e); process.exit(1) })
