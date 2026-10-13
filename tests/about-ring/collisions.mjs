// Rest-state fit + collision check. Rotated card polygons vs text boxes (+16px).
// Usage: node tests/about-ring/collisions.mjs   (BASE env optional)
import { chromium, webkit } from "playwright";

const BASE = process.env.BASE ?? "http://localhost:3004";
const SIZES = [
  [1024, 768], [1180, 820], [1194, 834], [1366, 1024],
  [1440, 900], [1920, 1080], [390, 844], [820, 1180],
];

// Separating axis test for two convex polygons.
function intersects(a, b) {
  for (const poly of [a, b]) {
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i], q = poly[(i + 1) % poly.length];
      const nx = q.y - p.y, ny = p.x - q.x;
      const proj = (pts) => pts.map((v) => v.x * nx + v.y * ny);
      const pa = proj(a), pb = proj(b);
      if (Math.max(...pa) < Math.min(...pb) || Math.max(...pb) < Math.min(...pa)) return false;
    }
  }
  return true;
}

let failed = false;
for (const [w, h] of SIZES) {
  const engine = w < 768 || w === 1194 || w === 820 ? webkit : chromium;
  const browser = await engine.launch();
  const page = await browser.newPage({ viewport: { width: w, height: h }, hasTouch: engine === webkit });
  await page.goto(`${BASE}/about`, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForTimeout(1500);
  const r = await page.evaluate(() => {
    const stage = document.querySelector("[data-hero-fit]");
    const nav = document.querySelector(".nav-bar").getBoundingClientRect().bottom;
    const sb = stage.getBoundingClientRect();
    const cards = [...stage.querySelectorAll('[role="listbox"] img')]
      .filter((i) => !i.alt.includes("SPACE8"))
      .map((img) => {
        // Corners of the image box mapped through the full CSS transform chain.
        const el = img;
        const w = el.offsetWidth, h = el.offsetHeight;
        const quad = el.getBoxQuads ? null : null;
        const m = new DOMMatrix(getComputedStyle(el.closest('[class*="backface"]')).transform);
        const rect = el.getBoundingClientRect();
        const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
        const ang = Math.atan2(m.b, m.a);
        // Visible size: bbox of a rotated rect solves back to its w/h.
        const c = Math.abs(Math.cos(ang)), s = Math.abs(Math.sin(ang));
        const det = c * c - s * s;
        let vw, vh;
        if (Math.abs(det) > 0.1) {
          vw = (rect.width * c - rect.height * s) / det;
          vh = (rect.height * c - rect.width * s) / det;
        } else {
          // 45°: assume the card's 3:2 ratio
          vh = (rect.width / (c + s)) / (1 + 1.5) * 2 / 1; vw = vh * 1.5;
          vh = rect.width / (1.5 * c + s); vw = vh * 1.5;
        }
        const pts = [[-vw / 2, -vh / 2], [vw / 2, -vh / 2], [vw / 2, vh / 2], [-vw / 2, vh / 2]].map(([x, y]) => ({
          x: cx + x * Math.cos(ang) - y * Math.sin(ang),
          y: cy + x * Math.sin(ang) + y * Math.cos(ang),
        }));
        void quad; void w; void h;
        return { f: img.src.split("/").pop().slice(6, 8), pts, top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right };
      });
    const box = (el, pad) => {
      if (!el) return null;
      const b = el.getBoundingClientRect();
      if (!b.width) return null;
      return [
        { x: b.left - pad, y: b.top - pad }, { x: b.right + pad, y: b.top - pad },
        { x: b.right + pad, y: b.bottom + pad }, { x: b.left - pad, y: b.bottom + pad },
      ];
    };
    const texts = {
      logo: box(stage.querySelector('img[alt="SPACE8"]'), 16),
      heading: box(stage.querySelector("h1"), 16),
      desc: box(stage.querySelector('[data-cms-key="aboutPage.hero_description_full"]'), 16),
      book: box(stage.querySelector('[data-cms-key="aboutPage.hero_cta_primary"]'), 16),
      venue: box(stage.querySelector('[data-cms-key="aboutPage.hero_cta_secondary"]'), 16),
    };
    const btn = stage.querySelector('[data-cms-key="aboutPage.hero_cta_primary"]').getBoundingClientRect();
    return {
      cards, texts, nav, stageTop: sb.top, stageBottom: sb.bottom, stageW: sb.width,
      fit: stage.getAttribute("data-hero-fit"),
      btnH: btn.height, btnBottom: btn.bottom,
      descPx: parseFloat(getComputedStyle(stage.querySelector('[data-cms-key="aboutPage.hero_description_full"]')).fontSize),
    };
  });
  const hits = [];
  for (const [name, poly] of Object.entries(r.texts)) {
    if (!poly) continue;
    for (const c of r.cards) if (intersects(poly, c.pts)) hits.push(`${name}×${c.f}`);
  }
  const top = Math.min(...r.cards.map((c) => c.top));
  const bottom = Math.max(...r.cards.map((c) => c.bottom));
  const left = Math.min(...r.cards.map((c) => c.left));
  const right = Math.max(...r.cards.map((c) => c.right));
  const ok =
    hits.length === 0 && r.cards.length === 8 && top >= r.nav && bottom <= r.stageBottom &&
    left >= 0 && right <= r.stageW && r.btnBottom <= r.stageBottom - 28 && r.btnH >= 44;
  if (!ok) failed = true;
  console.log(
    `${ok ? "PASS" : "FAIL"} ${w}x${h} cards=${r.cards.length} navGap=${Math.round(top - r.nav)}` +
      ` x=[${Math.round(left)},${Math.round(right)}] btnGapBottom=${Math.round(r.stageBottom - r.btnBottom)}` +
      ` btnH=${Math.round(r.btnH)} desc=${r.descPx}px fit=${r.fit} hits=${hits.join(",") || 0}`,
  );
  await page.screenshot({ path: `tests/about-ring/out/rest-${w}x${h}.png` });
  await browser.close();
}
process.exit(failed ? 1 : 0);
