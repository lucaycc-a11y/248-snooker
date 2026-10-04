import { test } from '@playwright/test';

test('Screenshot membership section with cards', async ({ page }) => {
  await page.goto('http://localhost:3000');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);
  
  // Find the specific text "優越會員" to locate the first card
  const firstCard = page.locator('text=優越會員').first();
  await firstCard.scrollIntoViewIfNeeded({ block: 'center' });
  await page.waitForTimeout(1000);
  
  // Desktop 1440px - take full page to see all cards
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.screenshot({ path: 'membership-final-1440.png', fullPage: false });
  
  // Tablet 820px
  await page.setViewportSize({ width: 820, height: 1180 });
  await firstCard.scrollIntoViewIfNeeded({ block: 'center' });
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'membership-final-820.png', fullPage: false });
  
  // Mobile 390px
  await page.setViewportSize({ width: 390, height: 844 });
  await firstCard.scrollIntoViewIfNeeded({ block: 'center' });
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'membership-final-390.png', fullPage: false });
});
