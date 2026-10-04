import { test, expect } from '@playwright/test'
import { loginAsTestUser } from '../helpers/auth'

/**
 * Issue 1: Points API Contract Test
 *
 * Verifies that /api/member/points returns the correct flat PointsSummary
 * and that PointsPageClient can render with that exact JSON.
 *
 * Expected values for Luca (id fec0303c-e7e8-412e-bcd9-aabf41148767):
 * - lifetime: 19760
 * - redeemable: 96
 * - convertedPoints: 100
 * - depositedToWallet: 10
 * - tier: maximum
 */

test.describe('Points API Contract', () => {
  test('GET /api/member/points returns flat PointsSummary with correct values', async ({ page }) => {
    await loginAsTestUser(page)

    // Call the API directly
    const response = await page.request.get('/api/member/points')
    expect(response.ok()).toBe(true)

    const data = await response.json()

    // Verify structure: flat summary, no nested objects
    expect(data).toHaveProperty('lifetime')
    expect(data).toHaveProperty('redeemable')
    expect(data).toHaveProperty('convertedPoints')
    expect(data).toHaveProperty('depositedToWallet')
    expect(data).toHaveProperty('tier')
    expect(data).toHaveProperty('blockSize')
    expect(data).toHaveProperty('creditsPerBlock')

    // Should NOT have nested summary or transactions
    expect(data).not.toHaveProperty('summary')
    expect(data).not.toHaveProperty('transactions')

    // Verify types
    expect(typeof data.lifetime).toBe('number')
    expect(typeof data.redeemable).toBe('number')
    expect(typeof data.convertedPoints).toBe('number')
    expect(typeof data.depositedToWallet).toBe('number')
    expect(typeof data.tier).toBe('string')
    expect(typeof data.blockSize).toBe('number')
    expect(typeof data.creditsPerBlock).toBe('number')

    // Verify Luca's expected values
    expect(data.lifetime).toBe(19760)
    expect(data.redeemable).toBe(96)
    expect(data.convertedPoints).toBe(100)
    expect(data.depositedToWallet).toBe(10)
    expect(data.tier).toBe('maximum')

    console.log('✓ API returned correct flat summary:', data)
  })

  test('PointsPageClient renders successfully with API data', async ({ page }) => {
    await loginAsTestUser(page)

    // Navigate to points page
    await page.goto('/member/points')
    await page.waitForLoadState('networkidle')

    // Verify page loaded successfully (not error state)
    const errorAlert = page.locator('.alert[role="alert"]')
    await expect(errorAlert).not.toBeVisible()

    // Verify summary card is visible
    const pointsCard = page.locator('.pcard')
    await expect(pointsCard).toBeVisible()

    // Verify lifetime points display
    const lifetimeDisplay = page.locator('.p-big.gt')
    await expect(lifetimeDisplay).toBeVisible()
    const lifetimeText = await lifetimeDisplay.textContent()
    expect(lifetimeText?.replace(/,/g, '')).toBe('19760')

    // Verify redeemable progress section
    const progressSection = page.locator('.prog')
    await expect(progressSection).toBeVisible()

    // Verify stats section shows converted points and deposited wallet
    const stats = page.locator('.stats .stat')
    expect(await stats.count()).toBeGreaterThanOrEqual(2)

    console.log('✓ PointsPageClient rendered successfully with API data')
  })

  test('GET /api/member/points/transactions returns paginated feed', async ({ page }) => {
    await loginAsTestUser(page)

    // Call transactions API
    const response = await page.request.get('/api/member/points/transactions')
    expect(response.ok()).toBe(true)

    const data = await response.json()

    // Verify structure
    expect(data).toHaveProperty('items')
    expect(data).toHaveProperty('hasMore')
    expect(data).toHaveProperty('nextCursor')

    expect(Array.isArray(data.items)).toBe(true)
    expect(typeof data.hasMore).toBe('boolean')

    // Verify item structure if any items exist
    if (data.items.length > 0) {
      const item = data.items[0]
      expect(item).toHaveProperty('id')
      expect(item).toHaveProperty('source')
      expect(item).toHaveProperty('type')
      expect(item).toHaveProperty('points')
      expect(item).toHaveProperty('createdAt')
      expect(item).toHaveProperty('note')

      expect(['points', 'credits']).toContain(item.source)
      expect(typeof item.points).toBe('number')
    }

    console.log(`✓ Transactions API returned ${data.items.length} items`)
  })

  test('Points page makes two separate API calls (summary + transactions)', async ({ page }) => {
    await loginAsTestUser(page)

    const apiCalls: string[] = []

    // Intercept API calls
    page.on('request', request => {
      const url = request.url()
      if (url.includes('/api/member/points')) {
        apiCalls.push(url)
      }
    })

    await page.goto('/member/points')
    await page.waitForLoadState('networkidle')

    // Verify two separate calls were made
    const summaryCall = apiCalls.find(url => url.endsWith('/api/member/points'))
    const transactionsCall = apiCalls.find(url => url.includes('/api/member/points/transactions'))

    expect(summaryCall).toBeDefined()
    expect(transactionsCall).toBeDefined()

    console.log('✓ Page made two separate API calls:', {
      summary: summaryCall,
      transactions: transactionsCall
    })
  })
})
