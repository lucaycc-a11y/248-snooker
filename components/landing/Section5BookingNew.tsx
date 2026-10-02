"use client"

import Image from "next/image"
import { useEffect, useRef, useState } from "react"
import { useTranslations } from "next-intl"
import { Link } from "@/i18n/navigation"
import styles from "./Section5BookingNew.module.css"

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

export default function Section5BookingNew() {
  const t = useTranslations("homeBooking")

  const STEPS: Step[] = [
    {
      title: t("steps.0.title"),
      desc: t("steps.0.desc"),
      image: "/images/space8-booking-interface-pick-slot.webp",
      alt: t("steps.0.alt"),
      cta: { label: t("steps.0.cta"), href: "/book" },
    },
    {
      title: t("steps.1.title"),
      desc: t("steps.1.desc"),
      image: "/images/space8-qrcode-entry-system.webp",
      alt: t("steps.1.alt"),
    },
    {
      title: t("steps.2.title"),
      desc: t("steps.2.desc"),
      image: "/images/space8-member-rewards-points.webp",
      alt: t("steps.2.alt"),
      cta: { label: t("steps.2.cta"), href: "/membership" },
    },
  ]

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
    <section
      data-nav-theme="light"
      aria-labelledby="how-it-works-title"
      className={styles["how-section"]}
    >
      <h2 id="how-it-works-title" className={styles["sr-only"]}>
        {t("title")}
      </h2>

      {/* Desktop: two-column */}
      <div ref={wrapRef} className={styles.wrap}>
        <div ref={stageColRef} className={styles["stage-col"]}>
          <div className={styles.stage} aria-hidden="true">
            {STEPS.map((step, i) => (
              <Image
                key={i}
                src={step.image}
                alt={step.alt}
                fill
                sizes="(min-width: 1440px) 520px, (min-width: 1024px) 42vw, (min-width: 820px) 45vw, calc(24vh * 4 / 3)"
                quality={80}
                priority
                className={`${styles["stage-img"]} ${
                  i === activeIdx ? styles.on : ""
                }`}
              />
            ))}
          </div>
        </div>

        <div className={styles.steps}>
          {STEPS.map((step, i) => (
            <button
              key={i}
              data-step={i}
              className={`${styles.step} ${i === activeIdx ? styles.on : ""}`}
              aria-current={i === activeIdx ? "step" : undefined}
              onClick={() => handleStepClick(i)}
            >
              <div className={styles.num}>{String(i + 1).padStart(2, "0")}</div>
              <div className={styles.content}>
                <h3 className={styles["step-title"]}>{step.title}</h3>
                <p className={styles["step-desc"]}>{step.desc}</p>
                {step.cta && (
                  <Link
                    href={step.cta.href}
                    className={styles.cta}
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
  )
}
