import { chromium } from '@playwright/test';

const DEPLOYMENT_URL = 'https://space8-cb92mz3ds-lucaycc-3022s-projects.vercel.app';

(async () => {
  const browser = await chromium.launch();

  // Member page at 390px
  let page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(`${DEPLOYMENT_URL}/zh-HK/member`);
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: 'test-results/member-390px.png', fullPage: true });
  await page.close();
  console.log('✓ member-390px.png');

  // Member page at 1180px
  page = await browser.newPage({ viewport: { width: 1180, height: 800 } });
  await page.goto(`${DEPLOYMENT_URL}/zh-HK/member`);
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: 'test-results/member-1180px.png', fullPage: true });
  await page.close();
  console.log('✓ member-1180px.png');

  // Wallet page at 390px
  page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(`${DEPLOYMENT_URL}/zh-HK/member/wallet`);
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: 'test-results/wallet-390px.png', fullPage: true });
  await page.close();
  console.log('✓ wallet-390px.png');

  // Wallet page at 1180px
  page = await browser.newPage({ viewport: { width: 1180, height: 800 } });
  await page.goto(`${DEPLOYMENT_URL}/zh-HK/member/wallet`);
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: 'test-results/wallet-1180px.png', fullPage: true });
  await page.close();
  console.log('✓ wallet-1180px.png');

  await browser.close();
  console.log('\nAll screenshots saved to test-results/');
})();
