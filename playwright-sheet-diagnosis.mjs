#!/usr/bin/env node
import { chromium } from 'playwright';

const viewports = [
  { width: 1440, height: 900, name: '1440×900' },
  { width: 1158, height: 740, name: '1158×740' },
];

(async () => {
  const browser = await chromium.launch();

  for (const vp of viewports) {
    const context = await browser.newContext({ viewport: vp });
    const page = await context.newPage();

    await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-nav-theme="light"]', { timeout: 10000 });

    // Scroll to carousel
    await page.evaluate(() => {
      document.querySelector('[data-nav-theme="light"]')?.scrollIntoView({ behavior: 'instant', block: 'center' });
    });
    await page.waitForTimeout(500);

    // Click first "+" button
    const plusBtn = page.locator('.carousel-plus-btn').first();
    await plusBtn.click();
    await page.waitForTimeout(800);

    await page.screenshot({ path: `sheet-open-${vp.name}.png`, fullPage: false });

    // Element diagnosis at sheet position, white line, bottom-right corner
    const sheetY = 465;
    const diagnosis = await page.evaluate(({ y }) => {
      const centerX = window.innerWidth / 2;
      const rightEdge = window.innerWidth - 50;
      const bottomRight = { x: window.innerWidth - 50, y: window.innerHeight - 50 };

      function describeEl(el) {
        if (!el) return null;
        const rect = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        let parent = el.parentElement;
        const parents = [];
        while (parent && parents.length < 5) {
          const pcs = getComputedStyle(parent);
          parents.push({
            tag: parent.tagName,
            class: parent.className,
            transform: pcs.transform,
            filter: pcs.filter,
            willChange: pcs.willChange,
            overflow: pcs.overflow,
          });
          parent = parent.parentElement;
        }
        return {
          tag: el.tagName,
          class: el.className,
          position: cs.position,
          top: cs.top,
          left: cs.left,
          zIndex: cs.zIndex,
          rect: { x: rect.x, y: rect.y, w: rect.width, h: rect.height },
          parents,
        };
      }

      const atSheet = document.elementsFromPoint(centerX, y);
      const atRight = document.elementsFromPoint(centerX + 300, y + 100);
      const atBottomRight = document.elementsFromPoint(bottomRight.x, bottomRight.y);

      return {
        sheetStack: atSheet.slice(0, 5).map(describeEl),
        rightStack: atRight.slice(0, 5).map(describeEl),
        bottomRightStack: atBottomRight.slice(0, 5).map(describeEl),
      };
    }, { y: sheetY });

    console.log(`\n=== ${vp.name} ===`);
    console.log('Sheet stack:', JSON.stringify(diagnosis.sheetStack, null, 2));
    console.log('Right edge stack:', JSON.stringify(diagnosis.rightStack, null, 2));
    console.log('Bottom-right corner:', JSON.stringify(diagnosis.bottomRightStack, null, 2));

    await context.close();
  }

  await browser.close();
})();
