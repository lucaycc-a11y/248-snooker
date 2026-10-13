import { test } from '@playwright/test';

test('Debug button click with console', async ({ page }) => {
  // Capture ALL console messages
  page.on('console', msg => {
    console.log(`[${msg.type()}] ${msg.text()}`);
  });

  await page.goto('http://localhost:3000/zh-HK');
  await page.waitForLoadState('networkidle');

  // Scroll to carousel
  await page.evaluate(() => window.scrollTo(0, 2000));
  await page.waitForTimeout(2000); // Wait longer for animations

  // Debug: check what buttons exist
  const btnCount = await page.locator('button.carousel-plus-btn').count();
  console.log('\n=== Found', btnCount, 'buttons ===\n');

  // Check if button is visible and enabled
  const plusBtn = page.locator('button.carousel-plus-btn').first();
  const isVisible = await plusBtn.isVisible();
  const isEnabled = await plusBtn.isEnabled();
  console.log('Button visible:', isVisible, 'enabled:', isEnabled);

  // Get computed style
  const btnStyle = await plusBtn.evaluate((el) => {
    const computed = window.getComputedStyle(el);
    return {
      pointerEvents: computed.pointerEvents,
      zIndex: computed.zIndex,
      position: computed.position,
      display: computed.display,
      transform: computed.transform,
    };
  });
  console.log('Button computed style:', JSON.stringify(btnStyle));

  console.log('\n=== CLICKING BUTTON NOW ===\n');
  await plusBtn.click({ force: true }); // Force click to bypass stability check

  // Wait to see all logs
  await page.waitForTimeout(3000);

  console.log('\n=== END ===\n');
});
