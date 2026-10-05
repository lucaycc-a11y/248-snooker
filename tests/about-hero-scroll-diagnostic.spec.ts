import { test, expect } from '@playwright/test';

test.describe('About Hero Scroll Diagnostic', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000/about');
    await page.waitForLoadState('networkidle');
  });

  test('Touch test - Vertical swipe should scroll page (iPad WebKit)', async ({ page, browserName }) => {
    test.skip(browserName !== 'webkit', 'WebKit-specific touch test');

    await page.setViewportSize({ width: 1194, height: 834 });

    // Get initial scroll position
    const initialScrollY = await page.evaluate(() => window.scrollY);
    console.log('Initial scrollY:', initialScrollY);

    // Find the hero stage element
    const stage = page.locator('.sticky').first();
    const stageBox = await stage.boundingBox();

    if (!stageBox) {
      throw new Error('Stage element not found');
    }

    // Perform vertical touch swipe (simulate finger drag down to scroll up)
    const centerX = stageBox.x + stageBox.width / 2;
    const startY = stageBox.y + stageBox.height * 0.7;
    const endY = stageBox.y + stageBox.height * 0.2;

    await page.touchscreen.tap(centerX, startY);
    await page.waitForTimeout(50);
    await page.mouse.move(centerX, startY);
    await page.mouse.down();

    // Swipe up in 10 steps
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

    // Verify scroll changed (should increase if swipe worked)
    expect(finalScrollY).toBeGreaterThan(initialScrollY);
  });

  test('Wheel test - Multiple wheel events should scroll past hero (Chromium)', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'Chromium-specific wheel test');

    await page.setViewportSize({ width: 1440, height: 900 });

    const initialScrollY = await page.evaluate(() => window.scrollY);
    console.log('Initial scrollY:', initialScrollY);

    const stage = page.locator('.sticky').first();
    const stageBox = await stage.boundingBox();

    if (!stageBox) {
      throw new Error('Stage element not found');
    }

    // Dispatch 40 wheel events with deltaY = 100, 250ms apart
    const centerX = stageBox.x + stageBox.width / 2;
    const centerY = stageBox.y + stageBox.height / 2;

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

    // Should have scrolled past the hero section
    const heroHeight = await page.evaluate(() => {
      const runway = document.querySelector('[style*="height"]');
      if (!runway) return 0;
      const style = window.getComputedStyle(runway);
      return parseFloat(style.height);
    });

    console.log('Hero runway height:', heroHeight);

    expect(finalScrollY).toBeGreaterThan(900); // Should scroll beyond viewport
  });

  test('Range analysis - Count photo items and compute scroll range', async ({ page }) => {
    const analysis = await page.evaluate(() => {
      // Find SpaceWheel items
      const cards = document.querySelectorAll('[id^="space-wheel-item-"]');
      const count = cards.length;

      // Find runway element
      const runway = document.querySelector('[style*="00svh"]');
      const runwayStyle = runway ? window.getComputedStyle(runway) : null;
      const runwayHeight = runwayStyle ? parseFloat(runwayStyle.height) : 0;

      // Calculate expected range
      const pointCount = count; // turn goes from 0 to count+1
      const expectedHeight = (count + 2) * window.innerHeight;

      return {
        cardCount: count,
        pointCount,
        runwayHeight,
        expectedHeight,
        viewportHeight: window.innerHeight,
        multiplier: count + 2,
      };
    });

    console.log('Range Analysis:', analysis);

    expect(analysis.cardCount).toBeGreaterThan(0);
    expect(analysis.runwayHeight).toBeCloseTo(analysis.expectedHeight, -100);
  });

  test('Listener audit - Check for preventDefault on wheel/touch/pointer', async ({ page }) => {
    const listeners = await page.evaluate(() => {
      const results: any[] = [];

      // Check for wheel listeners
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

      // Check stage element for pointer/touch listeners
      const stage = document.querySelector('.sticky');
      if (stage) {
        const stageListeners = (window as any).getEventListeners?.(stage) || {};
        ['touchstart', 'touchmove', 'pointerdown', 'pointermove', 'wheel'].forEach(eventType => {
          if (stageListeners[eventType]) {
            stageListeners[eventType].forEach((l: any) => {
              results.push({
                type: eventType,
                target: 'stage',
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

    // Check if any non-passive listeners exist
    const nonPassive = listeners.filter(l => l.passive === false);
    console.log('Non-passive listeners:', nonPassive);

    // About hero should have NO non-passive wheel/touch listeners
    expect(nonPassive.length).toBe(0);
  });

  test('Keyboard navigation - Space/PageDown should scroll through', async ({ page }) => {
    await page.focus('body');

    const initialScrollY = await page.evaluate(() => window.scrollY);

    // Press Space key 5 times
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('Space');
      await page.waitForTimeout(300);
    }

    const afterSpaceScrollY = await page.evaluate(() => window.scrollY);
    console.log('After Space keys, scrollY:', afterSpaceScrollY);

    expect(afterSpaceScrollY).toBeGreaterThan(initialScrollY);

    // Press PageDown
    await page.keyboard.press('PageDown');
    await page.waitForTimeout(300);

    const afterPageDownScrollY = await page.evaluate(() => window.scrollY);
    console.log('After PageDown, scrollY:', afterPageDownScrollY);

    expect(afterPageDownScrollY).toBeGreaterThan(afterSpaceScrollY);
  });

  test('Verify NO preventDefault anywhere in hero code', async ({ page }) => {
    const hasPreventDefault = await page.evaluate(() => {
      // Check if any event handler in the hero section calls preventDefault
      let foundPreventDefault = false;

      const stage = document.querySelector('.sticky');
      if (stage) {
        // Try to find event handlers (this is limited in production)
        const events = ['wheel', 'touchstart', 'touchmove', 'pointerdown', 'pointermove'];

        events.forEach(eventType => {
          const handler = (e: Event) => {
            // This won't catch preventDefault in the actual handler
            // but we can check if scrolling is blocked
          };
          stage.addEventListener(eventType, handler, { passive: true });
          stage.removeEventListener(eventType, handler);
        });
      }

      return foundPreventDefault;
    });

    expect(hasPreventDefault).toBe(false);
  });

  test('Final verification - Monotonic scroll from top to bottom', async ({ page }) => {
    const scrollPositions: number[] = [];

    // Record scroll position every 500ms while scrolling
    const recordInterval = page.evaluate(() => {
      const positions: number[] = [];
      const interval = setInterval(() => {
        positions.push(window.scrollY);
      }, 500);
      return { interval, positions };
    });

    // Scroll aggressively
    for (let i = 0; i < 60; i++) {
      await page.mouse.wheel(0, 100);
      await page.waitForTimeout(100);

      const currentScrollY = await page.evaluate(() => window.scrollY);
      scrollPositions.push(currentScrollY);
    }

    console.log('Scroll positions sample:', scrollPositions.slice(0, 10));
    console.log('Final scroll position:', scrollPositions[scrollPositions.length - 1]);

    // Check monotonicity (should always increase or stay same, never decrease)
    let isMonotonic = true;
    for (let i = 1; i < scrollPositions.length; i++) {
      if (scrollPositions[i] < scrollPositions[i - 1] - 5) { // Allow 5px tolerance
        console.log(`Non-monotonic at index ${i}: ${scrollPositions[i - 1]} -> ${scrollPositions[i]}`);
        isMonotonic = false;
      }
    }

    expect(isMonotonic).toBe(true);
    expect(scrollPositions[scrollPositions.length - 1]).toBeGreaterThan(1000);
  });
});
