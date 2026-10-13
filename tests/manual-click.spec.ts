import { test } from '@playwright/test';

test('Manually trigger click via JS', async ({ page }) => {
  page.on('console', msg => {
    console.log(`[${msg.type()}] ${msg.text()}`);
  });

  await page.goto('http://localhost:3000/zh-HK');
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => window.scrollTo(0, 2000));
  await page.waitForTimeout(2000);

  console.log('\n=== TRIGGERING CLICK VIA JS ===\n');

  await page.evaluate(() => {
    const btn = document.querySelector('button.carousel-plus-btn');
    if (btn) {
      console.log('Found button, clicking...');
      (btn as HTMLButtonElement).click();
    } else {
      console.log('Button not found!');
    }
  });

  await page.waitForTimeout(3000);
  console.log('\n=== END ===\n');
});
