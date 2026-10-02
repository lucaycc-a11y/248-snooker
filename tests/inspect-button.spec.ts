import { test } from '@playwright/test';

test('Inspect button properties', async ({ page }) => {
  await page.goto('http://localhost:3000/zh-HK');
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => window.scrollTo(0, 2000));
  await page.waitForTimeout(2000);

  const buttonInfo = await page.evaluate(() => {
    const btn = document.querySelector('button.carousel-plus-btn');
    if (!btn) return { found: false };

    return {
      found: true,
      hasOnClick: (btn as any).onclick !== null,
      outerHTML: btn.outerHTML.substring(0, 300),
      parentClass: btn.parentElement?.className,
      hasReactProps: Object.keys(btn).some(k => k.startsWith('__react'))
    };
  });

  console.log('Button info:', JSON.stringify(buttonInfo, null, 2));
});
