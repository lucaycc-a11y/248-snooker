import { test, expect } from '@playwright/test';

test.describe('Venue Hero Scroll Diagnostic', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000/venue');
    await page.waitForLoadState('networkidle');
  });

  test('Touch test - Vertical swipe should scroll page (iPad WebKit)', async ({ page, browserName }) => {
    test.skip(browserName !== 'webkit', 'WebKit-specific touch test');

    await page.setViewportSize({ width: 1194, height: 834 });

    const initialScrollY = await page.evaluate(() => window.scrollY);
    console.log('Initial scrollY:', initialScrollY);

    // Find the hero section
    const hero = page.locator('section').first();
    const heroBox = await hero.boundingBox();

    if (!heroBox) {
      throw new Error('Hero element not found');
    }

    // Perform vertical touch swipe
    const centerX = heroBox.x + heroBox.width / 2;
    const startY = heroBox.y + heroBox.height * 0.7;
    const endY = heroBox.y + heroBox.height * 0.2;

    await page.touchscreen.tap(centerX, startY);
    await page.waitForTimeout(50);
    await page.mouse.move(centerX, startY);
    await page.mouse.down();

    for (let i = 1; i <= 10; i++) {
      const y = startY + ((endY - startY) * i) / 10;
      await page.mouse.move(centerX, y);
      await page.waitForTimeout(10);
    }

    await page.mouse.up();
    await page.waitForTimeout(500);

    const finalScrollY = await page.evaluate(() => window.scrollY);
    console.log('Final scrollY:', finalScrollY);
    console.log('Scroll delta:', finalScrollY - initialScrollY);

    expect(finalScrollY).toBeGreaterThan(initialScrollY);
  });

  test('Wheel test - Multiple wheel events should scroll past hero (Chromium)', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'Chromium-specific wheel test');

    await page.setViewportSize({ width: 1440, height: 900 });

    const initialScrollY = await page.evaluate(() => window.scrollY);
    console.log('Initial scrollY:', initialScrollY);

    const hero = page.locator('section').first();
    const heroBox = await hero.boundingBox();

    if (!heroBox) {
      throw new Error('Hero element not found');
    }

    const centerX = heroBox.x + heroBox.width / 2;
    const centerY = heroBox.y + heroBox.height / 2;

    await page.mouse.move(centerX, centerY);

    for (let i = 0; i < 40; i++) {
      await page.mouse.wheel(0, 100);
      await page.waitForTimeout(250);

      if (i % 10 === 0) {
        const currentScrollY = await page.evaluate(() => window.scrollY);
        console.log(`After ${i} wheel events, scrollY:`, currentScrollY);
      }
    }

    await page.waitForTimeout(500);

    const finalScrollY = await page.evaluate(() => window.scrollY);
    console.log('Final scrollY:', finalScrollY);
    console.log('Total scroll distance:', finalScrollY - initialScrollY);

    const heroHeight = await page.evaluate(() => {
      const section = document.querySelector('section');
      if (!section) return 0;
      const style = window.getComputedStyle(section);
      return parseFloat(style.height);
    });

    console.log('Hero section height:', heroHeight);

    expect(finalScrollY).toBeGreaterThan(900);
  });

  test('Listener audit - Check for preventDefault on wheel/touch/pointer', async ({ page }) => {
    const listeners = await page.evaluate(() => {
      const results: any[] = [];

      const wheelListeners = (window as any).getEventListeners?.(document) || {};
      if (wheelListeners.wheel) {
        wheelListeners.wheel.forEach((l: any) => {
          results.push({
            type: 'wheel',
            target: 'document',
            passive: l.passive,
            useCapture: l.useCapture,
          });
        });
      }

      const hero = document.querySelector('section');
      if (hero) {
        const heroListeners = (window as any).getEventListeners?.(hero) || {};
        ['touchstart', 'touchmove', 'pointerdown', 'pointermove', 'wheel'].forEach(eventType => {
          if (heroListeners[eventType]) {
            heroListeners[eventType].forEach((l: any) => {
              results.push({
                type: eventType,
                target: 'hero',
                passive: l.passive,
                useCapture: l.useCapture,
              });
            });
          }
        });
      }

      return results;
    });

    console.log('Event Listeners:', JSON.stringify(listeners, null, 2));

    const nonPassive = listeners.filter(l => l.passive === false);
    console.log('Non-passive listeners:', nonPassive);

    expect(nonPassive.length).toBe(0);
  });

  test('Keyboard navigation - Space/PageDown should scroll through', async ({ page }) => {
    await page.focus('body');

    const initialScrollY = await page.evaluate(() => window.scrollY);

    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('Space');
      await page.waitForTimeout(300);
    }

    const afterSpaceScrollY = await page.evaluate(() => window.scrollY);
    console.log('After Space keys, scrollY:', afterSpaceScrollY);

    expect(afterSpaceScrollY).toBeGreaterThan(initialScrollY);

    await page.keyboard.press('PageDown');
    await page.waitForTimeout(300);

    const afterPageDownScrollY = await page.evaluate(() => window.scrollY);
    console.log('After PageDown, scrollY:', afterPageDownScrollY);

    expect(afterPageDownScrollY).toBeGreaterThan(afterSpaceScrollY);
  });

  test('Final verification - Monotonic scroll from top to bottom', async ({ page }) => {
    const scrollPositions: number[] = [];

    for (let i = 0; i < 60; i++) {
      await page.mouse.wheel(0, 100);
      await page.waitForTimeout(100);

      const currentScrollY = await page.evaluate(() => window.scrollY);
      scrollPositions.push(currentScrollY);
    }

    console.log('Scroll positions sample:', scrollPositions.slice(0, 10));
    console.log('Final scroll position:', scrollPositions[scrollPositions.length - 1]);

    let isMonotonic = true;
    for (let i = 1; i < scrollPositions.length; i++) {
      if (scrollPositions[i] < scrollPositions[i - 1] - 5) {
        console.log(`Non-monotonic at index ${i}: ${scrollPositions[i - 1]} -> ${scrollPositions[i]}`);
        isMonotonic = false;
      }
    }

    expect(isMonotonic).toBe(true);
    expect(scrollPositions[scrollPositions.length - 1]).toBeGreaterThan(1000);
  });
});
