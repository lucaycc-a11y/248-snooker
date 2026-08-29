import { chromium, devices } from 'playwright'

const measure = async (page, label) => {
  const geom = await page.evaluate(() => {
    const st = document.querySelector('.s2-stage')
    const pin = document.querySelector('.s2-pin')
    return {
      top: Math.round(window.scrollY + st.getBoundingClientRect().top),
      h: st.offsetHeight,
      ph: pin.offsetHeight,
    }
  })

  // Baseline: idle rAF interval, no scrolling, no work.
  const idle = await page.evaluate(async () => {
    const f = []
    let last = performance.now()
    await new Promise((res) => {
      let n = 0
      const tick = () => {
        const now = performance.now()
        f.push(now - last)
        last = now
        if (++n < 40) requestAnimationFrame(tick)
        else res()
      }
      requestAnimationFrame(tick)
    })
    const s = [...f].sort((a, b) => a - b)
    return { median: +s[20].toFixed(2), max: +Math.max(...f).toFixed(2) }
  })

  // Cost of the component's own scroll->style work, measured directly.
  const handler = await page.evaluate(
    async ({ top, h, ph }) => {
      const st = document.querySelector('.s2-stage')
      const costs = []
      const dist = h - ph
      for (let i = 0; i <= 60; i++) {
        window.scrollTo(0, top + (dist * i) / 60)
        const t0 = performance.now()
        // Force the same read+write the component performs, then flush layout.
        st.getBoundingClientRect()
        void document.querySelector('.s2-pin').offsetHeight
        const t1 = performance.now()
        costs.push(t1 - t0)
        await new Promise((r) => requestAnimationFrame(r))
      }
      const s = [...costs].sort((a, b) => a - b)
      return { median: +s[30].toFixed(3), p95: +s[57].toFixed(3), max: +Math.max(...costs).toFixed(3) }
    },
    geom,
  )

  // Long-task observation during a fast scroll sweep — the real jank signal.
  const longTasks = await page.evaluate(
    async ({ top, h, ph }) => {
      const tasks = []
      let po
      try {
        po = new PerformanceObserver((l) => l.getEntries().forEach((e) => tasks.push(+e.duration.toFixed(1))))
        po.observe({ entryTypes: ['longtask'] })
      } catch {
        return { supported: false }
      }
      const dist = h - ph
      for (let i = 0; i <= 60; i++) {
        window.scrollTo(0, top + (dist * i) / 60)
        await new Promise((r) => setTimeout(r, 8))
      }
      await new Promise((r) => setTimeout(r, 200))
      po.disconnect()
      return { supported: true, count: tasks.length, max: tasks.length ? Math.max(...tasks) : 0, tasks: tasks.slice(0, 10) }
    },
    geom,
  )

  return { label, geom, idle, handler, longTasks }
}

const run = async () => {
  const browser = await chromium.launch()
  const out = []
  for (const vp of [
    { label: 'desktop', opts: { viewport: { width: 1440, height: 900 } } },
    { label: 'mobile-375', opts: { ...devices['iPhone SE'] } },
  ]) {
    const ctx = await browser.newContext(vp.opts)
    const page = await ctx.newPage()
    await page.goto('http://localhost:3000/', { waitUntil: 'networkidle', timeout: 60000 })
    await page.locator('.s2-stage').scrollIntoViewIfNeeded()
    await page.waitForTimeout(300)
    out.push(await measure(page, vp.label))
    await ctx.close()
  }
  await browser.close()
  console.log(JSON.stringify(out, null, 2))
}

run().catch((e) => {
  console.error('FAIL', e)
  process.exit(1)
})
