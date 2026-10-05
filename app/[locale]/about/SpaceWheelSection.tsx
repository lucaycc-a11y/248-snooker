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
import Image from "next/image";

import { SpaceWheel, type SpaceWheelItem } from "@/components/ui/works-wheel";

gsap.registerPlugin(ScrollTrigger);

// ─── Photo data ──────────────────────────────────────────────────────────────
// Loaded from the manifest at build time. `file` points to the WebP.
import manifest from "@/public/images/space8-about-photos/manifest.json";

// Ring intro uses all 8 photos in specific slots (0° = top, clockwise)
// Slot assignments: clear orientation (room, stools, cue rack) at 0°, 45°, 315°
// Direction-free details (felt, pocket, balls) at 135°, 180°, 225°
// Keep existing 3 photos (0, 3, 5) positioned for short handover
const RING_PHOTO_INDICES = [
  0, // 0° - about-01-table-eight-ball (existing, full table, upright)
  4, // 45° - about-05-cue-rack (clear vertical orientation)
  3, // 90° - about-04-cove-lighting (existing, pocket detail, semi-directional)
  1, // 135° - about-02-felt-xingpai (direction-free, logo readable any angle)
  7, // 180° - about-08-ball-rack (direction-free, triangle works inverted)
  2, // 225° - about-03-corner-pocket (direction-free)
  5, // 270° - about-06-lounge (existing, lounge furniture, semi-directional)
  6, // 315° - about-07-stools (clear vertical orientation)
];

// Drum carousel uses only 3 photos (the existing ones)
const DRUM_PHOTO_INDICES = [0, 3, 5]; // about-01, about-04, about-06

const RING_ITEMS: SpaceWheelItem[] = RING_PHOTO_INDICES.map((idx) => {
  const item = manifest.items[idx];
  return {
    title: item.title,
    description: item.description,
    image: `/images/space8-about-photos/${item.file.replace(/\.jpg$/, ".webp")}`,
    alt: item.alt,
  };
});

const DRUM_ITEMS: SpaceWheelItem[] = DRUM_PHOTO_INDICES.map((idx) => {
  const item = manifest.items[idx];
  return {
    title: item.title,
    description: item.description,
    image: `/images/space8-about-photos/${item.file.replace(/\.jpg$/, ".webp")}`,
    alt: item.alt,
  };
});

// Rotating words from i18n. Index 2 ("純粹玩樂") gets the green accent.
const GREEN_WORD_INDEX = 2;
const NAVBAR_HEIGHT = 64; // px

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
      {/* Line 1: 「關於」 + Space8 logo (baseline-aligned, logo at ~65% of text height) */}
      <div className="flex items-baseline gap-1 justify-center">
        <span
          className="font-semibold"
          style={{
            fontFamily: "'Noto Sans TC', sans-serif",
            fontSize: "clamp(1.5rem, 7.5vw, 2.25rem)",
            color: "#000000",
            lineHeight: 1,
          }}
        >
          關於
        </span>
        <div style={{ display: "inline-flex", alignItems: "baseline" }}>
          <Image
            src="/logos/logo-black-horizontal.svg"
            alt="SPACE8"
            width={120}
            height={40}
            style={{
              height: "0.65em",
              width: "auto",
            }}
            priority
          />
        </div>
      </div>

      {/* Line 2: Rotating word */}
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
              color: isGreen ? "#22c55e" : "#000000",
              fontSize: "clamp(1.25rem, 5.5vw, 1.875rem)",
            }}
          >
            {activeWord}
          </motion.span>
        </AnimatePresence>
      </div>

      {/* Line 3: Short description */}
      <p
        className="leading-relaxed mt-1 font-semibold"
        style={{
          fontFamily: "'Noto Sans TC', sans-serif",
          fontSize: "clamp(14px, 3.5vw, 15px)",
          color: "#000000",
        }}
      >
        {t("wheel_section_description")}
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

  const count = DRUM_ITEMS.length;

  useEffect(() => {
    const runway = runwayRef.current;
    const stage = stageRef.current;
    if (!runway || !stage) return;

    // Map scroll progress 0→1 to turn 0→(count+1).
    // With 3 items, turn runs 0 to 4 (ring at 0, photos 1-3 at turns 1-3, release at 4).
    // This stops the wheel at photo 3 and transitions to the next section.
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
      style={{ height: `${count + 2}00svh`, background: "#ffffff" }}
      className="relative"
    >
      {/* Sticky stage — fills viewport, GSAP pins it */}
      <div
        ref={stageRef}
        className="sticky top-0 w-full h-[100svh] overflow-hidden"
        style={{ backgroundColor: "#ffffff" }}
      >
        <SpaceWheel
          items={DRUM_ITEMS}
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

        {/* Top fade overlay (8-10% of stage height) */}
        <div
          className="pointer-events-none absolute top-0 left-0 right-0 z-10"
          style={{
            height: "10%",
            background: "linear-gradient(to bottom, #ffffff, rgba(255,255,255,0))",
          }}
        />

        {/* Bottom fade overlay (18-25% of stage height) */}
        <div
          className="pointer-events-none absolute bottom-0 left-0 right-0 z-10"
          style={{
            height: "22%",
            background: "linear-gradient(to bottom, rgba(255,255,255,0), #ffffff)",
          }}
        />
      </div>
    </div>
  );
}

export default SpaceWheelSection;
