import { test, expect } from '@playwright/test';

test('Modal appears after button click', async ({ page }) => {
  page.on('console', msg => console.log(`[${msg.type()}] ${msg.text()}`));

  await page.goto('http://localhost:3000/zh-HK');
  await page.waitForLoadState('networkidle');

  // Scroll to carousel
  await page.evaluate(() => window.scrollTo(0, 2000));
  await page.waitForTimeout(1000);

  // Click button
  const plusBtn = page.locator('button.carousel-plus-btn').first();
  await plusBtn.click();

  // Wait for modal to appear
  await page.waitForTimeout(500);

  // Check if dialog role exists
  const dialog = page.locator('[role="dialog"]');
  const dialogCount = await dialog.count();
  console.log('\nDialog count:', dialogCount);

  if (dialogCount > 0) {
    const isVisible = await dialog.first().isVisible();
    console.log('Dialog visible:', isVisible);
  }

  // Check body overflow
  const bodyOverflow = await page.evaluate(() => document.body.style.overflow);
  console.log('Body overflow:', bodyOverflow);

  // Screenshot
  await page.screenshot({ path: 'tests/screenshots/modal-verification.png', fullPage: true });

  // Assert
  await expect(dialog).toBeVisible();
});
