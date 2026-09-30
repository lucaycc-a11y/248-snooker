"use client"

import Image from "next/image"
import { motion, useReducedMotion, useScroll, useSpring, useTransform } from "framer-motion"
import { useRef } from "react"
import { useTranslations } from "next-intl"
import { Emphasis } from "@/components/ui/Emphasis"

// Screenshot real dimensions: 4269 × 2400
const SCREEN_IMAGE = "/gallery/spacepliot.png"

type Props = { compact?: boolean }

export default function SpacePilotScoreboardExperience({ compact = false }: Props) {
  const t = useTranslations("spacePilot")
  const sectionRef = useRef<HTMLElement>(null)
  const reducedMotion = useReducedMotion()

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end end"],
  })
  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 110,
    damping: 28,
    mass: 0.35,
  })

  // iPad-only scroll animation — all widget/progress/dot transforms removed
  const imageScale = useTransform(smoothProgress, [0, 0.42, 1], [0.82, 0.96, 1])
  const imageRotate = useTransform(smoothProgress, [0, 0.42, 1], [7, 2, 0])
  const imageY = useTransform(smoothProgress, [0, 0.42, 1], [120, 22, 0])
  const imageOpacity = useTransform(smoothProgress, [0, 0.12, 1], [0.65, 1, 1])

  // Compact variant — used in member dashboard cards
  if (compact) {
    return (
      <section
        aria-labelledby="member-space-pilot-title"
        className="mt-6 overflow-hidden rounded-[20px] border border-white/10 bg-white/[0.04] p-4"
      >
        <div className="mb-4">
          <p
            data-cms-key="spacePilot.scoreboard_kicker"
            className="font-label text-[10px] tracking-[0.18em] text-[#22C55E]"
          >
            {t("scoreboard_kicker")}
          </p>
          <h2
            id="member-space-pilot-title"
            data-cms-key="spacePilot.scoreboard_title"
            className="mt-1 text-lg font-semibold text-[#F5F5F7]"
          >
            {t("scoreboard_title")}
          </h2>
        </div>
        <div
          className="relative overflow-hidden rounded-[16px] bg-black"
          style={{ aspectRatio: "4269 / 2400" }}
        >
          <Image
            src={SCREEN_IMAGE}
            alt={t("scoreboard_alt")}
            fill
            sizes="(max-width: 768px) 100vw, 640px"
            className="object-contain"
            draggable={false}
          />
        </div>
      </section>
    )
  }

  return (
    <section
      ref={sectionRef}
      aria-labelledby="space-pilot-scoreboard-title"
      data-nav-theme="dark"
      className="relative h-[220vh] overflow-clip bg-black"
    >
      <div className="sticky top-0 flex min-h-[100svh] flex-col items-center justify-center px-5 py-20 md:px-8">
        <div className="mx-auto w-full max-w-[1120px]">

          {/* Eyebrow */}
          <p
            data-cms-key="spacePilot.scoreboard_kicker"
            className="font-label mb-5 text-center text-[11px] tracking-[0.18em] text-white/45"
          >
            Space Pilot
          </p>

          {/* Headline */}
          <h2
            id="space-pilot-scoreboard-title"
            data-cms-key="spacePilot.scoreboard_title"
            className="mb-8 text-center text-[clamp(2.25rem,5vw,4.5rem)] font-semibold leading-[1.1] tracking-tight text-white md:mb-12"
          >
            {t("scoreboard_title")}
          </h2>

          {/* iPad — bare, no border/frame wrapper, scroll-driven float-up */}
          <div className="mx-auto w-[92vw] sm:w-[78vw] lg:w-[min(60vw,1000px)] [perspective:1400px]">
            <motion.div
              style={
                reducedMotion
                  ? { aspectRatio: "4269 / 2400" }
                  : { scale: imageScale, rotateX: imageRotate, y: imageY, opacity: imageOpacity, aspectRatio: "4269 / 2400" }
              }
              className="relative mx-auto"
            >
              <Image
                src={SCREEN_IMAGE}
                alt={t("scoreboard_alt")}
                fill
                sizes="(max-width: 639px) 92vw, (max-width: 1023px) 78vw, min(60vw, 1000px)"
                className="object-cover"
                priority
                draggable={false}
              />
            </motion.div>
          </div>

          {/* Bottom two-column row */}
          <div className="mx-auto mt-12 grid max-w-[960px] grid-cols-1 items-start gap-8 md:mt-16 md:grid-cols-[1fr_2fr] md:gap-x-14">

            {/* Left: stat block */}
            <div>
              <p
                data-cms-key="spacePilot.stat_label"
                className="font-label mb-2.5 text-[12px] tracking-[0.06em] text-white/40"
              >
                <span className="font-label">Space Pilot</span> 智能管家
              </p>
              <p
                data-cms-key="spacePilot.stat_main"
                className="mb-2.5 text-[clamp(1.5rem,2.4vw,2.25rem)] font-semibold leading-[1.15] tracking-[-0.015em] text-white"
              >
                {t("stat_main")}
              </p>
              <p
                data-cms-key="spacePilot.stat_footnote"
                className="text-[13px] leading-relaxed text-white/38"
              >
                {t("stat_footnote")}
              </p>
            </div>

            {/* Right: paragraph */}
            <Emphasis
              data-cms-key="spacePilot.scoreboard_intro"
              text={t("scoreboard_intro")}
              className="text-[clamp(1.0625rem,1.5vw,1.5rem)] leading-[1.45] max-w-[40ch] text-white/60"
              strongClassName="font-semibold text-white opacity-100"
              dimClassName="font-normal opacity-100"
            />

          </div>
        </div>
      </div>
    </section>
  )
}
