const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  console.log('Starting Help Centre Verification\n');
  console.log('='.repeat(80));

  const browser = await chromium.launch();
  const context = await browser.newContext();

  // Item 1: Screenshots at 375px and 1440px
  console.log('\n=== ITEM 1: Screenshots at 375px and 1440px ===\n');

  const mobile = await context.newPage();
  await mobile.setViewportSize({ width: 375, height: 812 });
  await mobile.goto('http://localhost:3000/zh-HK/support');
  await mobile.waitForLoadState('networkidle');
  await mobile.screenshot({ path: './verify-screenshots/support-mobile-375px.png', fullPage: true });
  console.log('✓ support-mobile-375px.png');

  const desktop = await context.newPage();
  await desktop.setViewportSize({ width: 1440, height: 900 });
  await desktop.goto('http://localhost:3000/zh-HK/support');
  await desktop.waitForLoadState('networkidle');
  await desktop.screenshot({ path: './verify-screenshots/support-desktop-1440px.png', fullPage: true });
  console.log('✓ support-desktop-1440px.png');

  // Item 3: Check for box-shadow
  console.log('\n=== ITEM 3: Box-shadow check ===\n');

  const searchCard = await desktop.locator('.rounded-2xl.border.border-neutral-200.bg-white').first();
  const boxShadow = await searchCard.evaluate((el) => window.getComputedStyle(el).boxShadow);
  console.log(`Search card box-shadow: ${boxShadow}`);
  console.log(boxShadow === 'none' ? '✓ PASS: No box-shadow' : '✗ FAIL: box-shadow detected');

  // Item 4: Test search functionality
  console.log('\n=== ITEM 4: Search functionality ===\n');

  await desktop.fill('input[placeholder]', 'QR');
  await desktop.waitForTimeout(300);

  const results = await desktop.locator('a').filter({ hasText: 'QR' }).count();
  console.log(`Search for "QR": ${results} results`);
  console.log(results > 0 ? '✓ PASS: Search returns results' : '✗ FAIL: No results');

  await desktop.screenshot({ path: './verify-screenshots/support-search-qr.png', fullPage: true });
  console.log('✓ support-search-qr.png');

  // Clear search
  await desktop.fill('input[placeholder]', '');
  await desktop.waitForTimeout(300);

  // Item 5: Test Popular Questions links
  console.log('\n=== ITEM 5: Popular Questions links ===\n');

  const links = await desktop.locator('section:has-text("熱門問題") a');
  const linkCount = await links.count();
  console.log(`Found ${linkCount} popular question links`);

  if (linkCount > 0) {
    await links.first().click();
    await desktop.waitForLoadState('networkidle');
    const url = desktop.url();
    console.log(`Clicked first link, landed on: ${url}`);
    console.log(url.includes('/support/') ? '✓ PASS: Link navigates correctly' : '✗ FAIL: Wrong URL');

    await desktop.screenshot({ path: './verify-screenshots/article-page.png', fullPage: true });
    console.log('✓ article-page.png');
  }

  // Item 7: Test responsive range
  console.log('\n=== ITEM 7: Responsive 320px-2560px ===\n');

  const widths = [320, 375, 768, 1024, 1440, 1920, 2560];
  let allPass = true;

  for (const width of widths) {
    await desktop.setViewportSize({ width, height: 900 });
    await desktop.goto('http://localhost:3000/zh-HK/support');
    await desktop.waitForLoadState('networkidle');

    const overflow = await desktop.evaluate(() => document.body.scrollWidth > window.innerWidth);

    if (overflow) {
      console.log(`✗ ${width}px: Horizontal overflow`);
      allPass = false;
    } else {
      console.log(`✓ ${width}px: No overflow`);
    }
  }

  console.log(allPass ? '\n✓ PASS: No overflow at any width' : '\n✗ FAIL: Overflow detected');

  // Item 8: Compare public /support vs member Help tab
  console.log('\n=== ITEM 8: Public vs Member Help tab ===\n');

  await desktop.setViewportSize({ width: 1440, height: 900 });
  await desktop.goto('http://localhost:3000/zh-HK/support');
  await desktop.waitForLoadState('networkidle');
  await desktop.screenshot({ path: './verify-screenshots/public-support.png', fullPage: true });
  console.log('✓ public-support.png');

  await desktop.goto('http://localhost:3000/member?tab=help');
  await desktop.waitForLoadState('networkidle');
  await desktop.waitForTimeout(1000);
  await desktop.screenshot({ path: './verify-screenshots/member-help-tab.png', fullPage: true });
  console.log('✓ member-help-tab.png');
  console.log('NOTE: Compare screenshots manually for visual identity');

  await browser.close();

  console.log('\n' + '='.repeat(80));
  console.log('Verification script completed');
  console.log('Screenshots saved in verify-screenshots/');
  console.log('='.repeat(80));
})();
