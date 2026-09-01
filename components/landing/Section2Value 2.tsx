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
  { src: "/gallery/S2/part1_tap_to_enter.png", position: "50% 50%" },
  { src: "/gallery/S2/part2_table_closeup.png", position: "50% 50%" },
  { src: "/gallery/S2/part3_table_wide_room.png", position: "50% 42%" },
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
          <div data-value-copy className="s2-beat">
            <p className="s2-line" data-cms-key="homeValue.part1_before">
              {t("part1_before")}
              <span className="font-code s2-kw" data-cms-key="homeValue.part1_highlight">
                {t("part1_highlight")}
              </span>
              {t("part1_after")}
            </p>
          </div>

          <div data-value-copy className="s2-beat">
            <p className="s2-line" data-cms-key="homeValue.part2_line">
              {t("part2_line")}
            </p>
          </div>

          <div data-value-copy className="s2-beat">
            <p className="s2-line" data-cms-key="homeValue.part3_line">
              {t("part3_line")}
            </p>
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
        .s2-line {
          margin: 0;
          /* One line is the design intent, so the type is sized off viewport
             width rather than a fixed ramp: 3.1vw keeps the longest beat
             (21 chars, incl. the wider Good Times "QR Code") on a single line
             from 375px up, and the nowrap makes any future regression visible
             as overflow instead of a silent second line. */
          max-width: 96vw;
          text-align: center;
          text-wrap: balance;
          font-family: "Noto Sans TC", var(--font-sans);
          font-weight: 800;
          font-size: clamp(1rem, 4.5vw, 2.6rem);
          line-height: 1.3;
          letter-spacing: -0.02em;
          color: #ffffff;
          text-shadow: 0 2px 24px rgba(0, 0, 0, 0.5);
        }
        /* Good Times, scoped to the Latin keyword only — the house rule is that
           font-code/font-label never wrap Chinese text or full sentences. */
        .s2-kw {
          color: var(--brand);
          font-size: 0.86em;
          white-space: nowrap;
        }
        .s2-stage[data-reduced="true"] .s2-beat {
          opacity: 1;
        }
        @media (min-width: 861px) {
          .s2-line {
            max-width: 24ch;
          }
        }
      `}</style>
    </section>
  );
}
