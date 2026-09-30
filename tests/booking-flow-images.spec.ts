import { test, expect } from '@playwright/test'

test.describe('Booking Flow Section - Image Switching', () => {
  test('should show correct image for each step on desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 })
    await page.goto('http://localhost:3001')

    // Wait for the booking flow section to be visible
    await page.waitForSelector('.booking-flow-section', { timeout: 10000 })

    // Scroll to the booking flow section
    await page.locator('.booking-flow-section').scrollIntoViewIfNeeded()

    // Wait a bit for scroll to complete
    await page.waitForTimeout(500)

    // Helper to get the currently visible image
    const getActiveImage = async () => {
      const images = await page.locator('.flow-image').all()
      for (let i = 0; i < images.length; i++) {
        const opacity = await images[i].evaluate((el) =>
          window.getComputedStyle(el).opacity
        )
        const zIndex = await images[i].evaluate((el) =>
          window.getComputedStyle(el).zIndex
        )
        if (opacity === '1' && zIndex === '1') {
          const src = await images[i].getAttribute('src')
          return { index: i, src }
        }
      }
      return null
    }

    // Helper to scroll to a specific step
    const scrollToStep = async (stepIndex: number) => {
      const step = page.locator(`[data-step-idx="${stepIndex}"]`)
      await step.scrollIntoViewIfNeeded({ block: 'center' })
      await page.waitForTimeout(800) // Wait for transition
    }

    // Test step 01 - should show pick-slot image
    await scrollToStep(0)
    let activeImage = await getActiveImage()
    expect(activeImage).not.toBeNull()
    expect(activeImage?.src).toContain('space8-booking-interface-pick-slot')
    console.log(`Step 01: Image ${activeImage?.index} (${activeImage?.src})`)

    // Test step 02 - should show qrcode image
    await scrollToStep(1)
    activeImage = await getActiveImage()
    expect(activeImage).not.toBeNull()
    expect(activeImage?.src).toContain('space8-qrcode-entry-system')
    console.log(`Step 02: Image ${activeImage?.index} (${activeImage?.src})`)

    // Test step 03 - should show rewards image
    await scrollToStep(2)
    activeImage = await getActiveImage()
    expect(activeImage).not.toBeNull()
    expect(activeImage?.src).toContain('space8-member-rewards-points')
    console.log(`Step 03: Image ${activeImage?.index} (${activeImage?.src})`)

    // Scroll back up to step 01 to verify it switches back
    await scrollToStep(0)
    activeImage = await getActiveImage()
    expect(activeImage).not.toBeNull()
    expect(activeImage?.src).toContain('space8-booking-interface-pick-slot')
    console.log(`Back to Step 01: Image ${activeImage?.index} (${activeImage?.src})`)
  })

  test('should show correct image for each step on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('http://localhost:3001')

    // Wait for the booking flow section
    await page.waitForSelector('.booking-flow-section', { timeout: 10000 })

    // Scroll to the booking flow section
    await page.locator('.booking-flow-section').scrollIntoViewIfNeeded()
    await page.waitForTimeout(500)

    const getActiveImage = async () => {
      const images = await page.locator('.flow-mobile-image .flow-image').all()
      for (let i = 0; i < images.length; i++) {
        const opacity = await images[i].evaluate((el) =>
          window.getComputedStyle(el).opacity
        )
        if (opacity === '1') {
          const src = await images[i].getAttribute('src')
          return { index: i, src }
        }
      }
      return null
    }

    // Initial state should show step 01
    let activeImage = await getActiveImage()
    expect(activeImage).not.toBeNull()
    expect(activeImage?.src).toContain('space8-booking-interface-pick-slot')
    console.log(`Mobile Step 01: Image ${activeImage?.index}`)

    // Note: Mobile uses scroll progress to determine active step,
    // which is harder to test precisely. This test verifies the initial state.
  })

  test('should center the section horizontally', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 })
    await page.goto('http://localhost:3001')

    await page.waitForSelector('.flow-desktop', { timeout: 10000 })

    const flowDesktop = page.locator('.flow-desktop')
    const box = await flowDesktop.boundingBox()

    expect(box).not.toBeNull()

    if (box) {
      const viewportWidth = 1920
      const groupCenter = box.x + box.width / 2
      const viewportCenter = viewportWidth / 2
      const offset = Math.abs(groupCenter - viewportCenter)

      console.log(`Group center: ${groupCenter}px, Viewport center: ${viewportCenter}px, Offset: ${offset}px`)

      // Allow for some padding/margin variance
      expect(offset).toBeLessThan(100)
    }
  })
})
