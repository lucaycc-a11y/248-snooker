import { chromium } from '@playwright/test'

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
await page.goto('http://localhost:3000/venue', { waitUntil: 'networkidle', timeout: 60000 })
await page.waitForTimeout(2000)

const check = await page.evaluate(() => {
  const heading = Array.from(document.querySelectorAll('h2')).find(h => h.textContent?.includes('兩間 1T 獨立球室'))
  const headingText = heading?.textContent
  const headingRect = heading?.getBoundingClientRect()
  const stage = document.querySelector('[data-stage]')
  const stageRect = stage?.getBoundingClientRect()
  const labels = {
    left: document.querySelector('[data-label-left]')?.textContent,
    right: document.querySelector('[data-label-right]')?.textContent
  }
  const tabs = Array.from(document.querySelectorAll('[data-tab]')).map(t => t.textContent?.trim())
  const pills = Array.from(document.querySelectorAll('button')).filter(b => {
    const t = b.textContent?.trim()
    return t && ['場地裝修', '舒適自在', '專業設備', '科技體驗'].includes(t)
  }).map(b => b.textContent?.trim())

  return {
    heading: headingText,
    headingY: headingRect?.top,
    headingHeight: headingRect?.height,
    stage: !!stage,
    stageY: stageRect?.top,
    stageHeight: stageRect?.height,
    labels,
    tabs,
    pills,
    scrollY: window.scrollY,
    clientHeight: document.documentElement.clientHeight
  }
})

console.log(JSON.stringify(check, null, 2))

// Try scrolling to heading
await page.locator('text=兩間 1T 獨立球室').scrollIntoViewIfNeeded()
await page.waitForTimeout(1000)

const afterScroll = await page.evaluate(() => {
  const heading = document.querySelector('h2')
  const rect = heading?.getBoundingClientRect()
  return {
    scrollY: window.scrollY,
    headingY: rect?.top,
    headingText: heading?.textContent
  }
})

console.log('AFTER SCROLL:', JSON.stringify(afterScroll))

await browser.close()
