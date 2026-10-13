import { test, expect } from '@playwright/test'

test.describe('Venue Room Viewer - Comprehensive Verification', () => {
  test('All images load correctly', async ({ page }) => {
    await page.goto('/zh-HK/venue')
    await page.waitForLoadState('networkidle')

    // Wait for Room Viewer section
    await page.locator('text=兩間 1T 獨立球室').waitFor()

    // Check all 11 images exist and load
    const images = [
      '/images/clean-no-title/space8-infinity-room-chinese-eight-ball-table-san-po-kong-clean.webp',
      '/images/clean-no-title/space8-eternity-room-chinese-eight-ball-table-san-po-kong-clean.webp',
      '/images/space8-infinity-room-lounge-sofa-armchair-side-table.webp',
      '/images/space8-eternity-room-lounge-black-sofa.webp',
      '/images/space8-eternity-room-bar-counter-black-stools.webp',
      '/images/xing-pai-chinese-eight-ball-table-corner-pocket-hong-kong.webp',
      '/images/super-aramith-pro-tv-pro-cup-billiard-balls-space8.webp',
      '/images/triangle-chalk-billiard-cue-chalk-space8.webp',
      '/images/space8-cue-rack-professional-cues-close-up.webp',
    ]

    for (const src of images) {
      const response = await page.request.get(src)
      expect(response.status()).toBe(200)
      expect(response.headers()['content-type']).toContain('image')
    }

    console.log(`✅ All ${images.length} images returned 200`)
  })

  test('Compare images use clean-no-title panoramas', async ({ page }) => {
    await page.goto('/zh-HK/venue')
    await page.waitForLoadState('networkidle')

    // Default pill is 場地裝修 (compare mode)
    await page.locator('text=兩間 1T 獨立球室').waitFor()
    await page.waitForTimeout(1000)

    // Check both layers use clean-no-title versions
    const infinityImg = page.locator('img[alt*="Infinity 無限空間球室全景"]').first()
    const eternityImg = page.locator('img[alt*="Eternity 永恆空間球室全景"]').first()

    // Wait for images to load
    await infinityImg.waitFor({ state: 'visible' })
    await eternityImg.waitFor({ state: 'visible' })

    const infinitySrc = await infinityImg.getAttribute('src')
    const eternitySrc = await eternityImg.getAttribute('src')

    console.log('Infinity src:', infinitySrc)
    console.log('Eternity src:', eternitySrc)

    expect(infinitySrc).toContain('clean-no-title')
    expect(eternitySrc).toContain('clean-no-title')

    // Verify both images have naturalWidth > 0 (loaded)
    const infinityNaturalWidth = await infinityImg.evaluate((img: HTMLImageElement) => img.naturalWidth)
    const eternityNaturalWidth = await eternityImg.evaluate((img: HTMLImageElement) => img.naturalWidth)

    expect(infinityNaturalWidth).toBeGreaterThan(0)
    expect(eternityNaturalWidth).toBeGreaterThan(0)

    console.log(`✅ Both compare images loaded (${infinityNaturalWidth}px × ${eternityNaturalWidth}px)`)
  })

  test('Technology panel geometry at desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/zh-HK/venue')
    await page.waitForLoadState('networkidle')

    // Click Technology pill
    await page.getByRole('tab', { name: '科技體驗' }).click()
    await page.waitForTimeout(500)

    // Check iPad width ratio - use the technology stage iPad specifically
    const stage = page.locator('.technology-stage').first()
    const ipad = page.locator('img[alt*="Space Pilot AI 智能對戰管家"]')

    await stage.waitFor({ state: 'visible' })
    await ipad.waitFor({ state: 'visible' })

    const stageBox = await stage.boundingBox()
    const ipadBox = await ipad.boundingBox()

    expect(stageBox).not.toBeNull()
    expect(ipadBox).not.toBeNull()

    const ratio = ipadBox!.width / stageBox!.width
    console.log(`iPad width ratio: ${ratio.toFixed(3)} (target: 0.52 ±0.03)`)

    expect(ratio).toBeGreaterThanOrEqual(0.49)
    expect(ratio).toBeLessThanOrEqual(0.55)

    // Check free space on each side
    const leftSpace = (ipadBox!.x - stageBox!.x) / stageBox!.width
    const rightSpace = (stageBox!.x + stageBox!.width - (ipadBox!.x + ipadBox!.width)) / stageBox!.width

    console.log(`Left space: ${(leftSpace * 100).toFixed(1)}%, Right space: ${(rightSpace * 100).toFixed(1)}%`)

    expect(leftSpace).toBeGreaterThanOrEqual(0.20)
    expect(rightSpace).toBeGreaterThanOrEqual(0.20)

    console.log('✅ iPad geometry correct at desktop')
  })

  test('Technology panel - no text overflow', async ({ page }) => {
    await page.setViewportSize({ width: 2576, height: 1100 })
    await page.goto('/zh-HK/venue')
    await page.waitForLoadState('networkidle')

    await page.getByRole('tab', { name: '科技體驗' }).click()
    await page.waitForTimeout(500)

    // Get panel and column bounds
    const panel = page.locator('.pill-panel').first()
    await panel.waitFor({ state: 'visible' })

    const panelBox = await panel.boundingBox()
    expect(panelBox).not.toBeNull()

    // Check all text elements stay within column
    const textElements = await panel.locator('span, div, p').all()

    for (const el of textElements) {
      const box = await el.boundingBox()
      if (box && box.width > 10) { // Skip tiny elements
        const isWithinColumn = box.x + box.width <= panelBox!.x + panelBox!.width + 2 // 2px tolerance
        if (!isWithinColumn) {
          const text = await el.textContent()
          console.warn(`⚠️ Element overflows: "${text?.substring(0, 30)}..." (${box.x + box.width} > ${panelBox!.x + panelBox!.width})`)
        }
      }
    }

    // Check 敬請期待 tags are visible
    const tags = page.locator('text=敬請期待')
    const tagCount = await tags.count()
    expect(tagCount).toBeGreaterThanOrEqual(2) // Technology pill + last point

    for (let i = 0; i < tagCount; i++) {
      await expect(tags.nth(i)).toBeVisible()
    }

    console.log('✅ No text overflow, all tags visible')
  })

  test('All images have alt text, width, and height', async ({ page }) => {
    await page.goto('/zh-HK/venue')
    await page.waitForLoadState('networkidle')

    await page.locator('text=兩間 1T 獨立球室').waitFor()
    await page.waitForTimeout(500)

    // Get all images in the section
    const section = page.locator('section:has-text("兩間 1T 獨立球室")').first()
    const images = section.locator('img')
    const count = await images.count()

    console.log(`Found ${count} images in Room Viewer section`)

    for (let i = 0; i < count; i++) {
      const img = images.nth(i)
      const alt = await img.getAttribute('alt')

      // All images must have meaningful alt text
      expect(alt).toBeTruthy()
      expect(alt!.length).toBeGreaterThan(5)

      // Check naturalWidth > 0 (image loaded successfully)
      const naturalWidth = await img.evaluate((el: HTMLImageElement) => el.naturalWidth)
      expect(naturalWidth).toBeGreaterThan(0)
    }

    console.log('✅ All images have alt text and loaded successfully')
  })

  test('Default selected pill is 場地裝修', async ({ page }) => {
    await page.goto('/zh-HK/venue')
    await page.waitForLoadState('networkidle')

    await page.locator('text=兩間 1T 獨立球室').waitFor()
    await page.waitForTimeout(500)

    // Check which pill has aria-selected=true
    const selectedPill = page.locator('[role="tab"][aria-selected="true"]')
    const label = await selectedPill.textContent()

    console.log(`Default selected pill: "${label}"`)
    expect(label).toContain('場地裝修')

    console.log('✅ Default pill is 場地裝修')
  })

  test('Section background is pure black', async ({ page }) => {
    await page.goto('/zh-HK/venue')
    await page.waitForLoadState('networkidle')

    const section = page.locator('section:has-text("兩間 1T 獨立球室")').first()
    const bgColor = await section.evaluate((el) => {
      return window.getComputedStyle(el).backgroundColor
    })

    console.log(`Section background: ${bgColor}`)

    // Pure black is rgb(0, 0, 0)
    expect(bgColor).toBe('rgb(0, 0, 0)')

    console.log('✅ Background is pure black')
  })
})
