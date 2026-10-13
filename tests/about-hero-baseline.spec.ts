import { test, expect } from "@playwright/test";

// Baseline screenshots BEFORE adding the ring intro
// States 01, 02, 03 at settled positions + transitions at 25%, 50%, 75%

const VIEWPORTS = [
  { name: "webkit-ipad", width: 1194, height: 834, userAgent: "webkit" },
  { name: "chromium-desktop", width: 1440, height: 900, userAgent: "chromium" },
];

test.describe("About Hero Baseline (before ring intro)", () => {
  for (const viewport of VIEWPORTS) {
    test.describe(`${viewport.name} ${viewport.width}×${viewport.height}`, () => {
      test.beforeEach(async ({ page }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await page.goto("http://localhost:3000/about");
        await page.waitForLoadState("networkidle");
        await page.waitForTimeout(500);
      });

      // State 01: turn = 1 (first photo at front)
      test("state-01-settled", async ({ page }) => {
        // Scroll to turn 1 position (1vh out of 5vh total = 20%)
        const scrollTarget = viewport.height * 1;
        await page.evaluate((y) => window.scrollTo(0, y), scrollTarget);
        await page.waitForTimeout(800); // Let GSAP settle
        await page.screenshot({
          path: `baseline/${viewport.name}-state-01.png`,
          fullPage: false,
        });
      });

      // Transition 01→02 at 25%
      test("transition-01-02-25pct", async ({ page }) => {
        const scrollTarget = viewport.height * (1 + 0.25);
        await page.evaluate((y) => window.scrollTo(0, y), scrollTarget);
        await page.waitForTimeout(800);
        await page.screenshot({
          path: `baseline/${viewport.name}-transition-01-02-25.png`,
          fullPage: false,
        });
      });

      // Transition 01→02 at 50%
      test("transition-01-02-50pct", async ({ page }) => {
        const scrollTarget = viewport.height * (1 + 0.5);
        await page.evaluate((y) => window.scrollTo(0, y), scrollTarget);
        await page.waitForTimeout(800);
        await page.screenshot({
          path: `baseline/${viewport.name}-transition-01-02-50.png`,
          fullPage: false,
        });
      });

      // Transition 01→02 at 75%
      test("transition-01-02-75pct", async ({ page }) => {
        const scrollTarget = viewport.height * (1 + 0.75);
        await page.evaluate((y) => window.scrollTo(0, y), scrollTarget);
        await page.waitForTimeout(800);
        await page.screenshot({
          path: `baseline/${viewport.name}-transition-01-02-75.png`,
          fullPage: false,
        });
      });

      // State 02: turn = 2 (second photo at front)
      test("state-02-settled", async ({ page }) => {
        const scrollTarget = viewport.height * 2;
        await page.evaluate((y) => window.scrollTo(0, y), scrollTarget);
        await page.waitForTimeout(800);
        await page.screenshot({
          path: `baseline/${viewport.name}-state-02.png`,
          fullPage: false,
        });
      });

      // Transition 02→03 at 25%
      test("transition-02-03-25pct", async ({ page }) => {
        const scrollTarget = viewport.height * (2 + 0.25);
        await page.evaluate((y) => window.scrollTo(0, y), scrollTarget);
        await page.waitForTimeout(800);
        await page.screenshot({
          path: `baseline/${viewport.name}-transition-02-03-25.png`,
          fullPage: false,
        });
      });

      // Transition 02→03 at 50%
      test("transition-02-03-50pct", async ({ page }) => {
        const scrollTarget = viewport.height * (2 + 0.5);
        await page.evaluate((y) => window.scrollTo(0, y), scrollTarget);
        await page.waitForTimeout(800);
        await page.screenshot({
          path: `baseline/${viewport.name}-transition-02-03-50.png`,
          fullPage: false,
        });
      });

      // Transition 02→03 at 75%
      test("transition-02-03-75pct", async ({ page }) => {
        const scrollTarget = viewport.height * (2 + 0.75);
        await page.evaluate((y) => window.scrollTo(0, y), scrollTarget);
        await page.waitForTimeout(800);
        await page.screenshot({
          path: `baseline/${viewport.name}-transition-02-03-75.png`,
          fullPage: false,
        });
      });

      // State 03: turn = 3 (third photo at front)
      test("state-03-settled", async ({ page }) => {
        const scrollTarget = viewport.height * 3;
        await page.evaluate((y) => window.scrollTo(0, y), scrollTarget);
        await page.waitForTimeout(800);
        await page.screenshot({
          path: `baseline/${viewport.name}-state-03.png`,
          fullPage: false,
        });
      });
    });
  }
});
