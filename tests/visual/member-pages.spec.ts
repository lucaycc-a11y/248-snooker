/**
 * Visual Regression Tests for Member Pages
 *
 * Tests the visual appearance of Wallet, Points, and Inbox pages
 * against baseline screenshots using pixelmatch.
 *
 * Diff threshold: 0.5% (fail if more than 0.5% of pixels differ)
 */

import { test, expect } from '@playwright/test'
import { loginAsMember } from '../helpers/auth'
import * as fs from 'fs'
import * as path from 'path'
import { PNG } from 'pngjs'
import pixelmatch from 'pixelmatch'

const BASELINE_DIR = path.resolve(__dirname, 'baseline')
const DIFF_DIR = path.resolve(__dirname, 'diff')
const DIFF_THRESHOLD = 0.005 // 0.5% pixel difference allowed

// Ensure diff directory exists
if (!fs.existsSync(DIFF_DIR)) {
  fs.mkdirSync(DIFF_DIR, { recursive: true })
}

interface PageConfig {
  name: string
  url: string
  selector: string
  description: string
}

const PAGES: PageConfig[] = [
  {
    name: 'wallet',
    url: '/member/wallet',
    selector: '.wcard',
    description: 'Member Wallet page',
  },
  {
    name: 'points',
    url: '/member/points',
    selector: '[data-testid="points-page"], .points-container, main',
    description: 'Member Points page',
  },
  {
    name: 'inbox',
    url: '/member/inbox',
    selector: '[data-testid="inbox-page"], .inbox-container, main',
    description: 'Member Inbox page',
  },
]

const VIEWPORTS = [
  { width: 390, height: 844, name: 'mobile' },
  { width: 768, height: 1024, name: 'tablet' },
  { width: 1440, height: 900, name: 'desktop' },
]

/**
 * Compare two PNG buffers and return the diff percentage
 */
function compareImages(
  img1Buffer: Buffer,
  img2Buffer: Buffer,
  diffPath: string
): { diffPixels: number; totalPixels: number; diffPercentage: number } {
  const img1 = PNG.sync.read(img1Buffer)
  const img2 = PNG.sync.read(img2Buffer)

  const { width, height } = img1

  // Ensure images have the same dimensions
  if (img2.width !== width || img2.height !== height) {
    throw new Error(
      `Image dimensions mismatch: ${width}x${height} vs ${img2.width}x${img2.height}`
    )
  }

  const diff = new PNG({ width, height })

  const diffPixels = pixelmatch(
    img1.data,
    img2.data,
    diff.data,
    width,
    height,
    {
      threshold: 0.1, // Pixel-level sensitivity
      includeAA: false, // Ignore anti-aliasing
      diffColor: [255, 0, 0], // Red for diff pixels
    }
  )

  // Save diff image
  fs.writeFileSync(diffPath, PNG.sync.write(diff))

  const totalPixels = width * height
  const diffPercentage = diffPixels / totalPixels

  return { diffPixels, totalPixels, diffPercentage }
}

for (const pageConfig of PAGES) {
  for (const viewport of VIEWPORTS) {
    test(`Visual regression: ${pageConfig.description} @ ${viewport.name} (${viewport.width}x${viewport.height})`, async ({ page }) => {
      // Set viewport
      await page.setViewportSize({ width: viewport.width, height: viewport.height })

      // Login as test member
      await loginAsMember(page, 'test@example.com')

      // Navigate to page
      await page.goto(pageConfig.url)

      // Wait for content to load
      try {
        // Try multiple selectors (separated by comma)
        const selectors = pageConfig.selector.split(',').map(s => s.trim())
        let loaded = false

        for (const selector of selectors) {
          try {
            await page.waitForSelector(selector, { timeout: 5000 })
            loaded = true
            break
          } catch {
            // Try next selector
          }
        }

        if (!loaded) {
          // Fallback: just wait for network idle
          await page.waitForLoadState('networkidle')
        }
      } catch {
        // Fallback: wait for network idle
        await page.waitForLoadState('networkidle')
      }

      // Small delay for animations to complete
      await page.waitForTimeout(500)

      // Take screenshot
      const screenshot = await page.screenshot({ fullPage: true })

      const baselinePath = path.join(BASELINE_DIR, `${pageConfig.name}-${viewport.name}.png`)
      const diffPath = path.join(DIFF_DIR, `${pageConfig.name}-${viewport.name}-diff.png`)

      // If baseline doesn't exist, create it
      if (!fs.existsSync(baselinePath)) {
        fs.writeFileSync(baselinePath, screenshot)
        console.log(`✓ Baseline created for ${pageConfig.name} @ ${viewport.name}`)
        test.skip() // Skip comparison on first run
        return
      }

      // Load baseline
      const baseline = fs.readFileSync(baselinePath)

      // Compare images
      const { diffPixels, totalPixels, diffPercentage } = compareImages(
        screenshot,
        baseline,
        diffPath
      )

      console.log(`${pageConfig.name} @ ${viewport.name}: ${diffPixels} / ${totalPixels} pixels differ (${(diffPercentage * 100).toFixed(3)}%)`)

      // Assert diff is within threshold
      expect(diffPercentage).toBeLessThanOrEqual(DIFF_THRESHOLD)

      // Clean up diff image if test passed
      if (diffPercentage <= DIFF_THRESHOLD && fs.existsSync(diffPath)) {
        fs.unlinkSync(diffPath)
      }
    })
  }
}
