"use client";

// Pinned scroll section — the SpaceWheel lives here.
//
// Structure:
//   <runway>            — tall enough to give GSAP scroll room (count+2 × 100svh)
//     <sticky stage>   — 100svh, position:sticky top:0
//       <SpaceWheel>
//       <ring centre>  — hero copy fades out as ring opens
//
// GSAP ScrollTrigger maps scroll progress → turnRef so the component itself
// has no wheel or pointer listeners. One rAF loop inside SpaceWheel reads
// turnRef and writes transforms to the DOM.
import * as React from "react";
import { useRef, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { motion, AnimatePresence } from "framer-motion";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

import { SpaceWheel, type SpaceWheelItem } from "@/components/ui/works-wheel";

gsap.registerPlugin(ScrollTrigger);

// ─── Photo data ──────────────────────────────────────────────────────────────
// Loaded from the manifest at build time. `file` points to the WebP.
import manifest from "@/public/images/space8-about-photos/manifest.json";

const ITEMS: SpaceWheelItem[] = manifest.items.map((item) => ({
  title: item.title,
  description: item.description,
  image: `/${item.file.replace(/\.jpg$/, ".webp")}`,
  alt: item.alt,
}));

// Rotating words from i18n. Index 2 ("純粹玩樂") gets the green accent.
const GREEN_WORD_INDEX = 2;

// ─── Ring centre ─────────────────────────────────────────────────────────────

function RingCentre({ ringOpacity }: { ringOpacity: number }) {
  const t = useTranslations("aboutPage");
  const words = t.raw("hero_rotating_words") as string[];
  const [wordIdx, setWordIdx] = useState(0);

  // Cycle words every 2.8s while ring is visible.
  useEffect(() => {
    if (ringOpacity < 0.05) return;
    const id = setInterval(
      () => setWordIdx((i) => (i + 1) % words.length),
      2800,
    );
    return () => clearInterval(id);
  }, [words.length, ringOpacity]);

  const activeWord = words[wordIdx] ?? "";
  const isGreen = wordIdx === GREEN_WORD_INDEX;

  return (
    <div className="flex flex-col items-center gap-3 text-center pointer-events-none select-none">
      {/* Eyebrow — Good Times */}
      <p
        className="text-xs tracking-[0.25em] uppercase text-white/50"
        style={{ fontFamily: "'Good Times', monospace" }}
      >
        {t("mission_eyebrow")}
      </p>

      {/* Main title — Good Times */}
      <h1
        className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-white"
        style={{ fontFamily: "'Good Times', monospace" }}
      >
        {t("hero_title")}
      </h1>

      {/* Rotating word */}
      <div className="h-10 overflow-hidden flex items-center justify-center">
        <AnimatePresence mode="wait">
          <motion.span
            key={wordIdx}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.35, ease: [0.2, 0.7, 0.3, 1] }}
            className="text-2xl md:text-3xl font-semibold"
            style={{
              fontFamily: "'Noto Sans TC', sans-serif",
              color: isGreen ? "#22c55e" : "rgba(255,255,255,0.85)",
            }}
          >
            {activeWord}
          </motion.span>
        </AnimatePresence>
      </div>

      {/* Subtitle — Noto Sans TC */}
      <p
        className="text-sm md:text-base text-white/60 max-w-xs leading-relaxed mt-1"
        style={{ fontFamily: "'Noto Sans TC', sans-serif", fontWeight: 600 }}
      >
        {t("hero_subtitle")}
      </p>
    </div>
  );
}

// ─── Section ─────────────────────────────────────────────────────────────────

export function SpaceWheelSection() {
  const runwayRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  // GSAP writes to this ref every frame; SpaceWheel reads it in its rAF loop.
  const turnRef = useRef(0);
  // Mirror of the ring's m-value (0→ring, 1→drum) for fading the ring centre.
  const [ringOpacity, setRingOpacity] = useState(1);

  const count = ITEMS.length;

  useEffect(() => {
    const runway = runwayRef.current;
    const stage = stageRef.current;
    if (!runway || !stage) return;

    // Map scroll progress 0→1 to turn 0→(count+1).
    // count+1 lets the last item fully present before the pin releases.
    const tween = gsap.to(turnRef, {
      current: count + 1,
      ease: "none",
      scrollTrigger: {
        trigger: runway,
        start: "top top",
        end: "bottom bottom",
        scrub: 0.6,
        pin: stage,
        pinSpacing: false,
        onUpdate: (self) => {
          // m = clamp(turn, 0, 1)
          const m = Math.min(1, Math.max(0, turnRef.current));
          setRingOpacity(1 - m);
        },
      },
    });

    return () => {
      tween.kill();
      ScrollTrigger.getAll().forEach((st) => {
        if (st.trigger === runway) st.kill();
      });
    };
  }, [count]);

  return (
    // Runway height: (count + 2) × 100svh gives GSAP enough scroll distance.
    <div
      ref={runwayRef}
      style={{ height: `${count + 2}00svh` }}
      className="relative"
    >
      {/* Sticky stage — fills viewport, GSAP pins it */}
      <div
        ref={stageRef}
        className="sticky top-0 w-full h-[100svh] overflow-hidden bg-black"
      >
        <SpaceWheel
          items={ITEMS}
          turnRef={turnRef}
          className="absolute inset-0"
          ringLabel={
            <div
              style={{ opacity: ringOpacity, transition: "opacity 0.1s linear" }}
            >
              <RingCentre ringOpacity={ringOpacity} />
            </div>
          }
        />
      </div>
    </div>
  );
}

export default SpaceWheelSection;
