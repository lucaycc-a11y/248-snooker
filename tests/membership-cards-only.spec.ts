import { test } from '@playwright/test';

test('Screenshot membership cards section', async ({ page }) => {
  await page.goto('http://localhost:3000');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);
  
  // Scroll down to find the membership section
  // The section should have the heading "會員制度"
  await page.evaluate(() => {
    const headings = Array.from(document.querySelectorAll('h2, h3'));
    const membershipHeading = headings.find(h => h.textContent?.includes('會員制度'));
    if (membershipHeading) {
      membershipHeading.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
  
  await page.waitForTimeout(2000);
  
  // Desktop 1440px
  await page.setViewportSize({ width: 1440, height: 1200 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'membership-section-1440.png', fullPage: false });
  
  // Tablet 820px
  await page.setViewportSize({ width: 820, height: 1400 });
  await page.evaluate(() => {
    const headings = Array.from(document.querySelectorAll('h2, h3'));
    const membershipHeading = headings.find(h => h.textContent?.includes('會員制度'));
    if (membershipHeading) {
      membershipHeading.scrollIntoView({ behavior: 'instant', block: 'start' });
    }
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'membership-section-820.png', fullPage: false });
  
  // Mobile 390px
  await page.setViewportSize({ width: 390, height: 1000 });
  await page.evaluate(() => {
    const headings = Array.from(document.querySelectorAll('h2, h3'));
    const membershipHeading = headings.find(h => h.textContent?.includes('會員制度'));
    if (membershipHeading) {
      membershipHeading.scrollIntoView({ behavior: 'instant', block: 'start' });
    }
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'membership-section-390.png', fullPage: false });
});
