import { test } from '@playwright/test';

test('Scroll button into view then click', async ({ page }) => {
  page.on('console', msg => {
    console.log(`[${msg.type()}] ${msg.text()}`);
  });

  await page.goto('http://localhost:3000/zh-HK');
  await page.waitForLoadState('networkidle');

  // Scroll to carousel area
  await page.evaluate(() => window.scrollTo(0, 2000));
  await page.waitForTimeout(2000);

  console.log('\n=== SCROLLING BUTTON INTO VIEW ===\n');

  const plusBtn = page.locator('button.carousel-plus-btn').first();

  // Scroll the button itself into view
  await plusBtn.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);

  // Check position after scroll
  const rect = await plusBtn.boundingBox();
  console.log('Button position after scroll:', rect);

  console.log('\n=== CLICKING BUTTON ===\n');
  await plusBtn.click({ force: false });

  await page.waitForTimeout(3000);
  console.log('\n=== END ===\n');
});
