import { test, expect } from '@playwright/test'

test.describe('Wallet Credits - Local Debug', () => {
  test.use({
    storageState: undefined // Start without auth
  })

  test('debug wallet UI on local booking page', async ({ page }) => {
    // Navigate to local booking page
    await page.goto('http://localhost:3000/zh-HK/book')

    // Wait for page to load
    await page.waitForLoadState('networkidle', { timeout: 30000 })

    console.log('✓ Booking page loaded')

    // Take initial screenshot
    await page.screenshot({ path: 'test-results/local-booking-initial.png', fullPage: true })

    // Check if there's a login/auth gate
    const hasAuthGate = await page.locator('text=/登入|login|sign in/i').isVisible().catch(() => false)
    console.log(hasAuthGate ? '⚠ Auth gate detected - need to login first' : '✓ No auth gate')

    // Look for checkout/payment section
    const checkoutVisible = await page.locator('text=/結帳|checkout|付款/i').first().isVisible({ timeout: 5000 }).catch(() => false)

    if (checkoutVisible) {
      console.log('✓ Checkout section visible')

      // Scroll to checkout section
      await page.locator('text=/結帳|checkout|付款/i').first().scrollIntoViewIfNeeded()
      await page.waitForTimeout(500)

      // Look for wallet section specifically
      const walletSection = page.locator('text=/Space Wallet|錢包/i').first()
      const walletVisible = await walletSection.isVisible().catch(() => false)

      if (walletVisible) {
        console.log('✓ Wallet section found')

        // Take screenshot of wallet area
        await walletSection.screenshot({ path: 'test-results/local-wallet-section.png' })

        // Check wallet balance text
        const walletText = await walletSection.locator('..').textContent()
        console.log('Wallet section text:', walletText)

        // Look for Apply button
        const applyButton = page.locator('button:has-text("套用"), button:has-text("Apply")').first()
        const applyVisible = await applyButton.isVisible().catch(() => false)

        if (applyVisible) {
          console.log('✓ Apply button visible')

          // Check if button is enabled
          const isEnabled = await applyButton.isEnabled()
          console.log(isEnabled ? '✓ Apply button is ENABLED' : '✗ Apply button is DISABLED')

          // Get button styles to check for CSS issues
          const buttonBox = await applyButton.boundingBox()
          console.log('Button bounding box:', buttonBox)

          // Try to click it
          try {
            await applyButton.click({ timeout: 3000 })
            console.log('✓ Apply button clicked successfully')

            // Wait a bit to see if wallet applied
            await page.waitForTimeout(1000)

            // Check if wallet was applied
            const appliedText = await page.locator('text=/已套用.*Wallet|wallet.*applied/i').isVisible().catch(() => false)
            console.log(appliedText ? '✓ Wallet applied successfully!' : '✗ Wallet not applied after click')

            // Take screenshot after click
            await page.screenshot({ path: 'test-results/local-after-wallet-apply.png', fullPage: true })
          } catch (err) {
            console.log('✗ Could not click Apply button:', err.message)
          }
        } else {
          console.log('✗ Apply button NOT visible')
          console.log('Looking for why...')

          // Check for "insufficient balance" message
          const insufficient = await page.locator('text=/餘額不足|insufficient/i').isVisible().catch(() => false)
          if (insufficient) {
            console.log('⚠ Wallet balance is insufficient (0 or less than total)')
          }
        }
      } else {
        console.log('✗ Wallet section not found in checkout')
        console.log('Possible reasons: not logged in, wallet balance is 0, or component not rendered')
      }
    } else {
      console.log('✗ Checkout section not visible - may need to select time slot first')

      // Check if we're on step 1 (date/time selection)
      const hasCalendar = await page.locator('text=/選擇時間|select.*time/i').isVisible().catch(() => false)
      console.log(hasCalendar ? 'ℹ On date/time selection step' : 'ℹ Unknown booking step')
    }

    // Save final screenshot
    await page.screenshot({ path: 'test-results/local-booking-final.png', fullPage: true })
  })
})
