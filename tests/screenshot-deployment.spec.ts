import { test } from '@playwright/test';

const DEPLOYMENT_URL = 'https://space8-cb92mz3ds-lucaycc-3022s-projects.vercel.app';

test.describe('Production Screenshots', () => {
  test('Member page at 390px', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${DEPLOYMENT_URL}/zh-HK/member`);
    await page.waitForLoadState('networkidle');
    await page.screenshot({
      path: 'test-results/member-390px.png',
      fullPage: true
    });
  });

  test('Member page at 1180px', async ({ page }) => {
    await page.setViewportSize({ width: 1180, height: 800 });
    await page.goto(`${DEPLOYMENT_URL}/zh-HK/member`);
    await page.waitForLoadState('networkidle');
    await page.screenshot({
      path: 'test-results/member-1180px.png',
      fullPage: true
    });
  });

  test('Wallet page at 390px', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${DEPLOYMENT_URL}/zh-HK/member/wallet`);
    await page.waitForLoadState('networkidle');
    await page.screenshot({
      path: 'test-results/wallet-390px.png',
      fullPage: true
    });
  });

  test('Wallet page at 1180px', async ({ page }) => {
    await page.setViewportSize({ width: 1180, height: 800 });
    await page.goto(`${DEPLOYMENT_URL}/zh-HK/member/wallet`);
    await page.waitForLoadState('networkidle');
    await page.screenshot({
      path: 'test-results/wallet-1180px.png',
      fullPage: true
    });
  });
});
