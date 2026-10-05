import { test, expect } from '@playwright/test'

/**
 * Simple screenshot test to verify what's actually rendering
 */

test.describe('Venue RoomViewer Screenshot Test', () => {
  test('Screenshot 場地裝修 pill to see what renders', async ({ page }) => {
    await page.goto('http://localhost:3000/zh-HK/venue')
    await page.setViewportSize({ width: 1194, height: 834 })

    // Wait for page load
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(3000)

    console.log('\n=== SCREENSHOT TEST ===')

    // Get page HTML structure
    const stageExists = await page.locator('[role="tabpanel"]').count()
    console.log(`Stage panels found: ${stageExists}`)

    const pillsCount = await page.locator('button[role="tab"]').count()
    console.log(`Pills found: ${pillsCount}`)

    // Check if 場地裝修 is already active
    const activePill = await page.locator('button[role="tab"][aria-selected="true"]').first().textContent()
    console.log(`Active pill: "${activePill}"`)

    // Take screenshot of full page
    await page.screenshot({ path: 'test-results/venue-before-click.png', fullPage: true })
    console.log('Screenshot saved: venue-before-click.png')

    // Click 場地裝修 if not active
    if (!activePill?.includes('場地裝修')) {
      const renovationPill = page.locator('button[role="tab"]').filter({ hasText: '場地裝修' }).first()
      await renovationPill.click()
      await page.waitForTimeout(1000)
      console.log('Clicked 場地裝修 pill')
    }

    // Get stage panel HTML
    const stageHTML = await page.locator('[role="tabpanel"]').first().innerHTML()
    console.log('\n=== STAGE HTML (first 500 chars) ===')
    console.log(stageHTML.substring(0, 500))

    // Count all img tags
    const allImages = await page.locator('img').count()
    console.log(`\nTotal img tags on page: ${allImages}`)

    // Count images in stage
    const stageImages = await page.locator('[role="tabpanel"]').first().locator('img').count()
    console.log(`Images in stage panel: ${stageImages}`)

    // Take screenshot after click
    await page.screenshot({ path: 'test-results/venue-after-click.png', fullPage: true })
    console.log('\nScreenshot saved: venue-after-click.png')

    // Get all image src attributes in stage
    const imageSrcs = await page.locator('[role="tabpanel"]').first().locator('img').evaluateAll((images) => {
      return images.map((img: any) => ({
        src: img.src,
        currentSrc: img.currentSrc,
        alt: img.alt,
        width: img.naturalWidth,
        height: img.naturalHeight,
      }))
    })

    console.log('\n=== IMAGES IN STAGE ===')
    console.log(JSON.stringify(imageSrcs, null, 2))
  })
})
