import { test, expect } from '@playwright/test'

test.describe('Stripe Two-Stage Payment Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to booking page
    await page.goto('http://localhost:3000/zh-HK/book')
    await page.waitForLoadState('networkidle')
  })

  test('Card Payment - Stage 1 → Stage 2 (PaymentElement only, no QR)', async ({ page }) => {
    console.log('Testing Card Payment flow...')

    // Wait for calendar to load
    await page.waitForSelector('[data-testid="calendar"]', { timeout: 10000 }).catch(() => {
      console.log('Calendar selector not found, trying alternative')
    })

    // Select a date (click first available date)
    const dateButton = page.locator('button:has-text("15")').first()
    await dateButton.click()
    await page.waitForTimeout(500)

    // Select time slot (假設有 time picker)
    const timeSlot = page.locator('[data-time-slot]').first()
    if (await timeSlot.isVisible().catch(() => false)) {
      await timeSlot.click()
      await page.waitForTimeout(500)
    }

    // ────────────────────────────────────────────────────────────
    // STAGE 1: Select payment method = "信用卡" (Card)
    // ────────────────────────────────────────────────────────────
    console.log('Stage 1: Selecting Card payment method...')

    // Look for "信用卡" button in PaymentMethodList
    const cardMethodButton = page.locator('button:has-text("信用卡")')
    await expect(cardMethodButton).toBeVisible({ timeout: 5000 })
    await cardMethodButton.click()

    console.log('✓ Stage 1: Card method selected')

    // ────────────────────────────────────────────────────────────
    // STAGE 2: Verify StripePayment shows PaymentElement ONLY
    // ────────────────────────────────────────────────────────────
    console.log('Stage 2: Verifying Card UI (PaymentElement only)...')

    // Wait for Stripe PaymentElement to mount
    const paymentElement = page.locator('#payment-element')
    await expect(paymentElement).toBeVisible({ timeout: 10000 })
    console.log('✓ PaymentElement is visible')

    // Verify NO QR code is shown
    const qrCode = page.locator('[data-testid="wechat-qr-code"]')
    await expect(qrCode).not.toBeVisible()
    console.log('✓ QR code is NOT visible (mutual exclusion verified)')

    // Take screenshot
    await page.screenshot({ path: 'test-output-card-payment.png', fullPage: true })
    console.log('✓ Screenshot saved: test-output-card-payment.png')
  })

  test('WeChat Pay - Stage 1 → Stage 2 (QR only, no PaymentElement)', async ({ page }) => {
    console.log('Testing WeChat Pay flow...')

    // Wait for calendar
    await page.waitForSelector('[data-testid="calendar"]', { timeout: 10000 }).catch(() => {
      console.log('Calendar selector not found, trying alternative')
    })

    // Select a date
    const dateButton = page.locator('button:has-text("16")').first()
    await dateButton.click()
    await page.waitForTimeout(500)

    // Select time slot
    const timeSlot = page.locator('[data-time-slot]').first()
    if (await timeSlot.isVisible().catch(() => false)) {
      await timeSlot.click()
      await page.waitForTimeout(500)
    }

    // ────────────────────────────────────────────────────────────
    // STAGE 1: Select payment method = "微信支付" (WeChat)
    // ────────────────────────────────────────────────────────────
    console.log('Stage 1: Selecting WeChat Pay method...')

    const wechatMethodButton = page.locator('button:has-text("微信支付")')
    await expect(wechatMethodButton).toBeVisible({ timeout: 5000 })
    await wechatMethodButton.click()

    console.log('✓ Stage 1: WeChat method selected')

    // ────────────────────────────────────────────────────────────
    // STAGE 2: Verify StripePayment shows QR code ONLY
    // ────────────────────────────────────────────────────────────
    console.log('Stage 2: Verifying WeChat QR UI (QR only)...')

    // Wait for QR code to appear
    const qrCode = page.locator('[data-testid="wechat-qr-code"]')
    await expect(qrCode).toBeVisible({ timeout: 10000 })
    console.log('✓ QR code is visible')

    // Verify NO PaymentElement is shown
    const paymentElement = page.locator('#payment-element')
    await expect(paymentElement).not.toBeVisible()
    console.log('✓ PaymentElement is NOT visible (mutual exclusion verified)')

    // Take screenshot
    await page.screenshot({ path: 'test-output-wechat-qr.png', fullPage: true })
    console.log('✓ Screenshot saved: test-output-wechat-qr.png')
  })
})
