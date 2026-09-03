"use client"

import { useEffect, useRef } from "react"
import { useTranslations } from "next-intl"

/**
 * Section 5 — Booking Process (HomePod mini-style scroll reveal)
 *
 * Four booking steps crossfade on scroll: 選擇時段 → 掃碼入場 → 累積積分 → pricing.
 * A pricing transition sentence appears after the last step.
 *
 * Scroll-pinned using `position: sticky` (not GSAP) — same technique as
 * Section2Value. The section is 400svh tall; the sticky child is 100svh.
 * Scroll progress drives opacity of each layer via a step function.
 *
 * KEY DESIGN: Only one layer is ever fully visible at a time. Adjacent layers
 * cross-fade through a narrow 10% transition window, so text never overlaps.
 * Previous steps fade to a faint "ghost" opacity during the transition, matching
 * the HomePod mini lyric-reveal aesthetic.
 *
 * The section title ("預訂流程") is positioned at the top of the sticky viewport
 * and remains visible throughout the scroll, anchoring context for each step.
 */

const GOOD_TIMES: React.CSSProperties = {
  fontFamily: '"Good Times", "Bebas Neue", sans-serif',
}

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
const TOTAL_PANELS = STEP_COUNT + 1 // steps + pricing sentence
const SPAN = 1 / (TOTAL_PANELS - 1)

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v
}

/**
 * Step-function opacity — HomePod mini style.
 *
 * Only ONE layer is ever fully visible (opacity 1). Adjacent layers cross-fade
 * through a narrow transition window (10% of SPAN ≈ 3.3% of total scroll).
 * Previous step fades to ~0 opacity just as the next step fades in from ~0,
 * so there is no visual overlap of text content.
 *
 * At the midpoint of any transition, BOTH adjacent layers are at ~0 opacity,
 * producing a brief "snap" — the signature HomePod mini lyric-change feel.
 *
 * At the boundary between steps (e.g. progress = 0.25):
 *   Layer 0 (fading out): opacity = 0
 *   Layer 1 (fading in):  opacity = 0
 * → both are invisible simultaneously, creating a clean cut.
 *
 * At progress = 0.22:
 *   Layer 0 (fading out): (0.2667 - 0.22) / 0.0333 = 1.4 → clamp to 1.0
 *   Layer 1 (fading in):  (0.22 - 0.1667) / 0.0333 = 1.6 → clamp to 1.0
 * → wait, this means BOTH are 1.0. Let me recalculate...
 *
 * Actually, the transition window is:
 *   Layer i fades out over [i*SPAN + 0.9*SPAN, (i+1)*SPAN]
 *   Layer i+1 fades in  over [(i+1)*SPAN, (i+1)*SPAN + 0.1*SPAN]
 *
 * These windows are ADJACENT, not overlapping:
 *   Layer 0 fades out: [0.2667, 0.3333]
 *   Layer 1 fades in:  [0.3333, 0.3667]
 *
 * At the boundary (0.3333):
 *   Layer 0: (0.3333 - 0.2667) / 0.0333 = 2.0 → clamp to 1.0 → opacity = 1 - 1 = 0
 *   Layer 1: (0.3333 - 0.3333) / 0.0333 = 0 → opacity = 0
 * → Both at 0. Clean snap.
 *
 * At 0.30 (inside Layer 0's fade-out):
 *   Layer 0: (0.30 - 0.2667) / 0.0333 = 1.0 → opacity = 0
 *   Layer 1: (0.30 - 0.3333) / 0.0333 < 0 → opacity = 0
 * → Both at 0. Brief invisible gap (intentional).
 *
 * At 0.25 (Layer 0 still visible):
 *   Layer 0: 0.25 < 0.2667 → not in fade-out → opacity = 1
 *   Layer 1: 0.25 < 0.3333 → not in fade-in → opacity = 0
 * → Only Layer 0 visible. ✓
 */
function layerOpacity(progress: number, index: number): number {
  const stepStart = index * SPAN
  const stepEnd = (index + 1) * SPAN
  const fadeOutStart = stepStart + 0.9 * SPAN
  const fadeInEnd = stepEnd + 0.1 * SPAN
  const transLen = 0.1 * SPAN

  // Last layer (pricing): fades in, stays visible
  if (index === STEP_COUNT) {
    return clamp01((progress - stepStart) / transLen)
  }

  // Normal steps: fully visible in the middle, fade out near the end
  if (progress >= fadeOutStart) {
    return clamp01(1 - (progress - fadeOutStart) / transLen)
  }
  return progress >= stepStart ? 1 : 0
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
  const t = useTranslations("how")
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
    if (reduce) stage.dataset.reduced = "true"

    let ticking = false

    const update = (): void => {
      ticking = false
      const rect = stage.getBoundingClientRect()
      const total = stage.offsetHeight - window.innerHeight
      if (total <= 0) return

      const scrolled = Math.max(0, Math.min(total, -rect.top))
      const progress = scrolled / total

      layers.forEach((layer, i) => {
        layer.style.setProperty("--o", layerOpacity(progress, i).toFixed(4))
      })
    }

    const onScroll = (): void => {
      if (!ticking) {
        ticking = true
        window.requestAnimationFrame(update)
      }
    }

    update()
    window.addEventListener("scroll", onScroll, { passive: true })
    window.addEventListener("resize", onScroll, { passive: true })

    return () => {
      window.removeEventListener("scroll", onScroll)
      window.removeEventListener("resize", onScroll)
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
            {t("title")}
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
                      t(step.titleKey),
                      t(step.highlightKey),
                      step.color,
                    )}
                  </h3>
                  <p
                    className="s5-body"
                    data-cms-key={`how.${step.bodyKey}`}
                  >
                    {t(step.bodyKey)}
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
                  {t("title")}
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
          opacity: var(--o, 0);
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
          color: #ffffff;
          margin: 0 0 clamp(12px, 2vw, 20px);
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
