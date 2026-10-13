import { test } from '@playwright/test';

test('Check for style tags', async ({ page }) => {
  await page.goto('http://localhost:3000/zh-HK');
  await page.waitForLoadState('networkidle');

  const styles = await page.evaluate(() => {
    const styleTags = Array.from(document.querySelectorAll('style'));
    const jsx2492052258Styles = styleTags.filter(tag =>
      tag.textContent?.includes('jsx-2492052258') ||
      tag.textContent?.includes('carousel-plus-btn')
    );

    return {
      totalStyleTags: styleTags.length,
      matchingTags: jsx2492052258Styles.length,
      content: jsx2492052258Styles.map(tag => tag.textContent?.substring(0, 1000))
    };
  });

  console.log('Style tags:', JSON.stringify(styles, null, 2));
});
