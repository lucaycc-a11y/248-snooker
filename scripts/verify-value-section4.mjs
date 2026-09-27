import { chromium } from 'playwright';

const BASE_URL = 'http://localhost:3000';
const VALUE_PAGE = `${BASE_URL}/zh-HK/value`;

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1512, height: 1123 }
  });
  const page = await context.newPage();

  console.log('📸 Testing Value Page Section 4 - Desktop');

  try {
    await page.goto(VALUE_PAGE, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // Part 1: Initial state with Table 1
    await page.screenshot({ path: 'verification-desktop-part1-initial.png', fullPage: false });
    console.log('✓ Part 1 screenshot saved');

    // Scroll to trigger Part 3
    await page.evaluate(() => window.scrollBy(0, 800));
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'verification-desktop-part3-cutout.png', fullPage: false });
    console.log('✓ Part 3 screenshot saved');

    // Scroll to Part 4 (metallic)
    await page.evaluate(() => window.scrollBy(0, 1000));
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'verification-desktop-part4-metallic.png', fullPage: false });
    console.log('✓ Part 4 screenshot saved');

    // Scroll to Part 5 (subtitle appears)
    await page.evaluate(() => window.scrollBy(0, 1000));
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'verification-desktop-part5-subtitle.png', fullPage: false });
    console.log('✓ Part 5 screenshot saved');

    // Scroll to Part 7 (final zoom)
    await page.evaluate(() => window.scrollBy(0, 3000));
    await page.waitForTimeout(1500);
    await page.screenshot({ path: 'verification-desktop-part7-final.png', fullPage: false });
    console.log('✓ Part 7 screenshot saved');

    // Mobile test
    console.log('\n📱 Testing Value Page Section 4 - Mobile');
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(VALUE_PAGE, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    await page.screenshot({ path: 'verification-mobile-part1-initial.png', fullPage: false });
    console.log('✓ Mobile Part 1 screenshot saved');

    await page.evaluate(() => window.scrollBy(0, 600));
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'verification-mobile-part3-cutout.png', fullPage: false });
    console.log('✓ Mobile Part 3 screenshot saved');

    await page.evaluate(() => window.scrollBy(0, 1500));
    await page.waitForTimeout(1500);
    await page.screenshot({ path: 'verification-mobile-part7-final.png', fullPage: false });
    console.log('✓ Mobile Part 7 screenshot saved');

    console.log('\n✅ All screenshots captured successfully');
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await browser.close();
  }
})();
