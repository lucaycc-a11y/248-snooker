const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  
  // 390px mobile
  const page390 = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page390.goto('https://space8.com.hk/member', { waitUntil: 'networkidle' });
  await page390.waitForTimeout(3000);
  await page390.screenshot({ path: '/tmp/member-390.png' });
  console.log('✓ Captured 390px');
  
  // 1440px desktop
  const page1440 = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page1440.goto('https://space8.com.hk/member', { waitUntil: 'networkidle' });
  await page1440.waitForTimeout(3000);
  await page1440.screenshot({ path: '/tmp/member-1440.png' });
  console.log('✓ Captured 1440px');
  
  await browser.close();
})();
