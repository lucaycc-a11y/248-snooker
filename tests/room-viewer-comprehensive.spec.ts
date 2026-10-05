import { test, expect, devices } from '@playwright/test'

const baseURL = 'http://localhost:3000'

test.describe('Room Viewer - Comprehensive Verification', () => {
  test('Desktop 1440x900 - Full verification', async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    const page = await context.newPage()

    // Track console
    const errors: string[] = []
    page.on('console', msg => {
      if (msg.type() === 'error' || msg.type() === 'warning') {
        errors.push(`${msg.type()}: ${msg.text()}`)
      }
    })

    await page.goto(`${baseURL}/venue`, { waitUntil: 'networkidle', timeout: 60000 })
    await page.waitForTimeout(2000)

    // 1. No console errors
    expect(errors.filter(e => !e.includes('Lit is in dev mode'))).toEqual([])

    // 2. Scroll to component
    await page.locator('text=兩間 1T 獨立球室').scrollIntoViewIfNeeded()
    await page.waitForTimeout(500)

    // 3. Check heading position (not under navbar)
    const headingY = await page.locator('h2:has-text("兩間 1T 獨立球室")').evaluate(el => el.getBoundingClientRect().top)
    expect(headingY).toBeGreaterThanOrEqual(45) // navbar is 45px

    // 4. Check labels
    const labels = await page.locator('[data-rv-label]').allTextContents()
    expect(labels[0]).toContain('Space Infinity')
    expect(labels[1]).toContain('Space Eternity')

    // 5. Check slider exists
    const slider = page.locator('[data-rv-range]').first()
    expect(await slider.count()).toBe(1)
    const sliderValue = await slider.inputValue()
    expect(Number(sliderValue)).toBeGreaterThanOrEqual(0)
    expect(Number(sliderValue)).toBeLessThanOrEqual(100)

    // 6. Check 4 tabs exist
    const tabs = await page.locator('[data-tab]').allTextContents()
    expect(tabs).toEqual(['場地裝修', '舒適自在', '專業設備', '科技體驗敬請期待'])

    // 7. Check 4 scenes exist
    const scenes = await page.locator('[data-scene]').count()
    expect(scenes).toBe(4)

    // 8. Check all images load (200 status)
    const images = await page.locator('[data-scene] img').all()
    for (const img of images) {
      const src = await img.getAttribute('src')
      if (src) {
        const complete = await img.evaluate(i => (i as HTMLImageElement).complete)
        const naturalWidth = await img.evaluate(i => (i as HTMLImageElement).naturalWidth)
        expect(complete).toBe(true)
        expect(naturalWidth).toBeGreaterThan(0)
      }
    }

    // 9. No horizontal overflow
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth)
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1)

    // 10. Screenshot
    await page.screenshot({ path: 'test-results/room-viewer-desktop-1440.png', fullPage: false })

    await context.close()
  })

  test('Phone 396x860 - Mobile verification', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 396, height: 860 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true
    })
    const page = await context.newPage()

    await page.goto(`${baseURL}/venue`, { waitUntil: 'networkidle', timeout: 60000 })
    await page.waitForTimeout(2000)

    // Scroll to component
    await page.locator('text=兩間 1T 獨立球室').scrollIntoViewIfNeeded()
    await page.waitForTimeout(500)

    // 1. Check heading not under navbar
    const headingY = await page.locator('h2:has-text("兩間 1T 獨立球室")').evaluate(el => el.getBoundingClientRect().top)
    expect(headingY).toBeGreaterThanOrEqual(64) // navbar is 64px on phone

    // 2. Check tabs scroll behavior
    const tabs = page.locator('[data-tab]')
    const tabCount = await tabs.count()
    expect(tabCount).toBe(4)

    // Get initial scroll position
    const initialScrollY = await page.evaluate(() => window.scrollY)

    // Tap second tab
    await tabs.nth(1).tap()
    await page.waitForTimeout(300)

    // Check page didn't scroll
    const afterTapScrollY = await page.evaluate(() => window.scrollY)
    expect(Math.abs(afterTapScrollY - initialScrollY)).toBeLessThan(5)

    // Check tab is selected (data-active is on the parent div, not the button)
    const activeItem = page.locator('[data-active="true"]').first()
    const activeTab = await activeItem.locator('[data-tab]').textContent()
    expect(activeTab).toBe('舒適自在')

    // 3. No horizontal overflow
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth)
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1)

    // 4. All tap targets at least 44px
    const buttons = await page.locator('button').all()
    for (const btn of buttons) {
      const box = await btn.boundingBox()
      if (box) {
        expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(44)
      }
    }

    // Screenshot
    await page.screenshot({ path: 'test-results/room-viewer-phone-396.png', fullPage: false })

    await context.close()
  })

  test('iPad 1180x820 - Tablet verification', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 1180, height: 820 },
      isMobile: true,
      hasTouch: true
    })
    const page = await context.newPage()

    await page.goto(`${baseURL}/venue`, { waitUntil: 'networkidle', timeout: 60000 })
    await page.waitForTimeout(2000)

    await page.locator('text=兩間 1T 獨立球室').scrollIntoViewIfNeeded()
    await page.waitForTimeout(500)

    // Check component renders
    const scenes = await page.locator('[data-scene]').count()
    expect(scenes).toBe(4)

    // Screenshot
    await page.screenshot({ path: 'test-results/room-viewer-ipad-1180.png', fullPage: false })

    await context.close()
  })

  test('No auto-scroll after 8 seconds', async ({ page }) => {
    await page.goto(`${baseURL}/venue`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(2000)

    await page.locator('text=兩間 1T 獨立球室').scrollIntoViewIfNeeded()
    await page.waitForTimeout(500)

    const initialScrollY = await page.evaluate(() => window.scrollY)
    const initialURL = page.url()

    // Wait 8 seconds
    await page.waitForTimeout(8000)

    const finalScrollY = await page.evaluate(() => window.scrollY)
    const finalURL = page.url()

    expect(finalScrollY).toBe(initialScrollY)
    expect(finalURL).toBe(initialURL)
  })

  test('Visible text matches data file', async ({ page }) => {
    await page.goto(`${baseURL}/venue`, { waitUntil: 'networkidle' })
    await page.locator('text=兩間 1T 獨立球室').scrollIntoViewIfNeeded()

    const tabs = await page.locator('[data-tab]').allTextContents()

    // Expected from room-viewer.data.ts
    expect(tabs).toEqual(['場地裝修', '舒適自在', '專業設備', '科技體驗敬請期待'])
  })
})
