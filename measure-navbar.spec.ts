import { test } from '@playwright/test';

test('measure navbar height', async ({ page }) => {
  await page.goto('http://localhost:3000');
  await page.waitForLoadState('networkidle');

  const nav = page.locator('nav');
  const box = await nav.boundingBox();

  console.log('Desktop (1440×900):');
  console.log(`  Top: ${box?.y}px`);
  console.log(`  Height: ${box?.height}px`);
  console.log(`  Bottom: ${(box?.y ?? 0) + (box?.height ?? 0)}px`);

  await page.setViewportSize({ width: 396, height: 860 });
  await page.waitForTimeout(500);

  const boxMobile = await nav.boundingBox();
  console.log('\nMobile (396×860):');
  console.log(`  Top: ${boxMobile?.y}px`);
  console.log(`  Height: ${boxMobile?.height}px`);
  console.log(`  Bottom: ${(boxMobile?.y ?? 0) + (boxMobile?.height ?? 0)}px`);
});
