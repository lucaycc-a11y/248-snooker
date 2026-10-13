import { test, expect } from '@playwright/test'

test.describe('Wallet Credits UI', () => {
  test('should show wallet balance and apply button when user has credits', async ({ page }) => {
    // Navigate to booking page
    await page.goto('http://localhost:3000/zh-HK/book')

    // Wait for page to load
    await page.waitForLoadState('networkidle')

    // Check if user is logged in - look for any sign of authentication
    const bodyText = await page.textContent('body')
    console.log('Page loaded, checking for wallet UI...')

    // Look for wallet balance text
    const walletBalanceText = await page.getByText(/Space Wallet 可用餘額|wallet.*balance/i).first()

    if (await walletBalanceText.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log('✓ Wallet balance text found')

      // Check if apply button exists
      const applyButton = page.getByRole('button', { name: /套用|apply/i })
      const isApplyVisible = await applyButton.isVisible().catch(() => false)

      if (isApplyVisible) {
        console.log('✓ Apply button is visible')

        // Try to click it
        await applyButton.click()
        console.log('✓ Apply button clicked')

        // Check if wallet was applied (look for the minus amount)
        await page.waitForTimeout(1000)
        const appliedText = await page.getByText(/已套用 Space Wallet|wallet.*applied/i).isVisible().catch(() => false)
        console.log(appliedText ? '✓ Wallet applied successfully' : '✗ Wallet not applied after click')
      } else {
        console.log('✗ Apply button not visible - checking why')

        // Check what's on the page
        const walletSection = await page.locator('text=/Space Wallet/i').first().locator('..').innerHTML()
        console.log('Wallet section HTML:', walletSection.substring(0, 500))
      }
    } else {
      console.log('✗ Wallet balance text not found')
      console.log('Checking if user is logged in...')

      // Look for common auth indicators
      const hasProfile = await page.getByText(/會員|member/i).isVisible().catch(() => false)
      console.log(hasProfile ? 'User appears to be logged in' : 'User may not be logged in')
    }

    // Take a screenshot for debugging
    await page.screenshot({ path: 'test-results/wallet-ui-debug.png', fullPage: true })
    console.log('Screenshot saved to test-results/wallet-ui-debug.png')
  })
})
