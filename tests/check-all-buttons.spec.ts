import { test } from '@playwright/test';

test('Check all buttons', async ({ page }) => {
  await page.goto('http://localhost:3000/zh-HK');
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => window.scrollTo(0, 2000));
  await page.waitForTimeout(2000);

  const allButtons = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button.carousel-plus-btn'));
    return buttons.map((btn, i) => {
      const rect = btn.getBoundingClientRect();
      return {
        index: i,
        rect: { x: rect.left, y: rect.top, width: rect.width, height: rect.height },
        isVisible: rect.width > 0 && rect.height > 0 && rect.top >= 0 && rect.top < window.innerHeight,
        hasOnClick: (btn as any).onclick !== null,
        computedDisplay: window.getComputedStyle(btn).display,
        computedWidth: window.getComputedStyle(btn).width,
        computedHeight: window.getComputedStyle(btn).height
      };
    });
  });

  console.log('All buttons:', JSON.stringify(allButtons, null, 2));
});
