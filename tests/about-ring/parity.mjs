// Carousel parity: same frame on main (3011) and new (3004), intro shifted by
// 0.1vh (new runway = main + 10svh before turn 1). Pixel diff excludes the
// 28px top/bottom strips. Usage: node tests/about-ring/parity.mjs w h engine
import { chromium, webkit } from "playwright";
import { PNG } from "pngjs";
import fs from "node:fs";

const [w = 1194, h = 834, eng = "webkit"] = process.argv.slice(2);
const W = +w, H = +h;
// turn → scrollY: main has turn = y/H (0..4); new has turn 1 at 1.1H, then +1 per H.
const FRAMES = [1, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 2.75, 3];

async function shoot(base, yOf) {
  const browser = await (eng === "webkit" ? webkit : chromium).launch();
  const page = await browser.newPage({ viewport: { width: W, height: H }, hasTouch: eng === "webkit" });
  await page.goto(`${base}/about`, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForTimeout(1500);
  const out = [];
  for (const turn of FRAMES) {
    await page.evaluate((v) => window.scrollTo(0, v), Math.round(yOf(turn)));
    await page.waitForTimeout(2200);
    out.push(PNG.sync.read(await page.screenshot()));
  }
  await browser.close();
  return out;
}

const main = await shoot("http://localhost:3011", (t) => t * H);
const next = await shoot("http://localhost:3004", (t) => (1.1 + (t - 1)) * H);
fs.mkdirSync("tests/about-ring/out", { recursive: true });
let worst = 0;
FRAMES.forEach((turn, k) => {
  const a = main[k], b = next[k];
  let diff = 0, n = 0;
  for (let y = 28; y < a.height - 28; y++) {
    for (let x = 0; x < a.width; x++) {
      const i = (y * a.width + x) * 4;
      const d = Math.abs(a.data[i] - b.data[i]) + Math.abs(a.data[i + 1] - b.data[i + 1]) + Math.abs(a.data[i + 2] - b.data[i + 2]);
      if (d > 48) diff++;
      n++;
    }
  }
  const pct = (100 * diff) / n;
  worst = Math.max(worst, pct);
  const label = Number.isInteger(turn) ? `state 0${turn}` : `0${Math.floor(turn)}→0${Math.ceil(turn)} ${Math.round((turn % 1) * 100)}%`;
  console.log(`${label.padEnd(16)} diff=${pct.toFixed(2)}%`);
  fs.writeFileSync(`tests/about-ring/out/parity-${W}x${H}-${turn}.png`, PNG.sync.write(b));
});
console.log(`${W}x${H} ${eng} worst=${worst.toFixed(2)}% ${worst < 2 ? "PASS" : "FAIL"}`);
