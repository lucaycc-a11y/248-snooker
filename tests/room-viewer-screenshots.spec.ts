import { test } from '@playwright/test'

const baseURL = 'http://localhost:3000'

test.describe('Room Viewer - Screenshots', () => {
  test('Desktop 1440x900 - All 4 pills', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(`${baseURL}/venue`, { waitUntil: 'networkidle' })
    await page.locator('text=兩間 1T 獨立球室').scrollIntoViewIfNeeded()
    await page.waitForTimeout(1000)

    // Pill 1: 場地裝修 (default)
    await page.screenshot({ path: 'test-results/desktop-1440x900-pill-1-deco.png', fullPage: false })

    // Pill 2: 舒適自在
    await page.locator('[data-tab="comfort"]').click()
    await page.waitForTimeout(800)
    await page.screenshot({ path: 'test-results/desktop-1440x900-pill-2-comfort.png', fullPage: false })

    // Pill 3: 專業設備
    await page.locator('[data-tab="pro"]').click()
    await page.waitForTimeout(800)
    await page.screenshot({ path: 'test-results/desktop-1440x900-pill-3-pro.png', fullPage: false })

    // Pill 4: 科技體驗
    await page.locator('[data-tab="pilot"]').click()
    await page.waitForTimeout(800)
    await page.screenshot({ path: 'test-results/desktop-1440x900-pill-4-pilot.png', fullPage: false })
  })

  test('iPad 1180x820 - All 4 pills', async ({ page }) => {
    await page.setViewportSize({ width: 1180, height: 820 })
    await page.goto(`${baseURL}/venue`, { waitUntil: 'networkidle' })
    await page.locator('text=兩間 1T 獨立球室').scrollIntoViewIfNeeded()
    await page.waitForTimeout(1000)

    await page.screenshot({ path: 'test-results/ipad-1180x820-pill-1-deco.png', fullPage: false })

    await page.locator('[data-tab="comfort"]').click()
    await page.waitForTimeout(800)
    await page.screenshot({ path: 'test-results/ipad-1180x820-pill-2-comfort.png', fullPage: false })

    await page.locator('[data-tab="pro"]').click()
    await page.waitForTimeout(800)
    await page.screenshot({ path: 'test-results/ipad-1180x820-pill-3-pro.png', fullPage: false })

    await page.locator('[data-tab="pilot"]').click()
    await page.waitForTimeout(800)
    await page.screenshot({ path: 'test-results/ipad-1180x820-pill-4-pilot.png', fullPage: false })
  })

  test('Phone 396x860 - All 4 pills', async ({ page }) => {
    await page.setViewportSize({ width: 396, height: 860 })
    await page.goto(`${baseURL}/venue`, { waitUntil: 'networkidle' })
    await page.locator('text=兩間 1T 獨立球室').scrollIntoViewIfNeeded()
    await page.waitForTimeout(1000)

    await page.screenshot({ path: 'test-results/phone-396x860-pill-1-deco.png', fullPage: false })

    await page.locator('[data-tab="comfort"]').click()
    await page.waitForTimeout(800)
    await page.screenshot({ path: 'test-results/phone-396x860-pill-2-comfort.png', fullPage: false })

    await page.locator('[data-tab="pro"]').click()
    await page.waitForTimeout(800)
    await page.screenshot({ path: 'test-results/phone-396x860-pill-3-pro.png', fullPage: false })

    await page.locator('[data-tab="pilot"]').click()
    await page.waitForTimeout(800)
    await page.screenshot({ path: 'test-results/phone-396x860-pill-4-pilot.png', fullPage: false })
  })
})
