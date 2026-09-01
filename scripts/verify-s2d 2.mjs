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
    const imgs = []
    page.on('response', (r) => {
      const u = r.url()
      if (u.includes('/_next/image') || u.includes('/gallery/S2/')) {
        imgs.push({ status: r.status(), bytes: Number(r.headers()['content-length'] ?? 0), type: r.headers()['content-type'], url: u.slice(0, 110) })
      }
    })
    await page.goto('http://localhost:3000/', { waitUntil: 'networkidle', timeout: 60000 })
    const stage = page.locator('.s2-stage')
    await stage.scrollIntoViewIfNeeded()
    await page.waitForTimeout(1200)

    const geom = await page.evaluate(() => {
      const st = document.querySelector('.s2-stage')
      const pin = document.querySelector('.s2-pin')
      return { top: Math.round(window.scrollY + st.getBoundingClientRect().top), h: st.offsetHeight, ph: pin.offsetHeight }
    })

    // Measure the QR Code keyword against a forced fallback to prove Good Times
    // is actually rasterizing different glyph metrics, not just named in CSS.
    const fontProof = await page.evaluate(async () => {
      await document.fonts.ready
      const kw = document.querySelector('.s2-kw')
      const real = kw.getBoundingClientRect().width
      const prev = kw.style.fontFamily
      kw.style.fontFamily = 'monospace'
      const forced = kw.getBoundingClientRect().width
      kw.style.fontFamily = prev
      const loaded = []
      document.fonts.forEach((f) => { if (f.family.replace(/["']/g, '') === 'Good Times') loaded.push(f.status) })
      return { realWidth: +real.toFixed(1), monoWidth: +forced.toFixed(1), differs: Math.abs(real - forced) > 0.5, faceStatus: loaded }
    })

    const copy = await page.evaluate(() =>
      [...document.querySelectorAll('.s2-line')].map((l) => l.textContent.trim()),
    )

    // Screenshot each beat centre.
    const shots = []
    for (let i = 0; i < 3; i++) {
      const y = Math.round(geom.top + ((geom.h - geom.ph) * i) / 2)
      await page.evaluate((t) => window.scrollTo(0, t), y)
      await page.waitForTimeout(500)
      const p = `/tmp/s2-${vp.label}-beat${i + 1}.png`
      await page.screenshot({ path: p })
      shots.push(p)
    }

    out[vp.label] = {
      copy,
      fontProof,
      shots,
      images: imgs.filter((i) => i.url.includes('S2') || i.url.includes('_next/image')).slice(0, 6),
    }
    await ctx.close()
  }

  await browser.close()
  console.log(JSON.stringify(out, null, 2))
}

run().catch((e) => { console.error('FAIL', e); process.exit(1) })
