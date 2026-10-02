import { chromium } from '@playwright/test';

async function debug() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 1200 },
  });
  const page = await context.newPage();

  console.log('Navigating to /about...');
  await page.goto('http://localhost:3000/about', { waitUntil: 'networkidle' });

  console.log('Page loaded. Checking for outro section...');
  const hasOutro = await page.locator('[data-outro-section]').count();
  console.log(`Found ${hasOutro} outro sections`);

  if (hasOutro === 0) {
    console.log('Page HTML:');
    const html = await page.content();
    console.log(html.substring(0, 1000));
  }

  await page.waitForTimeout(5000);
  await browser.close();
}

debug();
