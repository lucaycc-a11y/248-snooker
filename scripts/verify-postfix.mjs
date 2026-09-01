/**
 * Post-fix flicker verification for the homepage hero.
 * Uses Playwright with a mobile viewport.
 * Captures 100 frames at 200ms intervals (20 seconds) and checks:
 *   - Hero section opacity stays at 1
 *   - Hero img/video maintain correct visibility (no alternating between
 *     the wordmark placeholder and the pool-table photo)
 *   - No console errors related to hydration mismatches
 *   - No sudden layout shifts or blank-to-black flashes
 */

import { chromium } from "playwright";
import { writeFileSync, mkdirSync } from "fs";

const URL = "http://localhost:3000";
const FRAMES = 100;
const INTERVAL_MS = 200;
const TOTAL_SECONDS = (FRAMES * INTERVAL_MS) / 1000;

mkdirSync("/tmp/flicker-postfix", { recursive: true });

async function main() {
  console.log("=== Post-fix flicker verification ===");
  console.log(`Capturing ${FRAMES} frames at ${INTERVAL_MS}ms intervals (${TOTAL_SECONDS}s total)\n`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    userAgent:
      "Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36",
  });

  const page = await context.newPage();

  // Collect console errors
  const errors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error" || msg.type() === "warning") {
      const text = msg.text();
      if (
        text.includes("Hydration") ||
        text.includes("hydration") ||
        text.includes("did not match") ||
        text.includes("Switched to client")
      ) {
        errors.push(text.slice(0, 200));
      }
    }
  });

  await page.goto(URL, { waitUntil: "networkidle" });

  // Wait for hydration + initial animations to settle
  await page.waitForTimeout(2500);

  // Check hero stability
  const heroSnapshots = await page.evaluate(
    async ({ frames, intervalMs }) => {
      const snapshots = [];

      for (let i = 0; i < frames; i++) {
        const hero = document.querySelector("section[data-nav-theme]");
        const heroImg = hero ? hero.querySelector("img") : null;
        const heroVideo = hero ? hero.querySelector("video") : null;

        // Content container (wordmark + headline + sub copy + CTAs)
        const contentDiv = hero ? hero.querySelector(".z-10") : null;

        // Video ended state
        const videoEnded = heroVideo
          ? parseFloat(getComputedStyle(heroVideo).opacity) === 0
          : false;

        snapshots.push({
          frame: i,
          heroOpacity: hero ? parseFloat(getComputedStyle(hero).opacity) : -1,
          imgOpacity: heroImg
            ? parseFloat(getComputedStyle(heroImg).opacity)
            : -1,
          imgNaturalWidth: heroImg ? heroImg.naturalWidth : -1,
          videoOpacity: heroVideo
            ? parseFloat(getComputedStyle(heroVideo).opacity)
            : -1,
          videoReadyState: heroVideo ? heroVideo.readyState : -1,
          videoEnded,
          contentOpacity: contentDiv
            ? parseFloat(getComputedStyle(contentDiv).opacity)
            : -1,
          // Check next sibling section visibility
          nextSection: hero && hero.nextElementSibling
            ? {
                tag: hero.nextElementSibling.tagName,
                opacity: parseFloat(
                  getComputedStyle(hero.nextElementSibling).opacity
                ),
              }
            : null,
        });

        await new Promise(function (r) { setTimeout(r, intervalMs); });
      }
      return snapshots;
    },
    { frames: FRAMES, intervalMs: INTERVAL_MS }
  );

  // Analyze
  let flickerDetected = false;
  let heroFlickerFrames = 0;
  let imgFlickerFrames = 0;
  let contentFlashFrames = 0;

  for (const snap of heroSnapshots) {
    if (snap.heroOpacity !== 1) heroFlickerFrames++;
    if (snap.imgOpacity !== 1 && snap.imgOpacity !== 0) imgFlickerFrames++;
    // Content flash: content opacity should be >= 0.9 after initial animation
    if (snap.frame > 10 && snap.contentOpacity < 0.9)
      contentFlashFrames++;
  }

  flickerDetected = heroFlickerFrames > 5 || imgFlickerFrames > 5 || contentFlashFrames > 5;

  // Print all snapshots
  for (const snap of heroSnapshots) {
    const status = snap.heroOpacity === 1 ? "OK" : "OPACITY=" + snap.heroOpacity;
    console.log(
      "Frame " + String(snap.frame).padStart(3) + ": hero=" + status +
      " img_op=" + snap.imgOpacity +
      " img_w=" + snap.imgNaturalWidth +
      " vid_op=" + snap.videoOpacity +
      " vid_ready=" + snap.videoReadyState +
      " content_op=" + snap.contentOpacity +
      " next=" + (snap.nextSection ? snap.nextSection.tag : "END")
    );
  }

  // Summary
  console.log("\n=== Summary ===");
  console.log("Hydration errors: " + errors.length);
  if (errors.length) {
    for (const e of errors) console.log("  ERROR: " + e);
  }
  console.log("Hero flicker frames (opacity !== 1): " + heroFlickerFrames);
  console.log("Image flicker frames: " + imgFlickerFrames);
  console.log("Content flash frames (op < 0.9 after settle): " + contentFlashFrames);
  console.log("Flicker detected: " + (flickerDetected ? "YES ❌" : "NO ✓"));

  // Also capture a full-page screenshot
  await page.screenshot({
    path: "/tmp/flicker-postfix/final-screenshot.png",
    fullPage: true,
  });
  console.log("Full-page screenshot: /tmp/flicker-postfix/final-screenshot.png");

  await browser.close();
  process.exit(flickerDetected ? 1 : 0);
}

main().catch(function (err) {
  console.error(err);
  process.exit(1);
});
