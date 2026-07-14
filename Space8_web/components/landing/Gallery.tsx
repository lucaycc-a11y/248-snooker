"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { CMSText } from "@/components/cms/CMSText";

interface SlideText {
  title: string;
  subtitle: string;
  alt: string;
}

// Image paths are not translatable — text comes from the `gallery` namespace,
// merged with these by index. Exactly 4 cards per spec.
const slideImages = [
  "/gallery/IMG_1511.jpg",
  "/gallery/IMG_1512.jpg",
  "/gallery/IMG_1513.jpg",
  "/gallery/IMG_1514.jpg",
];

const FONT_FAMILY =
  "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', Helvetica, Arial, sans-serif";

const GAP = 20; // px between slides (mobile carousel)
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

  // Desktop: a static 4-up grid, no scroll/carousel behaviour at all.
  // Mobile: a lightweight swipe carousel (the horizontal-scroll complaint in
  // the spec was specifically about desktop; a mobile carousel is still the
  // right pattern for a narrow viewport).
  const [current, setCurrent] = useState(0);
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

  const slidePercent = 0.88;
  const slideWidth = containerWidth * slidePercent;
  const step = slideWidth + GAP;
  const offset = (containerWidth - slideWidth) / 2;
  const trackX = offset - current * step;

  return (
    <section
      id="gallery"
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
          padding: isMobile ? "0 24px 40px" : "0 60px 56px",
          margin: 0,
          fontFamily: FONT_FAMILY,
        }}
      >
        <CMSText k="gallery.title">{t("title")}</CMSText>
      </h2>

      {isMobile ? (
        // Mobile: swipeable carousel with dot indicator, no play/pause control.
        <>
          <div
            ref={containerRef}
            style={{ width: "100%", overflow: "hidden", position: "relative" }}
          >
            <motion.div
              animate={{ x: trackX }}
              transition={{ type: "spring", stiffness: 300, damping: 35 }}
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
                      borderRadius: "20px",
                      overflow: "hidden",
                      background: "#2C2C2E",
                    }}
                  >
                    <Image
                      src={slide.image}
                      alt={slide.alt}
                      fill
                      sizes="88vw"
                      style={{ objectFit: "cover" }}
                      priority={i === 0}
                    />
                    <SlideCaption title={slide.title} subtitle={slide.subtitle} />
                  </motion.div>
                );
              })}
            </motion.div>
          </div>

          {/* Dots only — play/pause control removed per spec */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              gap: "8px",
              padding: "20px 0 0",
            }}
          >
            {slides.map((s, i) => {
              const active = i === current;
              return (
                <motion.button
                  key={s.title}
                  type="button"
                  onClick={() => setCurrent(i)}
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
        </>
      ) : (
        // Desktop: plain static grid — 2x2, no scroll, no autoplay, no controls.
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, 1fr)",
            gap: "28px",
            padding: "0 60px",
          }}
        >
          {slides.map((slide, i) => (
            <div
              key={slide.title}
              style={{
                position: "relative",
                aspectRatio: "16 / 10",
                borderRadius: "28px",
                overflow: "hidden",
                background: "#2C2C2E",
              }}
            >
              <Image
                src={slide.image}
                alt={slide.alt}
                fill
                sizes="45vw"
                style={{ objectFit: "cover" }}
                priority={i === 0}
              />
              <SlideCaption title={slide.title} subtitle={slide.subtitle} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function SlideCaption({ title, subtitle }: { title: string; subtitle: string }) {
  return (
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
        {title}
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
        {subtitle}
      </p>
    </div>
  );
}
