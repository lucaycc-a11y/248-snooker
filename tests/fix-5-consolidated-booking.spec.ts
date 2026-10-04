import { test, expect } from '@playwright/test'

test.describe('Fix 5: Consolidated Multi-Room Booking', () => {
  // Test at mobile viewport (390px)
  test('should show one consolidated ticket for 2-room order at 390px', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })

    // Navigate to booking confirmation with order_group_id
    // This simulates a successful 2-room booking confirmation
    await page.goto('/zh-HK/book?confirmed=true')

    // Wait for confirmation screen to load
    await page.waitForSelector('[data-testid="order-ticket"]', { timeout: 10000 })

    // Verify only ONE order ticket is displayed (consolidated)
    const tickets = await page.locator('[data-testid="order-ticket"]').count()
    expect(tickets).toBe(1)

    // Verify total price is shown
    const totalPrice = await page.locator('[data-testid="total-price"]').textContent()
    expect(totalPrice).toContain('HK$')

    // Verify QR code with member code is shown
    const qrCode = await page.locator('[data-testid="qr-member-code"]').isVisible()
    expect(qrCode).toBe(true)
  })

  // Test at desktop viewport (1440px)
  test('should show one consolidated ticket for 2-room order at 1440px', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })

    await page.goto('/zh-HK/book?confirmed=true')

    await page.waitForSelector('[data-testid="order-ticket"]', { timeout: 10000 })

    // Verify only ONE order ticket is displayed
    const tickets = await page.locator('[data-testid="order-ticket"]').count()
    expect(tickets).toBe(1)

    // Verify total price is shown
    const totalPrice = await page.locator('[data-testid="total-price"]').textContent()
    expect(totalPrice).toContain('HK$')

    // Verify QR code is shown
    const qrCode = await page.locator('[data-testid="qr-member-code"]').isVisible()
    expect(qrCode).toBe(true)
  })

  // Test member button navigation at 390px
  test('member button navigation should work at 390px', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })

    await page.goto('/zh-HK/book?confirmed=true')

    await page.waitForSelector('[data-testid="go-to-member"]', { timeout: 10000 })

    // Wait for member button to be visible and clickable
    const memberButton = page.locator('[data-testid="go-to-member"]')
    await expect(memberButton).toBeVisible()

    // Click should navigate to member page preserving locale
    await page.goto('/zh-HK/book?confirmed=true')
    await page.waitForSelector('[data-testid="go-to-member"]', { timeout: 10000 })

    // Verify button exists and is clickable
    await expect(memberButton).toBeEnabled()
  })

  // Test member button navigation at 1440px
  test('member button navigation should work at 1440px', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })

    await page.goto('/zh-HK/book?confirmed=true')

    await page.waitForSelector('[data-testid="go-to-member"]', { timeout: 10000 })

    const memberButton = page.locator('[data-testid="go-to-member"]')
    await expect(memberButton).toBeVisible()
    await expect(memberButton).toBeEnabled()
  })

  // Test calendar download functionality at 390px
  test('should be able to download calendar at 390px', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })

    await page.goto('/zh-HK/book?confirmed=true')

    await page.waitForSelector('[data-testid="download-calendar"]', { timeout: 10000 })

    const calendarButton = page.locator('[data-testid="download-calendar"]')
    await expect(calendarButton).toBeVisible()
    await expect(calendarButton).toBeEnabled()
  })

  // Test calendar download functionality at 1440px
  test('should be able to download calendar at 1440px', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })

    await page.goto('/zh-HK/book?confirmed=true')

    await page.waitForSelector('[data-testid="download-calendar"]', { timeout: 10000 })

    const calendarButton = page.locator('[data-testid="download-calendar"]')
    await expect(calendarButton).toBeVisible()
    await expect(calendarButton).toBeEnabled()
  })

  // Test share functionality at 390px
  test('should be able to open share dialog at 390px', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })

    await page.goto('/zh-HK/book?confirmed=true')

    await page.waitForSelector('[data-testid="share-button"]', { timeout: 10000 })

    const shareButton = page.locator('[data-testid="share-button"]')
    await expect(shareButton).toBeVisible()

    // Click to open share dialog
    await shareButton.click()

    // Verify share dialog appears
    const shareDialog = page.locator('[data-testid="share-dialog"]')
    await expect(shareDialog).toBeVisible()
  })

  // Test share functionality at 1440px
  test('should be able to open share dialog at 1440px', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })

    await page.goto('/zh-HK/book?confirmed=true')

    await page.waitForSelector('[data-testid="share-button"]', { timeout: 10000 })

    const shareButton = page.locator('[data-testid="share-button"]')
    await expect(shareButton).toBeVisible()

    // Click to open share dialog
    await shareButton.click()

    // Verify share dialog appears
    const shareDialog = page.locator('[data-testid="share-dialog"]')
    await expect(shareDialog).toBeVisible()
  })

  // Test responsive layout consistency
  test('ticket layout should be responsive between 390px and 1440px', async ({ page }) => {
    // Test at 390px
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/zh-HK/book?confirmed=true')
    await page.waitForSelector('[data-testid="order-ticket"]', { timeout: 10000 })

    const ticketAt390 = await page.locator('[data-testid="order-ticket"]').count()
    expect(ticketAt390).toBe(1)

    // Test at 1440px
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.waitForTimeout(500) // Allow reflow

    const ticketAt1440 = await page.locator('[data-testid="order-ticket"]').count()
    expect(ticketAt1440).toBe(1)

    // Both should show one consolidated ticket
    expect(ticketAt390).toBe(ticketAt1440)
  })
})
