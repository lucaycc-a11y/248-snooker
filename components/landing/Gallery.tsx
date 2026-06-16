"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import Image from "next/image";

interface Slide {
  title: string;
  subtitle: string;
  image: string;
  alt: string;
}

const slides: Slide[] = [
  {
    title: "專業中式桌球枱",
    subtitle: "精選頂級桌球枱，枱布每月更換，確保最佳手感。",
    image: "/gallery/IMG_1511.jpg",
    alt: "248桌球會 - 專業中式桌球枱",
  },
  {
    title: "24小時全天候",
    subtitle: "凌晨三點，依然燈火通明，永遠為你而開。",
    image: "/gallery/IMG_1512.jpg",
    alt: "248桌球會 - 24小時營業環境",
  },
  {
    title: "掃碼即入場",
    subtitle: "預訂後即獲QR Code，到場掃碼，門自動打開。",
    image: "/gallery/IMG_1513.jpg",
    alt: "248桌球會 - 智能掃碼入場系統",
  },
  {
    title: "私人獨立空間",
    subtitle: "整個場地屬於你，無需等位，無需共用。",
    image: "/gallery/IMG_1514.jpg",
    alt: "248桌球會 - 私人獨立桌球室",
  },
  {
    title: "頂級燈光設備",
    subtitle: "台球專用燈具，照亮每個細節，清晰看見每一顆球。",
    image: "/gallery/IMG_1515.jpg",
    alt: "248桌球會 - 專業桌球燈光設備",
  },
];

const GAP = 28; // px between slides
const FONT_FAMILY =
  "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', Helvetica, Arial, sans-serif";

const TRACK_SPRING = { type: "spring", stiffness: 300, damping: 35 } as const;
const SLIDE_SPRING = { type: "spring", stiffness: 300, damping: 30 } as const;
const DOT_SPRING = { type: "spring", stiffness: 500, damping: 35 } as const;

export default function Gallery() {
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
        場地。逐一看。
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
            {/* Element A — Dots pill */}
            <div
              style={{
                height: "44px",
                background: "rgba(50,50,55,0.9)",
                backdropFilter: "blur(20px)",
                WebkitBackdropFilter: "blur(20px)",
                borderRadius: "100px",
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
                    aria-label={`前往第 ${i + 1} 張`}
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

            {/* Element B — Action button pill */}
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
              aria-label={ended ? "重播" : paused ? "播放" : "暫停"}
              style={{
                width: "44px",
                height: "44px",
                borderRadius: "50%",
                background: "rgba(50,50,55,0.9)",
                backdropFilter: "blur(20px)",
                WebkitBackdropFilter: "blur(20px)",
                marginLeft: "8px",
                color: "white",
                fontSize: "15px",
                border: "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              {ended ? "↺" : paused ? "▶" : "⏸"}
            </button>
      </div>
    </section>
  );
}
