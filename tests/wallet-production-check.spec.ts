import { test, expect } from '@playwright/test'

test.describe('Wallet Credits - Production Check', () => {
  test('check wallet UI on production site', async ({ page }) => {
    // Go to production site
    await page.goto('https://space8.com.hk/zh-HK/book')

    // Wait for page to load
    await page.waitForLoadState('networkidle')

    console.log('Production site loaded')

    // Take screenshot of the booking page
    await page.screenshot({ path: 'test-results/prod-booking-full.png', fullPage: true })
    console.log('Full page screenshot saved')

    // Look for wallet-related text
    const hasWalletText = await page.locator('text=/wallet|錢包/i').count()
    console.log(`Found ${hasWalletText} wallet-related elements`)

    // Look for checkout section
    const checkoutSection = page.locator('text=/結帳|checkout|付款|payment/i').first()
    if (await checkoutSection.isVisible().catch(() => false)) {
      console.log('Checkout section visible')

      // Take screenshot of checkout area
      await checkoutSection.screenshot({ path: 'test-results/prod-checkout-section.png' })
      console.log('Checkout section screenshot saved')
    } else {
      console.log('Checkout section not visible - may need to select a booking first')
    }

    // Check if there's any "Apply" or "套用" button
    const applyButtons = await page.locator('button:has-text("套用"), button:has-text("Apply")').count()
    console.log(`Found ${applyButtons} Apply/套用 buttons`)

    // Print page text content (first 2000 chars)
    const pageText = await page.textContent('body')
    console.log('Page content preview:', pageText?.substring(0, 2000))
  })
})
