import { test, expect, devices } from '@playwright/test';

test.use({
  ...devices['iPhone 13'],
});

test.describe('Carousel First Paint & Button Click', () => {

  test('Problem A: All carousel chrome visible on first paint (WebKit)', async ({ page }) => {
    await page.goto('http://localhost:3002/');

    // Wait for carousel to appear and scroll to it
    const carousel = page.locator('[class*="carouselContainerCentered"]').first();
    await carousel.waitFor({ state: 'visible', timeout: 10000 });
    await carousel.scrollIntoViewIfNeeded();
    await page.waitForTimeout(100); // Brief settle after scroll

    // Check first card immediately - no waiting for hydration
    const firstCard = page.locator('[class*="carouselSlideCentered"]').first();
    const computedStyle = await firstCard.evaluate((el) => {
      const styles = window.getComputedStyle(el);
      return {
        borderRadius: styles.borderRadius,
        border: styles.border,
        background: styles.background,
      };
    });

    console.log('First card computed styles:', computedStyle);
    expect(computedStyle.borderRadius).toBe('32px');

    // Check button positioning
    const plusBtn = page.locator('[class*="carouselPlusBtn"]').first();
    const btnStyle = await plusBtn.evaluate((el) => {
      const styles = window.getComputedStyle(el);
      return {
        position: styles.position,
        bottom: styles.bottom,
        right: styles.right,
        zIndex: styles.zIndex,
      };
    });

    console.log('Plus button computed styles:', btnStyle);
    expect(btnStyle.position).toBe('absolute');
    expect(btnStyle.bottom).toBe('24px');
    expect(btnStyle.right).toBe('24px');

    // Check pagination pill
    const pagination = page.locator('[class*="carouselPaginationCentered"]').first();
    const paginationStyle = await pagination.evaluate((el) => {
      const styles = window.getComputedStyle(el);
      return {
        borderRadius: styles.borderRadius,
        background: styles.background,
      };
    });

    console.log('Pagination computed styles:', paginationStyle);
    expect(paginationStyle.borderRadius).toContain('999px');

    await page.screenshot({ path: 'tests/screenshots/carousel-first-paint-webkit.png', fullPage: false });
  });

  test('Problem B: Plus button opens modal on click', async ({ page }) => {
    await page.goto('http://localhost:3002/');

    // Wait for carousel to appear
    const carousel = page.locator('[class*="carouselContainerCentered"]').first();
    await carousel.waitFor({ state: 'visible', timeout: 10000 });
    await carousel.scrollIntoViewIfNeeded();

    // Wait for carousel to be visible
    await page.locator('[class*="carouselSlideCentered"]').first().waitFor({ state: 'visible' });

    // Click the plus button on first card
    const plusBtn = page.locator('[class*="carouselPlusBtn"]').first();
    await plusBtn.click();

    // Wait for modal to appear (give time for React state update + portal render)
    await page.waitForTimeout(500);

    // Verify sheet content exists
    const sheetContent = page.locator('[role="dialog"]');
    await expect(sheetContent).toBeVisible({ timeout: 10000 });

    // Verify body overflow is hidden
    const bodyOverflow = await page.evaluate(() => document.body.style.overflow);
    expect(bodyOverflow).toBe('hidden');

    await page.screenshot({ path: 'tests/screenshots/carousel-modal-open.png', fullPage: false });
  });

  test('Problem A: Chrome visible with JS disabled', async ({ page, context }) => {
    // Disable JavaScript
    await context.route('**/*', route => {
      if (route.request().resourceType() === 'script') {
        route.abort();
      } else {
        route.continue();
      }
    });

    await page.goto('http://localhost:3002/');

    // With JS disabled, wait a bit then check if carousel HTML exists
    await page.waitForTimeout(2000);

    // Check that card structure exists in HTML
    const firstCard = page.locator('[class*="carouselSlideCentered"]').first();
    await expect(firstCard).toBeVisible();

    const plusBtn = page.locator('[class*="carouselPlusBtn"]').first();
    await expect(plusBtn).toBeVisible();

    const pagination = page.locator('[class*="carouselPaginationCentered"]').first();
    await expect(pagination).toBeVisible();

    await page.screenshot({ path: 'tests/screenshots/carousel-no-js.png', fullPage: false });
  });
});
