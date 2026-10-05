import { test, expect } from '@playwright/test';

/**
 * Verification for About Hero Restore (commit 023982e)
 *
 * Tests the restored 3-photo wheel at multiple viewports and scroll positions.
 * No fixes applied — this is a pure restore verification.
 */

const VIEWPORTS = [
  { width: 1194, height: 834, name: '1194×834' },
  { width: 1440, height: 900, name: '1440×900' },
  { width: 1920, height: 1080, name: '1920×1080' },
];

test.describe('About Hero Restore Verification', () => {
  for (const viewport of VIEWPORTS) {
    test.describe(`${viewport.name}`, () => {
      test.use({ viewport });

      test('webkit: scroll positions: 0%, 25%, 50%, 75%, point 0, point 1, point 2', async ({ page, browserName }) => {
        test.skip(browserName !== 'webkit', 'WebKit only');

        await page.goto('/about');
        await page.waitForLoadState('networkidle');

        // Wait for wheel to be mounted
        const wheelSection = page.locator('section').filter({ hasText: '關於' }).first();
        await expect(wheelSection).toBeVisible({ timeout: 10000 });

        // Screenshot at scroll 0 (hero/ring state)
        await page.screenshot({
          path: `tests/screenshots/about-hero-restore-webkit-${viewport.name}-scroll-0.png`,
          fullPage: false,
        });

        // Get the runway height for scroll calculations
        const runwayHeight = await page.evaluate(() => {
          const runway = document.querySelector('[style*="height"]');
          if (!runway) return 0;
          return runway.getBoundingClientRect().height;
        });

        // 25% of first transition (turn ~0.25)
        await page.evaluate((h) => window.scrollTo(0, h * 0.125), runwayHeight);
        await page.waitForTimeout(500);
        await page.screenshot({
          path: `tests/screenshots/about-hero-restore-webkit-${viewport.name}-scroll-25.png`,
          fullPage: false,
        });

        // 50% of first transition (turn ~0.5)
        await page.evaluate((h) => window.scrollTo(0, h * 0.25), runwayHeight);
        await page.waitForTimeout(500);
        await page.screenshot({
          path: `tests/screenshots/about-hero-restore-webkit-${viewport.name}-scroll-50.png`,
          fullPage: false,
        });

        // 75% of first transition (turn ~0.75)
        await page.evaluate((h) => window.scrollTo(0, h * 0.375), runwayHeight);
        await page.waitForTimeout(500);
        await page.screenshot({
          path: `tests/screenshots/about-hero-restore-webkit-${viewport.name}-scroll-75.png`,
          fullPage: false,
        });

        // Point 0 (turn 1)
        await page.evaluate((h) => window.scrollTo(0, h * 0.4), runwayHeight);
        await page.waitForTimeout(500);
        await page.screenshot({
          path: `tests/screenshots/about-hero-restore-webkit-${viewport.name}-point-0.png`,
          fullPage: false,
        });

        // Point 1 (turn 2)
        await page.evaluate((h) => window.scrollTo(0, h * 0.6), runwayHeight);
        await page.waitForTimeout(500);
        await page.screenshot({
          path: `tests/screenshots/about-hero-restore-webkit-${viewport.name}-point-1.png`,
          fullPage: false,
        });

        // Point 2 (turn 3)
        await page.evaluate((h) => window.scrollTo(0, h * 0.8), runwayHeight);
        await page.waitForTimeout(500);
        await page.screenshot({
          path: `tests/screenshots/about-hero-restore-webkit-${viewport.name}-point-2.png`,
          fullPage: false,
        });
      });

      test('chromium: scroll positions: 0%, 25%, 50%, 75%, point 0, point 1, point 2', async ({ page, browserName }) => {
        test.skip(browserName !== 'chromium', 'Chromium only');

        await page.goto('/about');
          await page.goto('/about');
          await page.waitForLoadState('networkidle');

          // Wait for wheel to be mounted
          const wheelSection = page.locator('section').filter({ hasText: '關於' }).first();
          await expect(wheelSection).toBeVisible({ timeout: 10000 });

          // Screenshot at scroll 0 (hero/ring state)
          await page.screenshot({
            path: `tests/screenshots/about-hero-restore-${browser}-${viewport.name}-scroll-0.png`,
            fullPage: false,
          });

          // Get the runway height for scroll calculations
          const runwayHeight = await page.evaluate(() => {
            const runway = document.querySelector('[style*="height"]');
            if (!runway) return 0;
            return runway.getBoundingClientRect().height;
          });

          // 25% of first transition (turn ~0.25)
          await page.evaluate((h) => window.scrollTo(0, h * 0.125), runwayHeight);
          await page.waitForTimeout(500);
          await page.screenshot({
            path: `tests/screenshots/about-hero-restore-${browser}-${viewport.name}-scroll-25.png`,
            fullPage: false,
          });

          // 50% of first transition (turn ~0.5)
          await page.evaluate((h) => window.scrollTo(0, h * 0.25), runwayHeight);
          await page.waitForTimeout(500);
          await page.screenshot({
            path: `tests/screenshots/about-hero-restore-${browser}-${viewport.name}-scroll-50.png`,
            fullPage: false,
          });

          // 75% of first transition (turn ~0.75)
          await page.evaluate((h) => window.scrollTo(0, h * 0.375), runwayHeight);
          await page.waitForTimeout(500);
          await page.screenshot({
            path: `tests/screenshots/about-hero-restore-${browser}-${viewport.name}-scroll-75.png`,
            fullPage: false,
          });

          // Point 0 (turn 1)
          await page.evaluate((h) => window.scrollTo(0, h * 0.4), runwayHeight);
          await page.waitForTimeout(500);
          await page.screenshot({
            path: `tests/screenshots/about-hero-restore-${browser}-${viewport.name}-point-0.png`,
            fullPage: false,
          });

          // Point 1 (turn 2)
          await page.evaluate((h) => window.scrollTo(0, h * 0.6), runwayHeight);
          await page.waitForTimeout(500);
          await page.screenshot({
            path: `tests/screenshots/about-hero-restore-${browser}-${viewport.name}-point-1.png`,
            fullPage: false,
          });

          // Point 2 (turn 3)
          await page.evaluate((h) => window.scrollTo(0, h * 0.8), runwayHeight);
          await page.waitForTimeout(500);
          await page.screenshot({
            path: `tests/screenshots/about-hero-restore-${browser}-${viewport.name}-point-2.png`,
            fullPage: false,
          });
        });
      });
    }
  }

  test('1194×834 mount and scrollability check', async ({ page }) => {
    await page.setViewportSize({ width: 1194, height: 834 });
    await page.goto('/about');
    await page.waitForLoadState('networkidle');

    // Check if wheel is mounted
    const wheelSection = page.locator('section').filter({ hasText: '關於' }).first();
    const isWheelMounted = await wheelSection.isVisible();

    // Check if page can scroll past the hero
    const initialScrollY = await page.evaluate(() => window.scrollY);
    await page.evaluate(() => window.scrollTo(0, 2000));
    await page.waitForTimeout(300);
    const scrolledY = await page.evaluate(() => window.scrollY);
    const canScrollPastHero = scrolledY > 1000;

    console.log(`Wheel mounted: ${isWheelMounted}`);
    console.log(`Can scroll past hero: ${canScrollPastHero} (scrolled to ${scrolledY}px)`);
  });
});
