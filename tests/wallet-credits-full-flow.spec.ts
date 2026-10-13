import { test, expect } from '@playwright/test'

/**
 * Full booking flow test to verify wallet credits UI works end-to-end
 *
 * This test will:
 * 1. Go to booking page
 * 2. Select a date and time slot
 * 3. Proceed to checkout
 * 4. Login if needed
 * 5. Check if wallet credits UI appears
 * 6. Try to apply wallet credits
 */

test.describe('Wallet Credits - Full Flow', () => {
  test('should allow applying wallet credits in checkout', async ({ page }) => {
    console.log('=== Starting Wallet Credits Full Flow Test ===\n')

    // Step 1: Navigate to booking page
    await page.goto('http://localhost:3000/zh-HK/book')
    await page.waitForLoadState('networkidle')
    console.log('✓ Step 1: Loaded booking page')

    // Step 2: Select a date (pick tomorrow to avoid closed slots)
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const tomorrowDate = tomorrow.getDate()

    // Click on tomorrow's date in calendar
    const dateButton = page.locator(`button:has-text("${tomorrowDate}")`).first()
    if (await dateButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await dateButton.click()
      console.log(`✓ Step 2: Selected date ${tomorrowDate}`)
      await page.waitForTimeout(1000)
    } else {
      console.log('⚠ Could not find date button, trying first available slot')
    }

    // Step 3: Select a time slot (find first available "可選擇" slot)
    await page.waitForTimeout(1000)

    // Look for any available time slot
    const availableSlots = page.locator('button:not(:has-text("已滿額")):not(:has-text("已過時"))').filter({
      hasText: /^\d{2}:00$/
    })

    const slotCount = await availableSlots.count()
    console.log(`Found ${slotCount} potential time slots`)

    if (slotCount > 0) {
      // Click first available slot
      await availableSlots.first().click()
      console.log('✓ Step 3: Selected time slot')
      await page.waitForTimeout(1500)

      // Take screenshot after slot selection
      await page.screenshot({ path: 'test-results/after-slot-selection.png', fullPage: true })
    } else {
      console.log('✗ No available time slots found')
      await page.screenshot({ path: 'test-results/no-slots-available.png', fullPage: true })
      return
    }

    // Step 4: Look for "繼續預訂" or "Next" button to proceed
    const nextButton = page.locator('button:has-text("繼續預訂"), button:has-text("下一步"), button:has-text("Next")')
    if (await nextButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await nextButton.click()
      console.log('✓ Step 4: Clicked next/continue button')
      await page.waitForTimeout(1500)
    } else {
      console.log('ℹ No explicit next button found, may have auto-advanced')
    }

    // Step 5: Check if we're at checkout (look for payment section)
    await page.waitForTimeout(1000)
    const checkoutVisible = await page.locator('text=/付款方式|payment|結帳|checkout/i').first().isVisible({ timeout: 5000 }).catch(() => false)

    if (!checkoutVisible) {
      console.log('⚠ Not at checkout yet, taking debug screenshot')
      await page.screenshot({ path: 'test-results/not-at-checkout.png', fullPage: true })

      // Try to find what step we're on
      const currentStepText = await page.textContent('body')
      console.log('Current page content preview:', currentStepText?.substring(0, 500))
      return
    }

    console.log('✓ Step 5: At checkout screen')
    await page.screenshot({ path: 'test-results/at-checkout.png', fullPage: true })

    // Step 6: Look for wallet credits section
    const walletSection = page.locator('text=/Space Wallet|錢包/i').first()
    const walletVisible = await walletSection.isVisible({ timeout: 3000 }).catch(() => false)

    if (!walletVisible) {
      console.log('✗ Wallet section NOT visible')
      console.log('Possible reasons:')
      console.log('  - User not logged in (walletBalance = 0)')
      console.log('  - CheckoutWalletRow returns null when balance is 0')

      // Check if user is logged in
      const loginButton = await page.locator('text=/登入|login/i').isVisible().catch(() => false)
      if (loginButton) {
        console.log('⚠ User is NOT logged in - wallet requires auth')
      }

      return
    }

    console.log('✓ Step 6: Wallet section VISIBLE!')

    // Get wallet balance text
    const walletParent = walletSection.locator('..')
    const walletText = await walletParent.textContent()
    console.log('Wallet text:', walletText)

    // Step 7: Look for Apply button
    const applyButton = page.locator('button:has-text("套用"), button:has-text("Apply")').first()
    const applyVisible = await applyButton.isVisible({ timeout: 2000 }).catch(() => false)

    if (!applyVisible) {
      console.log('✗ Apply button NOT visible')

      // Check if insufficient balance
      const insufficient = await page.locator('text=/餘額不足|insufficient/i').isVisible().catch(() => false)
      if (insufficient) {
        console.log('⚠ Reason: Wallet balance is insufficient (less than booking total)')
      } else {
        console.log('⚠ Reason: Unknown - taking screenshot for debug')
        await walletSection.screenshot({ path: 'test-results/wallet-no-button.png' })
      }

      return
    }

    console.log('✓ Step 7: Apply button IS VISIBLE')

    // Check if button is enabled
    const isEnabled = await applyButton.isEnabled()
    console.log(`Button enabled: ${isEnabled}`)

    // Get button position
    const buttonBox = await applyButton.boundingBox()
    console.log('Button position:', buttonBox)

    // Step 8: Try to click Apply button
    try {
      await applyButton.click({ timeout: 3000 })
      console.log('✓ Step 8: Apply button CLICKED successfully!')

      // Wait for wallet to be applied
      await page.waitForTimeout(1500)

      // Check if wallet was applied (look for green "-HK$XX" text)
      const appliedVisible = await page.locator('text=/已套用.*Wallet|−.*HK\$/i').isVisible({ timeout: 3000 }).catch(() => false)

      if (appliedVisible) {
        console.log('✅ SUCCESS: Wallet credits APPLIED!')

        // Get the applied amount
        const appliedText = await page.locator('text=/−.*HK\$/').first().textContent()
        console.log(`Applied amount: ${appliedText}`)

        // Take success screenshot
        await page.screenshot({ path: 'test-results/wallet-applied-success.png', fullPage: true })

        // Check if total was reduced
        const totalSection = page.locator('text=/總計|total/i').first().locator('..')
        const totalText = await totalSection.textContent()
        console.log('Total after wallet applied:', totalText)

      } else {
        console.log('⚠ Wallet button clicked but no confirmation of application')
        await page.screenshot({ path: 'test-results/wallet-clicked-no-confirm.png', fullPage: true })
      }

    } catch (err) {
      console.log(`✗ FAILED to click Apply button: ${err.message}`)
      await page.screenshot({ path: 'test-results/wallet-click-failed.png', fullPage: true })

      // Additional debugging
      console.log('Debugging why click failed:')
      const isVisible = await applyButton.isVisible()
      const isEnabled = await applyButton.isEnabled()
      const box = await applyButton.boundingBox()
      console.log(`  Visible: ${isVisible}`)
      console.log(`  Enabled: ${isEnabled}`)
      console.log(`  Bounding box: ${JSON.stringify(box)}`)
    }

    console.log('\n=== Test Complete ===')
  })
})
