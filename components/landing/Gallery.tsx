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
// merged with these by index.
// TODO: 需要 Luca 提供正確素材 — 中式桌球枱場地照片（暫用現有圖佔位）
const slideImages = [
  "/gallery/IMG_1511.jpg",
  "/gallery/IMG_1513.jpg",
  "/gallery/IMG_1514.jpg",
  "/gallery/IMG_1515.jpg",
];

const FONT_FAMILY =
  "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', Helvetica, Arial, sans-serif";

const DOT_SPRING = { type: "spring", stiffness: 500, damping: 35 } as const;
const EASE = [0.16, 1, 0.3, 1] as const;
const VIEWPORT = { once: true, amount: 0.2 } as const;

// Desktop: 2×2 grid — no oversized horizontal-scroll carousel, no play
// controls. Mobile: horizontal snap-scroll strip with dot indicators.
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
  const [isMobile, setIsMobile] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Track which card is centred in the mobile snap strip (for the dots).
  const onScroll = () => {
    const el = trackRef.current;
    if (!el) return;
    const cardWidth = el.scrollWidth / slides.length;
    setCurrent(Math.round(el.scrollLeft / cardWidth));
  };

  const scrollToCard = (i: number) => {
    const el = trackRef.current;
    if (!el) return;
    const cardWidth = el.scrollWidth / slides.length;
    el.scrollTo({ left: i * cardWidth, behavior: "smooth" });
  };

  const card = (slide: (typeof slides)[number], i: number) => (
    <motion.div
      key={slide.title}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={VIEWPORT}
      transition={{ duration: 0.55, ease: EASE, delay: isMobile ? 0 : (i % 2) * 0.08 }}
      style={{
        position: "relative",
        flexShrink: 0,
        width: isMobile ? "84%" : "100%",
        aspectRatio: "16 / 10",
        borderRadius: isMobile ? "20px" : "24px",
        overflow: "hidden",
        background: "#2C2C2E",
        scrollSnapAlign: isMobile ? "center" : undefined,
      }}
    >
      <Image
        src={slide.image}
        alt={slide.alt}
        fill
        sizes="(max-width: 768px) 84vw, 44vw"
        style={{ objectFit: "cover" }}
      />
      {/* Top gradient + text overlay */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          padding: isMobile ? "24px 24px 48px" : "32px 36px 56px",
          background:
            "linear-gradient(to bottom, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0) 100%)",
        }}
      >
        <h3
          style={{
            fontSize: "clamp(20px, 2.2vw, 28px)",
            fontWeight: 600,
            letterSpacing: "-0.02em",
            color: "white",
            lineHeight: 1.15,
            margin: 0,
            fontFamily: FONT_FAMILY,
          }}
        >
          {slide.title}
        </h3>
        <p
          style={{
            fontSize: "clamp(15px, 1.3vw, 18px)",
            color: "rgba(255,255,255,0.78)",
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
          padding: isMobile ? "0 24px 40px" : "0 24px 56px",
          maxWidth: "1200px",
          margin: "0 auto",
          fontFamily: FONT_FAMILY,
          boxSizing: "content-box",
        }}
      >
        <CMSText k="gallery.title">{t("title")}</CMSText>
      </h2>

      {isMobile ? (
        <>
          {/* Mobile — horizontal snap strip */}
          <div
            ref={trackRef}
            onScroll={onScroll}
            className="no-scrollbar"
            style={{
              display: "flex",
              gap: "16px",
              overflowX: "auto",
              scrollSnapType: "x mandatory",
              padding: "0 24px",
              WebkitOverflowScrolling: "touch",
            }}
          >
            {slides.map((slide, i) => card(slide, i))}
          </div>

          {/* Dot indicators */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              gap: "8px",
              paddingTop: "28px",
            }}
          >
            {slides.map((s, i) => {
              const active = i === current;
              return (
                <motion.button
                  key={s.title}
                  type="button"
                  onClick={() => scrollToCard(i)}
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
        /* Desktop — contained 2×2 grid */
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "24px",
            maxWidth: "1200px",
            margin: "0 auto",
            padding: "0 24px",
          }}
        >
          {slides.map((slide, i) => card(slide, i))}
        </div>
      )}
    </section>
  );
}
