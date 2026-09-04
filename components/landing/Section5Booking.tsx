"use client"

import { useEffect, useRef } from "react"
import { useTranslations } from "next-intl"

/**
 * Section 5 — Booking Process (left-steps + right-image layout)
 *
 * Replaced GSAP pin+scrub with normal scroll + parallax depth.
 * Steps reveal on scroll via IntersectionObserver. Background moves
 * at a slower rate than foreground for parallax depth effect.
 *
 * Layout (matches reference 主頁web_final.html):
 *   - Desktop: grid 1fr 1.05fr (steps left, image right)
 *   - Mobile: stacked (image top, steps below)
 *   - No scroll-jacking — section scrolls naturally with the page
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

const STEP_IMAGES = [
  "/gallery/Space8_Competition_Mode.PNG",
  "/gallery/Space8_Door.PNG",
  "/gallery/space-pilot-scoreboard.png",
] as const

function highlight(text: string, word: string, color: string): React.ReactNode {
  if (!word) return text
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const parts = text.split(new RegExp(`(${escaped})`, "g"))
  return parts.map((part, i) =>
    part === word ? (
      <span key={i} style={{ color, fontWeight: 700 }}>
        {part}
      </span>
    ) : (
      part
    ),
  )
}

export default function Section5Booking() {
  const tHow = useTranslations("how")
  const stepsRef = useRef<HTMLDivElement>(null)
  const bgRef = useRef<HTMLDivElement>(null)
  const titleRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const steps = stepsRef.current
    const bg = bgRef.current
    const title = titleRef.current
    if (!steps) return

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (reduce) {
      steps.querySelectorAll<HTMLElement>("[data-step]").forEach((el) => {
        el.style.opacity = "1"
        el.style.transform = "none"
      })
      return
    }

    /* ── Step reveal via IntersectionObserver ── */
    const stepEls = Array.from(steps.querySelectorAll<HTMLElement>("[data-step]"))
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const el = entry.target as HTMLElement
            const idx = Number(el.getAttribute("data-step"))
            el.style.transitionDelay = `${idx * 0.15}s`
            el.classList.add("is-shown")
            observer.unobserve(el)
          }
        })
      },
      { threshold: 0.2, rootMargin: "0px 0px -60px 0px" },
    )
    stepEls.forEach((el) => observer.observe(el))

    /* ── Parallax depth — background moves slower than scroll ── */
    let raf: number
    const onScroll = () => {
      raf = requestAnimationFrame(() => {
        const rect = steps.getBoundingClientRect()
        const viewH = window.innerHeight
        if (rect.bottom < 0 || rect.top > viewH) return

        // Progress: 0 when section top enters viewport, 1 when bottom leaves
        const progress = 1 - rect.top / (rect.height + viewH)

        // Parallax transforms at different rates
        if (bg) {
          bg.style.transform = `translateY(${progress * 60}px)`
        }
        if (title) {
          title.style.transform = `translateY(${progress * -25}px)`
        }
      })
    }

    window.addEventListener("scroll", onScroll, { passive: true })
    onScroll()

    return () => {
      window.removeEventListener("scroll", onScroll)
      cancelAnimationFrame(raf)
      observer.disconnect()
    }
  }, [])

  return (
    <section
      data-nav-theme="dark"
      aria-label="Booking process — three steps to play"
      className="relative bg-black"
    >
      <div className="s5-wrapper">
        {/* ── Parallax background layer (moves slower) ── */}
        <div ref={bgRef} className="s5-bg" />

        {/* ── Title ── */}
        <div ref={titleRef} className="s5-title-block">
          <h2
            className="s5-title"
            data-cms-key="how.title"
          >
            {tHow("title")}
          </h2>
        </div>

        {/* ── Grid: steps left, image right ── */}
        <div ref={stepsRef} className="s5-grid">
          <div className="s5-steps">
            {STEPS.map((step, i) => (
              <div
                key={step.num}
                data-step={i}
                className="s5-step"
              >
                <div className="s5-marker">
                  <span className="s5-num">{step.num}</span>
                </div>
                <div className="s5-text">
                  <h3
                    className="s5-step-title"
                    data-cms-key={`how.${step.titleKey}`}
                  >
                    {highlight(
                      tHow(step.titleKey),
                      tHow(step.highlightKey),
                      step.color,
                    )}
                  </h3>
                  <p
                    className="s5-step-body"
                    data-cms-key={`how.${step.bodyKey}`}
                  >
                    {tHow(step.bodyKey)}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="s5-image-wrap">
            {STEP_IMAGES.map((src, i) => (
              <img
                key={src}
                src={src}
                alt={tHow(STEPS[i].titleKey)}
                className="s5-image"
                loading={i === 0 ? "eager" : "lazy"}
              />
            ))}
            {/* Stacked images — opacity controlled by CSS :has() on step hover/focus */}
          </div>
        </div>
      </div>

      <style jsx>{`
        .s5-wrapper {
          position: relative;
          max-width: 1080px;
          margin: 0 auto;
          padding: clamp(72px, 10vh, 120px) clamp(20px, 5vw, 48px) clamp(64px, 8vh, 96px);
          overflow: hidden;
        }

        /* ── Parallax background ── */
        .s5-bg {
          position: absolute;
          inset: 0;
          background: radial-gradient(
            ellipse 60% 50% at 70% 50%,
            rgba(26, 157, 92, 0.06) 0%,
            transparent 70%
          );
          pointer-events: none;
          will-change: transform;
          transform: translateY(0);
        }

        /* ── Title ── */
        .s5-title-block {
          text-align: center;
          margin-bottom: clamp(32px, 5vw, 48px);
          position: relative;
          z-index: 2;
          will-change: transform;
          transform: translateY(0);
        }
        .s5-title {
          font-family: "Noto Sans TC", -apple-system, BlinkMacSystemFont,
            "SF Pro Display", "Helvetica Neue", sans-serif;
          font-size: clamp(1.7rem, 3.6vw, 2.5rem);
          font-weight: 900;
          letter-spacing: -0.02em;
          color: #ffffff;
          margin: 0;
          line-height: 1.2;
        }

        /* ── Grid layout ── */
        .s5-grid {
          display: grid;
          grid-template-columns: 1fr 1.05fr;
          gap: 44px;
          align-items: center;
          position: relative;
          z-index: 2;
        }

        /* ── Steps list ── */
        .s5-steps {
          display: flex;
          flex-direction: column;
          gap: 30px;
        }
        .s5-step {
          display: flex;
          gap: 20px;
          align-items: flex-start;
          text-align: left;
          opacity: 0;
          transform: translateY(16px);
          transition:
            opacity 0.6s cubic-bezier(0.2, 0.7, 0.3, 1),
            transform 0.6s cubic-bezier(0.2, 0.7, 0.3, 1);
        }
        :global(.s5-step.is-shown) {
          opacity: 1 !important;
          transform: none !important;
        }

        /* ── Step marker (circle) ── */
        .s5-marker {
          flex-shrink: 0;
          width: 42px;
          height: 42px;
          border-radius: 50%;
          border: 1px solid rgba(255, 255, 255, 0.18);
          display: flex;
          align-items: center;
          justify-content: center;
          color: rgba(255, 255, 255, 0.72);
          transition:
            background 0.45s ease,
            border-color 0.45s ease,
            color 0.45s ease,
            transform 0.45s cubic-bezier(0.2, 0.7, 0.3, 1);
          margin-top: 2px;
        }
        .s5-step:hover .s5-marker,
        .s5-step:focus-within .s5-marker {
          background: #22C55E;
          border-color: #22C55E;
          color: #ffffff;
          transform: scale(1.06);
        }
        .s5-num {
          font-family: "Inter", -apple-system, sans-serif;
          font-size: 14px;
          font-weight: 500;
        }

        /* ── Step text ── */
        .s5-text {
          display: block;
        }
        .s5-step-title {
          display: block;
          font-family: "Noto Sans TC", -apple-system, BlinkMacSystemFont,
            "SF Pro Display", "Helvetica Neue", sans-serif;
          font-weight: 700;
          font-size: clamp(17px, 2vw, 20px);
          color: rgba(255, 255, 255, 0.72);
          margin: 0 0 8px;
          transition: color 0.45s ease, transform 0.55s cubic-bezier(0.2, 0.7, 0.3, 1);
          line-height: 1.3;
        }
        .s5-step:hover .s5-step-title,
        .s5-step:focus-within .s5-step-title {
          color: #ffffff;
          transform: translateX(3px);
        }
        .s5-step-body {
          display: block;
          font-family: "Noto Sans TC", -apple-system, BlinkMacSystemFont,
            "SF Pro Display", "Helvetica Neue", sans-serif;
          font-size: 14.5px;
          line-height: 1.8;
          color: rgba(255, 255, 255, 0.52);
          max-width: 34ch;
          margin: 0;
          transition: color 0.45s ease, transform 0.55s cubic-bezier(0.2, 0.7, 0.3, 1);
        }
        .s5-step:hover .s5-step-body,
        .s5-step:focus-within .s5-step-body {
          color: rgba(255, 255, 255, 0.72);
          transform: translateX(3px);
        }

        /* ── Right image column ── */
        .s5-image-wrap {
          position: relative;
          border-radius: 18px;
          overflow: hidden;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: #0b0b0d;
          aspect-ratio: 4 / 3;
        }
        .s5-image {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
          opacity: 0;
          transform: scale(1.05);
          transition: opacity 0.75s ease, transform 1.2s cubic-bezier(0.2, 0.7, 0.3, 1);
        }
        .s5-image:nth-child(1) {
          opacity: 1;
          transform: scale(1);
        }
        /* Show image on step hover — sibling selector via :has */
        .s5-steps:has(.s5-step:nth-child(1):hover) .s5-image:nth-child(1),
        .s5-steps:has(.s5-step:nth-child(1):focus-within) .s5-image:nth-child(1) {
          opacity: 1;
          transform: scale(1);
        }
        .s5-steps:has(.s5-step:nth-child(2):hover) .s5-image:nth-child(2),
        .s5-steps:has(.s5-step:nth-child(2):focus-within) .s5-image:nth-child(2) {
          opacity: 1;
          transform: scale(1);
        }
        .s5-steps:has(.s5-step:nth-child(3):hover) .s5-image:nth-child(3),
        .s5-steps:has(.s5-step:nth-child(3):focus-within) .s5-image:nth-child(3) {
          opacity: 1;
          transform: scale(1);
        }

        /* ── Mobile ── */
        @media (max-width: 860px) {
          .s5-grid {
            grid-template-columns: 1fr;
            gap: 30px;
          }
          .s5-image-wrap {
            order: -1;
          }
          .s5-steps {
            gap: 24px;
          }
          .s5-wrapper {
            padding: 72px 20px 64px;
          }
        }
        @media (max-width: 560px) {
          .s5-marker {
            width: 36px;
            height: 36px;
          }
          .s5-step {
            gap: 15px;
          }
          .s5-step-body {
            font-size: 13.5px;
          }
        }
      `}</style>
    </section>
  )
}
