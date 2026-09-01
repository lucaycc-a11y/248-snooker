/**
 * Standalone font+copy measurement — no Next.js server required.
 *
 * Loads GOODTIME.TTF and Noto Sans TC directly from disk, renders each beat's
 * copy string with the real CSS, and reports intrinsic width vs. viewport
 * available width so we know the exact clamp() value that keeps Part 1 on one
 * line at 375 / 390 / 1440 px without over-shrinking on desktop.
 */
import { chromium } from 'playwright'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { resolve, dirname } from 'path'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const goodTimeTTF = readFileSync(resolve(root, 'public/fonts/GOODTIME.TTF'))
const goodTimeB64 = goodTimeTTF.toString('base64')

// Actual copy strings (zh-HK locale, the hardest case for Part 1).
const BEATS = [
  // Part 1: CJK prefix + Latin "QR Code" in Good Times
  { id: 'part1', before: '數碼即入場，網上預訂後獲得 ', keyword: 'QR Code', after: '' },
  // Part 2 & 3: plain CJK
  { id: 'part2', before: '專業中式球枱，窄袋真實手感', keyword: '', after: '' },
  { id: 'part3', before: '獨立球室，一房一枱，零打擾', keyword: '', after: '' },
]

// Also test the longest English beat (Part 2 is 48 chars — can it ever fit one
// line at any legible size, or must we allow wrapping for en only?)
const EN_BEATS = [
  { id: 'en-part1', before: 'Book online and get your ', keyword: 'QR Code', after: ' for instant entry.' },
  { id: 'en-part2', before: 'A pro Chinese table with narrow, honest pockets.', keyword: '', after: '' },
  { id: 'en-part3', before: 'One private room, one table, zero distractions.', keyword: '', after: '' },
]

const html = (fontSizeCss) => /* html */ `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  @font-face {
    font-family: 'Good Times';
    src: url('data:font/truetype;base64,${goodTimeB64}') format('truetype');
    font-display: block;
  }
  /* Mirror the exact .s2-line + .s2-kw rules from Section2Value.tsx.
     NOTE: no @media (min-width:861px){max-width:24ch} override — the component
     no longer has it (it was forcing Part 1 to wrap at desktop). */
  .line {
    margin: 0;
    max-width: 96vw;
    text-align: center;
    text-wrap: wrap;
    font-family: 'Noto Sans TC', sans-serif;
    font-weight: 800;
    font-size: ${fontSizeCss};
    line-height: 1.3;
    letter-spacing: -0.02em;
    color: #fff;
    display: inline-block;
    white-space: normal;
  }
  .kw {
    font-family: 'Good Times', 'JetBrains Mono', monospace;
    font-size: 0.86em;
    letter-spacing: 0.05em;
    white-space: nowrap;
  }
  /* Beat container mirrors .s2-beat padding */
  .beat {
    width: 100vw;
    padding: 0 24px;
    box-sizing: border-box;
    display: flex;
    align-items: center;
    justify-content: center;
  }
</style>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@800&display=block" rel="stylesheet">
</head>
<body style="background:#000;margin:0">
${[...BEATS, ...EN_BEATS].map(b => `
  <div class="beat" data-beat="${b.id}">
    <p class="line" data-line="${b.id}">${
      b.before
    }${b.keyword ? `<span class="kw" data-kw="${b.id}">${b.keyword}</span>` : ''}${
      b.after
    }</p>
  </div>
`).join('')}
</body>
</html>`

const measure = () =>
  [...document.querySelectorAll('[data-line]')].map(el => {
    const cs = getComputedStyle(el)
    const lh = parseFloat(cs.lineHeight)
    const lines = Math.round(el.getBoundingClientRect().height / lh)
    // Intrinsic nowrap width
    const probe = el.cloneNode(true)
    probe.style.cssText = 'position:absolute;visibility:hidden;white-space:nowrap;max-width:none;left:-9999px;'
    probe.style.font = cs.font
    probe.style.letterSpacing = cs.letterSpacing
    document.body.appendChild(probe)
    const needPx = Math.round(probe.getBoundingClientRect().width)
    probe.remove()
    const beat = el.closest('[data-beat]')
    const availPx = Math.round(beat.getBoundingClientRect().width) - 48 // minus padding
    return {
      id: el.dataset.line,
      lines,
      fontPx: +parseFloat(cs.fontSize).toFixed(1),
      needPx,
      availPx,
      fits: needPx <= availPx + 1,
    }
  })

const run = async () => {
  const browser = await chromium.launch()
  const results = {}

  // Test at these font-size values (clamp picks one per viewport).
  // We test a range to find the sweet spot.
  const candidates = ['clamp(1rem, 3.8vw, 2.6rem)', 'clamp(1rem, 4.0vw, 2.6rem)', 'clamp(1rem, 4.2vw, 2.6rem)', 'clamp(1rem, 4.5vw, 2.6rem)']

  for (const fontSize of candidates) {
    results[fontSize] = {}
    const content = html(fontSize)
    for (const [vwLabel, vw] of [['375px', 375], ['390px', 390], ['1440px', 1440]]) {
      const ctx = await browser.newContext({ viewport: { width: vw, height: 900 } })
      const page = await ctx.newPage()
      await page.setContent(content, { waitUntil: 'networkidle' })
      await page.evaluate(() => document.fonts.ready)
      await page.waitForTimeout(400)
      results[fontSize][vwLabel] = await page.evaluate(measure)
      await ctx.close()
    }
  }

  await browser.close()
  console.log(JSON.stringify(results, null, 2))
}

run().catch(e => { console.error('FAIL', e); process.exit(1) })
