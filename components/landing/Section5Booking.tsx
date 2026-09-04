"use client"

import { useEffect, useRef } from "react"
import { useTranslations } from "next-intl"
import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger)
}

/**
 * Section 5 — Booking Process (HomePod mini-style scroll reveal)
 *
 * Four booking layers (3 steps + pricing slogan) reveal on scroll, each
 * driven by GSAP ScrollTrigger with `scrub: true` — the section's progress
 * is tied directly to the scroll position so opacity tracks the user's
 * hand exactly.
 *
 * Opacity profile (HomePod lyric-stack feel):
 *   - Active panel:    1.0
 *   - Adjacent panels: fade to a faint GHOST (0.13) instead of 0,
 *     producing a visible "stack" of muted green outlines around the
 *     active title. This is what gives the section its depth — the
 *     previous line never fully disappears.
 *
 * Per-panel window is a triangle over its `1/N` slice of timeline progress:
 *   sliceStart = i/N, sliceMid = (i+0.5)/N, sliceEnd = (i+1)/N
 *   before sliceStart → GHOST; sliceStart→sliceMid → lerp(GHOST, 1);
 *   sliceMid→sliceEnd → lerp(1, GHOST); after sliceEnd → GHOST.
 * Last panel (slogan) holds at 1 after its midpoint (no fade-out).
 *
 * Section title (`預訂流程`) is positioned at the top of the sticky viewport
 * and remains visible throughout the scroll, anchoring context.
 */

const STEPS = [
  {
    num: "01",
    color: "#3B82F6",
    titleKey: "step1_title" as const,
    bodyKey: "step1_body" as const,
    highlightKey: "step1_highlight" as const,
  },
  {
    num: "02",
    color: "#22C55E",
    titleKey: "step2_title" as const,
    bodyKey: "step2_body" as const,
    highlightKey: "step2_highlight" as const,
  },
  {
    num: "03",
    color: "#F59E0B",
    titleKey: "step3_title" as const,
    bodyKey: "step3_body" as const,
    highlightKey: "step3_highlight" as const,
  },
] as const

const STEP_COUNT = STEPS.length
const TOTAL_PANELS = STEP_COUNT + 1 // steps + pricing slogan
const GHOST = 0.13 // "stack" opacity for non-active panels

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

/**
 * Triangle-window opacity per panel.
 *
 * For each panel `i`, draw a triangle over its slice [i/N, (i+1)/N]:
 *   - below sliceStart  → GHOST
 *   - sliceStart→mid    → lerp(GHOST, 1)
 *   - mid→sliceEnd      → lerp(1, GHOST)
 *   - above sliceEnd    → GHOST
 *
 * The last panel (index === TOTAL_PANELS - 1, the pricing slogan) holds at
 * 1 once it reaches the midpoint of its slice — no fade-out, so it stays
 * visible when the user scrolls into Section 6.
 */
function panelOpacity(progress: number, index: number): number {
  const N = TOTAL_PANELS
  const clamped = Math.max(0, Math.min(1, progress))
  const sliceStart = index / N
  const sliceMid = (index + 0.5) / N
  const sliceEnd = (index + 1) / N

  if (clamped <= sliceStart) return GHOST
  if (clamped >= sliceEnd) return index === N - 1 ? 1 : GHOST

  if (clamped < sliceMid) {
    return lerp(GHOST, 1, (clamped - sliceStart) / (sliceMid - sliceStart))
  }
  // progress in [sliceMid, sliceEnd)
  if (index === N - 1) return 1
  return lerp(1, GHOST, (clamped - sliceMid) / (sliceEnd - sliceMid))
}

function highlight(text: string, word: string, color: string): React.ReactNode {
  if (!word) return text
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const parts = text.split(new RegExp(`(${escaped})`, "g"))
  return parts.map((part, i) =>
    part === word ? (
      <span key={i} style={{ color, fontWeight: 600 }}>
        {part}
      </span>
    ) : (
      part
    ),
  )
}

export default function Section5Booking() {
  const tHow = useTranslations("how")
  const tPricing = useTranslations("pricingPage")
  const stageRef = useRef<HTMLDivElement>(null)
  const layersRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const stage = stageRef.current
    const layerHost = layersRef.current
    if (!stage || !layerHost) return

    const layers = Array.from(
      layerHost.querySelectorAll<HTMLElement>("[data-booking-layer]"),
    )

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (reduce) {
      stage.dataset.reduced = "true"
      return
    }

    // GSAP ScrollTrigger — scrub-driven progress for the whole section.
    // The 400svh stage owns the scroll range; opacity updates per frame in onUpdate.
    // The dummy tween gives the (otherwise empty) timeline a 1-unit duration for
    // scrub to drive — without it, totalDuration() is 0 and progress stays 0.
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: stage,
        start: "top top",
        end: "bottom bottom",
        scrub: true,
      },
    })
    tl.to({}, { duration: 1, ease: "none" })

    tl.eventCallback("onUpdate", () => {
      const p = tl.progress()
      layers.forEach((layer, i) => {
        layer.style.opacity = panelOpacity(p, i).toFixed(4)
      })
    })

    // Initial sync (handles the case where section is already in view on mount)
    layers.forEach((layer, i) => {
      layer.style.opacity = panelOpacity(tl.progress(), i).toFixed(4)
    })

    return () => {
      // Clear GSAP-injected inline opacity so CSS default (opacity: 0) takes over
      layers.forEach((l) => l.style.removeProperty("opacity"))
      tl.scrollTrigger?.kill()
      tl.kill()
    }
  }, [])

  return (
    <section
      data-nav-theme="dark"
      aria-label="Booking process — three steps to play"
      className="relative bg-black"
    >
      <div ref={stageRef} className="s5-stage">
        {/* Pinned viewport — section title + layers crossfade inside here */}
        <div className="s5-pin">
          {/* Section title — always visible at top of sticky viewport */}
          <h2
            className="s5-heading"
            data-cms-key="how.title"
          >
            {tHow("title")}
          </h2>

          {/* Step layers — crossfade on scroll */}
          <div ref={layersRef} className="s5-layers" aria-hidden="true">
            {STEPS.map((step, i) => (
              <div key={step.num} data-booking-layer className="s5-layer">
                <div className="s5-step">
                  <span
                    className="s5-num"
                    style={{ color: step.color }}
                    data-cms-key={`how.${step.titleKey}`}
                  >
                    {step.num}
                  </span>
                  <h3
                    className="s5-title"
                    data-cms-key={`how.${step.titleKey}`}
                  >
                    {highlight(
                      tHow(step.titleKey),
                      tHow(step.highlightKey),
                      step.color,
                    )}
                  </h3>
                  <p
                    className="s5-body"
                    data-cms-key={`how.${step.bodyKey}`}
                  >
                    {tHow(step.bodyKey)}
                  </p>
                </div>
              </div>
            ))}

            {/* Pricing transition sentence — fades in last */}
            <div data-booking-layer className="s5-layer">
              <div className="s5-step">
                <p
                  className="s5-transition"
                  data-cms-key="pricingPage.periods_subtitle"
                >
                  {tPricing("periods_subtitle")}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .s5-stage {
          position: relative;
          height: ${TOTAL_PANELS * 100}svh;
        }
        .s5-pin {
          position: sticky;
          top: 0;
          height: 100svh;
          overflow: hidden;
          transform: translateZ(0);
          will-change: opacity;
          display: flex;
          flex-direction: column;
        }
        /* Section title — pinned at top, visible throughout the scroll */
        .s5-heading {
          position: relative;
          z-index: 2;
          flex-shrink: 0;
          font-family: "Noto Sans TC", -apple-system, BlinkMacSystemFont,
            "SF Pro Display", "Helvetica Neue", sans-serif;
          font-size: clamp(20px, 3vw, 32px);
          font-weight: 700;
          letter-spacing: -0.02em;
          color: rgba(255, 255, 255, 0.85);
          margin: 0;
          padding: clamp(72px, 10vh, 100px) clamp(20px, 5vw, 80px) 0;
          text-align: center;
        }
        /* Layers container — fills remaining space, layers are absolute inside */
        .s5-layers {
          position: relative;
          flex: 1;
          min-height: 0;
        }
        .s5-layer {
          position: absolute;
          inset: 0;
          /* GSAP sets opacity per-frame via style.opacity; default hidden. */
          opacity: 0;
        }
        .s5-step {
          height: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 0 clamp(20px, 5vw, 80px);
          text-align: center;
        }
        .s5-num {
          font-family: "Good Times", "Bebas Neue", sans-serif;
          font-size: clamp(80px, 14vw, 200px);
          font-weight: 400;
          line-height: 1;
          letter-spacing: -0.02em;
          margin-bottom: clamp(12px, 2vw, 24px);
        }
        .s5-title {
          font-family: "Noto Sans TC", -apple-system, BlinkMacSystemFont,
            "SF Pro Display", "Helvetica Neue", sans-serif;
          font-size: clamp(28px, 5vw, 56px);
          font-weight: 800;
          letter-spacing: -0.03em;
          line-height: 1.1;
          /* Brand gradient — green → bright green (background-clip: text). */
          color: transparent;
          background-image: linear-gradient(180deg, #1a9d5c 0%, #22b86b 100%);
          -webkit-background-clip: text;
          background-clip: text;
          margin: 0 0 clamp(12px, 2vw, 20px);
          white-space: nowrap;
          max-width: 100%;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .s5-body {
          font-family: "Noto Sans TC", -apple-system, BlinkMacSystemFont,
            "SF Pro Display", "Helvetica Neue", sans-serif;
          font-size: clamp(15px, 2vw, 20px);
          line-height: 1.6;
          color: rgba(255, 255, 255, 0.6);
          max-width: 520px;
          margin: 0;
        }
        .s5-transition {
          font-family: "Noto Sans TC", -apple-system, BlinkMacSystemFont,
            "SF Pro Display", "Helvetica Neue", sans-serif;
          font-size: clamp(20px, 3.5vw, 36px);
          font-weight: 700;
          letter-spacing: -0.02em;
          line-height: 1.3;
          color: rgba(255, 255, 255, 0.85);
          max-width: 640px;
          margin: 0;
          text-align: center;
        }
        /* Reduced motion: show only step 1, hide all others */
        .s5-stage[data-reduced="true"] .s5-layer {
          opacity: 0;
        }
        .s5-stage[data-reduced="true"] .s5-layer:first-child {
          opacity: 1;
        }
      `}</style>
    </section>
  )
}
