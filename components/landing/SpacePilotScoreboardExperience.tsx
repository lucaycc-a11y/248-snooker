"use client"

import Image from "next/image"
import { motion, useMotionValueEvent, useReducedMotion, useScroll, useSpring, useTransform } from "framer-motion"
import { useRef, useState } from "react"
import { useTranslations } from "next-intl"
import { Activity, BarChart3, Clock3, Trophy } from "lucide-react"

const SCOREBOARD_IMAGE = "/gallery/space-pilot-scoreboard.png"
const EASE = [0.16, 1, 0.3, 1] as const

type SpacePilotScoreboardExperienceProps = {
  compact?: boolean
}

export default function SpacePilotScoreboardExperience({
  compact = false,
}: SpacePilotScoreboardExperienceProps) {
  const t = useTranslations("spacePilot")
  const sectionRef = useRef<HTMLElement>(null)
  const reducedMotion = useReducedMotion()
  const [stage, setStage] = useState(0)
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end end"],
  })
  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 110,
    damping: 28,
    mass: 0.35,
  })

  const imageScale = useTransform(smoothProgress, [0, 0.42, 1], [0.82, 0.96, 1])
  const imageRotate = useTransform(smoothProgress, [0, 0.42, 1], [7, 2, 0])
  const imageY = useTransform(smoothProgress, [0, 0.42, 1], [80, 15, 0])
  const imageOpacity = useTransform(smoothProgress, [0, 0.12, 1], [0.65, 1, 1])
  const leftPanelX = useTransform(smoothProgress, [0.08, 0.42], [-48, 0])
  const rightPanelX = useTransform(smoothProgress, [0.42, 0.78], [48, 0])
  const standingsY = useTransform(smoothProgress, [0.62, 0.9], [42, 0])
  const standingsOpacity = useTransform(smoothProgress, [0.58, 0.78], [0, 1])
  const progressWidth = useTransform(smoothProgress, [0, 1], ["8%", "100%"])

  useMotionValueEvent(smoothProgress, "change", (value) => {
    setStage(value < 0.34 ? 0 : value < 0.68 ? 1 : 2)
  })

  if (compact) {
    return (
      <section
        aria-labelledby="member-space-pilot-title"
        className="mt-6 overflow-hidden rounded-[20px] border border-white/10 bg-white/[0.04] p-4"
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p data-cms-key="spacePilot.scoreboard_kicker" className="font-label text-[10px] tracking-[0.18em] text-[#22C55E]">
              {t("scoreboard_kicker")}
            </p>
            <h2 data-cms-key="spacePilot.scoreboard_title" id="member-space-pilot-title" className="mt-1 text-lg font-semibold text-[#F5F5F7]">
              {t("scoreboard_title")}
            </h2>
          </div>
          <Activity size={18} strokeWidth={1.6} className="shrink-0 text-[#22C55E]" aria-hidden="true" />
        </div>
        <div className="relative aspect-[983/674] overflow-hidden rounded-[14px] border border-white/10 bg-black">
          <Image
            src={SCOREBOARD_IMAGE}
            alt={t("scoreboard_alt")}
            fill
            sizes="(max-width: 768px) 100vw, 640px"
            className="object-cover"
            draggable={false}
          />
          <div className="absolute inset-x-3 bottom-3 flex items-center justify-between rounded-lg border border-white/15 bg-black/70 px-3 py-2 text-[10px] text-white/80 backdrop-blur-md">
            <span data-cms-key="spacePilot.scoreboard_live">{t("scoreboard_live")}</span>
            <span data-cms-key="spacePilot.scoreboard_match" className="flex items-center gap-1 text-[#22C55E]"><span className="h-1.5 w-1.5 rounded-full bg-[#22C55E]" aria-hidden="true" />{t("scoreboard_match")}</span>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section
      ref={sectionRef}
      aria-labelledby="space-pilot-scoreboard-title"
      className="relative h-[220vh] overflow-clip bg-black"
      style={{ position: "relative" }}
    >
      <div className="sticky top-0 flex min-h-[100svh] items-center overflow-hidden px-4 py-16 md:px-8 md:py-20">
        <div className="mx-auto w-full max-w-7xl">
          <div className="mb-8 flex items-end justify-between gap-6 md:mb-12">
            <div className="max-w-2xl">
              <p data-cms-key="spacePilot.scoreboard_kicker" className="font-label text-[10px] tracking-[0.2em] text-[#22C55E]">
                {t("scoreboard_kicker")}
              </p>
              <h2 data-cms-key="spacePilot.scoreboard_title" id="space-pilot-scoreboard-title" className="mt-3 text-3xl font-semibold tracking-tight text-white md:text-6xl">
                {t("scoreboard_title")}
              </h2>
              <p data-cms-key="spacePilot.scoreboard_intro" className="mt-4 max-w-xl text-sm leading-relaxed text-white/60 md:text-lg">
                {t("scoreboard_intro")}
              </p>
            </div>
            <div data-cms-key="spacePilot.scoreboard_live" className="hidden shrink-0 items-center gap-2 border-b border-white/20 pb-2 text-[10px] tracking-[0.18em] text-white/45 md:flex">
              <span className="h-2 w-2 rounded-full bg-[#22C55E]" aria-hidden="true" />
              {t("scoreboard_live")}
            </div>
          </div>

          <div className="relative mx-auto max-w-6xl [perspective:1400px]">
            <motion.div
              style={reducedMotion ? undefined : { scale: imageScale, rotateX: imageRotate, y: imageY, opacity: imageOpacity }}
              transition={{ duration: 0.7, ease: EASE }}
              className="relative z-10 mx-auto aspect-[983/674] w-full max-w-5xl overflow-hidden rounded-[22px] border border-white/20 bg-[#11131b] md:rounded-[30px] md:border-2"
            >
              <Image
                src={SCOREBOARD_IMAGE}
                alt={t("scoreboard_alt")}
                fill
                sizes="(max-width: 768px) 100vw, 1024px"
                className="object-cover"
                priority
                draggable={false}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-white/[0.06]" aria-hidden="true" />

              <motion.div
                style={reducedMotion ? undefined : { x: leftPanelX }}
                className="absolute left-3 top-3 hidden items-center gap-2 rounded-xl border border-white/20 bg-black/70 px-3 py-2 text-[10px] text-white/80 backdrop-blur-md sm:flex md:left-6 md:top-6 md:px-4"
              >
                <Trophy size={14} className="text-[#F59E0B]" aria-hidden="true" />
                <span data-cms-key="spacePilot.scoreboard_wins">{t("scoreboard_wins")}</span>
              </motion.div>

              <motion.div
                style={reducedMotion ? undefined : { x: rightPanelX }}
                className="absolute right-3 top-3 hidden items-center gap-2 rounded-xl border border-white/20 bg-black/70 px-3 py-2 text-[10px] text-white/80 backdrop-blur-md sm:flex md:right-6 md:top-6 md:px-4"
              >
                <Clock3 size={14} className="text-[#60A5FA]" aria-hidden="true" />
                <span data-cms-key="spacePilot.scoreboard_time">{t("scoreboard_time")}</span>
              </motion.div>

              <motion.div
                style={reducedMotion ? undefined : { y: standingsY, opacity: standingsOpacity }}
                className="absolute inset-x-3 bottom-3 flex items-center justify-between gap-3 rounded-xl border border-white/20 bg-black/75 px-3 py-2.5 text-[10px] text-white/80 backdrop-blur-md md:inset-x-6 md:bottom-6 md:px-4 md:py-3"
              >
                <span data-cms-key="spacePilot.scoreboard_standings" className="flex items-center gap-2"><BarChart3 size={14} className="text-[#A78BFA]" aria-hidden="true" />{t("scoreboard_standings")}</span>
                <span data-cms-key="spacePilot.scoreboard_match" className="hidden text-white/45 sm:inline">{t("scoreboard_match")}</span>
              </motion.div>
            </motion.div>

            <div className="pointer-events-none absolute inset-x-0 -bottom-8 z-20 mx-auto flex max-w-5xl items-center gap-3 px-2 md:-bottom-10">
              <div className="h-px flex-1 bg-white/10"><motion.div style={reducedMotion ? { width: "100%" } : { width: progressWidth }} className="h-full bg-[#22C55E]" /></div>
              <div className="flex gap-1.5" aria-label={t("scoreboard_stage_label")}>
                {[0, 1, 2].map((item) => <span key={item} className={`h-1.5 rounded-full transition-all duration-300 ${stage === item ? "w-8 bg-[#22C55E]" : "w-1.5 bg-white/25"}`} />)}
              </div>
            </div>
          </div>

          <p data-cms-key="spacePilot.scoreboard_scroll_hint" className="mx-auto mt-16 max-w-2xl text-center text-xs tracking-[0.08em] text-white/35 md:mt-20 md:text-sm">
            {t("scoreboard_scroll_hint")}
          </p>
        </div>
      </div>
    </section>
  )
}
