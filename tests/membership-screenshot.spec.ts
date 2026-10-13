import { test } from '@playwright/test';

test('Screenshot membership section at different sizes', async ({ page }) => {
  await page.goto('http://localhost:3000');
  await page.waitForLoadState('networkidle');
  
  // Scroll to membership section
  await page.evaluate(() => {
    const sections = Array.from(document.querySelectorAll('section'));
    const membershipSection = sections.find(s => 
      s.textContent.includes('會員制度') || s.textContent.includes('優越會員')
    );
    if (membershipSection) {
      membershipSection.scrollIntoView({ behavior: 'instant', block: 'center' });
    }
  });
  
  await page.waitForTimeout(1000);
  
  // 390px mobile
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'membership-390.png' });
  
  // 820px tablet
  await page.setViewportSize({ width: 820, height: 1180 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'membership-820.png' });
  
  // 1440px desktop
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'membership-1440.png' });
});
