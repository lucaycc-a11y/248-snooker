// Capture About hero screenshots + geometry. Usage:
//   node tests/about-ring/capture.mjs <baseURL> <outDir> [scrollFractions...]
// Each fraction is a page scrollY in viewport heights (e.g. 0, 1.1, 2.2).
import { webkit, chromium, devices } from "playwright";
import fs from "node:fs";
import path from "node:path";

const [, , base = "http://localhost:3003", out = "tests/about-ring/out", ...fr] = process.argv;
const fractions = fr.length ? fr.map(Number) : [0];

export const VIEWPORTS = [
  { name: "ipad-1194x834", engine: "webkit", viewport: { width: 1194, height: 834 }, touch: true },
  { name: "chromium-1440x900", engine: "chromium", viewport: { width: 1440, height: 900 }, touch: false },
  { name: "mobile-390x844", engine: "webkit", viewport: { width: 390, height: 844 }, touch: true },
];

fs.mkdirSync(out, { recursive: true });

for (const v of VIEWPORTS) {
  const browser = await (v.engine === "webkit" ? webkit : chromium).launch();
  const ctx = await browser.newContext({
    viewport: v.viewport,
    hasTouch: v.touch,
    isMobile: v.touch && v.viewport.width < 768,
    deviceScaleFactor: 1,
  });
  const page = await ctx.newPage();
  await page.goto(`${base}/about`, { waitUntil: "networkidle", timeout: 120000 });
  await page.waitForTimeout(1500);
  for (const f of fractions) {
    await page.evaluate((y) => window.scrollTo(0, y), Math.round(f * v.viewport.height));
    await page.waitForTimeout(1600);
    const geo = await page.evaluate(() => {
      const cards = [...document.querySelectorAll('[id^="space-wheel-item-"]')];
      return cards.map((c) => {
        const r = c.getBoundingClientRect();
        const img = c.querySelector("img");
        return {
          src: img?.getAttribute("src")?.split("/").pop(),
          cx: r.left + r.width / 2, cy: r.top + r.height / 2,
          w: c.offsetWidth, h: c.offsetHeight,
          transform: getComputedStyle(c).transform,
          opacity: getComputedStyle(c).opacity,
        };
      });
    });
    const file = path.join(out, `${v.name}-s${f}.png`);
    await page.screenshot({ path: file });
    fs.writeFileSync(file.replace(/\.png$/, ".json"), JSON.stringify(geo, null, 1));
    console.log(file, geo.length, "cards");
  }
  await browser.close();
}
