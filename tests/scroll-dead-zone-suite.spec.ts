/**
 * Scroll Dead Zone Diagnostic Suite
 *
 * Reproduces iPad Safari scroll issues from screen recording evidence:
 * 1. Home flow section dead zone (grey blank screen ~1.5s)
 * 2. Home ends before footer (如何前往 cut off)
 * 3. Venue hero black dead zone (heading missing, ~1.2s black)
 * 4. Venue RoomViewer stage blank (no photo visible)
 *
 * Plus generic regression test for all routes.
 */

import { test, expect, type Page, devices } from '@playwright/test'

// Use localhost for now, switch to production after verification
const PRODUCTION_URL = process.env.TEST_URL || 'http://localhost:3000'

// iPad Safari configuration (must be top-level)
test.use({
  ...devices['iPad (gen 7)'],
  locale: 'zh-HK',
})

// Luminance calculation (ITU-R BT.709)
function getLuminance(r: number, g: number, b: number): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

// Compute viewport luminance stats from screenshot buffer
async function getViewportLuminanceStats(page: Page): Promise<{ mean: number; std: number }> {
  const screenshot = await page.screenshot({ type: 'png', fullPage: false })

  // Use sharp in Node.js to compute luminance
  const sharp = require('sharp')
  const { data, info } = await sharp(screenshot)
    .raw()
    .toBuffer({ resolveWithObject: true })

  const { width, height, channels } = info
  const pixelCount = width * height

  let sumLum = 0
  for (let i = 0; i < data.length; i += channels) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    sumLum += getLuminance(r, g, b)
  }

  const mean = sumLum / pixelCount

  // Compute std dev
  let sumSqDiff = 0
  for (let i = 0; i < data.length; i += channels) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    const lum = getLuminance(r, g, b)
    sumSqDiff += (lum - mean) ** 2
  }

  const std = Math.sqrt(sumSqDiff / pixelCount)

  return { mean, std }
}

// Check if viewport is "near-blank" (std < 12, ignoring deliberately empty sections)
function isNearBlank(std: number): boolean {
  return std < 12
}

test.describe('Scroll Dead Zone Diagnostics (iPad Safari)', () => {
  test('1. Home flow section dead zone', async ({ page }) => {
    test.setTimeout(90000) // 90s for image processing

    await page.goto(`${PRODUCTION_URL}/zh-HK`)
    await page.waitForLoadState('networkidle')

    // Find the flow section (Section5BookingNew)
    const flowSection = page.locator('section[data-nav-theme="light"]').first()
    await expect(flowSection).toBeVisible()

    const sectionBox = await flowSection.boundingBox()
    if (!sectionBox) throw new Error('Flow section not found')

    const sectionStart = sectionBox.y
    const sectionEnd = sectionBox.y + sectionBox.height
    const totalHeight = sectionBox.height

    console.log(`Flow section: ${sectionStart}px → ${sectionEnd}px (${totalHeight}px tall)`)

    // Sweep scrollY in 40px steps
    const deadZones: Array<{ start: number; end: number; length: number }> = []
    let deadZoneStart: number | null = null

    for (let y = sectionStart; y <= sectionEnd; y += 40) {
      await page.evaluate((scrollY) => window.scrollTo(0, scrollY), y)
      await page.waitForTimeout(30) // Reduced from 50ms

      const stats = await getViewportLuminanceStats(page)
      const blank = isNearBlank(stats.std)

      console.log(`scrollY=${y}: mean=${stats.mean.toFixed(1)}, std=${stats.std.toFixed(1)} ${blank ? '← BLANK' : ''}`)

      if (blank && deadZoneStart === null) {
        deadZoneStart = y
      } else if (!blank && deadZoneStart !== null) {
        deadZones.push({ start: deadZoneStart, end: y - 40, length: y - deadZoneStart })
        deadZoneStart = null
      }
    }

    // Close any open dead zone
    if (deadZoneStart !== null) {
      deadZones.push({ start: deadZoneStart, end: sectionEnd, length: sectionEnd - deadZoneStart })
    }

    // Report dead zones
    console.log('\nDead zones found:')
    deadZones.forEach((dz, i) => {
      console.log(`  ${i + 1}. ${dz.start}px → ${dz.end}px (${dz.length}px / ${(dz.length / 40 * 16.67).toFixed(1)}ms @ 60fps)`)
    })

    // Fail if any dead zone is longer than 160px (~0.7s at scroll speed)
    const longDeadZones = deadZones.filter((dz) => dz.length > 160)
    expect(longDeadZones).toHaveLength(0)

    // Also check pinned wrapper height, ScrollTrigger config
    const wrapHeight = await page.evaluate(() => {
      const wrap = document.querySelector('[class*="wrap"]')
      return wrap ? wrap.getBoundingClientRect().height : null
    })

    console.log(`\nPinned wrapper height: ${wrapHeight}px`)
  })

  test('2. Home ends before footer', async ({ page }) => {
    test.setTimeout(60000)

    await page.goto(`${PRODUCTION_URL}/zh-HK`)
    await page.waitForLoadState('networkidle')

    // Scroll to bottom
    const maxScroll = await page.evaluate(() => {
      const docHeight = document.documentElement.scrollHeight
      const viewportHeight = window.innerHeight
      return docHeight - viewportHeight
    })

    await page.evaluate((scrollY) => window.scrollTo(0, scrollY), maxScroll)
    await page.waitForTimeout(300) // Increased wait for animations

    // Check if footer is fully visible
    const footer = page.locator('footer')
    const footerBox = await footer.boundingBox()

    if (!footerBox) {
      throw new Error('Footer not found')
    }

    const viewportHeight = page.viewportSize()?.height || 0
    const footerVisibleHeight = Math.max(0, viewportHeight - footerBox.y)
    const footerBottom = footerBox.y + footerBox.height
    // Allow 1px tolerance for subpixel rounding
    const footerFullyVisible = footerBottom <= viewportHeight + 1

    console.log(`\nFooter diagnostics at maxScroll=${maxScroll}:`)
    console.log(`  document.scrollHeight: ${await page.evaluate(() => document.documentElement.scrollHeight)}px`)
    console.log(`  viewport height: ${viewportHeight}px`)
    console.log(`  footer.top: ${footerBox.y}px`)
    console.log(`  footer.height: ${footerBox.height}px`)
    console.log(`  footer visible height: ${footerVisibleHeight}px`)
    console.log(`  footer fully visible: ${footerFullyVisible}`)

    // Sum of all section heights
    const sectionHeights = await page.evaluate(() => {
      const sections = Array.from(document.querySelectorAll('main > section, main > div[class*="section"]'))
      return sections.reduce((sum, sec) => sum + sec.getBoundingClientRect().height, 0)
    })

    console.log(`  sum of section heights: ${sectionHeights}px`)

    // Take screenshot for evidence
    await page.screenshot({ path: 'test-results/home-footer-maxscroll.png' })

    expect(footerFullyVisible).toBe(true)
  })

  test('3. Venue hero black dead zone', async ({ page }) => {
    await page.goto(`${PRODUCTION_URL}/zh-HK/venue`)
    await page.waitForLoadState('networkidle')

    // At scroll 0, check if heading and body are visible
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.waitForTimeout(100)

    const heroHeading = page.locator('h1').first()
    const heroBody = page.locator('p').first()

    const headingVisible = await heroHeading.isVisible()
    const bodyVisible = await heroBody.isVisible()

    console.log(`\nVenue hero at scrollY=0:`)
    console.log(`  heading visible: ${headingVisible}`)
    console.log(`  body visible: ${bodyVisible}`)

    expect(headingVisible).toBe(true)
    expect(bodyVisible).toBe(true)

    // Find the hero section (CinematicOrbitHero)
    const heroSection = page.locator('section').first()
    const heroBox = await heroSection.boundingBox()

    if (!heroBox) throw new Error('Hero section not found')

    const heroStart = heroBox.y
    const heroEnd = heroBox.y + heroBox.height

    console.log(`Hero section: ${heroStart}px → ${heroEnd}px (${heroBox.height}px tall)`)

    // Sweep scrollY in 40px steps
    const deadZones: Array<{ start: number; end: number; length: number; meanLum: number }> = []
    let deadZoneStart: number | null = null
    let deadZoneLums: number[] = []

    for (let y = heroStart; y <= heroEnd && y <= 2000; y += 40) {
      await page.evaluate((scrollY) => window.scrollTo(0, scrollY), y)
      await page.waitForTimeout(50)

      const stats = await getViewportLuminanceStats(page)
      const blank = isNearBlank(stats.std)

      console.log(`scrollY=${y}: mean=${stats.mean.toFixed(1)}, std=${stats.std.toFixed(1)} ${blank ? '← BLANK' : ''}`)

      if (blank && deadZoneStart === null) {
        deadZoneStart = y
        deadZoneLums = [stats.mean]
      } else if (blank && deadZoneStart !== null) {
        deadZoneLums.push(stats.mean)
      } else if (!blank && deadZoneStart !== null) {
        const avgLum = deadZoneLums.reduce((a, b) => a + b, 0) / deadZoneLums.length
        deadZones.push({ start: deadZoneStart, end: y - 40, length: y - deadZoneStart, meanLum: avgLum })
        deadZoneStart = null
        deadZoneLums = []
      }
    }

    // Report dead zones
    console.log('\nDead zones found:')
    deadZones.forEach((dz, i) => {
      console.log(`  ${i + 1}. ${dz.start}px → ${dz.end}px (${dz.length}px, mean lum ${dz.meanLum.toFixed(1)})`)
    })

    // Fail if any dead zone is longer than 160px
    const longDeadZones = deadZones.filter((dz) => dz.length > 160)
    expect(longDeadZones).toHaveLength(0)

    // Also print hero wrapper height
    const heroWrapperHeight = await page.evaluate(() => {
      const hero = document.querySelector('section')
      return hero ? hero.getBoundingClientRect().height : null
    })

    console.log(`\nHero wrapper height: ${heroWrapperHeight}px`)
  })

  test('4. Venue RoomViewer stage blank', async ({ page }) => {
    await page.goto(`${PRODUCTION_URL}/zh-HK/venue`)
    await page.waitForLoadState('networkidle')

    // Scroll to RoomViewer section
    const roomViewer = page.locator('[role="tabpanel"]').first()
    await roomViewer.scrollIntoViewIfNeeded()
    await page.waitForTimeout(500) // Let images decode

    // Check if the stage has visible images
    const stageBox = await roomViewer.boundingBox()

    if (!stageBox) throw new Error('RoomViewer stage not found')

    console.log(`\nRoomViewer stage: ${stageBox.width}×${stageBox.height}`)

    // Take screenshot of the stage
    await roomViewer.screenshot({ path: 'test-results/venue-roomviewer-stage.png' })

    // Compute luminance stats of the stage
    const screenshot = await roomViewer.screenshot({ type: 'png' })
    const sharp = require('sharp')
    const { data, info } = await sharp(screenshot)
      .raw()
      .toBuffer({ resolveWithObject: true })

    const { width, height, channels } = info
    const pixelCount = width * height

    let sumLum = 0
    for (let i = 0; i < data.length; i += channels) {
      const r = data[i]
      const g = data[i + 1]
      const b = data[i + 2]
      sumLum += getLuminance(r, g, b)
    }

    const meanLum = sumLum / pixelCount

    let sumSqDiff = 0
    for (let i = 0; i < data.length; i += channels) {
      const r = data[i]
      const g = data[i + 1]
      const b = data[i + 2]
      const lum = getLuminance(r, g, b)
      sumSqDiff += (lum - meanLum) ** 2
    }

    const stdLum = Math.sqrt(sumSqDiff / pixelCount)

    console.log(`Stage luminance: mean=${meanLum.toFixed(1)}, std=${stdLum.toFixed(1)}`)

    // Check that fix pass 3 (decode before swap, 4:3 aspect) is live
    const hasImages = await page.evaluate(() => {
      const stage = document.querySelector('[role="tabpanel"]')
      const imgs = stage?.querySelectorAll('img')
      return imgs ? imgs.length > 0 : false
    })

    console.log(`Images present: ${hasImages}`)

    // Check aspect ratio
    const aspectRatio = stageBox.width / stageBox.height
    console.log(`Stage aspect ratio: ${aspectRatio.toFixed(2)} (expected 1.33 for 4:3)`)

    // Fail if stage is blank (mean lum < 5 or std < 12)
    expect(meanLum).toBeGreaterThan(10)
    expect(stdLum).toBeGreaterThan(12)
    expect(hasImages).toBe(true)

    // Check aspect ratio is close to 4:3
    expect(Math.abs(aspectRatio - 4/3)).toBeLessThan(0.1)
  })
})

test.describe('Generic Scroll Regression Test', () => {
  const routes = [
    '/zh-HK',
    '/zh-HK/venue',
    '/zh-HK/about',
    '/zh-HK/membership',
    '/zh-HK/book',
  ]

  for (const route of routes) {
    test(`${route} has no scroll dead zones`, async ({ page }) => {
      test.setTimeout(120000) // 2 minutes for full page scan

      await page.goto(`${PRODUCTION_URL}${route}`)
      await page.waitForLoadState('networkidle')

      const maxScroll = await page.evaluate(() => {
        const docHeight = document.documentElement.scrollHeight
        const viewportHeight = window.innerHeight
        return docHeight - viewportHeight
      })

      console.log(`\n${route}: maxScroll=${maxScroll}px`)

      // Sweep scrollY in 40px steps
      const deadZones: Array<{ start: number; end: number; length: number }> = []
      let deadZoneStart: number | null = null

      for (let y = 0; y <= maxScroll; y += 40) {
        await page.evaluate((scrollY) => window.scrollTo(0, scrollY), y)
        await page.waitForTimeout(30)

        const stats = await getViewportLuminanceStats(page)
        const blank = isNearBlank(stats.std)

        if (blank && deadZoneStart === null) {
          deadZoneStart = y
        } else if (!blank && deadZoneStart !== null) {
          deadZones.push({ start: deadZoneStart, end: y - 40, length: y - deadZoneStart })
          deadZoneStart = null
        }
      }

      // Close any open dead zone
      if (deadZoneStart !== null) {
        deadZones.push({ start: deadZoneStart, end: maxScroll, length: maxScroll - deadZoneStart })
      }

      // Report dead zones longer than 160px
      const longDeadZones = deadZones.filter((dz) => dz.length > 160)

      if (longDeadZones.length > 0) {
        console.log('Long dead zones found:')
        longDeadZones.forEach((dz, i) => {
          console.log(`  ${i + 1}. ${dz.start}px → ${dz.end}px (${dz.length}px)`)
        })
      }

      expect(longDeadZones).toHaveLength(0)

      // Check footer is reachable
      await page.evaluate((scrollY) => window.scrollTo(0, scrollY), maxScroll)
      await page.waitForTimeout(100)

      const footer = page.locator('footer')
      const footerBox = await footer.boundingBox()

      if (footerBox) {
        const viewportHeight = page.viewportSize()?.height || 0
        const footerFullyVisible = footerBox.y + footerBox.height <= viewportHeight

        console.log(`Footer fully visible at maxScroll: ${footerFullyVisible}`)
        expect(footerFullyVisible).toBe(true)
      }
    })
  }
})
