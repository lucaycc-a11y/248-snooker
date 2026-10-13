import { test } from '@playwright/test';

test('Check what element is actually on top', async ({ page }) => {
  await page.goto('http://localhost:3000/zh-HK');
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => window.scrollTo(0, 2000));
  await page.waitForTimeout(2000);

  const clickInfo = await page.evaluate(() => {
    const btn = document.querySelector('button.carousel-plus-btn');
    if (!btn) return { found: false };

    const rect = btn.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const elementAtPoint = document.elementFromPoint(centerX, centerY);

    return {
      found: true,
      buttonRect: { x: rect.left, y: rect.top, width: rect.width, height: rect.height },
      centerPoint: { x: centerX, y: centerY },
      elementAtPoint: {
        tagName: elementAtPoint?.tagName,
        className: elementAtPoint?.className,
        id: elementAtPoint?.id,
        isButton: elementAtPoint === btn,
        outerHTML: elementAtPoint?.outerHTML.substring(0, 200)
      }
    };
  });

  console.log('Click info:', JSON.stringify(clickInfo, null, 2));
});
