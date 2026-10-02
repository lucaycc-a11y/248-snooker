"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { useRef, useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface ScrollChoreographyProps {
  images: {
    topLeft: { src: string; alt: string; objectPosition: string };
    topRight: { src: string; alt: string; objectPosition: string };
    bottomLeft: { src: string; alt: string; objectPosition: string };
    bottomRight: { src: string; alt: string; objectPosition: string };
  };
  overlay?: React.ReactNode;
  className?: string;
}

export function ScrollChoreography({
  images,
  overlay,
  className,
}: ScrollChoreographyProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [measurements, setMeasurements] = useState({
    photoSize: { width: 0, height: 0 },
    stageSize: { width: 0, height: 0 },
  });

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  useEffect(() => {
    const updateMeasurements = () => {
      if (!stageRef.current) return;

      const stageRect = stageRef.current.getBoundingClientRect();
      const vw = window.innerWidth;

      const isDesktop = vw >= 1024;
      const photoWidth = isDesktop
        ? Math.min(stageRect.width * 0.28, vw * 0.28)
        : Math.min(stageRect.width * 0.52, vw * 0.52);
      const photoHeight = isDesktop ? photoWidth * (2 / 3) : photoWidth * (26 / 52);

      setMeasurements({
        photoSize: { width: photoWidth, height: photoHeight },
        stageSize: { width: stageRect.width, height: stageRect.height },
      });
    };

    updateMeasurements();
    window.addEventListener("resize", updateMeasurements);
    return () => window.removeEventListener("resize", updateMeasurements);
  }, []);

  const { photoSize, stageSize } = measurements;
  const pw = photoSize.width || 36;
  const ph = photoSize.height || 24;

  const offsetX = pw / 2 + 12;
  const offsetY = ph / 2 + 12;

  const tlX = useTransform(scrollYProgress, [0, 0.28, 0.32, 0.58], [-offsetX, offsetX, offsetX, 0]);
  const tlY = useTransform(scrollYProgress, [0, 0.28, 0.32, 0.58], [-offsetY, -offsetY, -offsetY, 0]);
  const tlOpacity = useTransform(scrollYProgress, [0.62, 0.72], [1, 0]);

  const trX = useTransform(scrollYProgress, [0, 0.32, 0.58], [offsetX, offsetX, 0]);
  const trY = useTransform(scrollYProgress, [0, 0.32, 0.58], [-offsetY, -offsetY, 0]);
  const trOpacity = useTransform(scrollYProgress, [0.62, 0.72], [1, 0]);

  const blX = useTransform(scrollYProgress, [0, 0.32, 0.58], [-offsetX, -offsetX, 0]);
  const blY = useTransform(scrollYProgress, [0, 0.32, 0.58], [offsetY, offsetY, 0]);
  const blOpacity = useTransform(scrollYProgress, [0.62, 0.72], [1, 0]);

  const brX = useTransform(scrollYProgress, [0, 0.28, 0.32, 0.58], [offsetX, -offsetX, -offsetX, 0]);
  const brY = useTransform(scrollYProgress, [0, 0.28, 0.32, 0.58], [offsetY, offsetY, offsetY, 0]);
  const brOpacity = useTransform(scrollYProgress, [0.62, 0.72], [1, 0]);

  const heroClipPath = useTransform(scrollYProgress, [0.62, 0.82, 1.0], [
    `inset(0 0 0 0 round 24px)`,
    `inset(0 0 0 0 round 0px)`,
    `inset(0 0 0 0 round 0px)`,
  ]);

  const hintOpacity = useTransform(scrollYProgress, [0, 0.15], [1, 0]);
  const overlayOpacity = useTransform(scrollYProgress, [0.82, 0.92], [0, 1]);
  const overlayY = useTransform(scrollYProgress, [0.82, 0.92], [24, 0]);

  const prefersReducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (prefersReducedMotion) {
    return (
      <div className={cn("relative h-screen w-full bg-black", className)}>
        <div className="absolute inset-0">
          <img
            src={images.topRight.src}
            alt={images.topRight.alt}
            className="h-full w-full object-cover"
            style={{ objectPosition: images.topRight.objectPosition }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/70" />
        </div>
        <div className="absolute inset-x-0 bottom-0 flex items-end justify-center p-8 text-center text-white">
          {overlay}
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={cn("relative h-[420svh] w-full", className)}>
      <div
        ref={stageRef}
        className="sticky top-0 h-screen w-full overflow-hidden bg-black"
      >
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.div
            style={{
              x: tlX,
              y: tlY,
              opacity: tlOpacity,
              width: pw,
              height: ph,
              willChange: "transform, opacity",
            }}
            className="absolute rounded-2xl border border-white/10 overflow-hidden"
          >
            <img
              src={images.topLeft.src}
              alt={images.topLeft.alt}
              className="h-full w-full object-cover"
              style={{ objectPosition: images.topLeft.objectPosition }}
              loading="eager"
              decoding="async"
            />
          </motion.div>

          <motion.div
            style={{
              x: trX,
              y: trY,
              opacity: trOpacity,
              width: pw,
              height: ph,
              clipPath: heroClipPath,
              willChange: "clip-path, transform, opacity",
            }}
            className="absolute overflow-hidden"
          >
            <img
              src={images.topRight.src}
              alt={images.topRight.alt}
              className="h-full w-full object-cover"
              style={{ objectPosition: images.topRight.objectPosition }}
              loading="eager"
              decoding="async"
            />
          </motion.div>

          <motion.div
            style={{
              x: blX,
              y: blY,
              opacity: blOpacity,
              width: pw,
              height: ph,
              willChange: "transform, opacity",
            }}
            className="absolute rounded-2xl border border-white/10 overflow-hidden"
          >
            <img
              src={images.bottomLeft.src}
              alt={images.bottomLeft.alt}
              className="h-full w-full object-cover"
              style={{ objectPosition: images.bottomLeft.objectPosition }}
              loading="eager"
              decoding="async"
            />
          </motion.div>

          <motion.div
            style={{
              x: brX,
              y: brY,
              opacity: brOpacity,
              width: pw,
              height: ph,
              willChange: "transform, opacity",
            }}
            className="absolute rounded-2xl border border-white/10 overflow-hidden"
          >
            <img
              src={images.bottomRight.src}
              alt={images.bottomRight.alt}
              className="h-full w-full object-cover"
              style={{ objectPosition: images.bottomRight.objectPosition }}
              loading="eager"
              decoding="async"
            />
          </motion.div>
        </div>

        <motion.div
          style={{ opacity: hintOpacity }}
          className="absolute bottom-12 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
        >
          <div className="text-xs text-white/40 uppercase tracking-wide">
            Scroll
          </div>
          <motion.svg
            className="w-4 h-4 text-white/40"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            animate={{ y: [0, 6, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </motion.svg>
        </motion.div>

        <motion.div
          style={{
            opacity: overlayOpacity,
            y: overlayY,
            willChange: "opacity, transform",
          }}
          className="absolute inset-0 flex items-end justify-start"
        >
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/70" />
          <div className="relative p-8 sm:p-12 text-white">{overlay}</div>
        </motion.div>
      </div>
    </div>
  );
}

export default ScrollChoreography;
