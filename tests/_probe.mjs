import { chromium } from '@playwright/test'

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const bad = []
page.on('response', (r) => { if (r.status() >= 400) bad.push(`${r.status()} ${r.url()}`) })
const logs = []
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(`${m.type()}: ${m.text().slice(0, 200)}`) })
await page.goto('http://localhost:3000/venue', { waitUntil: 'networkidle', timeout: 60000 })
await page.waitForTimeout(2000)
const info = await page.evaluate(() => {
  const hs = [...document.querySelectorAll('h2')].map((h) => h.textContent?.trim())
  const nav = document.querySelector('nav')?.getBoundingClientRect()
  return { hs, nav: nav && { top: nav.top, height: nav.height, bottom: nav.bottom } }
})
console.log(JSON.stringify(info, null, 2))
console.log('BAD RESPONSES:\n' + bad.join('\n'))
console.log('CONSOLE:\n' + logs.join('\n'))
await page.setViewportSize({ width: 396, height: 860 })
await page.reload({ waitUntil: 'networkidle' })
const nav2 = await page.evaluate(() => { const r = document.querySelector('nav')?.getBoundingClientRect(); return r && { top: r.top, height: r.height, bottom: r.bottom } })
console.log('PHONE NAV', JSON.stringify(nav2))
await browser.close()
