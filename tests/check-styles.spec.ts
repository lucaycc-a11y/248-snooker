import { test } from '@playwright/test';

test('Check button styles', async ({ page }) => {
  await page.goto('http://localhost:3000/zh-HK');
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => window.scrollTo(0, 2000));
  await page.waitForTimeout(2000);

  const styles = await page.evaluate(() => {
    const btn = document.querySelectorAll('button.carousel-plus-btn')[1]; // Get the visible one
    if (!btn) return null;

    const computed = window.getComputedStyle(btn);
    return {
      width: computed.width,
      height: computed.height,
      position: computed.position,
      bottom: computed.bottom,
      right: computed.right,
      borderRadius: computed.borderRadius,
      background: computed.background,
      display: computed.display,
      zIndex: computed.zIndex
    };
  });

  console.log('Button computed styles:', JSON.stringify(styles, null, 2));
});
