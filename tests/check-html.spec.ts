import { test } from '@playwright/test';

test('Check button HTML', async ({ page }) => {
  await page.goto('http://localhost:3000/zh-HK');
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => window.scrollTo(0, 2000));
  await page.waitForTimeout(2000);

  const html = await page.evaluate(() => {
    const btn = document.querySelectorAll('button.carousel-plus-btn')[1];
    if (!btn) return null;

    const parent = btn.parentElement;
    const grandparent = parent?.parentElement;

    return {
      button: btn.outerHTML,
      parent: parent?.outerHTML.substring(0, 500),
      grandparent: grandparent?.outerHTML.substring(0, 500),
      buttonClasses: btn.className,
      parentClasses: parent?.className,
      grandparentClasses: grandparent?.className
    };
  });

  console.log('HTML structure:', JSON.stringify(html, null, 2));
});
