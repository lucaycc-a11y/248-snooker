import { chromium, devices } from 'playwright'

const run = async () => {
  const browser = await chromium.launch()
  const out = {}

  for (const vp of [
    { label: 'desktop', opts: { viewport: { width: 1440, height: 900 } } },
    { label: 'mobile-375', opts: { ...devices['iPhone SE'] } },
  ]) {
    const ctx = await browser.newContext(vp.opts)
    const page = await ctx.newPage()
    const errors = []
    page.on('console', (m) => {
      if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${m.type()}] ${m.text().slice(0, 220)}`)
    })
    page.on('pageerror', (e) => errors.push(`[pageerror] ${String(e).slice(0, 220)}`))

    await page.goto('http://localhost:3000/', { waitUntil: 'networkidle', timeout: 60000 })
    await page.locator('.s2-stage').scrollIntoViewIfNeeded()
    await page.waitForTimeout(800)

    const geom = await page.evaluate(() => {
      const st = document.querySelector('.s2-stage')
      const pin = document.querySelector('.s2-pin')
      return { top: Math.round(window.scrollY + st.getBoundingClientRect().top), h: st.offsetHeight, ph: pin.offsetHeight }
    })

    // At each beat's peak, confirm the brightest copy line matches the brightest layer.
    const sync = []
    const shots = []
    for (let i = 0; i < 3; i++) {
      const y = Math.round(geom.top + ((geom.h - geom.ph) * i) / 2)
      await page.evaluate((t) => window.scrollTo(0, t), y)
      await page.waitForTimeout(450)
      const s = await page.evaluate(() => {
        const ops = [...document.querySelectorAll('[data-value-layer]')].map((l) =>
          Number(getComputedStyle(l).opacity),
        )
        const beats = [...document.querySelectorAll('[data-value-copy]')].map((b) => Number(getComputedStyle(b).opacity))
        // Which beat is vertically centred in the viewport right now?
        const centred = [...document.querySelectorAll('.s2-line')]
          .map((l, idx) => {
            const r = l.getBoundingClientRect()
            return { idx, dist: Math.abs(r.top + r.height / 2 - window.innerHeight / 2), text: l.textContent.trim() }
          })
          .sort((a, b) => a.dist - b.dist)[0]
        return {
          brightestLayer: ops.indexOf(Math.max(...ops)),
          layers: ops.map((o) => o.toFixed(3)),
          brightestBeat: beats.indexOf(Math.max(...beats)),
          centredLine: centred.idx,
          centredDist: Math.round(centred.dist),
          text: centred.text,
        }
      })
      sync.push({ beat: i, ...s, inSync: s.brightestLayer === i && s.centredLine === i })
      const p = `/tmp/s2fix-${vp.label}-beat${i + 1}.png`
      await page.screenshot({ path: p })
      shots.push(p)
    }

    out[vp.label] = { geom, sync, shots, errors: [...new Set(errors)].slice(0, 12) }
    await ctx.close()
  }

  await browser.close()
  console.log(JSON.stringify(out, null, 2))
}

run().catch((e) => { console.error('FAIL', e); process.exit(1) })
