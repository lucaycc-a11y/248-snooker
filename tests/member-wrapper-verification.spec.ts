import { test, expect } from '@playwright/test'
import { loginAsTestUser } from './helpers/auth'

/**
 * Issue 1: M8 Wrapper Verification
 *
 * Verifies that all member pages have their correct m8 wrapper classes
 * and that computed styles match the design specifications.
 *
 * Requirements:
 * - wallet: .m8.m8-wallet wrapper with .wcard having radial-gradient and 20px radius
 * - points: .m8.m8-points wrapper with .app max-width
 * - inbox: .m8.m8-inbox wrapper with .app structure
 * - home: .m8.m8-actions wrapper around tile grid only
 */

test.describe('Member Area M8 Wrapper Verification', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page)
  })

  test('wallet page has m8-wallet wrapper and correct styles', async ({ page }) => {
    await page.goto('/member/wallet')
    await page.waitForLoadState('networkidle')

    // Verify m8-wallet wrapper exists
    const wrapper = page.locator('.m8.m8-wallet')
    await expect(wrapper).toBeVisible()

    // Verify main.app.wide structure inside wrapper
    const main = wrapper.locator('main.app.wide')
    await expect(main).toBeVisible()

    // Verify wallet card has correct styles
    const wcard = page.locator('.wcard')
    await expect(wcard).toBeVisible()

    // Check border-radius is 20px
    const borderRadius = await wcard.evaluate((el) => {
      return window.getComputedStyle(el).borderRadius
    })
    expect(borderRadius).toBe('20px')

    // Check for radial-gradient background
    const background = await wcard.evaluate((el) => {
      return window.getComputedStyle(el).backgroundImage
    })
    expect(background).toContain('radial-gradient')

    // Verify Good Times font family on .gt elements
    const gtElement = page.locator('.gt').first()
    const fontFamily = await gtElement.evaluate((el) => {
      return window.getComputedStyle(el).fontFamily
    })
    expect(fontFamily.toLowerCase()).toContain('good times')
  })

  test('points page has m8-points wrapper and correct styles', async ({ page }) => {
    await page.goto('/member/points')
    await page.waitForLoadState('networkidle')

    // Verify m8-points wrapper exists
    const wrapper = page.locator('.m8.m8-points')
    await expect(wrapper).toBeVisible()

    // Verify main.app.wide structure inside wrapper
    const main = wrapper.locator('main.app.wide')
    await expect(main).toBeVisible()

    // Verify .app has max-width constraint
    const maxWidth = await main.evaluate((el) => {
      return window.getComputedStyle(el).maxWidth
    })
    // Should have a max-width set (not 'none')
    expect(maxWidth).not.toBe('none')

    // Verify Good Times font family on .gt elements
    const gtElement = page.locator('.gt').first()
    await expect(gtElement).toBeVisible()
    const fontFamily = await gtElement.evaluate((el) => {
      return window.getComputedStyle(el).fontFamily
    })
    expect(fontFamily.toLowerCase()).toContain('good times')
  })

  test('inbox page has m8-inbox wrapper and correct styles', async ({ page }) => {
    await page.goto('/member/inbox')
    await page.waitForLoadState('networkidle')

    // Verify m8-inbox wrapper exists
    const wrapper = page.locator('.m8.m8-inbox')
    await expect(wrapper).toBeVisible()

    // Verify main.app structure inside wrapper
    const main = wrapper.locator('main.app')
    await expect(main).toBeVisible()

    // Verify .app has max-width constraint
    const maxWidth = await main.evaluate((el) => {
      return window.getComputedStyle(el).maxWidth
    })
    expect(maxWidth).not.toBe('none')
  })

  test('home page has m8-actions wrapper around tile grid only', async ({ page }) => {
    await page.goto('/member')
    await page.waitForLoadState('networkidle')

    // Verify m8-actions wrapper exists
    const wrapper = page.locator('.m8.m8-actions')
    await expect(wrapper).toBeVisible()

    // Verify HorizontalActionTiles component is inside the wrapper
    // (It should contain action tiles/links)
    const tilesInside = wrapper.locator('a, button').first()
    await expect(tilesInside).toBeVisible()

    // Verify wrapper is NOT around the entire page
    // (The member card should be outside this wrapper)
    const memberCard = page.locator('[class*="member"]').first()
    if (await memberCard.isVisible()) {
      const isInsideWrapper = await memberCard.evaluate((el) => {
        return el.closest('.m8.m8-actions') !== null
      })
      expect(isInsideWrapper).toBe(false)
    }
  })

  test('all three pages have scoped CSS properly applied', async ({ page }) => {
    // Test wallet scoped styles
    await page.goto('/member/wallet')
    await page.waitForLoadState('networkidle')

    const walletWrapper = page.locator('.m8.m8-wallet')
    await expect(walletWrapper).toBeVisible()

    // Test points scoped styles
    await page.goto('/member/points')
    await page.waitForLoadState('networkidle')

    const pointsWrapper = page.locator('.m8.m8-points')
    await expect(pointsWrapper).toBeVisible()

    // Test inbox scoped styles
    await page.goto('/member/inbox')
    await page.waitForLoadState('networkidle')

    const inboxWrapper = page.locator('.m8.m8-inbox')
    await expect(inboxWrapper).toBeVisible()

    // All three pages should have their scoped wrapper
    // This ensures the 357 CSS rules in member-ui.css can match
  })
})
