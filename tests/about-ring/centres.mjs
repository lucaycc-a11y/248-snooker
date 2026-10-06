// Print visible photo centres, sizes and rotation. Usage: BASE=... node tests/about-ring/centres.mjs w h
import { chromium } from "playwright";

const [w, h] = process.argv.slice(2).map(Number);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: w, height: h } });
await page.goto(`${process.env.BASE ?? "http://localhost:3004"}/about`, { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(1500);
const out = await page.evaluate(() =>
  [...document.querySelectorAll('[role="listbox"] img')]
    .filter((i) => !i.alt.includes("SPACE8"))
    .map((i) => {
      const r = i.getBoundingClientRect();
      const m = new DOMMatrix(getComputedStyle(i.closest('[class*="backface"]')).transform);
      return {
        f: i.src.split("/").pop().slice(6, 8),
        cx: Math.round(r.left + r.width / 2),
        cy: Math.round(r.top + r.height / 2),
        bw: Math.round(r.width),
        bh: Math.round(r.height),
        rot: Math.round((Math.atan2(m.b, m.a) * 180) / Math.PI),
      };
    })
    .sort((a, b) => a.f.localeCompare(b.f)),
);
for (const c of out) console.log(Object.values(c).join("\t"));
await browser.close();
