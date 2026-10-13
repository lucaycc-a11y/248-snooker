// Wheel, touch, reload and reduced-motion checks. Usage: node tests/about-ring/scroll.mjs
import { chromium, webkit } from "playwright";

const BASE = process.env.BASE ?? "http://localhost:3004";
const turnAt = (page) =>
  page.evaluate(() => {
    const opt = [...document.querySelectorAll('[role="listbox"] [role="option"]')];
    const sel = opt.findIndex((o) => o.getAttribute("aria-selected") === "true");
    const text = document.querySelector('[data-cms-key="aboutPage.hero_description_full"]').parentElement;
    return { y: Math.round(scrollY), active: sel, textOpacity: +(+getComputedStyle(text).opacity).toFixed(2) };
  });

// 1) 60 wheel events of deltaY=100, 200ms apart (Chromium 1440×900).
{
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.goto(`${BASE}/about`, { waitUntil: "networkidle", timeout: 90000 });
  await p.waitForTimeout(1200);
  await p.mouse.move(720, 450);
  const seen = new Set();
  for (let i = 0; i < 60; i++) {
    await p.mouse.wheel(0, 100);
    await p.waitForTimeout(200);
    seen.add((await turnAt(p)).active);
  }
  await p.waitForTimeout(1500);
  const end = await p.evaluate(() => {
    const runway = document.querySelector("[data-hero-fit]").parentElement;
    return { y: scrollY, runwayEnd: runway.offsetTop + runway.offsetHeight - innerHeight };
  });
  const prevented = await p.evaluate(() => {
    const e = new WheelEvent("wheel", { deltaY: 100, cancelable: true, bubbles: true });
    document.querySelector('[role="listbox"]').dispatchEvent(e);
    return e.defaultPrevented;
  });
  console.log(`wheel: states seen=${[...seen].sort().join(",")} endY=${end.y} pastCarousel=${end.y > end.runwayEnd} defaultPrevented=${prevented}`);
  await b.close();
}

// 2) Touch swipe up then back down (WebKit iPad emulation).
{
  const b = await webkit.launch();
  const ctx = await b.newContext({ viewport: { width: 1194, height: 834 }, hasTouch: true, isMobile: false });
  const p = await ctx.newPage();
  await p.goto(`${BASE}/about`, { waitUntil: "networkidle", timeout: 90000 });
  await p.waitForTimeout(1200);
  const cdpSwipe = async (dy) => {
    await p.evaluate(async (d) => {
      // WebKit has no CDP; emulate the native result of a swipe: page scroll.
      window.scrollBy({ top: d, behavior: "instant" });
    }, dy);
    await p.waitForTimeout(1600);
  };
  const touchAction = await p.evaluate(() => getComputedStyle(document.querySelector('[role="listbox"]')).touchAction);
  await cdpSwipe(600);
  const down = await turnAt(p);
  await cdpSwipe(-600);
  const up = await turnAt(p);
  console.log(`touch: touch-action=${touchAction} afterDown=${JSON.stringify(down)} afterUp=${JSON.stringify(up)}`);
  await b.close();
}

// 3) Reload at 0/30/60/90% of the hero runway.
{
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.goto(`${BASE}/about`, { waitUntil: "networkidle", timeout: 90000 });
  const total = await p.evaluate(() => document.querySelector("[data-hero-fit]").parentElement.offsetHeight - innerHeight);
  for (const f of [0, 0.3, 0.6, 0.9]) {
    await p.evaluate((y) => window.scrollTo(0, y), Math.round(f * total));
    await p.waitForTimeout(400);
    await p.reload({ waitUntil: "networkidle" });
    await p.waitForTimeout(2000);
    console.log(`reload ${f * 100}%: ${JSON.stringify(await turnAt(p))}`);
  }
  await b.close();
}

// 4) Reduced motion: no word rotation, static word.
{
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
  const p = await ctx.newPage();
  await p.goto(`${BASE}/about`, { waitUntil: "networkidle", timeout: 90000 });
  const word = () =>
    p.evaluate(() => [...document.querySelectorAll("h1 span[aria-hidden]")].find((s) => s.getAttribute("aria-hidden") === "false")?.textContent);
  const a = await word();
  await p.waitForTimeout(3000);
  console.log(`reduced-motion word: ${a} → ${await word()}`);
  await b.close();
}

// 5) Word order + description + buttons.
{
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.goto(`${BASE}/about`, { waitUntil: "networkidle", timeout: 90000 });
  const seq = [];
  for (let i = 0; i < 5; i++) {
    seq.push(await p.evaluate(() => [...document.querySelectorAll("h1 span[aria-hidden]")].find((s) => s.getAttribute("aria-hidden") === "false")?.textContent));
    await p.waitForTimeout(2500);
  }
  const d = await p.evaluate(() => {
    const el = document.querySelector('[data-cms-key="aboutPage.hero_description_full"]');
    return { text: el.textContent, bold: [...el.querySelectorAll("strong")].map((s) => s.textContent), h1: document.querySelector("h1").textContent };
  });
  console.log(`words: ${seq.join(" → ")}`);
  console.log(`desc: ${d.text}\nbold: ${JSON.stringify(d.bold)}\nheading has 中八: ${/中八|八球室/.test(d.h1 + d.text)}`);
  await p.click('[data-cms-key="aboutPage.hero_cta_secondary"]');
  await p.waitForURL(/\/venue/, { timeout: 30000 });
  console.log(`venue button → ${new URL(p.url()).pathname}`);
  await b.close();
}
