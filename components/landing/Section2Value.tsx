"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";

/**
 * Homepage Section 2 — "Value".
 *
 * Three beats share ONE pinned background stage. The background is pinned with
 * `position: sticky` (not GSAP ScrollTrigger — GSAP is not a dependency here, and
 * the sticky approach is what GalleryScroll.tsx already uses; it also avoids the
 * pin-spacing / address-bar resize bugs GSAP `pin: true` hits on mobile Safari).
 *
 * Copy stays in normal document flow and scrolls up over the pinned layers.
 * Scroll progress drives each layer's opacity through a CSS custom property, so
 * the crossfade tracks the finger/wheel directly (scrub) rather than autoplaying.
 *
 * Geometry note: the stage is PANELS.length * 100svh tall and the sticky child is
 * 100svh, so total scroll distance is (n - 1) * 100svh. Panel k therefore centres
 * in the viewport at progress k / (n - 1) — the same value used as layer k's
 * crossfade peak. Text transitions and background transitions stay in sync
 * without hand-tuned offsets.
 *
 * NOTE (out of scope, do not fix here): GalleryScroll.tsx drops its sticky pin
 * below 861px and runs a separate mobile "beats" layout. This section keeps the
 * pin on mobile by request, so the two sections behave differently on phones.
 */

type Panel = {
  /** Background image for this beat, layered in the pinned stage. */
  src: string;
  /** Focal point so the subject survives the 100svh crop on tall phones. */
  position: string;
};

const PANELS: readonly Panel[] = [
  /* 0 — 快捷/掃碼即入: TAP TO ENTER */
  { src: "/gallery/S2/part1_tap_to_enter.png", position: "50% 50%" },
  /* 1 — 獨立/一房一枱: wide room */
  { src: "/gallery/S2/part3_table_wide_room.png", position: "50% 42%" },
  /* 2 — 設備/專業球枱: table closeup */
  { src: "/gallery/S2/part2_table_closeup.png", position: "50% 50%" },
];

/** Distance between adjacent crossfade peaks in progress units. */
const SPAN = 1 / (PANELS.length - 1);

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/**
 * Triangular ramp centred on each layer's peak. Adjacent layers sum to 1, so
 * there is no dark gap or double-bright flash mid-transition.
 */
function layerOpacity(progress: number, index: number): number {
  return clamp01(1 - Math.abs(progress - index * SPAN) / SPAN);
}

export default function Section2Value() {
  const t = useTranslations("homeValue");
  const stageRef = useRef<HTMLDivElement | null>(null);
  const layersRef = useRef<HTMLDivElement | null>(null);
  const panelsRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const stage = stageRef.current;
    const layerHost = layersRef.current;
    const panelHost = panelsRef.current;
    if (!stage || !layerHost || !panelHost) return;

    const layers = Array.from(
      layerHost.querySelectorAll<HTMLElement>("[data-value-layer]"),
    );
    const copies = Array.from(
      panelHost.querySelectorAll<HTMLElement>("[data-value-copy]"),
    );
    if (!layers.length) return;

    // Opacity crossfades are not vestibular-triggering, so the background
    // transition is kept under reduced motion; only the copy's translate is
    // dropped (handled by the data-reduced attribute in CSS below).
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) stage.dataset.reduced = "true";

    let ticking = false;

    const update = (): void => {
      ticking = false;
      const rect = stage.getBoundingClientRect();
      const total = stage.offsetHeight - layerHost.offsetHeight;
      if (total <= 0) return;

      const scrolled = Math.max(0, Math.min(total, -rect.top));
      const progress = scrolled / total;

      layers.forEach((layer, i) => {
        layer.style.setProperty("--o", layerOpacity(progress, i).toFixed(4));
      });

      if (reduce) return;
      // Each beat fades in as it approaches its own peak and dims as it leaves,
      // so only the copy matching the current background reads as primary.
      copies.forEach((copy, i) => {
        const local = clamp01(1 - Math.abs(progress - i * SPAN) / (SPAN * 0.85));
        copy.style.setProperty("--t", (0.28 + 0.72 * local).toFixed(4));
      });
    };

    const onScroll = (): void => {
      if (!ticking) {
        ticking = true;
        window.requestAnimationFrame(update);
      }
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <section
      aria-labelledby="home-value-title"
      data-nav-theme="dark"
      className="relative bg-black"
    >
      <h2 id="home-value-title" className="sr-only" data-cms-key="homeValue.eyebrow">
        {t("eyebrow")}
      </h2>

      <div ref={stageRef} className="s2-stage">
        {/* Pinned background: absolutely-stacked layers, opacity-crossfaded. */}
        <div ref={layersRef} className="s2-pin" aria-hidden="true">
          {PANELS.map((panel, i) => (
            <div key={panel.src} data-value-layer className="s2-layer">
              <Image
                src={panel.src}
                alt=""
                fill
                priority={i === 0}
                sizes="100vw"
                quality={72}
                style={{ objectFit: "cover", objectPosition: panel.position }}
              />
            </div>
          ))}
          <div className="s2-scrim" />
        </div>

        {/* Copy in normal flow, scrolling up over the pinned background. */}
        <div ref={panelsRef} className="s2-copy">
          {/* Beat 1 — 快捷/掃碼即入 (panel 0: tap-to-enter) */}
          <div data-value-copy className="s2-beat">
            <div className="s2-content">
              <p className="s2-kicker" data-cms-key="homeValue.part2_kicker">
                {t("part2_kicker")}
              </p>
              <p className="s2-line" data-cms-key="homeValue.part2_heading">
                <span className="s2-kw" data-cms-key="homeValue.part2_highlight">
                  {t("part2_highlight")}
                </span>
                {t("part2_after")}
              </p>
              <p className="s2-footer" data-cms-key="homeValue.part2_footer">
                {t("part2_footer_before")}
                <span className="font-code" data-cms-key="homeValue.part2_footer_qr">
                  {t("part2_footer_qr")}
                </span>
                {t("part2_footer_after")}
              </p>
            </div>
          </div>

          {/* Beat 2 — 獨立/一房一枱 (panel 1: wide room) */}
          <div data-value-copy className="s2-beat">
            <div className="s2-content">
              <p className="s2-kicker" data-cms-key="homeValue.part3_kicker">
                {t("part3_kicker")}
              </p>
              <p className="s2-line" data-cms-key="homeValue.part3_heading">
                <span className="s2-kw" data-cms-key="homeValue.part3_highlight">
                  {t("part3_highlight")}
                </span>
                {t("part3_after")}
              </p>
              <p className="s2-footer" data-cms-key="homeValue.part3_footer">
                {t("part3_footer")}
              </p>
            </div>
          </div>

          {/* Beat 3 — 設備/專業球枱 (panel 2: table closeup) */}
          <div data-value-copy className="s2-beat">
            <div className="s2-content">
              <p className="s2-kicker" data-cms-key="homeValue.part1_kicker">
                {t("part1_kicker")}
              </p>
              <p className="s2-line" data-cms-key="homeValue.part1_heading">
                <span className="s2-kw" data-cms-key="homeValue.part1_highlight">
                  {t("part1_highlight")}
                </span>
                {t("part1_after")}
              </p>
              <p className="s2-footer" data-cms-key="homeValue.part1_footer">
                {t("part1_footer")}
              </p>
            </div>
          </div>
        </div>
      </div>
      <style jsx>{`
        /* Stage height = panels * 100svh. svh (not vh) keeps the sticky child
           from exceeding the stage while the mobile address bar is showing —
           with vh the pin visibly drifts on iOS Safari. */
        .s2-stage {
          position: relative;
          height: ${PANELS.length * 100}svh;
        }
        .s2-pin {
          position: sticky;
          top: 0;
          height: 100svh;
          overflow: hidden;
          /* Own compositing layer so opacity changes never repaint the page. */
          transform: translateZ(0);
          will-change: opacity;
        }
        .s2-layer {
          position: absolute;
          inset: 0;
          opacity: var(--o, 0);
          /* No transition: opacity must track scroll position directly (scrub). */
        }
        .s2-scrim {
          position: absolute;
          inset: 0;
          background: linear-gradient(
            180deg,
            rgba(0, 0, 0, 0.62) 0%,
            rgba(0, 0, 0, 0.34) 42%,
            rgba(0, 0, 0, 0.72) 100%
          );
        }
        /* The sticky pin still occupies 100svh of normal flow, so pulling the
           copy up by exactly that much lands beat 1 at stage offset 0. Using the
           full stage height here shifts every beat up by (n-1) viewports and
           desyncs the copy from the background. */
        .s2-copy {
          position: relative;
          margin-top: -100svh;
        }
        .s2-beat {
          height: 100svh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0 24px;
          opacity: var(--t, 1);
        }
        /* Three-layer content wrapper: stacks kicker → heading → footer vertically
           and gives footer a fixed bottom position so it never competes with heading. */
        .s2-content {
          display: flex;
          flex-direction: column;
          align-items: center;
          max-width: 720px;
        }
        /* Kicker — small label above heading, 15–16px medium weight. */
        .s2-kicker {
          margin: 0 0 10px;
          font-family: "Noto Sans TC", var(--font-sans);
          font-size: 15px;
          font-weight: 500;
          letter-spacing: 0.02em;
          color: rgba(255, 255, 255, 0.6);
        }
        .s2-line {
          margin: 0;
          /* One line is the design intent for the CJK copy, so the type is
             sized off viewport width rather than a fixed ramp: 4.5vw keeps
             every zh-HK/zh-CN beat (the longest, Part 1, needs 304px of its
             327px budget at 375px) on a single line, while the English beats
             (48 chars) are free to wrap — fitting those on one line at 375px
             would shrink the type to ~14px, which is not legible. Measured in
             scripts/verify-s2h.mjs. */
          max-width: 96vw;
          text-align: center;
          text-wrap: balance;
          font-family: "Noto Sans TC", var(--font-sans);
          font-weight: 700;
          font-size: clamp(1.6rem, 5vw, 3rem);
          line-height: 1.12;
          letter-spacing: -0.02em;
          color: #ffffff;
          text-shadow: 0 2px 24px rgba(0, 0, 0, 0.5);
        }
        /* Footer — subtle caption at the bottom of each beat. */
        .s2-footer {
          margin: 14px 0 0;
          font-family: "Noto Sans TC", var(--font-sans);
          font-size: 13px;
          font-weight: 400;
          color: rgba(255, 255, 255, 0.5);
          text-align: center;
        }
        /* Green keyword highlight — same size and weight as the heading line,
           only the colour changes. white-space: nowrap keeps a multi-character
           CJK keyword (e.g. 專業球枱) from breaking across lines. Good Times is
           applied separately via .font-code only where the keyword is Latin
           (Part 2's footer "QR Code"), never on Chinese text. */
        .s2-kw {
          color: var(--brand);
          white-space: nowrap;
        }
        .s2-stage[data-reduced="true"] .s2-beat {
          opacity: 1;
        }
        /* No desktop max-width override: 96vw already constrains the line at
           every width. A fixed ch-based cap caused Part 1 to wrap at desktop
           because ch tracks the "0" glyph width, which at 41.6px Noto Sans
           800 is ~24px — 24ch ≈ 576px, too narrow for the 750px Part 1 string.
           Without the override, Part 1 renders at ~52vw (750px / 1440px),
           comfortably centred on the full-bleed photo. */
      `}</style>
    </section>
  );
}
