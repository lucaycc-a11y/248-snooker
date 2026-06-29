"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import { Pause, Play, RotateCcw } from "lucide-react";
import { useTranslations } from "next-intl";

interface SlideText {
  title: string;
  subtitle: string;
  alt: string;
}

// Image paths are not translatable — text comes from the `gallery` namespace,
// merged with these by index.
const slideImages = [
  "/gallery/IMG_1511.jpg",
  "/gallery/IMG_1512.jpg",
  "/gallery/IMG_1513.jpg",
  "/gallery/IMG_1514.jpg",
  "/gallery/IMG_1515.jpg",
];

const GAP = 28; // px between slides
const FONT_FAMILY =
  "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', Helvetica, Arial, sans-serif";

const TRACK_SPRING = { type: "spring", stiffness: 300, damping: 35 } as const;
const SLIDE_SPRING = { type: "spring", stiffness: 300, damping: 30 } as const;
const DOT_SPRING = { type: "spring", stiffness: 500, damping: 35 } as const;

export default function Gallery() {
  const t = useTranslations("gallery");
  const slideTexts = t.raw("slides") as SlideText[];
  const slides = slideImages.map((image, i) => ({
    image,
    title: slideTexts[i]?.title ?? "",
    subtitle: slideTexts[i]?.subtitle ?? "",
    alt: slideTexts[i]?.alt ?? "",
  }));

  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);
  const [ended, setEnded] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [containerWidth, setContainerWidth] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => setContainerWidth(el.offsetWidth);
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  useEffect(() => {
    if (paused) return;
    const timer = setInterval(() => {
      setCurrent((p) => {
        if (p === slides.length - 1) {
          setEnded(true);
          setPaused(true);
          return p;
        }
        return p + 1;
      });
    }, 5000);
    return () => clearInterval(timer);
  }, [paused, current]);

  const slidePercent = isMobile ? 0.88 : 0.75;
  const slideWidth = containerWidth * slidePercent;
  const step = slideWidth + GAP;
  // Centre the active slide; previous/next peek from the sides.
  const offset = (containerWidth - slideWidth) / 2;
  const trackX = offset - current * step;

  return (
    <section
      data-nav-theme="dark"
      style={{
        background: "#1C1C1E",
        padding: isMobile ? "88px 0" : "140px 0",
      }}
    >
      {/* Section title */}
      <h2
        style={{
          fontSize: "clamp(32px, 4vw, 48px)",
          fontWeight: 600,
          letterSpacing: "-0.025em",
          color: "white",
          padding: isMobile ? "0 24px 40px" : "0 0 56px 60px",
          margin: 0,
          fontFamily: FONT_FAMILY,
        }}
      >
        {t("title")}
      </h2>

      {/* Carousel */}
      <div
        ref={containerRef}
        style={{ width: "100%", overflow: "hidden", position: "relative" }}
      >
        <motion.div
          animate={{ x: trackX }}
          transition={TRACK_SPRING}
          style={{ display: "flex", gap: `${GAP}px` }}
        >
          {slides.map((slide, i) => {
            const active = i === current;
            return (
              <motion.div
                key={slide.title}
                animate={{ opacity: active ? 1 : 0.5, scale: active ? 1 : 0.96 }}
                transition={SLIDE_SPRING}
                style={{
                  position: "relative",
                  flexShrink: 0,
                  width: `${slidePercent * 100}%`,
                  aspectRatio: "16 / 10",
                  borderRadius: isMobile ? "20px" : "28px",
                  overflow: "hidden",
                  background: "#2C2C2E",
                }}
              >
                <Image
                  src={slide.image}
                  alt={slide.alt}
                  fill
                  sizes={isMobile ? "88vw" : "75vw"}
                  style={{ objectFit: "cover" }}
                  priority={i === 0}
                />

                {/* Text overlay */}
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    padding: "36px 40px",
                    background:
                      "linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0) 100%)",
                  }}
                >
                  <h3
                    style={{
                      fontSize: "clamp(22px, 2.5vw, 32px)",
                      fontWeight: 600,
                      letterSpacing: "-0.02em",
                      color: "white",
                      lineHeight: 1.1,
                      margin: 0,
                      fontFamily: FONT_FAMILY,
                    }}
                  >
                    {slide.title}
                  </h3>
                  <p
                    style={{
                      fontSize: "15px",
                      color: "rgba(255,255,255,0.65)",
                      marginTop: "8px",
                      lineHeight: 1.6,
                      fontFamily: FONT_FAMILY,
                    }}
                  >
                    {slide.subtitle}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      </div>

      {/* Sticky controls bar */}
      <div
        style={{
          position: "sticky",
          bottom: "24px",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: "12px",
          padding: "16px 0",
          zIndex: 40,
          pointerEvents: "auto",
        }}
      >
            {/* Element A — Dots pill (frosted glass) */}
            <div
              style={{
                height: "44px",
                background: "rgba(255,255,255,0.15)",
                backdropFilter: "blur(20px) saturate(180%)",
                WebkitBackdropFilter: "blur(20px) saturate(180%)",
                border: "1px solid rgba(255,255,255,0.2)",
                borderRadius: "999px",
                padding: "0 16px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              {slides.map((s, i) => {
                const active = i === current;
                return (
                  <motion.button
                    key={s.title}
                    type="button"
                    onClick={() => {
                      setCurrent(i);
                      setEnded(false);
                      setPaused(false);
                    }}
                    aria-label={t("goto", { n: i + 1 })}
                    aria-current={active}
                    layout
                    transition={DOT_SPRING}
                    style={{
                      height: "8px",
                      width: active ? "24px" : "8px",
                      borderRadius: "100px",
                      background: active ? "white" : "rgba(255,255,255,0.35)",
                      border: "none",
                      padding: 0,
                      cursor: "pointer",
                    }}
                  />
                );
              })}
            </div>

            {/* Element B — Action button (frosted glass) */}
            <button
              type="button"
              onClick={() => {
                if (ended) {
                  setEnded(false);
                  setCurrent(0);
                  setPaused(false);
                } else {
                  setPaused((p) => !p);
                }
              }}
              aria-label={ended ? t("control_replay") : paused ? t("control_play") : t("control_pause")}
              style={{
                width: "44px",
                height: "44px",
                borderRadius: "50%",
                background: "rgba(255,255,255,0.15)",
                backdropFilter: "blur(20px) saturate(180%)",
                WebkitBackdropFilter: "blur(20px) saturate(180%)",
                border: "1px solid rgba(255,255,255,0.2)",
                marginLeft: "8px",
                color: "white",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              {ended ? (
                <RotateCcw size={16} strokeWidth={2} color="white" />
              ) : paused ? (
                <Play size={16} strokeWidth={2} color="white" />
              ) : (
                <Pause size={16} strokeWidth={2} color="white" />
              )}
            </button>
      </div>
    </section>
  );
}
