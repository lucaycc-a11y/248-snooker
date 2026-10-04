"use client";

import {
  motion,
  useScroll,
  useTransform,
  useReducedMotion,
  useMotionValue,
  useSpring,
  useMotionValueEvent,
} from "framer-motion";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";

const IMAGES = [
  { src: "/images/venue-interior-中八桌球-香港新蒲崗.webp", alt: "場地內部環境" },
  { src: "/images/pool-table-closeup-中八桌球-香港新蒲崗.webp", alt: "星牌桌球臺特寫" },
  { src: "/images/pool-table-closeup-2-中八桌球-香港新蒲崗.webp", alt: "專業球臺細節" },
  { src: "/images/cue-stand-中八桌球-香港新蒲崗.webp", alt: "球桿架設施" },
];

// Dynamically generate a 3D Elliptical Orbit
const generateOrbitCards = () => {
  const radiusX = 42; // Wide X spread (vw)
  const radiusY = 15; // Flattened Y spread for 3D effect (vh)
  const total = IMAGES.length;

  return IMAGES.map((item, i) => {
    const angle = (i * (Math.PI * 2)) / total;
    const x = Math.cos(angle - Math.PI / 2) * radiusX;
    const y = Math.sin(angle - Math.PI / 2) * radiusY;

    // Cards at the bottom of the ellipse are "closer" -> scale up
    const depthScale = Math.sin(angle - Math.PI / 2); // -1 to 1
    const targetScale = 0.8 + depthScale * 0.25;

    // Z-index matches depth so front cards overlap back cards
    const calculatedZIndex = Math.round((depthScale + 1) * 100);

    // Subtle outward-leaning rotation
    const rotate = Math.cos(angle - Math.PI / 2) * 15;

    return {
      item,
      linearOffset: { x: (i - total / 2) * 4, y: (i - total / 2) * 3 },
      linearRotate: (i - total / 2) * 3,
      target: { x, y: y + 8, rotate, scale: targetScale, w: 15, h: 22 },
      targetSm: {
        x: x * 0.7,
        y: y * 1.5 + 10,
        rotate,
        scale: targetScale,
        w: 32,
        h: 24,
      },
      z: calculatedZIndex,
    };
  });
};

const CARDS = generateOrbitCards();

const SPRING_CONFIG = { stiffness: 40, damping: 25, mass: 1 };
const PROGRESS_SPRING = { stiffness: 60, damping: 30, restDelta: 0.001 };

function usePointerParallax(active: boolean, enabled: boolean) {
  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const x = useSpring(rawX, SPRING_CONFIG);
  const y = useSpring(rawY, SPRING_CONFIG);

  useEffect(() => {
    if (!enabled || !active) return;
    const onMove = (e: PointerEvent) => {
      rawX.set((e.clientX / window.innerWidth - 0.5) * 2);
      rawY.set((e.clientY / window.innerHeight - 0.5) * 2);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [active, enabled, rawX, rawY]);

  return { x, y };
}

interface CardProps {
  card: (typeof CARDS)[number];
  progress: any;
  pointer: { x: any; y: any };
  isSpreadActive: boolean;
  isMobile: boolean;
}

function Card({ card, progress, pointer, isSpreadActive, isMobile }: CardProps) {
  const { item, linearOffset, linearRotate, z } = card;
  const activeTarget = isMobile ? card.targetSm : card.target;
  const depthFactor = 0.2 + z / 200;

  const translate = useTransform(
    [progress, pointer.x, pointer.y],
    ([p, px, py]: number[]) => {
      const easeP = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
      const tx = linearOffset.x + (activeTarget.x - linearOffset.x) * easeP;
      const ty = linearOffset.y + (activeTarget.y - linearOffset.y) * easeP;
      const dx = tx - px * 5 * depthFactor * p;
      const dy = ty - py * 5 * depthFactor * p;
      return `calc(-50% + ${dx}vw) calc(-50% + ${dy}vh)`;
    }
  );

  const rotate = useTransform(progress, [0, 1], [linearRotate, activeTarget.rotate]);
  const scale = useTransform(progress, [0, 1], [0.6, activeTarget.scale]);

  return (
    <motion.div
      className="absolute left-1/2 top-1/2 will-change-transform"
      style={{
        width: `${activeTarget.w}vw`,
        height: `${activeTarget.h}vh`,
        zIndex: z,
        translate,
        rotate,
        scale,
      }}
      whileHover={
        isSpreadActive
          ? { scale: activeTarget.scale * 1.15, zIndex: 999, transition: SPRING_CONFIG }
          : undefined
      }
    >
      <div className="relative h-full w-full overflow-hidden rounded-2xl border border-white/15 transition-all duration-500">
        <Image
          src={item.src}
          alt={item.alt}
          fill
          sizes="(max-width: 768px) 32vw, 15vw"
          className="object-cover"
          draggable={false}
          priority={z > 150}
          loading={z > 150 ? "eager" : "lazy"}
        />
      </div>
    </motion.div>
  );
}

export default function CinematicOrbitHero() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const [isMobile, setIsMobile] = useState(false);
  const t = useTranslations("venuePage");

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const { scrollYProgress } = useScroll({ target: wrapRef, offset: ["start start", "end end"] });
  const smoothProgress = useSpring(scrollYProgress, PROGRESS_SPRING);
  const progress = useTransform(smoothProgress, [0.1, 0.9], [0, 1]);

  const [spread, setSpread] = useState(false);
  useMotionValueEvent(progress, "change", (p) => setSpread(p > 0.95));

  const pointer = usePointerParallax(spread, !reduce);
  const textScale = useTransform(progress, [0, 1], [0.85, 1]);
  const textOpacity = useTransform(progress, [0.2, 0.8], [0, 1]);

  return (
    <section ref={wrapRef} className="relative w-full h-[350vh] bg-black text-white">
      <div className="sticky top-0 h-[100svh] w-full overflow-hidden flex items-center justify-center">
        {/* Background glow — z-index 0 (default) */}
        <motion.div
          className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-10 blur-[100px] md:blur-[120px] mix-blend-screen"
          style={{ scale: textScale }}
        >
          <div className="w-[60vw] md:w-[40vw] h-[60vw] md:h-[40vw] rounded-full bg-white/80" />
        </motion.div>

        {/* Photo orbit layer — z-[1], pointer-events-none */}
        <div className="absolute inset-0 z-[1] pointer-events-none">
          {CARDS.map((card, i) => (
            <Card key={i} card={card} progress={progress} pointer={pointer} isSpreadActive={spread} isMobile={isMobile} />
          ))}
        </div>

        {/* Subtle scrim for text readability — z-[2] */}
        <motion.div
          className="absolute inset-0 z-[2] pointer-events-none"
          style={{
            opacity: textOpacity,
            background: "radial-gradient(ellipse 50% 40% at 50% 45%, rgba(0,0,0,0.65) 0%, transparent 70%)",
          }}
        />

        {/* Text layer — z-[3], always above photos */}
        <motion.div
          className="relative z-[3] pointer-events-none flex flex-col items-center text-center px-6 mt-[-10vh] max-w-[90vw] md:max-w-[60vw]"
          style={{ opacity: textOpacity, scale: textScale }}
        >
          <h1
            className="text-3xl md:text-[3.5vw] font-medium tracking-normal"
            style={{
              background: "linear-gradient(to bottom, #ffffff 0%, #8a8a8a 100%)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
              lineHeight: 1.35,
            }}
          >
            {t('hero.heading')}
          </h1>
          <p
            className="mt-3 max-w-[50ch] text-sm md:text-[1vw] font-light leading-relaxed"
            style={{
              fontFamily: "'Good Times', 'SF Pro Display', -apple-system, sans-serif",
            }}
          >
            <strong className="font-semibold">{t('hero.body_bold')}</strong>
            {t('hero.body_rest')}
          </p>
        </motion.div>
      </div>
    </section>
  );
}
