// Hand-off + scroll checks. Usage: node tests/about-ring/handoff.mjs w h engine
import { chromium, webkit } from "playwright";
import { PNG } from "pngjs";
import fs from "node:fs";

const [w = 1194, h = 834, eng = "webkit"] = process.argv.slice(2);
const W = +w, H = +h;
const BASE = process.env.BASE ?? "http://localhost:3004";
const browser = await (eng === "webkit" ? webkit : chromium).launch();
const page = await browser.newPage({ viewport: { width: W, height: H }, hasTouch: eng === "webkit" });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message.split("\n")[0]));
await page.goto(`${BASE}/about`, { waitUntil: "networkidle", timeout: 90000 });
await page.waitForTimeout(1500);

const state = () => page.evaluate(() => {
  const nav = document.querySelector(".nav-bar").getBoundingClientRect().bottom;
  const imgs = [...document.querySelectorAll('[role="listbox"] img')].filter((i) => !i.alt.includes("SPACE8"));
  const vis = imgs.filter((i) => {
    const c = i.closest('[class*="backface"]');
    const s = getComputedStyle(c);
    return s.visibility !== "hidden" && parseFloat(s.opacity) > 0.05;
  });
  const underNav = vis.filter((i) => {
    const r = i.getBoundingClientRect();
    return r.top < nav - 1 && r.bottom > 0;
  }).length;
  const text = document.querySelector('[data-cms-key="aboutPage.hero_description_full"]').parentElement;
  return {
    visible: vis.map((i) => i.src.split("/").pop().slice(6, 8)).join(""),
    underNav,
    textOpacity: +getComputedStyle(text).opacity,
    inert: text.inert,
    textHidden: getComputedStyle(text).visibility === "hidden",
  };
});
const settle = async (y) => {
  await page.evaluate((v) => window.scrollTo(0, v), y);
  // scrub 0.6s + rAF ease: wait until turn stops moving
  await page.waitForTimeout(1600);
};
const stdev = async () => {
  const buf = await page.screenshot();
  const png = PNG.sync.read(buf);
  let n = 0, s = 0, s2 = 0;
  for (let y = Math.round(png.height * 0.15); y < png.height * 0.85; y += 4) {
    for (let x = 0; x < png.width; x += 4) {
      const i = (y * png.width + x) * 4;
      const l = 0.2126 * png.data[i] + 0.7152 * png.data[i + 1] + 0.0722 * png.data[i + 2];
      n++; s += l; s2 += l * l;
    }
  }
  return { sd: Math.sqrt(s2 / n - (s / n) ** 2), buf };
};

const intro = 1.1 * H;
fs.mkdirSync("tests/about-ring/out", { recursive: true });
const report = [];
for (const t of [0, 0.2, 0.4, 0.6, 0.8, 1.0]) {
  await settle(Math.round(t * intro));
  const st = await state();
  const { sd, buf } = await stdev();
  fs.writeFileSync(`tests/about-ring/out/handoff-${W}x${H}-t${t.toFixed(1)}.png`, buf);
  report.push(`t=${t.toFixed(1)} visible=${st.visible} underNav=${st.underNav} text=${st.textOpacity.toFixed(2)} inert=${st.inert} sd=${sd.toFixed(1)}`);
}
console.log(report.join("\n"));

// Blank-frame + navbar sweep every 40px through the intro (settled).
let minSd = 999, worst = 0, navHits = 0;
for (let y = 0; y <= intro; y += 40) {
  await page.evaluate((v) => window.scrollTo(0, v), y);
  await page.waitForTimeout(250);
  const { sd } = await stdev();
  const st = await state();
  if (sd < minSd) { minSd = sd; worst = y; }
  navHits += st.underNav;
}
console.log(`sweep: minSd=${minSd.toFixed(1)} at y=${worst} navHits=${navHits}`);

// Reverse: back to top must restore the ring.
await settle(0);
const back = await state();
console.log(`reverse: visible=${back.visible} text=${back.textOpacity} inert=${back.inert} hidden=${back.textHidden}`);
console.log(`errors: ${errors.join(" | ") || "none"}`);
await browser.close();
