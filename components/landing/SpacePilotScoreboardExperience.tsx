"use client"

import Image from "next/image"
import { motion, useReducedMotion, useScroll, useSpring, useTransform } from "framer-motion"
import { useRef } from "react"
import { useTranslations } from "next-intl"
import { Emphasis } from "@/components/ui/Emphasis"

// Screenshot real dimensions: 4269 × 2400
const SCREEN_IMAGE = "/gallery/spacepliot.png"
const IMAGE_WIDTH = 4269
const IMAGE_HEIGHT = 2400

type Props = {
  variant?: "full" | "compact" | "landing"
  /** @deprecated Use variant="compact" instead */
  compact?: boolean
}

export default function SpacePilotScoreboardExperience({ variant = "full", compact = false }: Props) {
  const t = useTranslations("spacePilot")
  const sectionRef = useRef<HTMLElement>(null)
  const reducedMotion = useReducedMotion()

  // Backward compat: compact prop maps to variant
  const activeVariant = compact ? "compact" : variant

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: activeVariant === "full" ? ["start start", "end end"] : ["start end", "end start"],
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
  if (activeVariant === "compact") {
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

  // Landing variant — used in member landing page between Points and Safety
  if (activeVariant === "landing") {
    return (
      <section
        ref={sectionRef}
        aria-labelledby="space-pilot-landing-title"
        data-nav-theme="dark"
        className="relative overflow-clip bg-black px-5 py-20 md:px-8 md:py-32"
      >
        <div className="mx-auto w-full max-w-[1120px]">

          {/* Badge */}
          <div className="mb-6 flex justify-center">
            <span
              data-cms-key="spacePilot.landing_badge"
              className="inline-block rounded-full bg-white/10 px-4 py-1.5 text-[11px] font-medium tracking-wide text-white/70"
            >
              {t("landing_badge")}
            </span>
          </div>

          {/* Title */}
          <h2
            id="space-pilot-landing-title"
            data-cms-key="spacePilot.landing_title"
            className="mb-4 text-center text-[clamp(2.5rem,6vw,5rem)] font-semibold leading-[1.05] tracking-tight text-white"
          >
            {t("landing_title")}
          </h2>

          {/* Tagline */}
          <p
            data-cms-key="spacePilot.landing_tagline"
            className="mx-auto mb-16 max-w-[42ch] text-center text-[clamp(1.0625rem,1.8vw,1.375rem)] leading-relaxed text-white/60"
          >
            {t("landing_tagline")}
          </p>

          {/* iPad — viewport-scroll-driven animation, no sticky */}
          <div className="mx-auto mb-20 w-[92vw] sm:w-[78vw] lg:w-[min(60vw,1000px)] [perspective:1400px]">
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
                width={IMAGE_WIDTH}
                height={IMAGE_HEIGHT}
                sizes="(max-width: 639px) 92vw, (max-width: 1023px) 78vw, min(60vw, 1000px)"
                className="h-auto w-full"
                draggable={false}
              />
            </motion.div>
          </div>

          {/* Four steps — row on desktop, stacked on mobile, hairline dividers */}
          <div className="mx-auto grid max-w-[1020px] grid-cols-1 gap-0 md:grid-cols-4">
            {[1, 2, 3, 4].map((step, idx) => (
              <motion.div
                key={step}
                initial={reducedMotion ? false : { opacity: 0, y: 24 }}
                whileInView={reducedMotion ? {} : { opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ delay: idx * 0.12, duration: 0.7, ease: [0.2, 0.7, 0.3, 1] }}
                className="border-white/10 py-8 md:border-l md:px-6 md:py-0 md:first:border-l-0"
              >
                <h3
                  data-cms-key={`spacePilot.landing_step${step}_title`}
                  className="mb-3 text-[15px] font-semibold leading-snug text-white"
                >
                  {t(`landing_step${step}_title`)}
                </h3>
                <p
                  data-cms-key={`spacePilot.landing_step${step}_body`}
                  className="text-[13px] leading-relaxed text-white/50"
                >
                  {t(`landing_step${step}_body`)}
                </p>
              </motion.div>
            ))}
          </div>

        </div>
      </section>
    )
  }

  // Full variant — homepage with 220vh sticky scroll (UNCHANGED from original)
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
                <span className="font-label">Space Pilot</span> {t("stat_label_text")}
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
