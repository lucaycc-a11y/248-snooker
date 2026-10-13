import { test, expect } from '@playwright/test';

/**
 * Visual regression test for Space8 About page outro section centering.
 *
 * FIXED ISSUES (from spec):
 * 1. Ball was -35px off-centre due to Tailwind preflight clamping width to 100%
 *    → Fixed with maxWidth: "none" and maxHeight: "none"
 * 2. Headline/echoes/description were -5 to -12px off-centre due to trailing 「。」
 *    → Fixed with paddingLeft: "0.375em" to compensate for Noto Sans TC spacing
 *
 * This test verifies all elements are centered on the same vertical axis at
 * multiple viewport widths.
 */

const WIDTHS = [390, 768, 1280, 1712, 3422];
const TOLERANCE = 2; // Allow ±2px for sub-pixel rendering differences

test.describe('About outro section centering', () => {
  for (const width of WIDTHS) {
    test(`elements are centered at ${width}px viewport`, async ({ page }) => {
      await page.setViewportSize({ width, height: 1200 });

      // Navigate to about page
      await page.goto('/zh-HK/about', { waitUntil: 'domcontentloaded' });

      // Wait for fonts and content to load
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(3000);

      // Scroll to outro section
      const outroSection = page.locator('[data-outro-section]');
      await outroSection.scrollIntoViewIfNeeded();
      await page.waitForTimeout(1000);

      // Wait for ball image to load
      await page.waitForFunction(() => {
        const img = document.querySelector('[data-outro-ball-scroll] img');
        return img && (img as HTMLImageElement).complete;
      }, { timeout: 10000 });

      // Measure centers
      const measurements = await page.evaluate(() => {
        const contentCenter = window.innerWidth / 2;

        const ball = document.querySelector('[data-outro-ball-scroll]') as HTMLElement;
        const ballRect = ball?.getBoundingClientRect();
        const ballCenter = ballRect ? ballRect.left + ballRect.width / 2 : 0;

        const headline = document.querySelector('[data-outro-headline-chars]') as HTMLElement;
        const headlineRect = headline?.getBoundingClientRect();
        const headlineCenter = headlineRect ? headlineRect.left + headlineRect.width / 2 : 0;

        const echo1 = document.querySelector('[data-outro-echo="1"]') as HTMLElement;
        const echo1Rect = echo1?.getBoundingClientRect();
        const echo1Center = echo1Rect ? echo1Rect.left + echo1Rect.width / 2 : 0;

        const desc = document.querySelector('[data-outro-desc]') as HTMLElement;
        const descRect = desc?.getBoundingClientRect();
        const descCenter = descRect ? descRect.left + descRect.width / 2 : 0;

        const step02 = document.querySelector('[data-outro-step="1"]') as HTMLElement;
        const step02Rect = step02?.getBoundingClientRect();
        const step02Center = step02Rect ? step02Rect.left + step02Rect.width / 2 : 0;

        return {
          contentCenter,
          ballCenter,
          headlineCenter,
          echo1Center,
          descCenter,
          step02Center,
        };
      });

      // Verify all elements are centered within tolerance
      const { contentCenter, ballCenter, headlineCenter, echo1Center, descCenter, step02Center } = measurements;

      expect(Math.abs(ballCenter - contentCenter)).toBeLessThanOrEqual(TOLERANCE);
      expect(Math.abs(headlineCenter - contentCenter)).toBeLessThanOrEqual(TOLERANCE);
      expect(Math.abs(echo1Center - contentCenter)).toBeLessThanOrEqual(TOLERANCE);
      expect(Math.abs(descCenter - contentCenter)).toBeLessThanOrEqual(TOLERANCE);
      expect(Math.abs(step02Center - contentCenter)).toBeLessThanOrEqual(TOLERANCE);
    });
  }

  test('mobile 390px: no horizontal scroll, headline on one line', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    await page.goto('/zh-HK/about', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(3000);

    const outroSection = page.locator('[data-outro-section]');
    await outroSection.scrollIntoViewIfNeeded();
    await page.waitForTimeout(1000);

    // Check no horizontal overflow
    const hasHorizontalScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(hasHorizontalScroll).toBe(false);

    // Check headline renders on one line (height should be ~1.2em of font size)
    const headlineHeight = await page.locator('[data-outro-headline-chars]').evaluate((el) => {
      const rect = el.getBoundingClientRect();
      const fontSize = parseFloat(getComputedStyle(el).fontSize);
      return rect.height / fontSize;
    });
    expect(headlineHeight).toBeLessThan(1.5); // Single line with 1.2 line-height

    // Check ball is visible and not clipped
    const ballVisible = await page.locator('[data-outro-ball-scroll] img').isVisible();
    expect(ballVisible).toBe(true);
  });
});
