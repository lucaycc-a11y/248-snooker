/**
 * Venue Room Viewer Hotfix — Step 1 Diagnostic Tests
 * Evidence collection for: i18n keys, broken images, auto-scrolling, jank
 */

import { test, expect } from '@playwright/test'

test.describe('Venue Room Viewer — Diagnostic Evidence', () => {
  test.beforeEach(async ({ page }) => {
    // Production build test
    await page.goto('/zh-HK/venue')
    await page.waitForLoadState('networkidle')
  })

  test('A. i18n — Raw keys visible', async ({ page }) => {
    const roomSection = page.locator('section').filter({ hasText: '兩間 1T 獨立球室' })
    await roomSection.scrollIntoViewIfNeeded()
    await page.waitForTimeout(500)

    // Check for doubled venue.rooms prefix
    const rawKeyPattern = /venue\.rooms\.venue\.rooms\./
    const bodyText = await page.textContent('body')

    console.log('=== A. i18n Diagnostic ===')
    console.log('1. Raw keys found:', rawKeyPattern.test(bodyText || ''))

    // List all raw keys visible
    const allText = await page.locator('text=/venue\\.rooms\\./').allTextContents()
    console.log('2. Raw key instances:', allText.slice(0, 10))

    // Check specific pills
    const pills = await page.locator('[role="tab"]').all()
    for (const pill of pills) {
      const text = await pill.textContent()
      console.log('   Pill text:', text?.substring(0, 80))
    }
  })

  test('B. Images — Broken image evidence', async ({ page }) => {
    const roomSection = page.locator('section').filter({ hasText: '兩間 1T 獨立球室' })
    await roomSection.scrollIntoViewIfNeeded()
    await page.waitForTimeout(1000)

    console.log('\n=== B. Image Diagnostic ===')

    // Find stage images
    const stageImages = await page.locator('img[alt*="Space Infinity"], img[alt*="Space Eternity"]').all()

    for (const img of stageImages) {
      const src = await img.getAttribute('src')
      const alt = await img.getAttribute('alt')
      const naturalWidth = await img.evaluate((el: HTMLImageElement) => el.naturalWidth)
      const naturalHeight = await img.evaluate((el: HTMLImageElement) => el.naturalHeight)
      const complete = await img.evaluate((el: HTMLImageElement) => el.complete)

      console.log(`Image: ${src?.substring(0, 80)}`)
      console.log(`  Alt: ${alt?.substring(0, 60)}`)
      console.log(`  naturalWidth: ${naturalWidth}, naturalHeight: ${naturalHeight}`)
      console.log(`  complete: ${complete}`)
      console.log(`  Status: ${naturalWidth > 0 ? '✓ LOADED' : '✗ BROKEN'}`)
      console.log('')
    }

    // Check if broken image icon or alt text is visible on stage
    const altTextVisible = await page.locator('text=/Space (Infinity|Eternity).*新蒲崗/').isVisible().catch(() => false)
    console.log(`Alt text visible on stage: ${altTextVisible}`)
  })

  test('C. Auto-scrolling — 15s observation', async ({ page, context }) => {
    // Track scroll calls and position changes
    const scrollEvents: Array<{ type: string; scrollY: number; timestamp: number; stack?: string }> = []
    const startTime = Date.now()

    await page.goto('/zh-HK/venue')

    // Instrument scroll tracking
    await page.evaluate(() => {
      const originalScrollTo = window.scrollTo
      const originalScrollBy = window.scrollBy
      const originalScroll = window.scroll

      window.scrollTo = function(...args: any[]) {
        (window as any).__scrollCalled = { type: 'scrollTo', args, stack: new Error().stack }
        return originalScrollTo.apply(this, args as any)
      }

      window.scrollBy = function(...args: any[]) {
        (window as any).__scrollCalled = { type: 'scrollBy', args, stack: new Error().stack }
        return originalScrollBy.apply(this, args as any)
      }

      window.scroll = function(...args: any[]) {
        (window as any).__scrollCalled = { type: 'scroll', args, stack: new Error().stack }
        return originalScroll.apply(this, args as any)
      }
    })

    const roomSection = page.locator('section').filter({ hasText: '兩間 1T 獨立球室' })
    await roomSection.scrollIntoViewIfNeeded()

    const initialScrollY = await page.evaluate(() => window.scrollY)
    console.log('\n=== C. Auto-scroll Diagnostic ===')
    console.log(`Initial scrollY: ${initialScrollY}`)

    // Observe for 15 seconds with NO user input
    for (let i = 0; i < 15; i++) {
      await page.waitForTimeout(1000)
      const scrollY = await page.evaluate(() => window.scrollY)
      const scrollCall = await page.evaluate(() => (window as any).__scrollCalled)

      if (scrollCall) {
        scrollEvents.push({
          type: scrollCall.type,
          scrollY,
          timestamp: Date.now() - startTime,
          stack: scrollCall.stack?.split('\n').slice(0, 3).join('\n')
        })
        await page.evaluate(() => { delete (window as any).__scrollCalled })
      }

      if (i % 3 === 0) {
        console.log(`  ${i}s: scrollY=${scrollY} (delta: ${scrollY - initialScrollY})`)
      }
    }

    const finalScrollY = await page.evaluate(() => window.scrollY)
    console.log(`Final scrollY: ${finalScrollY} (total delta: ${finalScrollY - initialScrollY})`)
    console.log(`Scroll event count: ${scrollEvents.length}`)

    if (scrollEvents.length > 0) {
      console.log('\nScroll events captured:')
      scrollEvents.forEach((evt, idx) => {
        console.log(`  ${idx + 1}. [${evt.timestamp}ms] ${evt.type} → scrollY=${evt.scrollY}`)
        if (evt.stack) {
          console.log(`     Stack: ${evt.stack}`)
        }
      })
    }
  })

  test('D. Technology panel — Layout diagnostic', async ({ page }) => {
    await page.goto('/zh-HK/venue')
    const roomSection = page.locator('section').filter({ hasText: '兩間 1T 獨立球室' })
    await roomSection.scrollIntoViewIfNeeded()

    // Click technology pill
    await page.locator('[role="tab"]').filter({ hasText: /科技|technology/ }).click()
    await page.waitForTimeout(500)

    console.log('\n=== D. Technology Panel Diagnostic ===')

    // Check for raw keys
    const panelText = await page.locator('[role="tabpanel"]').filter({ has: page.locator('text=/科技|technology/i') }).textContent()
    const hasRawKeys = /venue\.rooms\./.test(panelText || '')
    console.log(`1. Raw keys in panel: ${hasRawKeys}`)
    console.log(`   Panel text preview: ${panelText?.substring(0, 200)}`)

    // iPad size
    const ipadImg = page.locator('img[alt*="iPad"], img[alt*="Space Pilot"]')
    const ipadBox = await ipadImg.boundingBox().catch(() => null)
    const stageBox = await ipadImg.locator('..').locator('..').boundingBox().catch(() => null)

    if (ipadBox && stageBox) {
      const widthRatio = ipadBox.width / stageBox.width
      console.log(`2. iPad width: ${ipadBox.width}px, stage width: ${stageBox.width}px`)
      console.log(`   Ratio: ${(widthRatio * 100).toFixed(1)}% (spec: 52% desktop, 64% mobile)`)
    }

    // Panel overflow check
    const panelOverflow = await page.evaluate(() => {
      const panel = document.querySelector('[role="tabpanel"]')
      if (!panel) return null
      return {
        scrollWidth: panel.scrollWidth,
        clientWidth: panel.clientWidth,
        overflow: panel.scrollWidth > panel.clientWidth
      }
    })
    console.log(`3. Panel overflow: ${JSON.stringify(panelOverflow)}`)
  })
})
