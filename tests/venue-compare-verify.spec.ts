import { test, expect } from '@playwright/test'

/**
 * Verify the compare bar fix shows different photos
 */

test.describe('Venue RoomViewer Compare Verification', () => {
  test('Verify both pills show different photos at p=50', async ({ page }) => {
    await page.goto('http://localhost:3000/zh-HK/venue')
    await page.setViewportSize({ width: 1194, height: 834 })
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    console.log('\n=== VERIFICATION TEST ===')

    // Test 場地裝修 pill
    const renovationPill = page.locator('button[role="tab"][aria-controls="panel-renovation"]')
    await renovationPill.click()
    await page.waitForTimeout(500)

    const stagePanel = page.locator('[role="tabpanel"]').first()
    const images = stagePanel.locator('img')
    const imageCount = await images.count()

    console.log(`\n場地裝修 pill: Found ${imageCount} images`)

    const imageSrcs = []
    for (let i = 0; i < imageCount; i++) {
      const currentSrc = await images.nth(i).evaluate((el: HTMLImageElement) => el.currentSrc)
      const parentClipPath = await images.nth(i).evaluate((el) => {
        const parent = el.parentElement
        return parent ? window.getComputedStyle(parent).clipPath : 'none'
      })
      const filename = currentSrc.split('url=')[1]?.split('&')[0]?.split('/').pop()

      console.log(`  Image ${i + 1}:`)
      console.log(`    File: ${filename}`)
      console.log(`    Parent clip-path: ${parentClipPath}`)

      imageSrcs.push(currentSrc)
    }

    // Verify different sources
    const uniqueSrcs = new Set(imageSrcs)
    if (uniqueSrcs.size === 2) {
      console.log('\n✓ SUCCESS: Two different images loaded')
    } else {
      console.log('\n❌ FAIL: Images have same source')
    }

    // Check if both expected files are present
    const hasInfinity = imageSrcs.some(src => src.includes('venue-page-infinity.jpg'))
    const hasEternity = imageSrcs.some(src => src.includes('venue-page-eternity.jpg'))

    console.log(`  Has Infinity: ${hasInfinity ? '✓' : '❌'}`)
    console.log(`  Has Eternity: ${hasEternity ? '✓' : '❌'}`)

    expect(imageCount).toBe(2)
    expect(hasInfinity).toBe(true)
    expect(hasEternity).toBe(true)

    // Test 舒適自在 pill
    const comfortPill = page.locator('button[role="tab"][aria-controls="panel-comfort"]')
    await comfortPill.click()
    await page.waitForTimeout(500)

    const comfortImages = stagePanel.locator('img')
    const comfortCount = await comfortImages.count()

    console.log(`\n舒適自在 pill: Found ${comfortCount} images`)

    const comfortSrcs = []
    for (let i = 0; i < comfortCount; i++) {
      const currentSrc = await comfortImages.nth(i).evaluate((el: HTMLImageElement) => el.currentSrc)
      const filename = currentSrc.split('url=')[1]?.split('&')[0]?.split('/').pop()
      console.log(`  Image ${i + 1}: ${filename}`)
      comfortSrcs.push(currentSrc)
    }

    const hasLounge = comfortSrcs.some(src => src.includes('about-06-lounge.webp'))
    const hasStools = comfortSrcs.some(src => src.includes('about-07-stools.webp'))

    console.log(`  Has Lounge (Infinity): ${hasLounge ? '✓' : '❌'}`)
    console.log(`  Has Stools (Eternity): ${hasStools ? '✓' : '❌'}`)

    expect(comfortCount).toBe(2)
    expect(hasLounge).toBe(true)
    expect(hasStools).toBe(true)
  })

  test('Visual comparison at different divider positions', async ({ page, browserName }) => {
    await page.goto('http://localhost:3000/zh-HK/venue')
    await page.setViewportSize({ width: 1194, height: 834 })
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    const renovationPill = page.locator('button[role="tab"][aria-controls="panel-renovation"]')
    await renovationPill.click()
    await page.waitForTimeout(500)

    console.log('\n=== VISUAL COMPARISON TEST ===')

    // Take screenshots at different positions
    const stageHandle = page.locator('[role="tabpanel"]').first().locator('button[role="slider"]')
    const stagePanel = page.locator('[role="tabpanel"]').first()

    for (const position of [0, 25, 50, 75, 100]) {
      // Move handle to position
      const stageBox = await stagePanel.boundingBox()
      if (stageBox) {
        const x = stageBox.x + (stageBox.width * position / 100)
        const y = stageBox.y + stageBox.height / 2
        await page.mouse.click(x, y)
        await page.waitForTimeout(300)
      }

      await page.screenshot({
        path: `test-results/compare-p${position}-${browserName}.png`,
        clip: await stagePanel.boundingBox() || undefined
      })

      console.log(`Screenshot saved at p=${position}%`)
    }

    console.log('\n✓ Visual comparison screenshots saved')
    console.log('  p=0: Should show only Eternity')
    console.log('  p=100: Should show only Infinity')
    console.log('  p=50: Should show split between both')
  })
})
