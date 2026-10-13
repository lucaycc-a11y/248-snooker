import { chromium } from '@playwright/test'

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
await page.goto('http://localhost:3000/venue', { waitUntil: 'networkidle', timeout: 60000 })
await page.waitForTimeout(3000)

// Scroll to component
await page.evaluate(() => {
  const h = Array.from(document.querySelectorAll('h2')).find(h => h.textContent?.includes('兩間'))
  h?.scrollIntoView({ behavior: 'instant', block: 'center' })
})
await page.waitForTimeout(1000)

const dom = await page.evaluate(() => {
  const section = Array.from(document.querySelectorAll('section')).find(s => {
    return s.querySelector('h2')?.textContent?.includes('兩間')
  })

  if (!section) return { found: false }

  const structure = {
    found: true,
    sectionClasses: section.className,
    children: Array.from(section.children).map((c, i) => ({
      index: i,
      tag: c.tagName,
      classes: c.className,
      id: c.id,
      dataAttrs: Array.from(c.attributes).filter(a => a.name.startsWith('data-')).map(a => a.name),
      text: c.textContent?.slice(0, 50)
    }))
  }

  // Look for actual component attributes
  const sceneElements = document.querySelectorAll('[data-scene]')
  structure.sceneCount = sceneElements.length
  structure.sceneIds = Array.from(sceneElements).map(e => e.getAttribute('data-scene'))

  const modeElements = document.querySelectorAll('[data-mode]')
  structure.modeCount = modeElements.length
  structure.modeValues = Array.from(modeElements).map(e => e.getAttribute('data-mode'))

  const tabElements = document.querySelectorAll('[data-tab]')
  structure.tabCount = tabElements.length
  structure.tabIds = Array.from(tabElements).map(e => e.getAttribute('data-tab'))

  const rangeElements = document.querySelectorAll('[data-rv-range]')
  structure.rangeCount = rangeElements.length

  const labelElements = document.querySelectorAll('[data-rv-label]')
  structure.labelCount = labelElements.length
  structure.labelTexts = Array.from(labelElements).map(e => e.textContent?.trim())

  return structure
})

console.log(JSON.stringify(dom, null, 2))

await page.screenshot({ path: 'test-results/debug-room-viewer.png', fullPage: true })
await browser.close()
