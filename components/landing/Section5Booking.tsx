"use client"

import { useEffect, useRef } from "react"
import { useTranslations } from "next-intl"

/**
 * Section 5 — Booking Process (HomePod mini-style scroll reveal)
 *
 * Three booking steps crossfade on scroll: 選擇時段 → 掃碼入場 → 累積積分.
 * A pricing transition sentence appears after the last step.
 *
 * Scroll-pinned using `position: sticky` (not GSAP) — same technique as
 * Section2Value. The section is 400svh tall; the sticky child is 100svh.
 * Scroll progress drives opacity of each layer via a triangular ramp.
 *
 * Desktop: large text, full-width layout.
 * Mobile: smaller font, tighter spacing, same fade logic.
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

/** Triangular ramp — peaks at index * SPAN, adjacent layers sum to 1. */
function layerOpacity(progress: number, index: number): number {
  return clamp01(1 - Math.abs(progress - index * SPAN) / SPAN)
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
        {/* Pinned viewport — layers crossfade inside here */}
        <div ref={layersRef} className="s5-pin" aria-hidden="true">
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
                <h2
                  className="s5-title"
                  data-cms-key={`how.${step.titleKey}`}
                >
                  {highlight(
                    t(step.titleKey),
                    t(step.highlightKey),
                    step.color,
                  )}
                </h2>
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
        .s5-stage[data-reduced="true"] .s5-layer {
          opacity: 1;
        }
      `}</style>
    </section>
  )
}
