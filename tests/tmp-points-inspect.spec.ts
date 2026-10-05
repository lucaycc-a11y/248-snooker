import { test } from '@playwright/test';

// Temporary Step 1 inspection for the 積分計劃 section. Deleted after use.
test.use({ viewport: { width: 1158, height: 900 } });

test('inspect points section', async ({ page }) => {
  await page.goto('/membership', { waitUntil: 'networkidle' });
  const h = page.locator('h2[data-cms-key="memberIntro.points.title"]');
  await h.scrollIntoViewIfNeeded();
  await page.waitForTimeout(1200);
  const data = await page.evaluate(() => {
    const out: Record<string, unknown>[] = [];
    for (const n of [1, 2, 3]) {
      const fig = document.querySelector<HTMLElement>(`[data-cms-key="memberIntro.points.stat${n}.value"]`);
      const cap = document.querySelector<HTMLElement>(`[data-cms-key="memberIntro.points.stat${n}.label"]`);
      if (!fig || !cap) continue;
      const fs = getComputedStyle(fig);
      const cs = getComputedStyle(cap);
      const r = document.createRange();
      r.selectNodeContents(fig);
      out.push({
        n,
        figText: fig.textContent,
        figFont: fs.fontFamily, figSize: fs.fontSize, figLH: fs.lineHeight, figWeight: fs.fontWeight,
        figWidth: fig.getBoundingClientRect().width,
        figLines: new Set(Array.from(r.getClientRects()).map((x) => Math.round(x.top))).size,
        colWidth: fig.parentElement?.getBoundingClientRect().width,
        capFont: cs.fontFamily, capSize: cs.fontSize, capTop: cap.getBoundingClientRect().top,
      });
    }
    const grid = document.querySelector<HTMLElement>('[data-cms-key="memberIntro.points.stat1.value"]')
      ?.closest('.grid') as HTMLElement | null;
    return { out, gridWidth: grid?.getBoundingClientRect().width, gridGap: grid ? getComputedStyle(grid).columnGap : null };
  });
  console.log(JSON.stringify(data, null, 2));
  const cap = page.locator('[data-cms-key="memberIntro.points.stat1.label"]');
  await cap.screenshot({ path: 'test-results/points-caption-before.png', scale: 'device' });
  await h.locator('xpath=ancestor::section').screenshot({ path: 'test-results/points-section-before.png' });
});
