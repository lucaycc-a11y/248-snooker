import { test, expect } from '@playwright/test'
import crypto from 'crypto'
import fs from 'fs/promises'
import path from 'path'

const BASE_URL = 'http://localhost:3000'
const VENUE_PATH = '/zh-HK/venue'

// Expected file hashes
const EXPECTED_HASHES = {
  'venue-page-infinity.jpg': 'f27ab994d82a067ac9c8569edd876786ee54e7181e8361c35cc182d21c032ec5',
  'venue-page-eternity.jpg': 'b1f03c14d47444dc0f8d6d96d254dae30c906c1ab7bc429b85fe2150076c8697',
  'about-06-lounge.webp': '498b39465bb0dbb4be82dc5a4f761f62b666b7811d16b19709d011602604f2ad',
  'about-07-stools.webp': '80db89331dd1605f5c50318e244722d69f6d9b4ff7e882a15132dc4ff77dc141',
}

test.describe('Venue RoomViewer Compare Bar - Diagnosis', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}${VENUE_PATH}`)
    await page.waitForLoadState('networkidle')
  })

  test('Step 1a: Layer inspection - 場地裝修 pill at p=50 (WebKit iPad)', async ({ page, browserName }) => {
    test.skip(browserName !== 'webkit', 'WebKit only')

    await page.setViewportSize({ width: 1194, height: 834 })

    // Click 場地裝修 pill
    await page.getByRole('tab', { name: /場地裝修/ }).click()
    await page.waitForTimeout(1000)

    // Find all images in the stage
    const stageImages = await page.locator('[role="tabpanel"] img').all()

    console.log('\n=== 場地裝修 PILL - LAYER INSPECTION (p=50) ===')
    console.log(`Found ${stageImages.length} image elements`)

    for (let i = 0; i < stageImages.length; i++) {
      const img = stageImages[i]
      const src = await img.getAttribute('src')
      const currentSrc = await img.evaluate((el: HTMLImageElement) => el.currentSrc)
      const naturalWidth = await img.evaluate((el: HTMLImageElement) => el.naturalWidth)
      const naturalHeight = await img.evaluate((el: HTMLImageElement) => el.naturalHeight)
      const box = await img.boundingBox()

      const styles = await img.evaluate((el) => {
        const computed = window.getComputedStyle(el)
        const parent = el.parentElement
        const parentComputed = parent ? window.getComputedStyle(parent) : null
        return {
          clipPath: computed.clipPath,
          zIndex: computed.zIndex,
          opacity: computed.opacity,
          willChange: computed.willChange,
          transform: computed.transform,
          parentClipPath: parentComputed?.clipPath || 'none',
        }
      })

      console.log(`\nImage ${i + 1}:`)
      console.log(`  src: ${src}`)
      console.log(`  currentSrc: ${currentSrc}`)
      console.log(`  naturalSize: ${naturalWidth} × ${naturalHeight}`)
      console.log(`  clipPath: ${styles.clipPath}`)
      console.log(`  parent clipPath: ${styles.parentClipPath}`)
      console.log(`  zIndex: ${styles.zIndex}`)
      console.log(`  opacity: ${styles.opacity}`)
      console.log(`  willChange: ${styles.willChange}`)
      console.log(`  transform: ${styles.transform}`)
      console.log(`  boundingBox: ${JSON.stringify(box)}`)
    }
  })

  test('Step 1b: File hash verification', async () => {
    const publicDir = path.join(process.cwd(), 'public', 'images')

    console.log('\n=== FILE HASH VERIFICATION ===')

    const files = [
      { name: 'venue-page-infinity.jpg', path: path.join(publicDir, 'venue-page-infinity.jpg') },
      { name: 'venue-page-eternity.jpg', path: path.join(publicDir, 'venue-page-eternity.jpg') },
      { name: 'about-06-lounge.webp', path: path.join(publicDir, 'space8-about-photos', 'images', 'about-06-lounge.webp') },
      { name: 'about-07-stools.webp', path: path.join(publicDir, 'space8-about-photos', 'images', 'about-07-stools.webp') },
    ]

    const hashes: string[] = []

    for (const file of files) {
      const buffer = await fs.readFile(file.path)
      const hash = crypto.createHash('sha256').update(buffer).digest('hex')
      hashes.push(hash)

      const expected = EXPECTED_HASHES[file.name as keyof typeof EXPECTED_HASHES]
      const match = hash === expected ? '✓' : '✗'

      console.log(`${match} ${file.name}:`)
      console.log(`  Actual:   ${hash}`)
      console.log(`  Expected: ${expected}`)
    }

    // Verify all hashes are unique
    const uniqueHashes = new Set(hashes)
    console.log(`\nUnique hashes: ${uniqueHashes.size} / ${hashes.length}`)
    expect(uniqueHashes.size).toBe(4)
  })

  test('Step 1c: Root cause - Check data mapping and loading', async ({ page, browserName }) => {
    test.skip(browserName !== 'webkit', 'WebKit only')

    await page.setViewportSize({ width: 1194, height: 834 })

    console.log('\n=== ROOT CAUSE INVESTIGATION ===')

    // Click 場地裝修 pill
    await page.getByRole('tab', { name: /場地裝修/ }).click()
    await page.waitForTimeout(1000)

    // Get all currentSrc values
    const currentSrcs = await page.locator('[role="tabpanel"] img').evaluateAll((images: HTMLImageElement[]) => {
      return images.map(img => ({
        currentSrc: img.currentSrc,
        src: img.src,
        complete: img.complete,
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
      }))
    })

    console.log('Images loaded:')
    currentSrcs.forEach((img, i) => {
      console.log(`  ${i + 1}. ${img.currentSrc}`)
      console.log(`     complete: ${img.complete}, size: ${img.naturalWidth}×${img.naturalHeight}`)
    })

    // Check for duplicates
    const srcSet = new Set(currentSrcs.map(img => img.currentSrc))
    if (srcSet.size < currentSrcs.length) {
      console.log('\n⚠️  DUPLICATE currentSrc DETECTED!')
      console.log(`   Found ${currentSrcs.length} images but only ${srcSet.size} unique sources`)
    } else {
      console.log(`\n✓ All ${currentSrcs.length} images have unique sources`)
    }

    // Check if "SPACE" text appears in stage (baked-in title)
    const stageText = await page.locator('[role="tabpanel"]').textContent()
    const hasSpaceText = stageText?.includes('SPACE INFINITY') || stageText?.includes('SPACE ETERNITY')
    console.log(`\nBaked-in title check: ${hasSpaceText ? 'Text found in DOM (may be overlay)' : 'No "SPACE" text in DOM'}`)
  })

  test('Step 1d: Divider position test - p=25, 50, 75 (WebKit)', async ({ page, browserName }) => {
    test.skip(browserName !== 'webkit', 'WebKit only')

    await page.setViewportSize({ width: 1194, height: 834 })

    // Click 場地裝修 pill
    await page.getByRole('tab', { name: /場地裝修/ }).click()
    await page.waitForTimeout(1000)

    const positions = [25, 50, 75]

    for (const targetPos of positions) {
      console.log(`\n=== Testing divider at p=${targetPos} ===`)

      // Drag handle to position
      const handle = page.locator('[role="slider"]').first()
      const handleBox = await handle.boundingBox()
      const stage = page.locator('[role="tabpanel"]').first()
      const stageBox = await stage.boundingBox()

      if (handleBox && stageBox) {
        const targetX = stageBox.x + (stageBox.width * targetPos / 100)
        await handle.hover()
        await page.mouse.down()
        await page.mouse.move(targetX, handleBox.y + handleBox.height / 2, { steps: 10 })
        await page.mouse.up()
        await page.waitForTimeout(500)
      }

      // Check image visibility
      const images = await page.locator('[role="tabpanel"] img').evaluateAll((imgs: HTMLImageElement[]) => {
        return imgs.map(img => {
          const rect = img.getBoundingClientRect()
          const parent = img.parentElement
          const parentStyles = parent ? window.getComputedStyle(parent) : null
          const imgStyles = window.getComputedStyle(img)

          return {
            src: img.currentSrc.split('/').pop(),
            opacity: imgStyles.opacity,
            clipPath: imgStyles.clipPath,
            parentClipPath: parentStyles?.clipPath || 'none',
            visible: rect.width > 0 && rect.height > 0 && imgStyles.opacity !== '0',
          }
        })
      })

      console.log('Image states:')
      images.forEach(img => {
        console.log(`  ${img.src}: opacity=${img.opacity}, clip=${img.clipPath}, visible=${img.visible}`)
      })
    }
  })

  test('Step 1e: Comfort pill comparison (WebKit)', async ({ page, browserName }) => {
    test.skip(browserName !== 'webkit', 'WebKit only')

    await page.setViewportSize({ width: 1194, height: 834 })

    // Click 舒適自在 pill
    await page.getByRole('tab', { name: /舒適自在/ }).click()
    await page.waitForTimeout(1000)

    console.log('\n=== 舒適自在 PILL INSPECTION ===')

    const images = await page.locator('[role="tabpanel"] img').evaluateAll((imgs: HTMLImageElement[]) => {
      return imgs.map(img => ({
        currentSrc: img.currentSrc,
        naturalSize: `${img.naturalWidth}×${img.naturalHeight}`,
      }))
    })

    console.log('Images loaded:')
    images.forEach((img, i) => {
      console.log(`  ${i + 1}. ${img.currentSrc}`)
      console.log(`     size: ${img.naturalSize}`)
    })

    // Check small lines rendering
    const smallLines = await page.locator('[role="tab"][aria-selected="true"]').first().textContent()
    console.log(`\nSmall lines text: ${smallLines}`)

    const hasInfinity = smallLines?.includes('Space Infinity') || false
    const hasEternity = smallLines?.includes('Space Eternity') || false

    console.log(`Shows Infinity line: ${hasInfinity}`)
    console.log(`Shows Eternity line: ${hasEternity}`)

    if (!hasInfinity || !hasEternity) {
      console.log('⚠️  ISSUE: Should show BOTH room descriptions')
    }
  })
})
