import { test } from '@playwright/test';

test('Screenshot membership cards', async ({ page }) => {
  await page.goto('http://localhost:3000');
  await page.waitForLoadState('networkidle');
  
  // Find and scroll to the membership cards section
  const membershipSection = await page.locator('section').filter({ hasText: '會員制度' }).first();
  await membershipSection.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  
  // Scroll a bit more to center the cards
  await page.evaluate(() => window.scrollBy(0, -100));
  await page.waitForTimeout(500);
  
  // Desktop 1440px
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.screenshot({ path: 'membership-cards-1440.png', fullPage: false });
  
  // Tablet 820px
  await page.setViewportSize({ width: 820, height: 1180 });
  await membershipSection.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'membership-cards-820.png', fullPage: false });
  
  // Mobile 390px
  await page.setViewportSize({ width: 390, height: 844 });
  await membershipSection.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'membership-cards-390.png', fullPage: false });
});
