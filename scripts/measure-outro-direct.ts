import { chromium } from '@playwright/test';

const WIDTHS = [390, 768, 1280, 1712, 3422];

async function measureCenters(width: number) {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width, height: 1200 },
    deviceScaleFactor: 1,
    reducedMotion: 'reduce',
  });
  const page = await context.newPage();

  // Navigate and wait for basic load
  await page.goto('http://localhost:3001/zh-HK/about', { waitUntil: 'domcontentloaded' });

  // Wait longer for React hydration and dynamic content
  await page.waitForTimeout(5000);

  // Try to find outro section - if it exists, measure it
  const outroExists = await page.locator('[data-outro-section]').count();

  if (outroExists === 0) {
    console.log(`Width ${width}px: No outro section found (page may have error)`);
    await browser.close();
    return null;
  }

  // Scroll to outro section
  await page.locator('[data-outro-section]').scrollIntoViewIfNeeded();
  await page.waitForTimeout(1000);

  // Wait for fonts and images
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => {
    const img = document.querySelector('[data-outro-ball-scroll] img');
    return img && (img as HTMLImageElement).complete;
  }, { timeout: 10000 }).catch(() => {
    console.log('  Warning: Ball image may not be loaded');
  });

  // Measure centers from DOM bounding boxes
  const measurements = await page.evaluate(() => {
    const contentCenter = window.innerWidth / 2;

    // Ball center
    const ball = document.querySelector('[data-outro-ball-scroll]') as HTMLElement;
    const ballRect = ball?.getBoundingClientRect();
    const ballCenter = ballRect ? ballRect.left + ballRect.width / 2 : 0;

    // Headline center
    const headline = document.querySelector('[data-outro-headline-chars]') as HTMLElement;
    const headlineRect = headline?.getBoundingClientRect();
    const headlineCenter = headlineRect ? headlineRect.left + headlineRect.width / 2 : 0;

    // Echo 1 center
    const echo1 = document.querySelector('[data-outro-echo="1"]') as HTMLElement;
    const echo1Rect = echo1?.getBoundingClientRect();
    const echo1Center = echo1Rect ? echo1Rect.left + echo1Rect.width / 2 : 0;

    // Description center
    const desc = document.querySelector('[data-outro-desc]') as HTMLElement;
    const descRect = desc?.getBoundingClientRect();
    const descCenter = descRect ? descRect.left + descRect.width / 2 : 0;

    // "02" center (step 1, index 1 in the array)
    const step02 = document.querySelector('[data-outro-step="1"]') as HTMLElement;
    const step02Rect = step02?.getBoundingClientRect();
    const step02Center = step02Rect ? step02Rect.left + step02Rect.width / 2 : 0;

    return {
      contentCenter,
      ballCenter,
      ballOffset: ballCenter - contentCenter,
      headlineCenter,
      headlineOffset: headlineCenter - contentCenter,
      echo1Center,
      echo1Offset: echo1Center - contentCenter,
      descCenter,
      descOffset: descCenter - contentCenter,
      step02Center,
      step02Offset: step02Center - contentCenter,
    };
  });

  console.log(`Width ${width}px:`);
  console.log(`  Content center: ${measurements.contentCenter}`);
  console.log(`  Ball center: ${measurements.ballCenter.toFixed(1)} (offset: ${measurements.ballOffset.toFixed(1)}px)`);
  console.log(`  Headline center: ${measurements.headlineCenter.toFixed(1)} (offset: ${measurements.headlineOffset.toFixed(1)}px)`);
  console.log(`  Echo 1 center: ${measurements.echo1Center.toFixed(1)} (offset: ${measurements.echo1Offset.toFixed(1)}px)`);
  console.log(`  Description center: ${measurements.descCenter.toFixed(1)} (offset: ${measurements.descOffset.toFixed(1)}px)`);
  console.log(`  "02" center: ${measurements.step02Center.toFixed(1)} (offset: ${measurements.step02Offset.toFixed(1)}px)`);

  await browser.close();
  return measurements;
}

async function main() {
  console.log('=== BEFORE FIX ===\n');
  for (const width of WIDTHS) {
    await measureCenters(width);
    console.log('');
  }
}

main();
