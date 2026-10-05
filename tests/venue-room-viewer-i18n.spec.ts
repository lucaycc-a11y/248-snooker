import { test, expect } from '@playwright/test'

test.describe('Venue page i18n keys', () => {
  test('should not show raw i18n keys', async ({ page }) => {
    await page.goto('/zh-HK/venue')

    // Wait for page to be fully loaded
    await page.waitForLoadState('networkidle')

    // Get all visible text content
    const bodyText = await page.locator('body').innerText()

    // Check for raw i18n keys pattern: word.word.word (at least 3 segments)
    // Excluding URLs (http://), email addresses (@), and file paths (/)
    const rawKeyPattern = /\b[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*){2,}\b/gi
    const matches = bodyText.match(rawKeyPattern) || []

    // Filter out false positives
    const actualKeys = matches.filter((match) => {
      // Exclude URLs
      if (match.includes('http') || match.includes('www')) return false
      // Exclude email domains
      if (bodyText.includes(`@${match}`) || bodyText.includes(`${match}@`)) return false
      // Exclude file extensions and paths
      if (match.includes('.jpg') || match.includes('.png') || match.includes('.webp')) return false
      if (match.includes('.com') || match.includes('.hk') || match.includes('.org')) return false
      // Exclude version numbers
      if (/\d+\.\d+\.\d+/.test(match)) return false

      return true
    })

    if (actualKeys.length > 0) {
      console.error('Found raw i18n keys:', actualKeys)
    }

    expect(actualKeys, `Found ${actualKeys.length} raw i18n key(s): ${actualKeys.join(', ')}`).toHaveLength(0)
  })

  test('Venue Room Viewer text matches reference', async ({ page }) => {
    await page.goto('/zh-HK/venue')
    await page.waitForLoadState('networkidle')

    // Check heading
    const heading = page.locator('text=兩間 1T 獨立球室')
    await expect(heading).toBeVisible()

    // Check slider hint
    const hint = page.locator('text=拖動滑桿以觀看兩間球室')
    await expect(hint).toBeVisible()

    // Check pill labels
    await expect(page.locator('text=場地裝修')).toBeVisible()
    await expect(page.locator('text=舒適自在')).toBeVisible()
    await expect(page.locator('text=專業設備')).toBeVisible()
    await expect(page.locator('text=科技體驗')).toBeVisible()

    // Check room labels
    await expect(page.locator('text=Space Infinity')).toBeVisible()
    await expect(page.locator('text=Space Eternity')).toBeVisible()
    await expect(page.locator('text=無限空間球室')).toBeVisible()
    await expect(page.locator('text=永恆空間球室')).toBeVisible()
  })
})
