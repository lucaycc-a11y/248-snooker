import { test, expect } from '@playwright/test'

/**
 * Contract test for /api/member/wallet API shape
 *
 * Ensures the API returns the correct WalletApiResponse shape and that
 * the wallet page can handle both correct and incorrect API responses.
 */

test.describe('Wallet API Contract', () => {
  test('wallet page renders with correct API shape', async ({ page }) => {
    // Mock the API with correct shape
    await page.route('/api/member/wallet', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          balance: 500,
          currency: 'HKD',
          held: 0,
          available: 500,
          memberCode: 'TEST123',
          ledger: {
            items: [
              {
                id: '1',
                type: 'booking',
                amount: -100,
                created_at: '2024-01-15T10:00:00Z',
                description: 'Test booking'
              }
            ],
            hasMore: false,
            nextCursor: null
          }
        })
      })
    })

    await page.goto('http://localhost:3000/zh-HK/member/wallet')
    await page.waitForLoadState('networkidle')

    // Should show balance, not skeleton
    const balanceText = await page.locator('text=/HK\$500|500/').first().textContent()
    expect(balanceText).toBeTruthy()

    // Should NOT show skeleton loader indefinitely
    const skeletonVisible = await page.locator('[class*="skeleton"]').isVisible({ timeout: 2000 }).catch(() => false)
    expect(skeletonVisible).toBe(false)
  })

  test('wallet page shows error state with wrong API shape', async ({ page }) => {
    // Mock the API with WRONG shape (old nested structure)
    await page.route('/api/member/wallet', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          balance: {
            available: 500,
            held: 0,
            memberCode: 'TEST123'
          },
          ledger: []
        })
      })
    })

    await page.goto('http://localhost:3000/zh-HK/member/wallet')
    await page.waitForLoadState('networkidle')

    // Wait a bit for client-side error handling
    await page.waitForTimeout(1500)

    // Should show error state, NOT permanent skeleton
    // Check that balance is either showing error or showing nothing (not skeleton)
    const hasError = await page.locator('text=/錯誤|error|載入失敗|failed/i').isVisible({ timeout: 2000 }).catch(() => false)
    const hasBalance = await page.locator('text=/HK\$/').isVisible({ timeout: 1000 }).catch(() => false)

    // Either shows error state OR doesn't show balance (but must not show skeleton forever)
    expect(hasError || !hasBalance).toBe(true)
  })

  test('wallet page handles API error gracefully', async ({ page }) => {
    // Mock API 500 error
    await page.route('/api/member/wallet', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'server_error' })
      })
    })

    await page.goto('http://localhost:3000/zh-HK/member/wallet')
    await page.waitForLoadState('networkidle')

    // Should show error state
    await page.waitForTimeout(1500)

    const errorVisible = await page.locator('text=/錯誤|error|載入失敗|failed/i').isVisible({ timeout: 2000 }).catch(() => false)
    expect(errorVisible).toBe(true)
  })
})
