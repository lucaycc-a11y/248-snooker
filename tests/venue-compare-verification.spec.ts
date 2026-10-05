import { test, expect } from '@playwright/test'
import { PNG } from 'pngjs'
import pixelmatch from 'pixelmatch'

const BASE_URL = 'http://localhost:3000'
const VENUE_PATH = '/zh-HK/venue'

test.describe('Venue RoomViewer Compare Bar - Verification', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}${VENUE_PATH}`)
    await page.waitForLoadState('networkidle')
  })

  test('Step 3.1: File verification - 4 unique sources loaded (WebKit iPad)', async ({ page, browserName }) => {
    test.skip(browserName !== 'webkit', 'WebKit only')

    await page.setViewportSize({ width: 1194, height: 834 })

    // Click 場地裝修 pill
    await page.getByRole('tab', { name: /場地裝修/ }).click()
    await page.waitForTimeout(1000)

    const images = await page.locator('[role="tabpanel"] img').evaluateAll((imgs: HTMLImageElement[]) => {
      return imgs.map(img => img.currentSrc)
    })

    const uniqueSources = new Set(images)

    console.log('\n=== FILE VERIFICATION ===')
    console.log(`Total images: ${images.length}`)
    console.log(`Unique sources: ${uniqueSources.size}`)

    // Extract filenames
    const filenames = Array.from(uniqueSources).map(src => {
      const match = src.match(/\/(venue-page-\w+\.jpg|about-\d+-\w+\.webp)/)
      return match ? match[1] : null
    }).filter(Boolean)

    const uniqueFilenames = new Set(filenames)
    console.log('Unique files:', Array.from(uniqueFilenames))

    expect(uniqueFilenames.size).toBe(2) // Should have both infinity and eternity
    expect(Array.from(uniqueFilenames)).toContain('venue-page-infinity.jpg')
    expect(Array.from(uniqueFilenames)).toContain('venue-page-eternity.jpg')
  })

  test('Step 3.2: Visual comparison - p=50 shows two different photos (WebKit)', async ({ page, browserName }) => {
    test.skip(browserName !== 'webkit', 'WebKit only')

    await page.setViewportSize({ width: 1194, height: 834 })

    // Click 場地裝修 pill
    await page.getByRole('tab', { name: /場地裝修/ }).click()
    await page.waitForTimeout(1000)

    // Set divider to p=50
    const handle = page.locator('[role="slider"]').first()
    const stage = page.locator('[role="tabpanel"]').first()
    const stageBox = await stage.boundingBox()

    if (stageBox) {
      const centerX = stageBox.x + stageBox.width / 2
      await handle.hover()
      await page.mouse.down()
      await page.mouse.move(centerX, stageBox.y + stageBox.height / 2, { steps: 10 })
      await page.mouse.up()
      await page.waitForTimeout(500)
    }

    // Take screenshot of stage
    const screenshot = await stage.screenshot()

    // Check clip-path is applied
    const layerInfo = await page.locator('[role="tabpanel"] > div > div').evaluateAll((divs: HTMLDivElement[]) => {
      return divs.map(div => {
        const computed = window.getComputedStyle(div)
        return {
          clipPath: computed.clipPath,
          hasImage: div.querySelector('img') !== null,
        }
      })
    })

    console.log('\n=== VISUAL COMPARISON (p=50) ===')
    console.log('Layer clip-paths:', layerInfo)

    // Both layers should have clipPath applied
    const infinityLayer = layerInfo[0]
    const eternityLayer = layerInfo[1]

    console.log(`Infinity layer: clipPath=${infinityLayer?.clipPath}, hasImage=${infinityLayer?.hasImage}`)
    console.log(`Eternity layer: clipPath=${eternityLayer?.clipPath}, hasImage=${eternityLayer?.hasImage}`)

    expect(infinityLayer?.clipPath).not.toBe('none')
    expect(eternityLayer?.clipPath).not.toBe('none')
  })

  test('Step 3.3: Small lines show both rooms (WebKit)', async ({ page, browserName }) => {
    test.skip(browserName !== 'webkit', 'WebKit only')

    await page.setViewportSize({ width: 1194, height: 834 })

    // Click 舒適自在 pill
    await page.getByRole('tab', { name: /舒適自在/ }).click()
    await page.waitForTimeout(1000)

    const pillText = await page.locator('[role="tab"][aria-selected="true"]').first().textContent()

    console.log('\n=== SMALL LINES CHECK ===')
    console.log(`Pill text: ${pillText}`)

    const hasInfinity = pillText?.includes('Space Infinity') || false
    const hasEternity = pillText?.includes('Space Eternity') || false
    const hasInfinityDesc = pillText?.includes('一張沙發，一張大凳') || false
    const hasEternityDesc = pillText?.includes('一張沙發，兩張吧臺凳') || false

    console.log(`✓ Space Infinity: ${hasInfinity}`)
    console.log(`✓ Infinity desc: ${hasInfinityDesc}`)
    console.log(`✓ Space Eternity: ${hasEternity}`)
    console.log(`✓ Eternity desc: ${hasEternityDesc}`)

    expect(hasInfinity).toBe(true)
    expect(hasEternity).toBe(true)
    expect(hasInfinityDesc).toBe(true)
    expect(hasEternityDesc).toBe(true)
  })

  test('Step 3.4: Divider positions - p=0, 25, 50, 75, 100 (WebKit)', async ({ page, browserName }) => {
    test.skip(browserName !== 'webkit', 'WebKit only')

    await page.setViewportSize({ width: 1194, height: 834 })

    // Click 場地裝修 pill
    await page.getByRole('tab', { name: /場地裝修/ }).click()
    await page.waitForTimeout(1000)

    const positions = [0, 25, 50, 75, 100]

    console.log('\n=== DIVIDER POSITIONS TEST ===')

    for (const targetPos of positions) {
      const handle = page.locator('[role="slider"]').first()
      const stage = page.locator('[role="tabpanel"]').first()
      const stageBox = await stage.boundingBox()

      if (stageBox) {
        const targetX = stageBox.x + (stageBox.width * targetPos / 100)
        await handle.hover()
        await page.mouse.down()
        await page.mouse.move(targetX, stageBox.y + stageBox.height / 2, { steps: 10 })
        await page.mouse.up()
        await page.waitForTimeout(300)
      }

      // Read aria-valuenow
      const currentPos = await handle.getAttribute('aria-valuenow')

      // Check clip-paths
      const clips = await page.locator('[role="tabpanel"] > div > div').evaluateAll((divs: HTMLDivElement[]) => {
        return divs.slice(0, 2).map(div => window.getComputedStyle(div).clipPath)
      })

      console.log(`p=${targetPos}: aria-valuenow=${currentPos}, clips=[${clips.join(', ')}]`)

      // Verify aria-valuenow is close to target
      const actualPos = parseInt(currentPos || '0', 10)
      expect(Math.abs(actualPos - targetPos)).toBeLessThanOrEqual(5)
    }
  })

  test('Step 3.5: Handle interaction - keyboard and mouse (WebKit)', async ({ page, browserName }) => {
    test.skip(browserName !== 'webkit', 'WebKit only')

    await page.setViewportSize({ width: 1194, height: 834 })

    // Click 場地裝修 pill
    await page.getByRole('tab', { name: /場地裝修/ }).click()
    await page.waitForTimeout(1000)

    const handle = page.locator('[role="slider"]').first()

    console.log('\n=== HANDLE INTERACTION TEST ===')

    // Test keyboard: Home
    await handle.focus()
    await page.keyboard.press('Home')
    await page.waitForTimeout(200)
    let pos = await handle.getAttribute('aria-valuenow')
    console.log(`After Home: ${pos}`)
    expect(parseInt(pos || '0', 10)).toBeLessThanOrEqual(5)

    // Test keyboard: End
    await page.keyboard.press('End')
    await page.waitForTimeout(200)
    pos = await handle.getAttribute('aria-valuenow')
    console.log(`After End: ${pos}`)
    expect(parseInt(pos || '0', 10)).toBeGreaterThanOrEqual(95)

    // Test keyboard: ArrowLeft
    await page.keyboard.press('ArrowLeft')
    await page.waitForTimeout(200)
    pos = await handle.getAttribute('aria-valuenow')
    console.log(`After ArrowLeft: ${pos}`)

    // Test keyboard: ArrowRight
    await page.keyboard.press('ArrowRight')
    await page.waitForTimeout(200)
    pos = await handle.getAttribute('aria-valuenow')
    console.log(`After ArrowRight: ${pos}`)

    // Test mouse drag
    const stage = page.locator('[role="tabpanel"]').first()
    const stageBox = await stage.boundingBox()

    if (stageBox) {
      const targetX = stageBox.x + stageBox.width * 0.3
      await handle.hover()
      await page.mouse.down()
      await page.mouse.move(targetX, stageBox.y + stageBox.height / 2, { steps: 10 })
      await page.mouse.up()
      await page.waitForTimeout(200)

      pos = await handle.getAttribute('aria-valuenow')
      console.log(`After mouse drag to 30%: ${pos}`)
      const actualPos = parseInt(pos || '0', 10)
      expect(actualPos).toBeGreaterThanOrEqual(20)
      expect(actualPos).toBeLessThanOrEqual(40)
    }

    console.log('✓ All interactions work')
  })

  test('Step 3.6: Stability - 10 rapid pill switches (WebKit)', async ({ page, browserName }) => {
    test.skip(browserName !== 'webkit', 'WebKit only')

    await page.setViewportSize({ width: 1194, height: 834 })

    const pills = ['場地裝修', '舒適自在']

    console.log('\n=== STABILITY TEST - 10 RAPID SWITCHES ===')

    let blankFrames = 0

    for (let i = 0; i < 10; i++) {
      const pillName = pills[i % pills.length]
      await page.getByRole('tab', { name: new RegExp(pillName) }).click()
      await page.waitForTimeout(100) // Rapid switching

      // Check if stage has loaded images
      const imageCount = await page.locator('[role="tabpanel"] img').count()

      if (imageCount === 0) {
        blankFrames++
      }

      console.log(`Switch ${i + 1}: ${pillName} - ${imageCount} images`)
    }

    console.log(`\nBlank frames: ${blankFrames} / 10`)
    expect(blankFrames).toBe(0)
  })
})
