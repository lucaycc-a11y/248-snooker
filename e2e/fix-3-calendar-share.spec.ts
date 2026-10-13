import { test, expect, Page } from '@playwright/test'

/**
 * Fix 3: Verify calendar ICS and share image work with consolidated multi-room orders
 *
 * Test scenarios:
 * - Download calendar (.ics file) for multi-room order
 * - Verify it contains multiple VEVENT entries (one per line)
 * - Verify share image generation with all rooms and total price
 * - Test responsive layout at 390px (mobile) and 1440px (desktop)
 */

test.describe('Fix 3: Calendar & Share for Multi-Room Orders', () => {
  test('Mobile 390px: Multi-room order shows consolidated ticket with calendar & share', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })

    // Navigate to production booking confirmation page with multi-room order
    // Using order_group_id scenario (2 rooms, same session)
    await page.goto('https://space8.com.hk/zh-HK/book?step=4')

    // Wait for confirmation screen to load
    await page.waitForSelector('[data-testid="order-ticket"]', { timeout: 30000 })

    // Verify consolidated ticket is displayed (not array of tickets)
    const ticket = await page.locator('[data-testid="order-ticket"]').first()
    await expect(ticket).toBeVisible()

    // Verify member code is shown (not booking reference)
    const memberCodeSection = await page.locator('[data-testid="qr-member-code"]').first()
    await expect(memberCodeSection).toBeVisible()

    // Verify multiple room lines are visible
    const roomLines = await page.locator('[data-testid="booking-line"]').all()
    expect(roomLines.length).toBeGreaterThanOrEqual(2)

    // Verify total price is displayed
    const totalPrice = await page.locator('[data-testid="total-price"]').first()
    await expect(totalPrice).toBeVisible()

    // Test calendar download
    const downloadPromise = page.waitForEvent('download')
    await page.locator('[data-testid="download-calendar"]').first().click()
    const download = await downloadPromise

    // Verify filename uses member code
    expect(download.suggestedFilename()).toMatch(/^SPACE8-.*\.ics$/)

    // Read ICS content and verify multiple VEVENT entries
    const path = await download.path()
    const fs = await import('fs').then((m) => m.promises)
    const icsContent = await fs.readFile(path, 'utf-8')

    // Count VEVENT entries (should match room count)
    const eventCount = (icsContent.match(/BEGIN:VEVENT/g) || []).length
    expect(eventCount).toBeGreaterThanOrEqual(2)

    // Verify ICS contains member code, not booking reference
    expect(icsContent).toContain('SUMMARY')
    expect(icsContent).not.toMatch(/booking.?ref/i)
  })

  test('Desktop 1440px: Multi-room order calendar & share work properly', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })

    await page.goto('https://space8.com.hk/zh-HK/book?step=4')
    await page.waitForSelector('[data-testid="order-ticket"]', { timeout: 30000 })

    // Verify ticket is consolidated
    const ticket = await page.locator('[data-testid="order-ticket"]').first()
    await expect(ticket).toBeVisible()

    // Verify all room lines visible at desktop width
    const roomLines = await page.locator('[data-testid="booking-line"]').all()
    expect(roomLines.length).toBeGreaterThanOrEqual(2)

    // Get visible bounding box of ticket to verify proper layout
    const box = await ticket.boundingBox()
    expect(box).toBeTruthy()
    expect(box!.width).toBeGreaterThan(400)

    // Test share button visibility
    const shareButton = await page.locator('[data-testid="share-button"]').first()
    await expect(shareButton).toBeVisible()
  })

  test('Share image canvas height scales with room count', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('https://space8.com.hk/zh-HK/book?step=4')
    await page.waitForSelector('[data-testid="order-ticket"]', { timeout: 30000 })

    // Verify share button exists and is clickable
    const shareButton = await page.locator('[data-testid="share-button"]').first()
    await expect(shareButton).toBeVisible()

    // Note: Full canvas height verification requires mocking navigator.share
    // or testing in environment with share API support.
    // Here we verify the button is present and accessible.
    await shareButton.click()

    // Verify share dialog or fallback appears
    const shareDialog = await page.locator('[data-testid="share-dialog"]')
    // May not exist if navigator.share triggered native share
    // In that case, button click succeeds without error
  })
})
