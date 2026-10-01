"use client"

import Image from "next/image"
import { useEffect, useRef, useState } from "react"
import { useTranslations } from "next-intl"
import { Link } from "@/i18n/navigation"

/**
 * Section 5 — Booking Flow (scroll-triggered redesign)
 *
 * Desktop (≥820px): Left image sticky, right steps scroll naturally.
 *   - Active step determined by viewport centerline.
 *   - Progress bar fills per step progress.
 *   - Image crossfades when active step changes.
 *
 * Mobile (<820px): Entire section sticky (top: nav-height), content swaps.
 *   - Scroll progress determines active step.
 *   - Very short viewports (max-height: 520px): sequential layout, no pinning.
 */

interface Step {
  title: string
  desc: string
  art: string
  altCmsKey?: string // for CMS sync on alt text
  cta?: { label: string; href: string }
}

const STEPS: Step[] = [
  {
    title: "選擇時段",
    desc: "選擇日期、時間及時長。即時確認，無需等候。",
    art: "/images/space8-booking-interface-pick-slot.webp",
    altCmsKey: "step1_alt",
    cta: { label: "立即預訂", href: "/book" },
  },
  {
    title: "掃碼入場",
    desc: "預訂確認後即獲 QR 碼。到場掃描，自動開門。",
    art: "/images/space8-qrcode-entry-system.webp",
    altCmsKey: "step2_alt",
    cta: { label: "我的 QR 碼", href: "/membership" },
  },
  {
    title: "累積積分",
    desc: "每 HK$1 累積 1 積分。越打越划算。",
    art: "/images/space8-member-rewards-points.webp",
    altCmsKey: "step3_alt",
    cta: { label: "查看積分", href: "/membership" },
  },
] as const

const ALT_TEXTS = [
  "手機預訂介面：選擇時段",
  "用手機掃描二維碼進場",
  "會員積分與獎勵",
] as const

const NAV_HEIGHT = 64

export default function Section5Booking() {
  const t = useTranslations("how")
  const tCommon = useTranslations()
  const sectionRef = useRef<HTMLDivElement>(null)
  const stepsContainerRef = useRef<HTMLDivElement>(null)
  const progressBarRef = useRef<HTMLDivElement>(null)

  const [isDesktop, setIsDesktop] = useState(false)
  const [isShortViewport, setIsShortViewport] = useState(false)
  const [activeIdx, setActiveIdx] = useState(0)
  const [progressFills, setProgressFills] = useState<number[]>(
    STEPS.map(() => 0)
  )
  const [isProgrammaticScroll, setIsProgrammaticScroll] = useState(false)

  // Determine layout: desktop (≥820px), mobile with/without short viewport
  useEffect(() => {
    const updateLayout = () => {
      const mq = matchMedia("(min-width: 820px)")
      setIsDesktop(mq.matches)

      const vh = window.innerHeight
      const vw = window.innerWidth
      const isShort = vw < 820 && vh > 520
      setIsShortViewport(isShort)
    }

    updateLayout()
    const mq = matchMedia("(min-width: 820px)")
    mq.addEventListener("change", updateLayout)
    window.addEventListener("resize", updateLayout)

    return () => {
      mq.removeEventListener("change", updateLayout)
      window.removeEventListener("resize", updateLayout)
    }
  }, [])

  // Main scroll/layout logic
  useEffect(() => {
    const section = sectionRef.current
    const stepsContainer = stepsContainerRef.current
    if (!section || !stepsContainer) return

    const prefersReducedMotion = matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches

    let raf: number | null = null

    const updateLayout = () => {
      // Skip scroll-driven updates during programmatic scroll
      if (isProgrammaticScroll) return

      if (isDesktop) {
        // Desktop: centerline logic
        const steps = Array.from(stepsContainer.querySelectorAll<HTMLElement>(
          "[data-step-idx]"
        ))
        const viewCenter = window.innerHeight / 2

        let newActive = 0
        let minDist = Infinity

        steps.forEach((el, idx) => {
          const rect = el.getBoundingClientRect()
          const stepCenter = rect.top + rect.height / 2
          const dist = Math.abs(stepCenter - viewCenter)

          if (dist < minDist) {
            minDist = dist
            newActive = idx
          }
        })

        setActiveIdx(newActive)

        // Update progress fills
        const newFills = steps.map((el, idx) => {
          if (idx < newActive) return 1
          if (idx > newActive) return 0

          const rect = el.getBoundingClientRect()
          const stepStart = rect.top
          const stepEnd = rect.bottom
          const progress =
            (viewCenter - stepStart) / (stepEnd - stepStart)
          return Math.max(0, Math.min(1, progress))
        })

        setProgressFills(newFills)
      } else if (!isShortViewport) {
        // Mobile short viewport: sequential layout (no pinning)
        setActiveIdx(0)
        setProgressFills(STEPS.map(() => 1))
      } else {
        // Mobile normal: scroll progress
        const scrollH = document.documentElement.scrollHeight - window.innerHeight
        const scrollProgress = window.scrollY / scrollH
        const idx = Math.min(
          STEPS.length - 1,
          Math.floor(scrollProgress * STEPS.length)
        )

        setActiveIdx(idx)

        // Progress within active step
        const stepProgress =
          (scrollProgress * STEPS.length - idx) / 1
        const newFills = STEPS.map((_, i) => {
          if (i < idx) return 1
          if (i > idx) return 0
          return Math.max(0, Math.min(1, stepProgress))
        })

        setProgressFills(newFills)
      }
    }

    const onScroll = () => {
      if (raf !== null) cancelAnimationFrame(raf)
      raf = requestAnimationFrame(updateLayout)
    }

    updateLayout()
    window.addEventListener("scroll", onScroll, { passive: true })

    return () => {
      window.removeEventListener("scroll", onScroll)
      if (raf !== null) cancelAnimationFrame(raf)
    }
  }, [isDesktop, isShortViewport, isProgrammaticScroll])

  // Progress bar click handler
  const handleProgressClick = (idx: number) => {
    scrollToStep(idx)
  }

  // Step click handler
  const handleStepClick = (idx: number) => {
    scrollToStep(idx)
  }

  // Unified scroll-to-step logic
  const scrollToStep = (idx: number) => {
    const stepsContainer = stepsContainerRef.current
    if (!stepsContainer) return

    const targetStep = stepsContainer.querySelector(
      `[data-step-idx="${idx}"]`
    ) as HTMLElement | null
    if (!targetStep) return

    const prefersReducedMotion = matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches

    // Set programmatic scroll flag
    setIsProgrammaticScroll(true)
    setActiveIdx(idx)

    if (isDesktop) {
      // Desktop: scroll to center
      const rect = targetStep.getBoundingClientRect()
      const targetY =
        window.scrollY +
        rect.top +
        rect.height / 2 -
        window.innerHeight / 2

      window.scrollTo({
        top: targetY,
        behavior: prefersReducedMotion ? "auto" : "smooth",
      })
    } else if (!isShortViewport) {
      // Mobile short: no scroll needed, just update state
      setIsProgrammaticScroll(false)
      return
    } else {
      // Mobile normal: scroll to step position
      const targetY =
        window.scrollY +
        targetStep.getBoundingClientRect().top -
        NAV_HEIGHT

      window.scrollTo({
        top: targetY,
        behavior: prefersReducedMotion ? "auto" : "smooth",
      })
    }

    // Clear flag after scroll completes (smooth scroll takes ~600-800ms)
    const clearDelay = prefersReducedMotion ? 100 : 900
    setTimeout(() => {
      setIsProgrammaticScroll(false)
    }, clearDelay)
  }

  return (
    <section
      ref={sectionRef}
      data-nav-theme="light"
      aria-labelledby="booking-flow-title"
      className="booking-flow-section"
      style={{
        "--n": STEPS.length,
        "--nav-h": `${NAV_HEIGHT}px`,
        "--steps-top-pad": "22svh",
        "--steps-bot-pad": "34svh",
      } as React.CSSProperties & { [key: string]: string | number }}
    >
      {/* Hidden title for a11y */}
      <h2 id="booking-flow-title" style={{ display: "none" }}>
        預訂流程
      </h2>

      {/* Desktop: Two-column layout */}
      <div className="flow-desktop">
        {/* Left: Sticky image */}
        <div className="flow-pin">
          <div className="flow-image-wrap">
            {STEPS.map((step, i) => (
              <Image
                key={i}
                src={step.art}
                alt={ALT_TEXTS[i]}
                data-cms-key={step.altCmsKey}
                fill
                sizes="(min-width: 1440px) 520px, (min-width: 1024px) 42vw, (min-width: 820px) 45vw, 50vw"
                quality={80}
                priority
                className={`flow-image ${i === activeIdx ? "active" : ""}`}
                style={{ objectFit: "cover" }}
              />
            ))}
          </div>

          {/* Progress bar */}
          <div className="flow-progress-bar">
            {STEPS.map((_, i) => (
              <button
                key={i}
                className="flow-progress-segment"
                onClick={() => handleProgressClick(i)}
                aria-label={`前往步驟 ${i + 1}`}
                style={{
                  "--progress": progressFills[i] ?? 0,
                } as React.CSSProperties & { [key: string]: number }}
              />
            ))}
          </div>
        </div>

        {/* Right: Steps scroll naturally */}
        <div ref={stepsContainerRef} className="flow-steps">
          {STEPS.map((step, i) => (
            <button
              key={i}
              data-step-idx={i}
              className={`flow-step ${i === activeIdx ? "active" : ""}`}
              aria-current={i === activeIdx ? "step" : undefined}
              onClick={() => handleStepClick(i)}
            >
              <div className="flow-marker">
                <span className="flow-num">{String(i + 1).padStart(2, "0")}</span>
              </div>

              <div className="flow-content">
                <h3 className="flow-title">{step.title}</h3>
                <p className="flow-desc">{step.desc}</p>

                {step.cta && i === activeIdx && (
                  <Link
                    href={step.cta.href}
                    className="flow-cta"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {step.cta.label}
                  </Link>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Mobile: Pinned container with content swap */}
      {!isDesktop && (
        <div className="flow-mobile">
          {isShortViewport ? (
            /* Normal mobile: pinned */
            <>
              <div className="flow-mobile-image">
                {STEPS.map((step, i) => (
                  <Image
                    key={i}
                    src={step.art}
                    alt={ALT_TEXTS[i]}
                    data-cms-key={step.altCmsKey}
                    fill
                    sizes="(min-width: 768px) 85vw, 92vw"
                    quality={80}
                    priority
                    className={`flow-image ${i === activeIdx ? "active" : ""}`}
                    style={{ objectFit: "cover" }}
                  />
                ))}
              </div>

              <div className="flow-mobile-steps">
                {STEPS.map((step, i) => (
                  <button
                    key={i}
                    className={`flow-mobile-step ${i === activeIdx ? "active" : ""}`}
                    aria-current={i === activeIdx ? "step" : undefined}
                    onClick={() => handleStepClick(i)}
                  >
                    <div className="flow-marker">
                      <span className="flow-num">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                    </div>
                    <div className="flow-content">
                      <h3 className="flow-title">{step.title}</h3>
                      <p className="flow-desc">{step.desc}</p>
                      {step.cta && i === activeIdx && (
                        <Link
                          href={step.cta.href}
                          className="flow-cta"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {step.cta.label}
                        </Link>
                      )}
                    </div>
                  </button>
                ))}
              </div>

              {/* Mobile progress bar */}
              <div className="flow-mobile-progress">
                {STEPS.map((_, i) => (
                  <button
                    key={i}
                    className="flow-progress-segment"
                    onClick={() => handleProgressClick(i)}
                    aria-label={`前往步驟 ${i + 1}`}
                    style={{
                      "--progress": progressFills[i] ?? 0,
                    } as React.CSSProperties & { [key: string]: number }}
                  />
                ))}
              </div>
            </>
          ) : (
            /* Very short viewport: sequential */
            <div className="flow-sequential">
              {STEPS.map((step, i) => (
                <div key={i} className="flow-step-seq" aria-current="step">
                  <div className="flow-marker">
                    <span className="flow-num">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                  </div>
                  <div className="flow-content">
                    <h3 className="flow-title">{step.title}</h3>
                    <p className="flow-desc">{step.desc}</p>
                    {step.cta && (
                      <Link href={step.cta.href} className="flow-cta">
                        {step.cta.label}
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <style jsx>{`
        .booking-flow-section {
          background: #f3f3f5;
          color: #1d1d1f;
          position: relative;
          width: 100%;
          min-height: 100svh;
        }

        /* Desktop layout */
        .flow-desktop {
          display: none;
        }

        @media (min-width: 820px) {
          .booking-flow-section {
            padding: clamp(48px, 8vh, 80px) clamp(24px, 5vw, 64px);
            display: flex;
            align-items: center;
            justify-content: center;
          }

          .flow-desktop {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: clamp(32px, 4vw, 72px);
            align-items: start;
            width: 100%;
            max-width: 1200px;
            margin-inline: auto;
          }

          .flow-pin {
            position: sticky;
            top: calc(50vh - 220px);
            height: fit-content;
          }

          /* Images are 1448×1086 — landscape 4:3 */
          .flow-image-wrap {
            position: relative;
            width: 100%;
            aspect-ratio: 4 / 3;
            border-radius: 20px;
            overflow: hidden;
            background: #e8e8ea;
            margin-bottom: 20px;
          }

          .flow-image {
            position: absolute;
            inset: 0;
            width: 100%;
            height: 100%;
            object-fit: cover;
            opacity: 0;
            z-index: 0;
            transition: opacity 0.4s cubic-bezier(0.2, 0.7, 0.3, 1);
          }

          .flow-image.active {
            opacity: 1;
            z-index: 1;
          }

          @media (prefers-reduced-motion: reduce) {
            .flow-image {
              transition: none;
            }
          }

          .flow-progress-bar {
            display: flex;
            gap: 8px;
          }

          .flow-progress-segment {
            flex: 1;
            height: 3px;
            min-height: 44px;
            background: rgba(0, 0, 0, 0.1);
            border: none;
            cursor: pointer;
            border-radius: 2px;
            position: relative;
            overflow: hidden;
            padding: 0;
          }

          .flow-progress-segment:focus-visible {
            outline: 2px solid #22b86b;
            outline-offset: 2px;
          }

          .flow-progress-segment::before {
            content: "";
            position: absolute;
            inset: 0;
            background: #22b86b;
            transform: scaleX(var(--progress, 0));
            transform-origin: left center;
            transition: transform 0.2s ease;
          }

          .flow-steps {
            display: flex;
            flex-direction: column;
            gap: 0;
            padding-top: var(--steps-top-pad);
            padding-bottom: var(--steps-bot-pad);
          }

          .flow-step {
            display: flex;
            gap: 24px;
            min-height: 38svh;
            align-items: center;
            padding: 0;
            opacity: 0.38;
            transition: opacity 0.3s ease;
            background: none;
            border: none;
            width: 100%;
            text-align: left;
            cursor: pointer;
          }

          .flow-step:focus-visible {
            outline: 2px solid #22b86b;
            outline-offset: 4px;
            border-radius: 8px;
          }

          .flow-step.active {
            opacity: 1;
          }

          .flow-marker {
            flex-shrink: 0;
            width: 40px;
            height: 40px;
            border-radius: 50%;
            background: transparent;
            border: 1px solid rgba(0, 0, 0, 0.18);
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.3s ease;
          }

          .flow-step.active .flow-marker {
            background: #22b86b;
            border-color: #22b86b;
          }

          .flow-num {
            font-size: 14px;
            font-weight: 500;
            color: rgba(0, 0, 0, 0.6);
            transition: color 0.3s ease;
          }

          .flow-step.active .flow-num {
            color: #062b0d;
          }

          .flow-content {
            flex: 1;
          }

          .flow-title {
            font-size: clamp(18px, 2vw, 24px);
            font-weight: 700;
            margin: 0 0 8px;
            color: rgba(0, 0, 0, 0.65);
            transition: color 0.3s ease;
          }

          .flow-step.active .flow-title {
            color: #1d1d1f;
          }

          .flow-desc {
            font-size: 14.5px;
            line-height: 1.6;
            color: rgba(0, 0, 0, 0.45);
            margin: 0 0 16px;
            max-width: 40ch;
            transition: color 0.3s ease;
          }

          .flow-step.active .flow-desc {
            color: rgba(0, 0, 0, 0.65);
          }

          .flow-cta {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 10px 16px;
            background: #22b86b;
            color: #062b0d;
            text-decoration: none;
            border-radius: 6px;
            font-weight: 600;
            font-size: 14px;
            transition: all 0.2s ease;
          }

          .flow-cta:hover {
            background: #40a84a;
            transform: translateX(2px);
          }

          .flow-cta:focus-visible {
            outline: 2px solid #22b86b;
            outline-offset: 4px;
          }
        }

        /* Mobile layout */
        .flow-mobile {
          display: block;
        }

        @media (max-width: 819px) {
          .booking-flow-section {
            padding: 0;
          }

          .flow-mobile {
            position: sticky;
            top: var(--nav-h);
            height: calc(100svh - var(--nav-h));
            display: flex;
            flex-direction: column;
            overflow: hidden;
          }

          .flow-mobile-image {
            position: relative;
            flex-shrink: 0;
            width: calc(100% - 32px);
            /* Images are 1448×1086 — landscape 4:3 */
            aspect-ratio: 4 / 3;
            max-width: 520px;
            margin: 12px auto 0;
            border-radius: 16px;
            overflow: hidden;
            background: #e8e8ea;
          }

          .flow-image {
            position: absolute;
            inset: 0;
            width: 100%;
            height: 100%;
            object-fit: cover;
            opacity: 0;
            z-index: 0;
            transition: opacity 0.4s cubic-bezier(0.2, 0.7, 0.3, 1);
          }

          .flow-image.active {
            opacity: 1;
            z-index: 1;
          }

          @media (prefers-reduced-motion: reduce) {
            .flow-image {
              transition: none;
            }
          }

          .flow-mobile-steps {
            flex: 1;
            overflow-y: auto;
            padding: 24px 20px;
            display: flex;
            flex-direction: column;
            gap: 16px;
          }

          .flow-mobile-step {
            display: flex;
            gap: 16px;
            opacity: 0.38;
            transition: opacity 0.3s ease;
            background: none;
            border: none;
            width: 100%;
            text-align: left;
            cursor: pointer;
            padding: 8px 0;
          }

          .flow-mobile-step:focus-visible {
            outline: 2px solid #22b86b;
            outline-offset: 2px;
            border-radius: 6px;
          }

          .flow-mobile-step.active {
            opacity: 1;
          }

          .flow-marker {
            flex-shrink: 0;
            width: 36px;
            height: 36px;
            border-radius: 50%;
            background: transparent;
            border: 1px solid rgba(0, 0, 0, 0.18);
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.3s ease;
            margin-top: 2px;
          }

          .flow-mobile-step.active .flow-marker {
            background: #22b86b;
            border-color: #22b86b;
          }

          .flow-num {
            font-size: 12px;
            font-weight: 500;
            color: rgba(0, 0, 0, 0.6);
            transition: color 0.3s ease;
          }

          .flow-mobile-step.active .flow-num {
            color: #062b0d;
          }

          .flow-content {
            flex: 1;
          }

          .flow-title {
            font-size: 16px;
            font-weight: 700;
            margin: 0 0 6px;
            color: rgba(0, 0, 0, 0.65);
            transition: color 0.3s ease;
          }

          .flow-mobile-step.active .flow-title {
            color: #1d1d1f;
          }

          .flow-desc {
            font-size: 13px;
            line-height: 1.5;
            color: rgba(0, 0, 0, 0.45);
            margin: 0 0 12px;
            transition: color 0.3s ease;
          }

          .flow-mobile-step.active .flow-desc {
            color: rgba(0, 0, 0, 0.65);
          }

          .flow-cta {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 8px 12px;
            background: #22b86b;
            color: #062b0d;
            text-decoration: none;
            border-radius: 4px;
            font-weight: 600;
            font-size: 12px;
            transition: all 0.2s ease;
          }

          .flow-cta:hover {
            background: #40a84a;
          }

          .flow-cta:focus-visible {
            outline: 2px solid #22b86b;
            outline-offset: 2px;
          }

          .flow-mobile-progress {
            flex-shrink: 0;
            display: flex;
            gap: 4px;
            padding: 16px 20px;
            border-top: 1px solid rgba(0, 0, 0, 0.06);
          }

          .flow-progress-segment {
            flex: 1;
            height: 2px;
            min-height: 44px;
            background: rgba(0, 0, 0, 0.1);
            border: none;
            cursor: pointer;
            border-radius: 1px;
            position: relative;
            overflow: hidden;
            padding: 0;
          }

          .flow-progress-segment:focus-visible {
            outline: 2px solid #22b86b;
            outline-offset: 2px;
          }

          .flow-progress-segment::before {
            content: "";
            position: absolute;
            inset: 0;
            background: #22b86b;
            transform: scaleX(var(--progress, 0));
            transform-origin: left center;
            transition: transform 0.2s ease;
          }
        }

        /* Very short viewport: sequential layout */
        @media (max-width: 819px) and (max-height: 520px) {
          .flow-mobile {
            position: static;
            height: auto;
            display: block;
          }

          .flow-mobile-image {
            display: none;
          }

          .flow-mobile-steps {
            padding: 20px;
            flex: none;
            overflow: visible;
          }

          .flow-mobile-progress {
            display: none;
          }

          .flow-sequential {
            display: flex;
            flex-direction: column;
            gap: 24px;
            padding: 20px;
          }

          .flow-step-seq {
            display: flex;
            gap: 16px;
          }
        }

        /* Reduced motion */
        @media (prefers-reduced-motion: reduce) {
          .flow-progress-segment::before,
          .flow-marker,
          .flow-step,
          .flow-cta {
            transition: none !important;
          }
        }
      `}</style>
    </section>
  )
}
