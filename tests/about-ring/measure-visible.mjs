// Measure the VISIBLE ring (image rects, after all scales). Usage: node tests/about-ring/measure-visible.mjs [w] [h]
import { chromium } from "playwright";

const [w = 1194, h = 834] = process.argv.slice(2).map(Number);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: w, height: h } });
await page.goto(`${process.env.BASE ?? "http://localhost:3004"}/about`, { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(1500);

const m = await page.evaluate(() => {
  const stage = document.querySelector('[role="listbox"]');
  const stageRect = stage.getBoundingClientRect();
  const navBottom = document.querySelector(".nav-bar")?.getBoundingClientRect().bottom ?? 0;
  const imgs = [...stage.querySelectorAll("img")].filter((i) => !i.alt.includes("SPACE8"));
  const visible = imgs.filter((i) => {
    const card = i.closest('[class*="backface"]');
    const s = card ? getComputedStyle(card) : null;
    return s && s.visibility !== "hidden" && parseFloat(s.opacity) > 0.05;
  });
  const rects = visible.map((i) => i.getBoundingClientRect());
  const top = Math.min(...rects.map((r) => r.top));
  const bottom = Math.max(...rects.map((r) => r.bottom));
  const left = Math.min(...rects.map((r) => r.left));
  const right = Math.max(...rects.map((r) => r.right));
  // Top-slot card is upright, so its rect width is the true visible card width.
  const topCard = rects.reduce((a, b) => (b.top < a.top ? b : a));
  const outer = Math.max(bottom - top, right - left);
  return {
    visiblePhotos: visible.length,
    stageH: Math.round(stageRect.height),
    navBottom: Math.round(navBottom),
    ringTop: Math.round(top),
    ringBottom: Math.round(bottom),
    clearanceBelowNav: Math.round(top - navBottom),
    clearanceAboveStageBottom: Math.round(stageRect.bottom - bottom),
    outerDiameter: Math.round(outer),
    outerVsStage: +(outer / stageRect.height).toFixed(3),
    cardW: Math.round(topCard.width),
    cardH: Math.round(topCard.height),
    cardWVsOuter: +(topCard.width / outer).toFixed(3),
  };
});
console.log(JSON.stringify({ viewport: `${w}x${h}`, ...m }, null, 1));
await browser.close();
