"use client";

// Pinned scroll section — the SpaceWheel lives here.
//
// Structure:
//   <runway>            — tall enough to give GSAP scroll room (4 × 100svh for 3 points + release)
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
// All 8 photos from the manifest at build time. `file` points to the WebP.
// Items with a `point` index are drum cards; others are ring-only.
import manifest from "@/public/images/space8-about-photos/manifest.json";

const ITEMS: SpaceWheelItem[] = manifest.items.map((item) => {
  return {
    title: item.title,
    description: item.description,
    image: `/images/space8-about-photos/${item.file.replace(/\.jpg$/, ".webp")}`,
    alt: item.alt,
    // All 8 photos are ring-only; carousel by rotating the ring
  };
});

// Rotating words from i18n. Index 2 ("純粹玩樂") gets the green accent.
const GREEN_WORD_INDEX = 2;

// ─── Ring centre ─────────────────────────────────────────────────────────────

interface RingCentreProps {
  ringOpacity: number;
  ringOuter: number;
  cardHeight: number;
  fallbacks: {
    hideLogo: boolean;
    minimizeHeading: boolean;
    shrinkBody: boolean;
    enlargeRing: boolean;
  };
}

function RingCentre({ ringOpacity, ringOuter, cardHeight, fallbacks }: RingCentreProps) {
  const t = useTranslations("aboutPage");
  const words = t.raw("hero_rotating_words") as string[];
  const [wordIdx, setWordIdx] = useState(0);
  const [maxWordWidth, setMaxWordWidth] = useState(0);
  const wordRef = useRef<HTMLSpanElement>(null);
  const blockRef = useRef<HTMLDivElement>(null);

  // Measure the widest word to reserve space
  useEffect(() => {
    if (!wordRef.current) return;
    let max = 0;
    words.forEach((word) => {
      const span = document.createElement("span");
      span.textContent = word;
      span.style.fontFamily = "'Noto Sans TC', sans-serif";
      span.style.fontSize = "clamp(1.25rem, 5.5vw, 1.875rem)";
      span.style.fontWeight = "700";
      span.style.visibility = "hidden";
      span.style.position = "absolute";
      document.body.appendChild(span);
      max = Math.max(max, span.offsetWidth);
      document.body.removeChild(span);
    });
    setMaxWordWidth(max);
  }, [words]);

  // Calculate safe radius and measure centre block bounding rectangle
  const safeRadius = (ringOuter / 2 - cardHeight) - 20;

  // Measure centre block dimensions for fit check
  // This happens after first render, but the component applies fallbacks
  // before render, so visual fit is ensured by the fallback logic.
  useEffect(() => {
    if (!blockRef.current) return;
    const rect = blockRef.current.getBoundingClientRect();
    const halfDiagonal = Math.sqrt((rect.width / 2) ** 2 + (rect.height / 2) ** 2);
    // For debugging: log if centre block exceeds safe radius
    if (halfDiagonal > safeRadius) {
      console.warn(
        `Centre block half-diagonal ${halfDiagonal.toFixed(1)}px exceeds safe radius ${safeRadius.toFixed(1)}px`,
        { blockWidth: rect.width, blockHeight: rect.height, ringOuter, cardHeight, fallbacks }
      );
    }
  }, [safeRadius, fallbacks, ringOuter, cardHeight]);

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
    <div ref={blockRef} className="flex flex-col items-center gap-3 text-center pointer-events-none select-none">
      {/* Line 1: SPACE8 logo (hidden if fallback.hideLogo) */}
      {!fallbacks.hideLogo && (
        <div style={{ display: "inline-flex", alignItems: "baseline" }}>
          <Image
            src="/logos/logo-black-horizontal.svg"
            alt="SPACE8"
            width={120}
            height={40}
            style={{
              height: "clamp(1.5rem, 7.5vw, 2.25rem)",
              width: "auto",
            }}
            priority
          />
        </div>
      )}

      {/* Line 2: "一個" + rotating word (with tight 0.25em gaps) + "的空間" */}
      <div
        className="flex items-center justify-center gap-0 flex-wrap"
        style={{
          fontSize: fallbacks.minimizeHeading
            ? "clamp(1rem, 4vw, 1.25rem)"
            : "clamp(1.25rem, 5.5vw, 1.875rem)",
        }}
      >
        <span
          className="font-semibold"
          style={{
            fontFamily: "'Noto Sans TC', sans-serif",
            color: "#000000",
            lineHeight: 1.2,
            marginRight: "0.25em",
          }}
        >
          一個
        </span>
        <div
          className="overflow-hidden flex items-center justify-center"
          style={{
            minWidth: Math.max(maxWordWidth, 100),
            height: "1.4em",
          }}
        >
          <AnimatePresence mode="wait">
            <motion.span
              key={wordIdx}
              ref={wordRef}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.35, ease: [0.2, 0.7, 0.3, 1] }}
              className="font-semibold"
              style={{
                fontFamily: "'Noto Sans TC', sans-serif",
                color: isGreen ? "#22c55e" : "#000000",
                lineHeight: 1.2,
              }}
            >
              {activeWord}
            </motion.span>
          </AnimatePresence>
        </div>
        <span
          className="font-semibold"
          style={{
            fontFamily: "'Noto Sans TC', sans-serif",
            color: "#000000",
            lineHeight: 1.2,
            marginLeft: "0.25em",
          }}
        >
          的空間
        </span>
      </div>

      {/* Line 3: Body text (shrunk to 13px if fallback.shrinkBody) */}
      <p
        className="leading-relaxed mt-2"
        style={{
          fontFamily: "'Noto Sans TC', sans-serif",
          fontSize: fallbacks.shrinkBody ? "13px" : "clamp(14px, 3.5vw, 14px)",
          color: "#000000",
          maxWidth: "90%",
          textWrap: "balance",
        }}
      >
        <span className="font-semibold">好的中式桌球室不應有多餘干擾。</span>
        <span style={{ color: "rgba(0,0,0,0.72)" }}>
          {" "}SPACE8 自助無煙中式桌球獨立球室。隨時隨地，網上預訂專屬球枱。由預訂、付款到入場，全程自助，毋需等候。
        </span>
      </p>

      {/* Buttons: "立即預訂" (primary) and "查看場地" (secondary) */}
      <div className="flex gap-3 justify-center mt-4 pointer-events-auto flex-wrap">
        <button
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            background: "#22c55e",
            color: "#000000",
            fontWeight: 700,
            fontSize: "14px",
            padding: "12px 24px",
            borderRadius: "8px",
            border: "none",
            cursor: "pointer",
            height: "44px",
            minHeight: "44px",
            fontFamily: "'Noto Sans TC', sans-serif",
          }}
          onClick={() => {
            const bookPath = window.location.pathname.replace("/about", "/book");
            window.location.href = bookPath;
          }}
        >
          {t("hero_cta_primary")}
        </button>
        <button
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            background: "transparent",
            color: "#000000",
            fontWeight: 700,
            fontSize: "14px",
            padding: "12px 24px",
            borderRadius: "8px",
            border: "2px solid #000000",
            cursor: "pointer",
            height: "44px",
            minHeight: "44px",
            fontFamily: "'Noto Sans TC', sans-serif",
          }}
          onClick={() => {
            const venuePath = window.location.pathname.replace("/about", "/venue");
            window.location.href = venuePath;
          }}
        >
          {t("hero_cta_secondary")}
        </button>
      </div>
    </div>
  );
}

// ─── Section ─────────────────────────────────────────────────────────────────

type FallbackState = {
  hideLogo: boolean;
  minimizeHeading: boolean;
  shrinkBody: boolean;
  enlargeRing: boolean;
};

export function SpaceWheelSection() {
  const runwayRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const blockRef = useRef<HTMLDivElement>(null);
  // GSAP writes to this ref every frame; SpaceWheel reads it in its rAF loop.
  const turnRef = useRef(0);
  // Mirror of the ring's m-value (0→ring, 1→drum) for fading the ring centre.
  const [ringOpacity, setRingOpacity] = useState(1);
  // Fallback state for centre block fit
  const [fallbacks, setFallbacks] = useState<FallbackState>({
    hideLogo: false,
    minimizeHeading: false,
    shrinkBody: false,
    enlargeRing: false,
  });
  // Current ring parameters for fit calculation
  const [ringParams, setRingParams] = useState({
    ringOuterRatio: 0.73,
    ringCardWidthRatio: 0.24,
    ringOuter: 0,
    cardHeight: 0,
  });

  // All 8 photos in ring carousel (no point items)
  const totalCount = ITEMS.length;

  useEffect(() => {
    const runway = runwayRef.current;
    const stage = stageRef.current;
    if (!runway || !stage) return;

    // Map scroll progress to turn 0→totalCount (ring carousel through all 8 items)
    // Runway height: (totalCount + 1) × 100svh gives GSAP enough scroll distance.
    const tween = gsap.to(turnRef, {
      current: totalCount,
      ease: "none",
      scrollTrigger: {
        trigger: runway,
        start: "top top",
        end: "bottom bottom",
        scrub: 0.6,
        pin: stage,
        pinSpacing: false,
        onUpdate: (self) => {
          // Ring opacity fades as carousel starts scrolling
          const m = Math.min(1, Math.max(0, turnRef.current / 2));
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
  }, [totalCount]);

  // Centre block fit procedure (runs on resize and fallback changes)
  useEffect(() => {
    const checkAndApplyFallbacks = () => {
      if (!stageRef.current || !blockRef.current) return;

      const stageRect = stageRef.current.getBoundingClientRect();
      const stageHeight = stageRect.height;
      const stageWidth = stageRect.width;

      // Calculate ring metrics based on current fallback state
      const ringOuterRatio = fallbacks.enlargeRing ? 0.80 : 0.73;
      const ringCardWidthRatio = fallbacks.enlargeRing ? 0.20 : 0.24;
      const ringOuter = stageHeight * ringOuterRatio;
      const cardHeight = ringOuter * ringCardWidthRatio;
      const safeRadius = (ringOuter / 2 - cardHeight) - 20;

      // Measure centre block bounding box
      const blockRect = blockRef.current.getBoundingClientRect();
      const blockHalfDiagonal = Math.sqrt((blockRect.width / 2) ** 2 + (blockRect.height / 2) ** 2);

      // Fit procedure: apply fallbacks in order if block doesn't fit
      let newFallbacks: FallbackState = {
        hideLogo: false,
        minimizeHeading: false,
        shrinkBody: false,
        enlargeRing: false,
      };

      if (blockHalfDiagonal > safeRadius) {
        newFallbacks.hideLogo = true;
        if (blockHalfDiagonal > safeRadius) {
          newFallbacks.minimizeHeading = true;
          if (blockHalfDiagonal > safeRadius) {
            newFallbacks.shrinkBody = true;
            if (blockHalfDiagonal > safeRadius) {
              newFallbacks.enlargeRing = true;
              if (blockHalfDiagonal > safeRadius) {
                console.error(
                  `Centre block does not fit even with all fallbacks. Viewport: ${stageWidth}×${stageHeight}, Block half-diagonal: ${blockHalfDiagonal.toFixed(1)}px, Safe radius: ${safeRadius.toFixed(1)}px`,
                  { ringOuter: ringOuter.toFixed(1), cardHeight: cardHeight.toFixed(1), blockWidth: blockRect.width.toFixed(1), blockHeight: blockRect.height.toFixed(1) }
                );
              }
            }
          }
        }
      }

      setFallbacks(newFallbacks);
      setRingParams({ ringOuterRatio, ringCardWidthRatio, ringOuter, cardHeight });
    };

    checkAndApplyFallbacks();
    const resizeObserver = new ResizeObserver(checkAndApplyFallbacks);
    if (stageRef.current) resizeObserver.observe(stageRef.current);
    return () => resizeObserver.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    // Runway height: (totalCount + 1) × 100svh gives GSAP enough scroll distance.
    <div
      ref={runwayRef}
      style={{ height: `${totalCount + 1}00svh`, background: "#ffffff" }}
      className="relative"
    >
      {/* Sticky stage — fills viewport minus nav, GSAP pins it */}
      <div
        ref={stageRef}
        className="sticky top-0 w-full overflow-hidden"
        style={{
          height: "calc(100svh - 64px)",
          backgroundColor: "#ffffff",
        }}
      >
        <SpaceWheel
          items={ITEMS}
          turnRef={turnRef}
          className="absolute inset-0"
          ringTilt={1}
          ringOuterRatio={fallbacks.enlargeRing ? 0.80 : 0.73}
          ringCardWidthRatio={fallbacks.enlargeRing ? 0.20 : 0.24}
          navHeight={64}
          label={
            <div
              style={{ opacity: ringOpacity, transition: "opacity 0.1s linear" }}
            >
              <RingCentre
                ringOpacity={ringOpacity}
                ringOuter={ringParams.ringOuter}
                cardHeight={ringParams.cardHeight}
                fallbacks={fallbacks}
              />
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
