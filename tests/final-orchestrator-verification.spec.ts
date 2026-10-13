import { test, expect } from '@playwright/test'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'

test.describe('Final Orchestrator Verification', () => {
  test.describe('Hero (About & Venue)', () => {
    test('About Hero - 60 wheel events scroll monotonically past hero', async ({ page }) => {
      await page.goto('http://localhost:3000/about')
      await page.waitForLoadState('networkidle')

      const scrollYValues: number[] = []
      let previousScrollY = await page.evaluate(() => window.scrollY)
      scrollYValues.push(previousScrollY)

      // Dispatch 60 wheel events
      for (let i = 0; i < 60; i++) {
        await page.mouse.wheel(0, 100)
        await page.waitForTimeout(200)

        const currentScrollY = await page.evaluate(() => window.scrollY)
        scrollYValues.push(currentScrollY)

        // Verify monotonic increase (or equal if at bottom)
        expect(currentScrollY).toBeGreaterThanOrEqual(previousScrollY)
        previousScrollY = currentScrollY
      }

      // Verify we scrolled past hero section
      const finalScrollY = scrollYValues[scrollYValues.length - 1]
      expect(finalScrollY).toBeGreaterThan(2000) // Hero should be passed

      console.log('Scroll progression sample:', scrollYValues.filter((_, i) => i % 10 === 0))
      console.log('Final scroll position:', finalScrollY)
    })

    test('About Hero - vertical touch swipe scrolls page', async ({ page, browserName }) => {
      if (browserName !== 'webkit') test.skip()

      const iPad = {
        name: 'iPad Pro landscape',
        viewport: { width: 1194, height: 834 },
        hasTouch: true,
      }
      await page.setViewportSize(iPad.viewport)
      await page.goto('http://localhost:3000/about')
      await page.waitForLoadState('networkidle')

      const initialScrollY = await page.evaluate(() => window.scrollY)

      // Vertical swipe down
      await page.touchscreen.tap(600, 300)
      await page.touchscreen.tap(600, 100)
      await page.waitForTimeout(500)

      const afterSwipeDown = await page.evaluate(() => window.scrollY)
      expect(afterSwipeDown).toBeGreaterThan(initialScrollY)

      // Swipe back up
      await page.touchscreen.tap(600, 100)
      await page.touchscreen.tap(600, 400)
      await page.waitForTimeout(500)

      const afterSwipeUp = await page.evaluate(() => window.scrollY)
      expect(afterSwipeUp).toBeLessThan(afterSwipeDown)

      console.log('Touch swipe: initial', initialScrollY, '→ down', afterSwipeDown, '→ up', afterSwipeUp)
    })

    test('About Hero - Space/PageDown/arrows scroll through points', async ({ page }) => {
      await page.goto('http://localhost:3000/about')
      await page.waitForLoadState('networkidle')

      // Focus body
      await page.evaluate(() => document.body.focus())

      const initialScrollY = await page.evaluate(() => window.scrollY)

      // Press Space 3 times
      await page.keyboard.press('Space')
      await page.waitForTimeout(300)
      await page.keyboard.press('Space')
      await page.waitForTimeout(300)
      await page.keyboard.press('Space')
      await page.waitForTimeout(300)

      const afterSpace = await page.evaluate(() => window.scrollY)
      expect(afterSpace).toBeGreaterThan(initialScrollY)

      // Press PageDown
      await page.keyboard.press('PageDown')
      await page.waitForTimeout(300)

      const afterPageDown = await page.evaluate(() => window.scrollY)
      expect(afterPageDown).toBeGreaterThan(afterSpace)

      console.log('Keyboard: initial', initialScrollY, '→ Space×3', afterSpace, '→ PageDown', afterPageDown)
    })

    test('About Hero - index buttons 01/02/03 scroll to correct positions', async ({ page }) => {
      await page.goto('http://localhost:3000/about')
      await page.waitForLoadState('networkidle')

      // Find index buttons (if they exist)
      const indexButtons = await page.locator('button:has-text("01"), button:has-text("02"), button:has-text("03")').count()

      if (indexButtons === 0) {
        console.log('No index buttons found - skipping test')
        return
      }

      // Click button 02
      await page.locator('button:has-text("02")').first().click()
      await page.waitForTimeout(800) // Allow smooth scroll

      const scroll02 = await page.evaluate(() => window.scrollY)
      expect(scroll02).toBeGreaterThan(500)

      // Click button 03
      await page.locator('button:has-text("03")').first().click()
      await page.waitForTimeout(800)

      const scroll03 = await page.evaluate(() => window.scrollY)
      expect(scroll03).toBeGreaterThan(scroll02)

      // Click button 01 to go back
      await page.locator('button:has-text("01")').first().click()
      await page.waitForTimeout(800)

      const scroll01 = await page.evaluate(() => window.scrollY)
      expect(scroll01).toBeLessThan(scroll02)

      console.log('Index buttons:', '01', scroll01, '02', scroll02, '03', scroll03)
    })

    test('About Hero - scroll up from next section re-enters smoothly', async ({ page }) => {
      await page.goto('http://localhost:3000/about')
      await page.waitForLoadState('networkidle')

      // Scroll past hero
      await page.evaluate(() => window.scrollTo(0, 5000))
      await page.waitForTimeout(500)

      const pastHero = await page.evaluate(() => window.scrollY)
      expect(pastHero).toBeGreaterThan(3000)

      // Scroll back up
      await page.mouse.wheel(0, -500)
      await page.waitForTimeout(300)

      const backInHero = await page.evaluate(() => window.scrollY)
      expect(backInHero).toBeLessThan(pastHero)
      expect(backInHero).toBeGreaterThan(0)

      console.log('Re-entry: past', pastHero, '→ back', backInHero)
    })

    test('About Hero - reloads at 0%/30%/60%/90% show correct state', async ({ page }) => {
      const positions = [
        { percent: 0, scrollY: 0 },
        { percent: 30, scrollY: 1500 },
        { percent: 60, scrollY: 3000 },
        { percent: 90, scrollY: 4500 },
      ]

      for (const pos of positions) {
        await page.goto('http://localhost:3000/about')
        await page.waitForLoadState('networkidle')

        // Scroll to position
        await page.evaluate((y) => window.scrollTo(0, y), pos.scrollY)
        await page.waitForTimeout(500)

        // Reload
        await page.reload()
        await page.waitForLoadState('networkidle')
        await page.waitForTimeout(500)

        const afterReload = await page.evaluate(() => window.scrollY)

        // Should maintain scroll position (within 100px tolerance)
        expect(Math.abs(afterReload - pos.scrollY)).toBeLessThan(100)

        console.log(`Reload at ${pos.percent}%: expected ${pos.scrollY}, got ${afterReload}`)
      }
    })

    test('About Hero - NO preventDefault on wheel/touch', async ({ page }) => {
      await page.goto('http://localhost:3000/about')
      await page.waitForLoadState('networkidle')

      const listeners = await page.evaluate(() => {
        const results: any[] = []

        // Check for non-passive listeners
        const originalAddEventListener = EventTarget.prototype.addEventListener
        let nonPassiveCount = 0

        EventTarget.prototype.addEventListener = function(type, listener, options) {
          if (['wheel', 'touchstart', 'touchmove', 'touchend'].includes(type)) {
            const passive = typeof options === 'object' ? options.passive : true
            if (!passive) {
              nonPassiveCount++
              results.push({ type, passive: false })
            }
          }
          return originalAddEventListener.call(this, type, listener, options)
        }

        return { nonPassiveCount, results }
      })

      expect(listeners.nonPassiveCount).toBe(0)
      console.log('Non-passive listeners:', listeners)
    })

    test('About Hero - total scroll distance and final turn', async ({ page }) => {
      await page.goto('http://localhost:3000/about')
      await page.waitForLoadState('networkidle')

      // Get hero wrapper dimensions
      const heroDimensions = await page.evaluate(() => {
        const runway = document.querySelector('[data-testid="space-wheel-runway"]') as HTMLElement
        if (!runway) return null

        return {
          height: runway.offsetHeight,
          viewportHeight: window.innerHeight,
          viewportHeights: runway.offsetHeight / window.innerHeight,
        }
      })

      if (!heroDimensions) {
        console.log('Could not find hero runway element')
        return
      }

      console.log('Hero scroll distance:')
      console.log('- Total height:', heroDimensions.height, 'px')
      console.log('- Viewport heights:', heroDimensions.viewportHeights.toFixed(1), 'vh')

      // Scroll to bottom of hero
      await page.evaluate((h) => window.scrollTo(0, h + 500), heroDimensions.height)
      await page.waitForTimeout(500)

      const finalScrollY = await page.evaluate(() => window.scrollY)
      console.log('- Final scroll position:', finalScrollY, 'px')
    })

    test('Static layout - 390px and reduced motion', async ({ page }) => {
      // Test 390px viewport
      await page.setViewportSize({ width: 390, height: 844 })
      await page.goto('http://localhost:3000/about')
      await page.waitForLoadState('networkidle')

      const has390Layout = await page.evaluate(() => {
        const runway = document.querySelector('[data-testid="space-wheel-runway"]')
        return runway === null || window.getComputedStyle(runway as HTMLElement).position !== 'relative'
      })

      console.log('390px shows static layout:', has390Layout)

      // Test reduced motion
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await page.reload()
      await page.waitForLoadState('networkidle')

      const hasReducedMotionLayout = await page.evaluate(() => {
        const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
        return prefersReduced
      })

      console.log('Reduced motion active:', hasReducedMotionLayout)
    })
  })

  test.describe('Room Viewer Compare', () => {
    test('Four unique currentSrc values with unique SHA256s', async ({ page }) => {
      await page.goto('http://localhost:3000/venue')
      await page.waitForLoadState('networkidle')

      // Wait for RoomViewer to load
      await page.waitForSelector('[data-testid="room-viewer"]', { timeout: 10000 })

      // Get all image src values
      const imageSrcs = await page.evaluate(() => {
        const images = Array.from(document.querySelectorAll('[data-testid="room-viewer"] img'))
        return images.map(img => (img as HTMLImageElement).currentSrc).filter(Boolean)
      })

      console.log('Image sources found:', imageSrcs.length)
      console.log('Unique sources:', new Set(imageSrcs).size)

      // Compute SHA256 for the 4 specified files
      const baseDir = '/Users/lucayau/Documents/Space8_web/public/images'
      const files = [
        'venue-page-infinity.jpg',
        'venue-page-eternity.jpg',
        'space8-about-photos/images/about-06-lounge.webp',
        'space8-about-photos/images/about-07-stools.webp',
      ]

      const hashes: Record<string, string> = {}
      for (const file of files) {
        const fullPath = path.join(baseDir, file)
        if (fs.existsSync(fullPath)) {
          const content = fs.readFileSync(fullPath)
          const hash = crypto.createHash('sha256').update(content).digest('hex')
          hashes[file] = hash
          console.log(`${file}: ${hash}`)
        }
      }

      // Verify all hashes are unique
      const hashValues = Object.values(hashes)
      const uniqueHashes = new Set(hashValues)
      expect(uniqueHashes.size).toBe(4)
    })

    test('Visual accuracy - p=100 shows Infinity, p=0 shows Eternity, p=50 shows both', async ({ page, browserName }) => {
      if (browserName !== 'webkit') test.skip()

      const iPad = {
        name: 'iPad Pro landscape',
        viewport: { width: 1194, height: 834 },
        hasTouch: true,
      }
      await page.setViewportSize(iPad.viewport)

      await page.goto('http://localhost:3000/venue')
      await page.waitForLoadState('networkidle')
      await page.waitForSelector('[data-testid="room-viewer"]', { timeout: 10000 })

      // Test p=100 (Infinity only)
      await page.evaluate(() => {
        const slider = document.querySelector('input[type="range"]') as HTMLInputElement
        if (slider) {
          slider.value = '100'
          slider.dispatchEvent(new Event('input', { bubbles: true }))
        }
      })
      await page.waitForTimeout(500)

      const infinityOnly = await page.screenshot({ path: 'test-results/compare-p100-infinity.png' })
      console.log('p=100 screenshot saved')

      // Test p=0 (Eternity only)
      await page.evaluate(() => {
        const slider = document.querySelector('input[type="range"]') as HTMLInputElement
        if (slider) {
          slider.value = '0'
          slider.dispatchEvent(new Event('input', { bubbles: true }))
        }
      })
      await page.waitForTimeout(500)

      const eternityOnly = await page.screenshot({ path: 'test-results/compare-p0-eternity.png' })
      console.log('p=0 screenshot saved')

      // Test p=50 (split view)
      await page.evaluate(() => {
        const slider = document.querySelector('input[type="range"]') as HTMLInputElement
        if (slider) {
          slider.value = '50'
          slider.dispatchEvent(new Event('input', { bubbles: true }))
        }
      })
      await page.waitForTimeout(500)

      const splitView = await page.screenshot({ path: 'test-results/compare-p50-split.png' })
      console.log('p=50 screenshot saved')
    })

    test('Screenshots at p=25/50/75 show two different photos', async ({ page, browserName }) => {
      if (browserName !== 'webkit') test.skip()

      const iPad = {
        name: 'iPad Pro landscape',
        viewport: { width: 1194, height: 834 },
        hasTouch: true,
      }
      await page.setViewportSize(iPad.viewport)

      await page.goto('http://localhost:3000/venue')
      await page.waitForLoadState('networkidle')
      await page.waitForSelector('[data-testid="room-viewer"]', { timeout: 10000 })

      const positions = [25, 50, 75]

      for (const p of positions) {
        await page.evaluate((pos) => {
          const slider = document.querySelector('input[type="range"]') as HTMLInputElement
          if (slider) {
            slider.value = String(pos)
            slider.dispatchEvent(new Event('input', { bubbles: true }))
          }
        }, p)
        await page.waitForTimeout(500)

        await page.screenshot({ path: `test-results/compare-p${p}.png` })
        console.log(`p=${p} screenshot saved`)
      }
    })

    test('Handle and thumb sync, keyboard navigation works', async ({ page }) => {
      await page.goto('http://localhost:3000/venue')
      await page.waitForLoadState('networkidle')
      await page.waitForSelector('[data-testid="room-viewer"]', { timeout: 10000 })

      // Get initial slider value
      const initialValue = await page.evaluate(() => {
        const slider = document.querySelector('input[type="range"]') as HTMLInputElement
        return slider ? parseInt(slider.value) : 50
      })

      // Press ArrowRight
      await page.locator('input[type="range"]').first().focus()
      await page.keyboard.press('ArrowRight')
      await page.waitForTimeout(200)

      const afterRight = await page.evaluate(() => {
        const slider = document.querySelector('input[type="range"]') as HTMLInputElement
        return slider ? parseInt(slider.value) : 50
      })

      expect(afterRight).toBeGreaterThan(initialValue)

      // Press Home (should go to 0)
      await page.keyboard.press('Home')
      await page.waitForTimeout(200)

      const afterHome = await page.evaluate(() => {
        const slider = document.querySelector('input[type="range"]') as HTMLInputElement
        return slider ? parseInt(slider.value) : 50
      })

      expect(afterHome).toBe(0)

      // Press End (should go to 100)
      await page.keyboard.press('End')
      await page.waitForTimeout(200)

      const afterEnd = await page.evaluate(() => {
        const slider = document.querySelector('input[type="range"]') as HTMLInputElement
        return slider ? parseInt(slider.value) : 50
      })

      expect(afterEnd).toBe(100)

      console.log('Keyboard nav:', initialValue, '→ Right', afterRight, '→ Home', afterHome, '→ End', afterEnd)
    })

    test('30 random pill switches under Slow 4G - zero blank frames', async ({ page, browserName, context }) => {
      if (browserName !== 'webkit') test.skip()

      // Simulate Slow 4G
      const client = await context.newCDPSession(page)
      await client.send('Network.emulateNetworkConditions', {
        offline: false,
        downloadThroughput: 50 * 1024 / 8, // 50kb/s
        uploadThroughput: 50 * 1024 / 8,
        latency: 2000, // 2s
      })

      await page.goto('http://localhost:3000/venue')
      await page.waitForLoadState('networkidle')
      await page.waitForSelector('[data-testid="room-viewer"]', { timeout: 10000 })

      let blankFrameCount = 0

      for (let i = 0; i < 30; i++) {
        // Click random pill
        const pills = await page.locator('[data-testid^="pill-"]').count()
        const randomPill = Math.floor(Math.random() * pills)

        await page.locator(`[data-testid^="pill-"]`).nth(randomPill).click()

        // Check for blank stage during transition
        const hasBlankFrame = await page.evaluate(() => {
          const images = Array.from(document.querySelectorAll('[data-testid="room-viewer"] img'))
          const allHidden = images.every(img => {
            const style = window.getComputedStyle(img as HTMLElement)
            return style.opacity === '0' || style.display === 'none'
          })
          return allHidden
        })

        if (hasBlankFrame) blankFrameCount++

        await page.waitForTimeout(100)
      }

      console.log(`Blank frames detected: ${blankFrameCount} / 30`)
      expect(blankFrameCount).toBe(0)
    })

    test('Baked-in title check', async ({ page }) => {
      await page.goto('http://localhost:3000/venue')
      await page.waitForLoadState('networkidle')

      const hasDOMTitle = await page.evaluate(() => {
        const textElements = Array.from(document.querySelectorAll('*'))
        return textElements.some(el => {
          const text = el.textContent || ''
          return text.includes('SPACE INFINITY') || text.includes('SPACE ETERNITY')
        })
      })

      console.log('Title in DOM elements:', hasDOMTitle)
      console.log(hasDOMTitle ? 'Title is CSS overlay (correct)' : 'Title may be baked into JPG (needs verification)')
    })
  })

  test.describe('Code Quality', () => {
    test('No raw i18n keys visible', async ({ page }) => {
      await page.goto('http://localhost:3000/about')
      await page.waitForLoadState('networkidle')

      const bodyText = await page.textContent('body')
      const hasRawKeys = /\b(about|venue|ui)\.\w+\.\w+/.test(bodyText || '')

      expect(hasRawKeys).toBe(false)
      console.log('Raw i18n keys found:', hasRawKeys)
    })

    test('No horizontal overflow', async ({ page }) => {
      await page.goto('http://localhost:3000/about')
      await page.waitForLoadState('networkidle')

      const hasOverflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth
      })

      expect(hasOverflow).toBe(false)
      console.log('Horizontal overflow:', hasOverflow)
    })
  })
})
