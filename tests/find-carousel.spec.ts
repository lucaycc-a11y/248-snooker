import { test } from '@playwright/test';

test('Find carousel on page', async ({ page }) => {
  await page.goto('http://localhost:3000/zh-HK');

  // Wait for page to load
  await page.waitForTimeout(3000);

  // Scroll down to facilities section
  await page.evaluate(() => window.scrollTo(0, 2000));
  await page.waitForTimeout(1000);

  // Look for any element with carousel in className
  const carouselElements = await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll('*'));
    return all
      .filter(el => el.className && el.className.toString().toLowerCase().includes('carousel'))
      .map(el => ({
        tag: el.tagName,
        classes: el.className,
        text: el.textContent?.substring(0, 50)
      }));
  });

  console.log('Carousel elements found:', JSON.stringify(carouselElements, null, 2));

  // Also check for the text we expect
  const facilitiesText = await page.locator('text=專業設備').first().isVisible();
  console.log('Facilities text visible:', facilitiesText);
});
