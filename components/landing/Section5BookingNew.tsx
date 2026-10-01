"use client"

import Image from "next/image"
import { useEffect, useRef, useState } from "react"
import { Link } from "@/i18n/navigation"

/**
 * Section 5 — How it works (scroll-driven, demo implementation)
 *
 * Desktop (>820px): Image sticky on left, steps scroll on right.
 *   Active step = closest to viewport centerline.
 *   NO progress bar.
 *
 * Mobile (≤820px): All 3 steps visible together, image at top.
 *   Entire block sticky. Scroll progress determines active step.
 *   NO progress bar.
 */

interface Step {
  title: string
  desc: string
  image: string
  alt: string
  cta?: { label: string; href: string }
}

const STEPS: Step[] = [
  {
    title: "選擇時段",
    desc: "選擇日期、時間及時長。即時確認，無需等候。",
    image: "/images/space8-booking-interface-pick-slot.webp",
    alt: "手機預訂介面：選擇時段",
    cta: { label: "立即預訂", href: "/book" },
  },
  {
    title: "掃碼入場",
    desc: "預訂確認後即獲 QR 碼。到場掃描，自動開門。",
    image: "/images/space8-qrcode-entry-system.webp",
    alt: "用手機掃描二維碼進場",
  },
  {
    title: "累積積分",
    desc: "每次消費自動賺取積分，換取優惠及會員禮遇。",
    image: "/images/space8-member-rewards-points.webp",
    alt: "會員積分與獎勵",
    cta: { label: "查看會員", href: "/membership" },
  },
]

export default function Section5BookingNew() {
  const wrapRef = useRef<HTMLDivElement>(null)
  const stageColRef = useRef<HTMLDivElement>(null)
  const [activeIdx, setActiveIdx] = useState(0)
  const [isMobile, setIsMobile] = useState(false)
  const tickingRef = useRef(false)

  useEffect(() => {
    const mq = matchMedia("(max-width: 820px)")
    const updateMQ = () => setIsMobile(mq.matches)
    updateMQ()
    mq.addEventListener("change", updateMQ)

    return () => mq.removeEventListener("change", updateMQ)
  }, [])

  useEffect(() => {
    const wrap = wrapRef.current
    const stageCol = stageColRef.current
    if (!wrap) return

    const update = () => {
      tickingRef.current = false

      if (isMobile) {
        // Mobile: set sticky top based on image height
        if (stageCol) {
          const colHeight = stageCol.offsetHeight
          document.documentElement.style.setProperty("--colh", `${colHeight}px`)
        }

        // Scroll progress determines active step
        const total = wrap.offsetHeight - window.innerHeight
        const scrollTop = -wrap.getBoundingClientRect().top
        const progress = Math.min(1, Math.max(0, scrollTop / total))
        const idx = Math.min(
          STEPS.length - 1,
          Math.floor(progress * STEPS.length)
        )
        setActiveIdx(idx)
      } else {
        // Desktop: centerline logic
        const steps = Array.from(
          wrap.querySelectorAll<HTMLElement>("[data-step]")
        )
        const ref = window.innerHeight / 2
        let best = 0
        let bestDist = 1e9

        steps.forEach((s, i) => {
          const rect = s.getBoundingClientRect()
          const center = rect.top + rect.height / 2
          const dist = Math.abs(center - ref)
          if (dist < bestDist) {
            bestDist = dist
            best = i
          }
        })

        setActiveIdx(best)
      }
    }

    const onScroll = () => {
      if (!tickingRef.current) {
        tickingRef.current = true
        requestAnimationFrame(update)
      }
    }

    const onResize = () => {
      update()
    }

    update()
    window.addEventListener("scroll", onScroll, { passive: true })
    window.addEventListener("resize", onResize)

    return () => {
      window.removeEventListener("scroll", onScroll)
      window.removeEventListener("resize", onResize)
    }
  }, [isMobile])

  const handleStepClick = (idx: number) => {
    if (!isMobile) return

    const wrap = wrapRef.current
    if (!wrap) return

    const total = wrap.offsetHeight - window.innerHeight
    const targetScroll =
      window.scrollY +
      wrap.getBoundingClientRect().top +
      (total * (idx + 0.5)) / STEPS.length

    window.scrollTo({ top: targetScroll, behavior: "smooth" })
  }

  return (
    <>
      <section
        ref={wrapRef}
        data-nav-theme="light"
        aria-labelledby="how-it-works-title"
        className="how-section"
      >
        <h2 id="how-it-works-title" className="sr-only">
          如何使用
        </h2>

        {/* Desktop: two-column */}
        <div className="wrap">
          <div ref={stageColRef} className="stage-col">
            <div className="stage" aria-hidden="true">
              {STEPS.map((step, i) => (
                <Image
                  key={i}
                  src={step.image}
                  alt={step.alt}
                  fill
                  sizes="(min-width: 1440px) 520px, (min-width: 1024px) 42vw, (min-width: 820px) 45vw, calc(24vh * 4 / 3)"
                  quality={80}
                  priority
                  className={`stage-img ${i === activeIdx ? "on" : ""}`}
                />
              ))}
            </div>
          </div>

          <div className="steps">
            {STEPS.map((step, i) => (
              <button
                key={i}
                data-step={i}
                className={`step ${i === activeIdx ? "on" : ""}`}
                aria-current={i === activeIdx ? "step" : undefined}
                onClick={() => handleStepClick(i)}
              >
                <div className="num">{String(i + 1).padStart(2, "0")}</div>
                <div className="content">
                  <h3 className="step-title">{step.title}</h3>
                  <p className="step-desc">{step.desc}</p>
                  {step.cta && (
                    <Link
                      href={step.cta.href}
                      className="cta"
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
      </section>

      <style jsx>{`
        .sr-only {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          white-space: nowrap;
          border: 0;
        }

        .how-section {
          background: #f3f3f5;
          color: #17191c;
          position: relative;
        }

        /* Desktop */
        @media (min-width: 821px) {
          .how-section {
            padding: clamp(48px, 8vh, 96px) clamp(24px, 5vw, 64px);
          }

          .wrap {
            display: grid;
            grid-template-columns: minmax(0, 540px) minmax(0, 420px);
            gap: 72px;
            justify-content: center;
            max-width: 1100px;
            margin: 0 auto;
            align-items: start;
          }

          .stage-col {
            position: sticky;
            top: 0;
            height: 100vh;
            display: grid;
            align-items: center;
          }

          .stage {
            position: relative;
            aspect-ratio: 4 / 3;
            border-radius: 24px;
            overflow: hidden;
            background: #e8e8ea;
          }

          .stage-img {
            position: absolute;
            inset: 0;
            width: 100%;
            height: 100%;
            object-fit: cover;
            opacity: 0;
            transition: opacity 0.45s cubic-bezier(0.2, 0.7, 0.3, 1);
          }

          .stage-img.on {
            opacity: 1;
          }

          .steps {
            display: flex;
            flex-direction: column;
          }

          .step {
            min-height: 100vh;
            display: grid;
            grid-template-columns: 40px 1fr;
            gap: 20px;
            align-content: center;
            opacity: 0.3;
            transition: opacity 0.3s cubic-bezier(0.2, 0.7, 0.3, 1);
            background: none;
            border: none;
            padding: 0;
            width: 100%;
            text-align: left;
            cursor: default;
          }

          .step.on {
            opacity: 1;
          }

          .num {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            display: grid;
            place-items: center;
            font-size: 13px;
            font-weight: 500;
            border: 1px solid rgba(0, 0, 0, 0.12);
            color: rgba(0, 0, 0, 0.5);
            transition: all 0.3s cubic-bezier(0.2, 0.7, 0.3, 1);
          }

          .step.on .num {
            background: #4caf64;
            border-color: #4caf64;
            color: #fff;
          }

          .content {
            display: flex;
            flex-direction: column;
            gap: 6px;
          }

          .step-title {
            font-size: 22px;
            font-weight: 600;
            line-height: 1.3;
            margin: 0;
          }

          .step-desc {
            font-size: 14px;
            line-height: 1.7;
            color: #6b6e74;
            margin: 0;
          }

          .cta {
            display: inline-block;
            margin-top: 8px;
            font-size: 15px;
            font-weight: 500;
            color: #17191c;
            text-decoration: none;
            padding: 10px 18px;
            background: #4caf64;
            border-radius: 8px;
            width: fit-content;
            transition: all 0.2s ease;
          }

          .cta:hover {
            background: #45a05b;
            transform: translateX(2px);
          }

          .cta:focus-visible {
            outline: 2px solid #4caf64;
            outline-offset: 3px;
          }
        }

        /* Mobile */
        @media (max-width: 820px) {
          .how-section {
            padding: 0;
            min-height: 260vh;
          }

          .wrap {
            display: block;
          }

          .stage-col {
            position: sticky;
            top: var(--colh, 220px);
            height: auto;
            padding: 10px 16px 14px;
            display: grid;
            justify-items: center;
            background: #f3f3f5;
            z-index: 2;
            pointer-events: none;
          }

          .stage {
            position: relative;
            border-radius: 14px;
            width: min(100%, calc(24vh * 4 / 3));
            aspect-ratio: 4 / 3;
            overflow: hidden;
            background: #e8e8ea;
          }

          .stage-img {
            position: absolute;
            inset: 0;
            width: 100%;
            height: 100%;
            object-fit: cover;
            opacity: 0;
            transition: opacity 0.45s cubic-bezier(0.2, 0.7, 0.3, 1);
          }

          .stage-img.on {
            opacity: 1;
          }

          .steps {
            position: sticky;
            top: var(--colh, 220px);
            padding: 4px 24px 0;
            max-width: 420px;
            margin: 0 auto;
          }

          .step {
            min-height: 0;
            padding: 12px 0;
            display: grid;
            grid-template-columns: 1fr;
            justify-items: center;
            text-align: center;
            gap: 8px;
            align-content: start;
            opacity: 0.28;
            transition: opacity 0.3s cubic-bezier(0.2, 0.7, 0.3, 1);
            cursor: pointer;
            background: none;
            border: none;
            width: 100%;
          }

          .step.on {
            opacity: 1;
          }

          .step:focus-visible {
            outline: 2px solid #4caf64;
            outline-offset: 4px;
            border-radius: 8px;
          }

          .num {
            width: 30px;
            height: 30px;
            border-radius: 50%;
            display: grid;
            place-items: center;
            font-size: 12px;
            font-weight: 500;
            border: 1px solid rgba(0, 0, 0, 0.12);
            color: rgba(0, 0, 0, 0.5);
            transition: all 0.3s cubic-bezier(0.2, 0.7, 0.3, 1);
          }

          .step.on .num {
            background: #4caf64;
            border-color: #4caf64;
            color: #fff;
          }

          .content {
            display: flex;
            flex-direction: column;
            gap: 4px;
          }

          .step-title {
            font-size: 19px;
            font-weight: 600;
            line-height: 1.3;
            margin: 0;
          }

          .step-desc {
            font-size: 13px;
            line-height: 1.6;
            color: #6b6e74;
            margin: 0;
          }

          .cta {
            display: inline-block;
            margin-top: 6px;
            font-size: 14px;
            font-weight: 500;
            color: #17191c;
            text-decoration: none;
            padding: 8px 14px;
            background: #4caf64;
            border-radius: 6px;
            width: fit-content;
            transition: all 0.2s ease;
          }

          .cta:hover {
            background: #45a05b;
          }

          .cta:focus-visible {
            outline: 2px solid #4caf64;
            outline-offset: 2px;
          }
        }

        /* Reduced motion */
        @media (prefers-reduced-motion: reduce) {
          .stage-img,
          .step,
          .num,
          .cta {
            transition: none !important;
          }
        }
      `}</style>
    </>
  )
}
