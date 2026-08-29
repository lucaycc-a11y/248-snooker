import { chromium, devices } from 'playwright'

const run = async () => {
  const browser = await chromium.launch()
  const out = {}

  // --- Desktop samples + frame timing ---
  for (const vp of [
    { label: 'desktop', opts: { viewport: { width: 1440, height: 900 } } },
    { label: 'mobile-375', opts: { ...devices['iPhone SE'] } },
  ]) {
    const ctx = await browser.newContext(vp.opts)
    const page = await ctx.newPage()
    await page.goto('http://localhost:3000/', { waitUntil: 'networkidle', timeout: 60000 })
    const stage = page.locator('.s2-stage')
    await stage.scrollIntoViewIfNeeded()
    await page.waitForTimeout(300)

    const geom = await page.evaluate(() => {
      const st = document.querySelector('.s2-stage')
      const pin = document.querySelector('.s2-pin')
      return {
        stageTopAbs: Math.round(window.scrollY + st.getBoundingClientRect().top),
        stageH: Math.round(st.offsetHeight),
        pinH: Math.round(pin.offsetHeight),
      }
    })

    const samples = []
    for (const frac of [0, 0.25, 0.5, 0.75, 1]) {
      const y = Math.round(geom.stageTopAbs + frac * (geom.stageH - geom.pinH))
      await page.evaluate((t) => window.scrollTo(0, t), y)
      await page.waitForTimeout(160)
      samples.push(
        await page.evaluate((f) => {
          const pin = document.querySelector('.s2-pin')
          const st = document.querySelector('.s2-stage')
          return {
            frac: f,
            pinTop: Math.round(pin.getBoundingClientRect().top),
            stageTop: Math.round(st.getBoundingClientRect().top),
            op: [...document.querySelectorAll('[data-value-layer]')].map((l) =>
              Number(getComputedStyle(l).opacity).toFixed(3),
            ),
          }
        }, frac),
      )
    }

    // Fast scroll frame timing across the pinned range.
    const fps = await page.evaluate(
      async ({ top, h, ph }) => {
        window.scrollTo(0, top)
        await new Promise((r) => setTimeout(r, 200))
        const frames = []
        let last = performance.now()
        let raf = 0
        const tick = () => {
          const now = performance.now()
          frames.push(now - last)
          last = now
          raf = requestAnimationFrame(tick)
        }
        raf = requestAnimationFrame(tick)
        const dist = h - ph
        const steps = 40
        for (let i = 0; i <= steps; i++) {
          window.scrollTo(0, top + (dist * i) / steps)
          await new Promise((r) => requestAnimationFrame(r))
        }
        cancelAnimationFrame(raf)
        const sorted = [...frames].sort((a, b) => a - b)
        return {
          count: frames.length,
          median: +sorted[Math.floor(sorted.length / 2)].toFixed(2),
          p95: +sorted[Math.floor(sorted.length * 0.95)].toFixed(2),
          max: +Math.max(...frames).toFixed(2),
          over32ms: frames.filter((f) => f > 32).length,
        }
      },
      { top: geom.stageTopAbs, h: geom.stageH, ph: geom.pinH },
    )

    // Monotonic sweep: opacity must never jump non-monotonically (no flicker).
    const sweep = await page.evaluate(
      async ({ top, h, ph }) => {
        const res = []
        const dist = h - ph
        for (let i = 0; i <= 24; i++) {
          window.scrollTo(0, top + (dist * i) / 24)
          await new Promise((r) => requestAnimationFrame(r))
          await new Promise((r) => requestAnimationFrame(r))
          res.push(
            [...document.querySelectorAll('[data-value-layer]')].map((l) =>
              +Number(getComputedStyle(l).opacity).toFixed(3),
            ),
          )
        }
        return res
      },
      { top: geom.stageTopAbs, h: geom.stageH, ph: geom.pinH },
    )
    const sums = sweep.map((r) => +r.reduce((a, b) => a + b, 0).toFixed(3))
    out[vp.label] = { geom, samples, fps, sumMin: Math.min(...sums), sumMax: Math.max(...sums) }
    await ctx.close()
  }

  // --- Reduced motion ---
  const rmCtx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' })
  const rp = await rmCtx.newPage()
  await rp.goto('http://localhost:3000/', { waitUntil: 'networkidle', timeout: 60000 })
  await rp.locator('.s2-stage').scrollIntoViewIfNeeded()
  await rp.waitForTimeout(400)
  out.reducedMotion = await rp.evaluate(() => ({
    reducedAttr: document.querySelector('.s2-stage')?.dataset.reduced ?? null,
    beatOpacities: [...document.querySelectorAll('[data-value-copy]')].map((b) =>
      Number(getComputedStyle(b).opacity).toFixed(2),
    ),
  }))
  await rmCtx.close()

  await browser.close()
  console.log(JSON.stringify(out, null, 2))
}

run().catch((e) => {
  console.error('FAIL', e)
  process.exit(1)
})
